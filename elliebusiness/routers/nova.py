from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Query

from agents.nova.researcher import run_all_niches, run_research
from agents.nova.ai_news import generate_digest
from agents.ELLIE.supervisor import _supervisor_state
from core.supabase_client import get_db

router = APIRouter(prefix="/nova", tags=["nova"])
logger = logging.getLogger(__name__)


@router.post("/run")
def trigger_run(background_tasks: BackgroundTasks, niche: str | None = Query(None)) -> dict:
    """Trigger a Nova research pass (runs in background)."""
    def _run():
        niches = [niche] if niche else None
        results = run_all_niches(niches)
        _supervisor_state["last_nova_run"] = datetime.now(timezone.utc).isoformat()
        logger.info(f"Nova background run complete: {len(results)} niches")

    background_tasks.add_task(_run)
    return {"ok": True, "message": "Nova research pass started in background"}


@router.get("/trends")
def get_trends(niche: str | None = Query(None), limit: int = Query(10, ge=1, le=50)) -> dict:
    """Get latest trend reports from DB."""
    try:
        db = get_db()
        q = db.table("trends").select("*").order("observed_at", desc=True)
        if niche:
            q = q.eq("niche", niche)
        rows = q.limit(limit).execute()
        return {"trends": rows.data or []}
    except Exception as e:
        return {"trends": [], "error": str(e)}


@router.get("/news")
def get_news() -> dict:
    """Get this week's AI news digest."""
    try:
        digest = generate_digest()
        return {"digest": digest, "generated_at": datetime.now(timezone.utc).isoformat()}
    except Exception as e:
        return {"digest": "Unavailable", "error": str(e)}
