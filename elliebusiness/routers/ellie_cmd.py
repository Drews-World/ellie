"""
ELLIE command router — natural language pipeline orchestration.

POST /ellie/command   → parse instruction into a plan (no side effects)
POST /ellie/confirm   → approve plan and run pipeline in background
GET  /ellie/pipeline  → current pipeline progress
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Query
from pydantic import BaseModel

from agents.ELLIE.pipeline import parse_command, run_pipeline

router = APIRouter(prefix="/ellie", tags=["ellie"])
logger = logging.getLogger(__name__)

_pipeline_state: dict = {
    "running": False,
    "step": "idle",
    "detail": "",
    "pct": 0,
    "started_at": None,
    "finished_at": None,
    "last_result": None,
    "error": None,
}


class CommandBody(BaseModel):
    message: str


class ConfirmBody(BaseModel):
    plan: dict


@router.post("/command")
def interpret_command(body: CommandBody) -> dict:
    """Parse a natural language instruction.
    Returns {command_type: 'design', plan: {...}} or {command_type: 'strategy', report: {...}}.
    """
    plan = parse_command(body.message)
    command_type = plan.get("command_type", "design")

    if command_type == "strategy":
        # Run the Strategist inline (fast enough for a request — LLM call but no images)
        try:
            from agents.strategist.analyst import run_analysis
            report = run_analysis()
        except Exception as e:
            report = {"error": str(e), "summary": "Analysis failed.", "top_niches": [], "catalog_gaps": [], "proposed_runs": []}
        return {"command_type": "strategy", "understood_intent": plan.get("understood_intent", ""), "report": report}

    if command_type == "repurpose":
        # Query DB for approved designs matching the filter, then return a preview plan.
        # User sees exactly which designs will be repurposed before confirming.
        try:
            from agents.ELLIE.pipeline import fetch_approved_designs
            f = plan.get("filter", {})
            designs = fetch_approved_designs(
                niche_filter=f.get("niche"),
                limit=int(f.get("limit", 10)),
            )
        except Exception as e:
            designs = []
            logger.warning(f"Repurpose: design fetch failed: {e}")

        if not designs:
            niche_hint = plan.get("filter", {}).get("niche", "")
            niche_clause = f" for niche matching '{niche_hint}'" if niche_hint else ""
            plan["interpretation"] = (
                f"No approved designs found{niche_clause}. "
                "Approve some designs in Archives first, then try again."
            )
        else:
            plan["designs"] = designs
            count = len(designs)
            products = plan.get("new_products", [])
            plan["interpretation"] = (
                f"I found {count} approved design{'s' if count != 1 else ''} "
                f"— I'll create {', '.join(products)} product{'s' if len(products) != 1 else ''} "
                f"on Printify for each one. No new images will be generated."
            )
        return {"command_type": "repurpose", "plan": plan}

    if command_type == "explore":
        # Run Nova trend discovery inline — finds fresh niches from real Etsy data
        try:
            from agents.nova.researcher import run_trend_discovery
            n_niches = int(plan.get("n_niches", 7))
            discovery = run_trend_discovery(n_niches=n_niches)
        except Exception as e:
            discovery = {"opportunities": [], "error": str(e)}
        return {
            "command_type": "explore",
            "understood_intent": plan.get("understood_intent", "Scanning Etsy for trending niches"),
            "discovery": discovery,
        }

    return {"command_type": "design", "plan": plan}


@router.post("/confirm")
def confirm_and_run(body: ConfirmBody, background_tasks: BackgroundTasks) -> dict:
    """Execute an approved plan — runs Nova → Forge in background."""
    if _pipeline_state["running"]:
        return {"ok": False, "message": "Pipeline already running — wait for it to finish"}

    def _run() -> None:
        _pipeline_state.update({
            "running": True,
            "step": "starting",
            "detail": "ELLIE is spinning up the pipeline…",
            "pct": 0,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "finished_at": None,
            "error": None,
        })
        try:
            result = run_pipeline(
                body.plan,
                progress_cb=lambda s, d, p: _pipeline_state.update(
                    {"step": s, "detail": d, "pct": p}
                ),
            )
            _pipeline_state.update({
                "running": False,
                "step": "done",
                "detail": f"{result.get('designs_created', 0)} design(s) ready for your approval",
                "pct": 100,
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "last_result": result,
            })
        except Exception as e:
            _pipeline_state.update({
                "running": False,
                "step": "error",
                "detail": str(e),
                "pct": 0,
                "error": str(e),
                "finished_at": datetime.now(timezone.utc).isoformat(),
            })
            logger.error(f"Pipeline failed: {e}")

    background_tasks.add_task(_run)
    return {"ok": True, "message": "Pipeline started"}


@router.get("/pipeline")
def pipeline_status() -> dict:
    """Current pipeline progress."""
    return dict(_pipeline_state)


@router.get("/pipeline/runs")
def pipeline_runs(limit: int = Query(20, ge=1, le=100)) -> dict:
    """List of past pipeline runs, newest first."""
    try:
        from core.supabase_client import get_db
        rows = (
            get_db().table("pipeline_runs")
            .select("*")
            .order("started_at", desc=True)
            .limit(limit)
            .execute()
        )
        return {"runs": rows.data or []}
    except Exception as e:
        return {"runs": [], "error": str(e)}


@router.get("/pipeline/runs/{run_id}")
def pipeline_run_detail(run_id: str) -> dict:
    """A single run with its designs and activity log."""
    try:
        from core.supabase_client import get_db
        from core.activity import get_recent
        run_row = get_db().table("pipeline_runs").select("*").eq("id", run_id).limit(1).execute()
        designs = (
            get_db().table("designs")
            .select("id,concept_name,niche,image_url,forge_score,status,created_at")
            .eq("run_id", run_id)
            .order("created_at", desc=False)
            .execute()
        )
        activity = get_recent(limit=50, run_id=run_id)
        return {
            "run": run_row.data[0] if run_row.data else None,
            "designs": designs.data or [],
            "activity": activity,
        }
    except Exception as e:
        return {"run": None, "designs": [], "activity": [], "error": str(e)}


@router.post("/pipeline/runs/{run_id}/rerun")
def rerun_pipeline_run(run_id: str, background_tasks: BackgroundTasks) -> dict:
    """Re-run a past pipeline: reconstructs a plan from the stored niche/command."""
    if _pipeline_state["running"]:
        return {"ok": False, "message": "Pipeline already running — wait for it to finish"}
    try:
        from core.supabase_client import get_db
        row = get_db().table("pipeline_runs").select("*").eq("id", run_id).limit(1).execute()
        if not row.data:
            return {"ok": False, "message": "Run not found"}
        run = row.data[0]
    except Exception as e:
        return {"ok": False, "message": str(e)}

    niche_str = run.get("niche", "")
    niche_names = [n.strip() for n in niche_str.split(",") if n.strip()]
    plan = {
        "command_type": "design",
        "understood_intent": run.get("command") or f"Re-run: {niche_str}",
        "niches": [
            {
                "name": n,
                "description": n,
                "suggested_products": ["t-shirt", "mug", "tote bag"],
                "n_concepts": 3,
                "style_notes": "",
            }
            for n in (niche_names or ["general"])
        ],
    }

    def _run() -> None:
        _pipeline_state.update({
            "running": True, "step": "starting",
            "detail": f"Re-running: {niche_str}…",
            "pct": 0, "started_at": datetime.now(timezone.utc).isoformat(),
            "finished_at": None, "error": None,
        })
        try:
            result = run_pipeline(
                plan,
                progress_cb=lambda s, d, p: _pipeline_state.update({"step": s, "detail": d, "pct": p}),
            )
            _pipeline_state.update({
                "running": False, "step": "done",
                "detail": f"{result.get('designs_created', 0)} design(s) ready for your approval",
                "pct": 100, "finished_at": datetime.now(timezone.utc).isoformat(),
                "last_result": result,
            })
        except Exception as e:
            _pipeline_state.update({
                "running": False, "step": "error",
                "detail": str(e), "pct": 0, "error": str(e),
                "finished_at": datetime.now(timezone.utc).isoformat(),
            })

    background_tasks.add_task(_run)
    return {"ok": True, "message": f"Re-running pipeline for: {niche_str}"}
