"""
Archives — Drew's feedback memory system.

Stores approve/reject/iterate decisions so Forge and Nova learn Drew's taste.
Forge consults this before generating; weight toward approved patterns.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from core.supabase_client import get_db

logger = logging.getLogger(__name__)


def record_feedback(
    target_kind: str,       # 'design' | 'listing' | 'concept'
    target_id: str,
    verdict: str,           # 'approve' | 'reject' | 'iterate'
    notes: str = "",
    drew_tags: list[str] | None = None,
) -> dict:
    """Write Drew's feedback to the DB. Called by the Hub UI."""
    db = get_db()
    row = {
        "target_kind": target_kind,
        "target_id": target_id,
        "verdict": verdict,
        "notes": notes,
        "drew_tags": drew_tags or [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = db.table("feedback_events").insert(row).execute()

    # If it's a design verdict, update the design's status too
    if target_kind == "design":
        status_map = {
            "approve": "approved",
            "reject": "rejected",
            "iterate": "needs_revision",
        }
        db.table("designs").update({"drew_verdict": verdict, "status": status_map.get(verdict, verdict)}).eq("id", target_id).execute()

    return result.data[0] if result.data else row


def get_pending_designs(limit: int = 20) -> list[dict]:
    """Return designs awaiting Drew's review, newest first."""
    try:
        db = get_db()
        result = (
            db.table("designs")
            .select("*")
            .eq("status", "pending_drew_review")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []
    except Exception as e:
        logger.warning(f"Archives: DB read failed: {e}")
        return []


def count_pending() -> int:
    """Quick count of pending designs for the Hub status card."""
    return len(get_pending_designs(limit=100))


def get_approved_designs(niche: str | None = None, limit: int = 10) -> list[dict]:
    """Approved designs — used by Forge to understand Drew's taste."""
    try:
        db = get_db()
        q = db.table("designs").select("*").eq("drew_verdict", "approve").order("created_at", desc=True)
        if niche:
            q = q.eq("niche", niche)
        return q.limit(limit).execute().data or []
    except Exception:
        return []
