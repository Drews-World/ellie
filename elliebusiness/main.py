"""
ELLIE Business — stub FastAPI service.

Implements the sub-system contract defined in ../ellie/SUBSYSTEM_CONTRACT.md.
All responses are mocked so ELLIE Hub has a target to talk to while real
agents are being built.

Run: uvicorn main:app --reload --port 8001
"""
from __future__ import annotations

import os
import time
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

VERSION = "0.0.1-stub"
STARTED_AT = time.time()
EXPECTED_TOKEN = os.environ.get("ELLIEBUSINESS_AUTH_TOKEN", "dev-token")

# In-memory state (resets on restart — fine for a stub)
_state = {
    "running": True,
    "paused": False,
    "paused_at": None,
    "paused_reason": None,
}

app = FastAPI(
    title="ELLIE Business",
    version=VERSION,
    description="Stub for the ELLIE business-agent crew. Conforms to ELLIE sub-system contract.",
)

# ELLIE Hub will hit this from the desktop app or a co-located service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Auth — single shared bearer token, same pattern ellietrading uses.
# ---------------------------------------------------------------------------
def require_auth(authorization: str | None = Header(default=None)) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    if token != EXPECTED_TOKEN:
        raise HTTPException(status_code=401, detail="Bad bearer token")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
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


class Summary(BaseModel):
    period: str
    headline: str
    wins: list[str]
    losses: list[str]
    decisions: list[str]
    next_steps: list[str]


class ActivityItem(BaseModel):
    ts: str
    kind: str
    summary: str


class Activity(BaseModel):
    items: list[ActivityItem]


class Alerts(BaseModel):
    items: list[dict]


class PauseBody(BaseModel):
    reason: str = "ELLIE Hub manual pause"
    by: str = "drew"


class Capability(BaseModel):
    name: str
    path: str
    description: str


class CapabilityMetric(BaseModel):
    key: str
    label: str
    unit: str


class Capabilities(BaseModel):
    actions: list[Capability]
    metrics: list[CapabilityMetric]


# ---------------------------------------------------------------------------
# Endpoints (all mocked)
# ---------------------------------------------------------------------------
@app.get("/health", response_model=Health)
def health() -> Health:
    """Cheap liveness — no auth (matches ellietrading)."""
    return Health(
        ok=True,
        uptime_seconds=time.time() - STARTED_AT,
        version=VERSION,
    )


@app.get("/status", response_model=Status, dependencies=[Depends(require_auth)])
def status() -> Status:
    headline = (
        "Forge sold 3 mugs, Nova flagged 2 trending designs."
        if _state["running"] and not _state["paused"]
        else "Paused — no agents running."
    )
    return Status(
        name="elliebusiness",
        running=_state["running"],
        paused=_state["paused"],
        headline=headline,
        metrics=[
            Metric(label="Revenue today", value="$47.21", trend="+$12 vs yesterday"),
            Metric(label="Active agents", value="0 / 5", trend="stub — none built yet"),
            Metric(label="Open orders", value="3", trend=None),
            Metric(label="Designs queued", value="12", trend=None),
        ],
        alerts=[],
        last_action_at=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/summary", response_model=Summary, dependencies=[Depends(require_auth)])
def summary(period: Literal["daily", "weekly"] = Query("daily")) -> Summary:
    if period == "daily":
        return Summary(
            period="daily",
            headline="Quiet day on the stub side. (No real agents yet — these numbers are fake.)",
            wins=["Mug listing #4421 sold 3 units"],
            losses=[],
            decisions=["(stub) Forge skipped 2 designs due to copyright risk"],
            next_steps=["Build Nova (research agent) first — see README"],
        )
    return Summary(
        period="weekly",
        headline="Stub week. $327 revenue, $0 ad spend, 4 designs published.",
        wins=["4 designs published", "$327 gross revenue (mocked)"],
        losses=["1 listing rejected by Etsy (mocked)"],
        decisions=["(stub) Doubled down on candle designs based on Nova research"],
        next_steps=["Replace stub data with real agents"],
    )


@app.get("/activity", response_model=Activity, dependencies=[Depends(require_auth)])
def activity(limit: int = Query(20, ge=1, le=100)) -> Activity:
    now = datetime.now(timezone.utc)
    fake = [
        ActivityItem(
            ts=(now - timedelta(minutes=15)).isoformat(),
            kind="sale",
            summary="Mug listing #4421 — sold 1 unit, $18.50 net",
        ),
        ActivityItem(
            ts=(now - timedelta(hours=2)).isoformat(),
            kind="design",
            summary="Forge generated 3 new candle designs (stub)",
        ),
        ActivityItem(
            ts=(now - timedelta(hours=6)).isoformat(),
            kind="research",
            summary="Nova report: 'minimalist mountain' theme trending +34% week-over-week (stub)",
        ),
    ]
    return Activity(items=fake[:limit])


@app.get("/alerts", response_model=Alerts, dependencies=[Depends(require_auth)])
def alerts() -> Alerts:
    return Alerts(items=[])


@app.post("/pause", dependencies=[Depends(require_auth)])
def pause(body: PauseBody) -> dict:
    _state["paused"] = True
    _state["paused_at"] = datetime.now(timezone.utc).isoformat()
    _state["paused_reason"] = body.reason
    return {"ok": True, "paused_at": _state["paused_at"]}


@app.post("/resume", dependencies=[Depends(require_auth)])
def resume(body: PauseBody) -> dict:
    _state["paused"] = False
    _state["paused_at"] = None
    _state["paused_reason"] = None
    return {"ok": True, "resumed_at": datetime.now(timezone.utc).isoformat()}


@app.get("/capabilities", response_model=Capabilities)
def capabilities() -> Capabilities:
    return Capabilities(
        actions=[
            Capability(name="pause", path="POST /pause", description="Pause all business agents"),
            Capability(name="resume", path="POST /resume", description="Resume business agents"),
        ],
        metrics=[
            CapabilityMetric(key="revenue_today", label="Revenue today", unit="USD"),
            CapabilityMetric(key="active_agents", label="Active agents", unit="count"),
            CapabilityMetric(key="open_orders", label="Open orders", unit="count"),
        ],
    )
