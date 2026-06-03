"""
Promotion router — Herald posts Etsy listings to Pinterest for discovery traffic.

GET  /promote/status          → coverage + config (read path for dashboard/chat)
GET  /promote/boards          → Pinterest boards on the connected account
POST /promote/listing/{id}    → promote one listing now (manual, always allowed)
POST /promote/run             → sweep un-promoted active listings (manual trigger)
"""
from __future__ import annotations

from fastapi import APIRouter

from agents.herald import promoter
from integrations import pinterest

router = APIRouter(prefix="/promote", tags=["promote"])


@router.get("/status")
def status() -> dict:
    """Promotion coverage (promoted vs pending) and Pinterest config state."""
    return promoter.promotion_status()


@router.get("/boards")
def boards() -> dict:
    """List Pinterest boards on the connected account (empty if not configured)."""
    if not pinterest.is_configured():
        return {"configured": False, "boards": []}
    try:
        return {"configured": True, "boards": pinterest.list_boards()}
    except Exception as e:  # noqa: BLE001
        return {"configured": True, "boards": [], "error": str(e)}


@router.post("/listing/{listing_id}")
def promote_one(listing_id: str, force: bool = False) -> dict:
    """Post a single listing to Pinterest now (manual / ELLIE-initiated)."""
    return promoter.promote_listing(listing_id, force=force)


@router.post("/run")
def run(limit: int = 10) -> dict:
    """Sweep un-promoted active listings and post each (manual trigger)."""
    return promoter.promote_pending(limit=limit)
