"""
Activity logging — writes events to the activity_log table.

All agents call activity.log(...) so the Activity tab has real data.
Best-effort: failures are logged but never raised to callers.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def log(
    agent: str,
    event_type: str,
    message: str,
    metadata: dict | None = None,
    run_id: str | None = None,
) -> None:
    """Persist an activity event. Silent on failure."""
    try:
        from core.supabase_client import get_db
        get_db().table("activity_log").insert({
            "agent":      agent,
            "event_type": event_type,
            "message":    message,
            "metadata":   metadata or {},
            "run_id":     str(run_id) if run_id else None,
        }).execute()
    except Exception as e:
        logger.debug(f"activity.log write failed (non-fatal): {e}")

    # Also push to supervisor in-memory notifications for immediate /status visibility
    try:
        from agents.ELLIE.supervisor import _notify
        _notify(message)
    except Exception:
        pass


def get_recent(limit: int = 40, run_id: str | None = None) -> list[dict]:
    """Fetch recent activity events, optionally filtered by run_id."""
    try:
        from core.supabase_client import get_db
        q = (
            get_db().table("activity_log")
            .select("id, agent, event_type, message, metadata, run_id, occurred_at")
            .order("occurred_at", desc=True)
            .limit(limit)
        )
        if run_id:
            q = q.eq("run_id", str(run_id))
        return q.execute().data or []
    except Exception as e:
        logger.warning(f"activity.get_recent failed: {e}")
        return []
