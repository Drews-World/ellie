from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel

from agents.archives.memory import record_feedback, get_pending_designs, count_pending

router = APIRouter(prefix="/archives", tags=["archives"])


class FeedbackBody(BaseModel):
    target_kind: str = "design"
    target_id: str
    verdict: str          # 'approve' | 'reject' | 'iterate'
    notes: str = ""
    drew_tags: list[str] = []


@router.post("/feedback")
def submit_feedback(body: FeedbackBody) -> dict:
    """Drew approves/rejects/iterates a design. Updates DB + signals Forge."""
    result = record_feedback(
        target_kind=body.target_kind,
        target_id=body.target_id,
        verdict=body.verdict,
        notes=body.notes,
        drew_tags=body.drew_tags,
    )
    return {"ok": True, "event": result}


@router.get("/pending")
def pending_designs(limit: int = Query(20, ge=1, le=50)) -> dict:
    """Designs waiting for Drew's review."""
    designs = get_pending_designs(limit=limit)
    return {"designs": designs, "count": count_pending()}
