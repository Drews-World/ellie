"""
ELLIE command router — natural language pipeline orchestration.

POST /ellie/command   → parse instruction into a plan (no side effects)
POST /ellie/confirm   → approve plan and run pipeline in background
GET  /ellie/pipeline  → current pipeline progress
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks
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
