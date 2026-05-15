"""
Trading Floor router — proxies to ellietrading and adapts its
shape to the SUBSYSTEM_CONTRACT.
"""
import httpx
from fastapi import APIRouter, HTTPException
from core.config import get_settings

router = APIRouter(prefix="/trading", tags=["trading"])


def _headers() -> dict:
    settings = get_settings()
    h = {"Content-Type": "application/json"}
    if settings.ellietrading_auth_token:
        h["Authorization"] = f"Bearer {settings.ellietrading_auth_token}"
    return h


async def _get(path: str):
    settings = get_settings()
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{settings.ellietrading_url}{path}", headers=_headers())
        resp.raise_for_status()
        return resp.json()


async def _post(path: str, body: dict = {}):
    settings = get_settings()
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(f"{settings.ellietrading_url}{path}", json=body, headers=_headers())
        resp.raise_for_status()
        return resp.json()


@router.get("/status")
async def trading_status():
    """Adapt ellietrading to the contract /status shape."""
    try:
        data = await _get("/status")
        return {
            "paused": data.get("paused", False),
            "open_positions": data.get("open_positions", data.get("positions_count", 0)),
            "alerts": data.get("alerts", 0),
            "uptime_seconds": data.get("uptime_seconds", 0),
            "capabilities": data.get("capabilities", ["trading"]),
        }
    except Exception as e:
        return {
            "paused": False,
            "open_positions": None,
            "alerts": 0,
            "uptime_seconds": 0,
            "capabilities": [],
            "error": str(e),
        }


@router.get("/summary")
async def trading_summary():
    """Return P&L, account value, positions list, recent activity."""
    try:
        data = await _get("/summary")
        # Normalize field names across ellietrading versions
        return {
            "account_value": data.get("account_value", data.get("equity")),
            "today_pnl": data.get("today_pnl", data.get("daily_pnl")),
            "today_pnl_pct": data.get("today_pnl_pct", data.get("daily_pnl_pct")),
            "positions": data.get("positions", []),
            "recent_activity": data.get("recent_activity", data.get("activity", [])),
        }
    except Exception as e:
        return {
            "account_value": None,
            "today_pnl": None,
            "today_pnl_pct": None,
            "positions": [],
            "recent_activity": [],
            "error": str(e),
        }


@router.get("/alerts")
async def trading_alerts():
    try:
        return await _get("/alerts")
    except Exception as e:
        return {"alerts": [], "error": str(e)}


@router.post("/pause")
async def trading_pause():
    try:
        return await _post("/pause")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/resume")
async def trading_resume():
    try:
        return await _post("/resume")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
