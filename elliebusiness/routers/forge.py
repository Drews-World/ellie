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


class ForgeRunBody(BaseModel):
    niche: str
    n_concepts: int = 5


@router.post("/run")
def trigger_run(body: ForgeRunBody, background_tasks: BackgroundTasks) -> dict:
    """Trigger a Forge design run for a niche (runs in background)."""
    def _run():
        results = run_forge(body.niche, n_concepts=body.n_concepts)
        _supervisor_state["last_forge_run"] = datetime.now(timezone.utc).isoformat()
        logger.info(f"Forge run complete for '{body.niche}': {len(results)} designs queued")

    background_tasks.add_task(_run)
    return {"ok": True, "message": f"Forge run started for '{body.niche}' ({body.n_concepts} concepts)"}


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
