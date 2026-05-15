from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Query
from pydantic import BaseModel

from agents.forge.designer import run_forge
from agents.ELLIE.supervisor import _supervisor_state
from core.supabase_client import get_db

router = APIRouter(prefix="/forge", tags=["forge"])
logger = logging.getLogger(__name__)

# ── In-memory progress tracker ────────────────────────────────────────────────
_forge_progress: dict = {
    "running": False,
    "step": "idle",
    "detail": "",
    "pct": 0,
    "started_at": None,
    "finished_at": None,
    "error": None,
}


def _set_progress(step: str, detail: str, pct: int) -> None:
    _forge_progress.update({"step": step, "detail": detail, "pct": pct, "error": None})


class ForgeRunBody(BaseModel):
    niche: str
    n_concepts: int = 5


@router.post("/run")
def trigger_run(body: ForgeRunBody, background_tasks: BackgroundTasks) -> dict:
    """Trigger a Forge design run for a niche (runs in background)."""
    if _forge_progress["running"]:
        return {"ok": False, "message": "Forge is already running"}

    def _run():
        _forge_progress.update({
            "running": True,
            "step": "starting",
            "detail": f"Starting run for '{body.niche}'",
            "pct": 0,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "finished_at": None,
            "error": None,
        })
        try:
            results = run_forge(
                body.niche,
                n_concepts=body.n_concepts,
                progress_cb=_set_progress,
            )
            _supervisor_state["last_forge_run"] = datetime.now(timezone.utc).isoformat()
            _forge_progress.update({
                "running": False,
                "step": "done" if results else "done_empty",
                "detail": f"{len(results)} design(s) saved to review queue" if results else "Run finished but 0 designs passed scoring — check elliebusiness logs",
                "pct": 100,
                "finished_at": datetime.now(timezone.utc).isoformat(),
            })
            logger.info(f"Forge run complete for '{body.niche}': {len(results)} designs queued")
        except Exception as e:
            _forge_progress.update({
                "running": False,
                "step": "error",
                "detail": str(e),
                "pct": 0,
                "error": str(e),
                "finished_at": datetime.now(timezone.utc).isoformat(),
            })
            logger.error(f"Forge run failed: {e}")

    background_tasks.add_task(_run)
    return {"ok": True, "message": f"Forge run started for '{body.niche}'"}


@router.get("/progress")
def get_progress() -> dict:
    """Current progress of a running (or last completed) Forge run."""
    return dict(_forge_progress)


@router.get("/queue")
def get_queue(limit: int = Query(20, ge=1, le=50)) -> dict:
    """Return designs currently in Drew's review queue."""
    try:
        db = get_db()
        rows = (
            db.table("designs")
            .select("*")
            .eq("status", "pending_drew_review")
            .order("forge_score", desc=True)
            .limit(limit)
            .execute()
        )
        return {"designs": rows.data or [], "count": len(rows.data or [])}
    except Exception as e:
        return {"designs": [], "count": 0, "error": str(e)}


@router.get("/listings")
def get_listings(limit: int = Query(20, ge=1, le=50)) -> dict:
    """Return all Etsy listings."""
    try:
        db = get_db()
        rows = (
            db.table("listings")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return {"listings": rows.data or []}
    except Exception as e:
        return {"listings": [], "error": str(e)}
