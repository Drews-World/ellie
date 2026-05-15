from __future__ import annotations

from fastapi import APIRouter, Query

from agents.treasury.ledger import today_spend, today_spend_by_agent
from core.supabase_client import get_db

router = APIRouter(prefix="/treasury", tags=["treasury"])


@router.get("/spend")
def get_spend() -> dict:
    """Today's spend summary."""
    return {
        "today_usd": round(today_spend(), 4),
        "by_agent": today_spend_by_agent(),
    }


@router.get("/history")
def get_history(days: int = Query(7, ge=1, le=30)) -> dict:
    """Recent cost events."""
    try:
        db = get_db()
        from datetime import date, timedelta
        since = (date.today() - timedelta(days=days)).isoformat()
        rows = (
            db.table("cost_events")
            .select("*")
            .gte("occurred_at", f"{since}T00:00:00Z")
            .order("occurred_at", desc=True)
            .limit(200)
            .execute()
        )
        return {"events": rows.data or []}
    except Exception as e:
        return {"events": [], "error": str(e)}
