from __future__ import annotations

import logging
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, Query
from pydantic import BaseModel

from agents.archives.memory import record_feedback, get_pending_designs, count_pending

router = APIRouter(prefix="/archives", tags=["archives"])
logger = logging.getLogger(__name__)

# In-process publish progress — one slot (publish runs are sequential per process)
_publish_state: dict = {
    "running": False,
    "design_id": None,
    "design_name": None,
    "step": "idle",       # idle | uploading | creating | done | error
    "current_product": None,
    "products_done": 0,
    "products_total": 0,
    "drafts_created": 0,
    "error": None,
    "finished_at": None,
}


class FeedbackBody(BaseModel):
    target_kind: str = "design"
    target_id: str
    verdict: str          # 'approve' | 'reject' | 'iterate'
    notes: str = ""
    drew_tags: list[str] = []


def _maybe_publish(design_id: str, design_name: str) -> None:
    _publish_state.update({
        "running": True,
        "design_id": design_id,
        "design_name": design_name,
        "step": "uploading",
        "current_product": None,
        "products_done": 0,
        "products_total": 0,
        "drafts_created": 0,
        "error": None,
        "finished_at": None,
    })
    try:
        from integrations.printify import approve_and_publish
        result = approve_and_publish(design_id, progress_cb=_publish_progress_cb)
        drafts = len(result.get("drafts", []))
        _publish_state.update({
            "running": False,
            "step": "done",
            "drafts_created": drafts,
            "finished_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Archives: published {design_id} → {drafts} drafts on Printify")
        try:
            from core.activity import log as alog
            alog("archives", "design_published",
                 f"Published '{design_name}' to Printify: {drafts} draft(s) created",
                 metadata={"design_id": design_id, "drafts": drafts})
        except Exception:
            pass
    except Exception as e:
        _publish_state.update({
            "running": False,
            "step": "error",
            "error": str(e),
            "finished_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.error(f"Archives: approve_and_publish failed for {design_id}: {e}")
        try:
            from core.activity import log as alog
            alog("archives", "error", f"Publish failed for '{design_name}': {e}",
                 metadata={"design_id": design_id})
        except Exception:
            pass


def _publish_progress_cb(step: str, current_product: str, products_done: int, products_total: int) -> None:
    _publish_state.update({
        "step": step,
        "current_product": current_product,
        "products_done": products_done,
        "products_total": products_total,
    })


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
        design_name = result.get("concept_name") or body.target_id[:8]
        background_tasks.add_task(_maybe_publish, body.target_id, design_name)
    return {"ok": True, "event": result}


@router.get("/publish_progress")
def publish_progress() -> dict:
    """Current Printify publish progress for the most recent approval."""
    return dict(_publish_state)


@router.get("/pending")
def pending_designs(limit: int = Query(20, ge=1, le=50)) -> dict:
    """Designs waiting for Drew's review."""
    designs = get_pending_designs(limit=limit)
    return {"designs": designs, "count": count_pending()}


@router.post("/publish_all")
def publish_all_approved(background_tasks: BackgroundTasks) -> dict:
    """Publish all approved-but-unpublished designs to Printify."""
    from agents.archives.memory import get_approved_designs
    from core.activity import log as alog
    designs = get_approved_designs(limit=50)
    publishable = [d for d in designs if d.get("status") == "approved"]
    if not publishable:
        return {"ok": False, "message": "No approved designs to publish"}
    alog("archives", "publish_all_started", f"Publishing all approved: {len(publishable)} design(s)")
    for d in publishable:
        background_tasks.add_task(_maybe_publish, d["id"], d.get("concept_name", ""))
    return {"ok": True, "queued": len(publishable), "message": f"Queued {len(publishable)} design(s) for Printify"}
