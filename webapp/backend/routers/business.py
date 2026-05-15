"""
Business Factory router — proxies to elliebusiness.
The stub is already contract-compliant so this is a near-direct passthrough.
"""
import httpx
from fastapi import APIRouter, HTTPException
from core.config import get_settings

router = APIRouter(prefix="/business", tags=["business"])


def _headers() -> dict:
    settings = get_settings()
    h = {"Content-Type": "application/json"}
    if settings.elliebusiness_auth_token:
        h["Authorization"] = f"Bearer {settings.elliebusiness_auth_token}"
    return h


async def _get(path: str):
    settings = get_settings()
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{settings.elliebusiness_url}{path}", headers=_headers())
        resp.raise_for_status()
        return resp.json()


async def _post(path: str, body: dict = {}):
    settings = get_settings()
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(f"{settings.elliebusiness_url}{path}", json=body, headers=_headers())
        resp.raise_for_status()
        return resp.json()


@router.get("/status")
async def business_status():
    try:
        return await _get("/status")
    except Exception as e:
        return {
            "paused": False,
            "active_agents": None,
            "actions_today": None,
            "alerts": 0,
            "agents": [],
            "error": str(e),
        }


@router.get("/summary")
async def business_summary():
    try:
        return await _get("/summary")
    except Exception as e:
        return {
            "revenue": None,
            "recent_activity": [],
            "error": str(e),
        }


@router.get("/alerts")
async def business_alerts():
    try:
        return await _get("/alerts")
    except Exception as e:
        return {"alerts": [], "error": str(e)}


@router.post("/pause")
async def business_pause():
    try:
        return await _post("/pause")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/resume")
async def business_resume():
    try:
        return await _post("/resume")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
