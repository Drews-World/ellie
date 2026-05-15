from __future__ import annotations

import logging
from fastapi import APIRouter, BackgroundTasks, Query
from pydantic import BaseModel

from agents.archives.memory import record_feedback, get_pending_designs, count_pending

router = APIRouter(prefix="/archives", tags=["archives"])
logger = logging.getLogger(__name__)


class FeedbackBody(BaseModel):
    target_kind: str = "design"
    target_id: str
    verdict: str          # 'approve' | 'reject' | 'iterate'
    notes: str = ""
    drew_tags: list[str] = []


def _maybe_publish(design_id: str) -> None:
    try:
        from integrations.printify import approve_and_publish
        result = approve_and_publish(design_id)
        logger.info(f"Archives: publish result for {design_id}: {result}")
    except Exception as e:
        logger.error(f"Archives: approve_and_publish failed for {design_id}: {e}")


@router.post("/feedback")
def submit_feedback(body: FeedbackBody, background_tasks: BackgroundTasks) -> dict:
    """Drew approves/rejects/iterates a design. Updates DB + triggers publish on approve."""
    result = record_feedback(
        target_kind=body.target_kind,
        target_id=body.target_id,
        verdict=body.verdict,
        notes=body.notes,
        drew_tags=body.drew_tags,
    )
    if body.target_kind == "design" and body.verdict == "approve":
        background_tasks.add_task(_maybe_publish, body.target_id)
    return {"ok": True, "event": result}


@router.get("/pending")
def pending_designs(limit: int = Query(20, ge=1, le=50)) -> dict:
    """Designs waiting for Drew's review."""
    designs = get_pending_designs(limit=limit)
    return {"designs": designs, "count": count_pending()}
