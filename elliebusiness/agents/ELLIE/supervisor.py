"""
ELLIE — the supervisor. Runs every hour via APScheduler.

Responsibilities:
- Check each agent's last-run timestamp; kick idle ones
- Watch Archives backlog; notify Drew if it grows too large
- Watch Treasury; pause all agents if daily spend limit is hit
- Write a supervisor snapshot consumed by /status
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import httpx

from agents.archives.memory import count_pending
from agents.treasury.ledger import is_over_limit, today_spend, today_spend_by_agent
from agents.nova.researcher import run_all_niches
from core.supabase_client import get_db
from core.config import get_settings

logger = logging.getLogger(__name__)


def _discord(message: str) -> None:
    """Fire-and-forget Discord notification. Never raises."""
    url = get_settings().discord_webhook_url
    if not url:
        return
    try:
        httpx.post(url, json={"content": message}, timeout=5)
    except Exception:
        pass

# How long an agent can be idle before ELLIE warns
IDLE_THRESHOLDS = {
    "nova": timedelta(hours=25),    # should run daily
    "forge": timedelta(hours=49),   # should run every 2 days (Drew-gated)
}

# In-memory state (resets on restart — replace with DB for persistence)
_supervisor_state: dict = {
    "running": True,
    "paused": False,
    "paused_at": None,
    "paused_reason": None,
    "last_nova_run": None,
    "last_forge_run": None,
    "notifications": [],   # pending notifications to surface in Hub
}


def get_state() -> dict:
    return _supervisor_state


def pause_all(reason: str = "ELLIE supervisor", by: str = "ellie") -> None:
    _supervisor_state["paused"] = True
    _supervisor_state["paused_at"] = datetime.now(timezone.utc).isoformat()
    _supervisor_state["paused_reason"] = reason
    logger.warning(f"ELLIE: paused all agents. Reason: {reason}")


def resume_all() -> None:
    _supervisor_state["paused"] = False
    _supervisor_state["paused_at"] = None
    _supervisor_state["paused_reason"] = None
    logger.info("ELLIE: resumed all agents")


def _notify(message: str, discord: bool = False) -> None:
    """Queue a notification for Hub. Only pings Discord when discord=True."""
    _supervisor_state["notifications"].append({
        "ts": datetime.now(timezone.utc).isoformat(),
        "message": message,
    })
    _supervisor_state["notifications"] = _supervisor_state["notifications"][-20:]
    logger.info(f"ELLIE notification: {message}")
    if discord:
        _discord(f"**ELLIE** · {message}")


def hourly_check() -> None:
    """Main supervisor loop — called every hour by APScheduler."""
    logger.info("ELLIE: running hourly check")

    if _supervisor_state["paused"]:
        logger.info("ELLIE: agents paused, skipping checks")
        return

    # 1. Cost limit check
    if is_over_limit():
        pause_all(reason=f"Daily spend limit hit (${today_spend():.2f})")
        _notify(f"⚠️ Cost limit hit: ${today_spend():.2f} today. Crew paused — check Treasury.", discord=True)
        return

    # 2. Archives backlog — hub only, no Discord spam
    pending = count_pending()
    if pending > 20:
        _notify(f"📬 Archives backlog: {pending} designs waiting for your review.")

    # 3. Agent idle checks — hub only, no Discord spam
    now = datetime.now(timezone.utc)
    for agent, threshold in IDLE_THRESHOLDS.items():
        last_run_key = f"last_{agent}_run"
        last_run = _supervisor_state.get(last_run_key)
        if last_run is None:
            continue
        if isinstance(last_run, str):
            last_run = datetime.fromisoformat(last_run)
        if now - last_run > threshold:
            _notify(f"⏰ {agent.title()} hasn't run in {(now - last_run).total_seconds() / 3600:.0f}h. Check logs.")

    logger.info("ELLIE: hourly check complete")


def build_status_snapshot() -> dict:
    """Build the snapshot consumed by /status endpoint."""
    state = _supervisor_state
    spend = today_spend()
    by_agent = today_spend_by_agent()
    pending_designs = count_pending()

    return {
        "running": state["running"],
        "paused": state["paused"],
        "paused_reason": state.get("paused_reason"),
        "pending_designs": pending_designs,
        "spend_today_usd": round(spend, 2),
        "spend_by_agent": by_agent,
        "notifications": state.get("notifications", []),
        "last_nova_run": state.get("last_nova_run"),
        "last_forge_run": state.get("last_forge_run"),
    }
