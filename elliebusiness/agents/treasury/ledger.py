"""
Treasury — cost tracking ledger.

Every LLM call, image gen, and Printify fulfillment is logged here.
ELLIE checks daily spend against limits and pauses agents if exceeded.
"""
from __future__ import annotations

import logging
from datetime import datetime, date, timezone
from typing import Literal

from core.supabase_client import get_db
from core.config import get_settings

logger = logging.getLogger(__name__)

AgentName = Literal["forge", "nova", "ellie", "archives"]
ServiceName = Literal["openrouter", "gemini", "openai", "printify", "etsy", "supabase"]
CostKind = Literal["llm", "image-gen", "fulfillment", "fee", "ad-spend"]


def log_cost(
    service: ServiceName,
    agent: AgentName,
    kind: CostKind,
    cost_usd: float,
    detail: dict | None = None,
) -> None:
    """Record a cost event. Best-effort — never raises."""
    try:
        db = get_db()
        db.table("cost_events").insert({
            "service": service,
            "agent": agent,
            "kind": kind,
            "cost_usd": cost_usd,
            "detail": detail or {},
            "occurred_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        logger.warning(f"Treasury: failed to log cost ({service}/{agent}/{kind} ${cost_usd:.4f}): {e}")


def today_spend() -> float:
    """Total spend today across all services."""
    try:
        db = get_db()
        today = date.today().isoformat()
        rows = (
            db.table("cost_events")
            .select("cost_usd")
            .gte("occurred_at", f"{today}T00:00:00Z")
            .execute()
        )
        return sum(r["cost_usd"] for r in (rows.data or []))
    except Exception:
        return 0.0


def today_spend_by_agent() -> dict[str, float]:
    """Breakdown of today's spend per agent."""
    try:
        db = get_db()
        today = date.today().isoformat()
        rows = (
            db.table("cost_events")
            .select("agent,cost_usd")
            .gte("occurred_at", f"{today}T00:00:00Z")
            .execute()
        )
        totals: dict[str, float] = {}
        for r in (rows.data or []):
            totals[r["agent"]] = totals.get(r["agent"], 0.0) + r["cost_usd"]
        return totals
    except Exception:
        return {}


def is_over_limit() -> bool:
    s = get_settings()
    total = today_spend()
    limit = s.daily_llm_spend_limit_usd + s.daily_image_spend_limit_usd
    return total >= limit
