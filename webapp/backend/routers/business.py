"""
Business Factory router — proxies all requests to elliebusiness (:8001).
"""
from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException, Request
from core.config import get_settings

router = APIRouter(prefix="/business", tags=["business"])

TIMEOUT = 30  # seconds — forge runs can take a bit


def _headers() -> dict:
    settings = get_settings()
    h = {"Content-Type": "application/json"}
    if settings.elliebusiness_auth_token:
        h["Authorization"] = f"Bearer {settings.elliebusiness_auth_token}"
    return h


def _base() -> str:
    return get_settings().elliebusiness_url


async def _get(path: str, params: dict | None = None):
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(f"{_base()}{path}", headers=_headers(), params=params or {})
        resp.raise_for_status()
        return resp.json()


async def _post(path: str, body: dict | None = None):
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(f"{_base()}{path}", json=body or {}, headers=_headers())
        resp.raise_for_status()
        return resp.json()


# ── Sub-system contract ───────────────────────────────────────────────────────

@router.get("/health")
async def business_health():
    try:
        return await _get("/health")
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.get("/status")
async def business_status():
    try:
        return await _get("/status")
    except Exception as e:
        return {"paused": False, "active_agents": 0, "actions_today": 0, "alerts": [], "agents": [], "error": str(e)}


@router.get("/summary")
async def business_summary(period: str = "daily"):
    try:
        return await _get("/summary", params={"period": period})
    except Exception as e:
        return {"revenue": 0.0, "recent_activity": [], "agents": [], "error": str(e)}


@router.get("/activity")
async def business_activity(limit: int = 40):
    try:
        return await _get("/activity", params={"limit": limit})
    except Exception as e:
        return {"items": [], "error": str(e)}


@router.get("/alerts")
async def business_alerts():
    try:
        return await _get("/alerts")
    except Exception as e:
        return {"items": [], "error": str(e)}


@router.post("/pause")
async def business_pause(request: Request):
    try:
        body = await request.json() if request.headers.get("content-length", "0") != "0" else {}
        return await _post("/pause", body)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/resume")
async def business_resume(request: Request):
    try:
        body = await request.json() if request.headers.get("content-length", "0") != "0" else {}
        return await _post("/resume", body)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/capabilities")
async def business_capabilities():
    try:
        return await _get("/capabilities")
    except Exception as e:
        return {"actions": [], "metrics": [], "error": str(e)}


# ── Nova ──────────────────────────────────────────────────────────────────────

@router.post("/nova/run")
async def nova_run(niche: str | None = None):
    try:
        params = {"niche": niche} if niche else {}
        return await _post("/nova/run", params)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/nova/trends")
async def nova_trends(niche: str | None = None, limit: int = 10):
    try:
        return await _get("/nova/trends", params={"niche": niche, "limit": limit} if niche else {"limit": limit})
    except Exception as e:
        return {"trends": [], "error": str(e)}


@router.get("/nova/news")
async def nova_news():
    try:
        return await _get("/nova/news")
    except Exception as e:
        return {"digest": "Unavailable", "error": str(e)}


# ── Forge ─────────────────────────────────────────────────────────────────────

@router.post("/forge/run")
async def forge_run(request: Request):
    try:
        body = await request.json()
        return await _post("/forge/run", body)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/forge/queue")
async def forge_queue(limit: int = 20):
    try:
        return await _get("/forge/queue", params={"limit": limit})
    except Exception as e:
        return {"designs": [], "count": 0, "error": str(e)}


@router.get("/forge/listings")
async def forge_listings(limit: int = 20):
    try:
        return await _get("/forge/listings", params={"limit": limit})
    except Exception as e:
        return {"listings": [], "error": str(e)}


# ── Archives ──────────────────────────────────────────────────────────────────

@router.get("/archives/pending")
async def archives_pending(limit: int = 20):
    try:
        return await _get("/archives/pending", params={"limit": limit})
    except Exception as e:
        return {"designs": [], "count": 0, "error": str(e)}


@router.post("/archives/feedback")
async def archives_feedback(request: Request):
    try:
        body = await request.json()
        return await _post("/archives/feedback", body)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ── Treasury ──────────────────────────────────────────────────────────────────

@router.get("/treasury/spend")
async def treasury_spend():
    try:
        return await _get("/treasury/spend")
    except Exception as e:
        return {"today_usd": 0.0, "by_agent": {}, "error": str(e)}


@router.get("/treasury/history")
async def treasury_history(days: int = 7):
    try:
        return await _get("/treasury/history", params={"days": days})
    except Exception as e:
        return {"events": [], "error": str(e)}
