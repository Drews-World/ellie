"""
ELLIE Business — FastAPI service for the agent crew.

Implements the sub-system contract defined in ../SUBSYSTEM_CONTRACT.md.
All integrations are env-var-gated; the app starts cleanly with no keys.

Run: uvicorn main:app --reload --port 8001
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings
from core.scheduler import scheduler
from agents.nova.researcher import run_all_niches
from agents.ELLIE.supervisor import hourly_check
from routers import status, nova, forge, archives, treasury, ellie_cmd, strategy, products

from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
def require_auth(authorization: str | None = Header(default=None)) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    if token != get_settings().auth_token:
        raise HTTPException(status_code=401, detail="Bad bearer token")


# ---------------------------------------------------------------------------
# Lifespan — scheduler jobs
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(run_all_niches, CronTrigger(hour=6, minute=0), id="nova_daily")
    scheduler.add_job(hourly_check, IntervalTrigger(hours=1), id="ellie_hourly")
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="ELLIE Business",
    version="0.1.0",
    description="ELLIE business-agent crew. Conforms to ELLIE sub-system contract.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "https://ellie.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inject auth dependency on everything except /health and /capabilities
auth_dep = [Depends(require_auth)]

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(status.router)          # /health /status /summary /activity /alerts /pause /resume /capabilities
app.include_router(nova.router)            # /nova/*
app.include_router(forge.router)           # /forge/*
app.include_router(archives.router)        # /archives/*
app.include_router(treasury.router)        # /treasury/*
app.include_router(ellie_cmd.router)       # /ellie/command /ellie/confirm /ellie/pipeline
app.include_router(strategy.router)        # /strategy/report /strategy/latest
app.include_router(products.router)        # /products/catalog /products/designs /products/generate_copy /products/create_draft
