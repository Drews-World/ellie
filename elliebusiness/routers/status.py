"""
Sub-system contract endpoints: /health /status /summary /activity /alerts /pause /resume /capabilities
"""
from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from agents.ELLIE.supervisor import get_state, pause_all, resume_all, build_status_snapshot
from agents.archives.memory import count_pending
from agents.treasury.ledger import today_spend

STARTED_AT = time.time()
VERSION = "0.1.0"

router = APIRouter()


# ── Models ────────────────────────────────────────────────────────────────────

class Health(BaseModel):
    ok: bool
    uptime_seconds: float
    version: str


class Metric(BaseModel):
    label: str
    value: str
    trend: str | None = None


class Status(BaseModel):
    name: str
    running: bool
    paused: bool
    headline: str
    metrics: list[Metric]
    alerts: list[dict]
    last_action_at: str
    # Extra fields for Hub BusinessFactory room
    active_agents: int
    actions_today: int
    revenue: float


class Summary(BaseModel):
    period: str
    headline: str
    wins: list[str]
    losses: list[str]
    decisions: list[str]
    next_steps: list[str]
    recent_activity: list[str]
    account_value: float | None = None


class ActivityItem(BaseModel):
    ts: str
    kind: str
    summary: str
    agent: str = ""


class Activity(BaseModel):
    items: list[ActivityItem]


class PauseBody(BaseModel):
    reason: str = "ELLIE Hub manual pause"
    by: str = "drew"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/health", response_model=Health)
def health() -> Health:
    return Health(ok=True, uptime_seconds=time.time() - STARTED_AT, version=VERSION)


@router.get("/status", response_model=Status)
def status() -> Status:
    snapshot = build_status_snapshot()
    state = get_state()
    pending = snapshot["pending_designs"]
    spend = snapshot["spend_today_usd"]

    alerts = []
    if pending > 20:
        alerts.append({"severity": "info", "msg": f"{pending} designs awaiting review"})
    if state.get("paused"):
        alerts.append({"severity": "warn", "msg": f"Paused: {state.get('paused_reason', '')}"})

    headline = (
        f"{pending} designs pending review · ${spend:.2f} spent today"
        if not state["paused"]
        else f"Paused — {state.get('paused_reason', 'manual pause')}"
    )

    return Status(
        name="elliebusiness",
        running=state["running"],
        paused=state["paused"],
        headline=headline,
        metrics=[
            Metric(label="Designs pending review", value=str(pending)),
            Metric(label="Spend today", value=f"${spend:.2f}"),
        ],
        alerts=alerts,
        last_action_at=datetime.now(timezone.utc).isoformat(),
        active_agents=0,   # Updated when real agents run
        actions_today=0,
        revenue=0.0,       # Updated when Etsy orders sync
    )


@router.get("/summary")
def summary(period: Literal["daily", "weekly"] = Query("daily")) -> dict:
    snapshot = build_status_snapshot()
    notifications = [n["message"] for n in snapshot.get("notifications", [])]

    return {
        "period": period,
        "headline": f"${snapshot['spend_today_usd']:.2f} spent · {snapshot['pending_designs']} designs queued",
        "wins": [],
        "losses": [],
        "decisions": [],
        "next_steps": ["Add API keys to .env to activate agents"],
        "recent_activity": notifications[-8:],
        "revenue": 0.0,
        "agents": [
            {"name": "ELLIE", "status": "running" if not snapshot["paused"] else "paused"},
            {"name": "Forge", "status": "idle"},
            {"name": "Nova", "status": "idle"},
            {"name": "Archives", "status": "idle"},
            {"name": "Treasury", "status": "idle"},
        ],
    }


@router.get("/activity", response_model=Activity)
def activity(limit: int = Query(40, ge=1, le=200)) -> Activity:
    from core.activity import get_recent
    rows = get_recent(limit=limit)
    if rows:
        items = [
            ActivityItem(
                ts=r.get("occurred_at", ""),
                kind=r.get("event_type", "info"),
                summary=r.get("message", ""),
                agent=r.get("agent", ""),
            )
            for r in rows
        ]
    else:
        # Fallback to in-memory notifications if DB not yet populated
        snapshot = build_status_snapshot()
        items = [
            ActivityItem(ts=n["ts"], kind="notification", summary=n["message"], agent="ellie")
            for n in snapshot.get("notifications", [])[-limit:]
        ]
    return Activity(items=items)


@router.get("/alerts")
def alerts() -> dict:
    snapshot = build_status_snapshot()
    state = get_state()
    items = []
    if snapshot["pending_designs"] > 20:
        items.append({"id": "backlog", "severity": "info", "msg": f"{snapshot['pending_designs']} designs need review"})
    if state.get("paused"):
        items.append({"id": "paused", "severity": "warn", "msg": f"Paused: {state.get('paused_reason')}"})
    return {"items": items}


@router.post("/pause")
def pause(body: PauseBody) -> dict:
    pause_all(reason=body.reason, by=body.by)
    return {"ok": True, "paused_at": datetime.now(timezone.utc).isoformat()}


@router.post("/resume")
def resume(body: PauseBody) -> dict:
    resume_all()
    return {"ok": True, "resumed_at": datetime.now(timezone.utc).isoformat()}


@router.get("/capabilities")
def capabilities() -> dict:
    return {
        "actions": [
            {"name": "pause", "path": "POST /pause", "description": "Pause all business agents"},
            {"name": "resume", "path": "POST /resume", "description": "Resume business agents"},
            {"name": "forge_run", "path": "POST /forge/run", "description": "Trigger a Forge design run"},
            {"name": "nova_run", "path": "POST /nova/run", "description": "Trigger a Nova research pass"},
        ],
        "metrics": [
            {"key": "revenue_today", "label": "Revenue today", "unit": "USD"},
            {"key": "designs_pending", "label": "Designs pending review", "unit": "count"},
            {"key": "spend_today", "label": "Spend today", "unit": "USD"},
        ],
    }
