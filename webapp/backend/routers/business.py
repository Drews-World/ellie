"""
Business Factory router — proxies all requests to elliebusiness (:8001).
"""
from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException, Request
from core.config import get_settings

router = APIRouter(prefix="/business", tags=["business"])

TIMEOUT = 120  # seconds — LLM calls (ELLIE command, strategy) can take 60-90s


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

@router.get("")
@router.get("/")
async def business_root():
    return {"ok": True, "service": "business"}


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


# ── ELLIE command ─────────────────────────────────────────────────────────────

@router.post("/ellie/command")
async def ellie_command(request: Request):
    try:
        body = await request.json()
        return await _post("/ellie/command", body)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/ellie/confirm")
async def ellie_confirm(request: Request):
    try:
        body = await request.json()
        return await _post("/ellie/confirm", body)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/ellie/pipeline")
async def ellie_pipeline():
    try:
        return await _get("/ellie/pipeline")
    except Exception as e:
        return {"running": False, "step": "idle", "detail": "", "pct": 0, "error": str(e)}


@router.get("/ellie/pipeline/runs")
async def ellie_pipeline_runs(limit: int = 20):
    try:
        return await _get("/ellie/pipeline/runs", params={"limit": limit})
    except Exception as e:
        return {"runs": [], "error": str(e)}


@router.get("/ellie/pipeline/runs/{run_id}")
async def ellie_pipeline_run_detail(run_id: str):
    try:
        return await _get(f"/ellie/pipeline/runs/{run_id}")
    except Exception as e:
        return {"run": None, "designs": [], "activity": [], "error": str(e)}


@router.post("/ellie/pipeline/runs/{run_id}/rerun")
async def ellie_pipeline_rerun(run_id: str):
    try:
        return await _post(f"/ellie/pipeline/runs/{run_id}/rerun")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ── Strategy ─────────────────────────────────────────────────────────────────

@router.get("/strategy/report")
async def strategy_report():
    try:
        return await _get("/strategy/report")
    except Exception as e:
        return {"error": str(e), "summary": "Report unavailable.", "top_niches": [], "catalog_gaps": [], "proposed_runs": []}


@router.get("/strategy/latest")
async def strategy_latest():
    try:
        return await _get("/strategy/latest")
    except Exception as e:
        return {"summary": "No report available.", "top_niches": [], "catalog_gaps": [], "proposed_runs": []}


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


@router.get("/forge/progress")
async def forge_progress():
    try:
        return await _get("/forge/progress")
    except Exception as e:
        return {"running": False, "step": "idle", "detail": "", "pct": 0, "error": str(e)}


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


@router.get("/archives/publish_progress")
async def archives_publish_progress():
    try:
        return await _get("/archives/publish_progress")
    except Exception as e:
        return {"running": False, "step": "idle", "error": str(e)}


@router.post("/archives/publish_all")
async def archives_publish_all():
    try:
        return await _post("/archives/publish_all")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/archives/feedback")
async def archives_feedback(request: Request):
    try:
        body = await request.json()
        return await _post("/archives/feedback", body)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ── Product Maker ─────────────────────────────────────────────────────────────

@router.get("/products/catalog")
async def products_catalog():
    try:
        return await _get("/products/catalog")
    except Exception as e:
        return {"products": [], "error": str(e)}


@router.get("/products/designs")
async def products_designs(limit: int = 40):
    try:
        return await _get("/products/designs", params={"limit": limit})
    except Exception as e:
        return {"designs": [], "error": str(e)}


@router.post("/products/generate_copy")
async def products_generate_copy(request: Request):
    try:
        body = await request.json()
        return await _post("/products/generate_copy", body)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/products/create_draft")
async def products_create_draft(request: Request):
    try:
        body = await request.json()
        return await _post("/products/create_draft", body)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ── Promote (Herald → Pinterest) ──────────────────────────────────────────────

@router.get("/promote/status")
async def promote_status():
    try:
        return await _get("/promote/status")
    except Exception as e:
        return {"configured": False, "promoted": 0, "unpromoted": 0, "error": str(e)}


@router.get("/promote/boards")
async def promote_boards():
    try:
        return await _get("/promote/boards")
    except Exception as e:
        return {"configured": False, "boards": [], "error": str(e)}


@router.post("/promote/listing/{listing_id}")
async def promote_listing(listing_id: str, force: bool = False):
    # force/limit are query params on the elliebusiness side; bake into the path.
    try:
        return await _post(f"/promote/listing/{listing_id}?force={str(force).lower()}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/promote/run")
async def promote_run(limit: int = 10):
    try:
        return await _post(f"/promote/run?limit={limit}")
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
