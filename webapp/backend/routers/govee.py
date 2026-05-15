"""
Govee Smart Lighting API integration for ELLIE IoT control layer.

All Govee REST calls go through /iot/* endpoints so the API key stays
server-side and never touches the browser.

Endpoints
─────────
GET  /iot/devices          – list all Govee devices
POST /iot/lights/scene     – trigger a named scene (police, alert, speaking, idle, …)
POST /iot/lights/raw       – low-level: set color / brightness / power on a device
GET  /iot/lights/config    – read current user scene mapping from Supabase
PUT  /iot/lights/config    – save user scene mapping to Supabase

Scene presets (overrideable by user config)
───────────────────────────────────────────
police_alert  → red pulse   RGB(255,0,0), bright
threat_spike  → amber flash RGB(255,140,0), medium
speaking      → cyan pulse  RGB(0,180,255), soft
listening     → soft blue   RGB(0,100,220), dim
alert         → red steady  RGB(220,30,30), bright
idle          → user-defined ambient (default: deep blue RGB(0,30,80), dim)
"""

from fastapi import APIRouter, Depends, Body
import httpx
from core.config import get_settings
from core.auth import get_current_user
from supabase import create_client

router = APIRouter(prefix="/iot", tags=["iot"])

GOVEE_BASE = "https://developer-api.govee.com/v1"

# Default scene definitions
DEFAULT_SCENES = {
    "police_alert":  {"color": {"r": 255, "g": 0,   "b": 0  }, "brightness": 100, "effect": "pulse"},
    "threat_spike":  {"color": {"r": 255, "g": 140,  "b": 0  }, "brightness": 80,  "effect": "flash"},
    "speaking":      {"color": {"r": 0,   "g": 180,  "b": 255}, "brightness": 50,  "effect": "soft"},
    "listening":     {"color": {"r": 0,   "g": 100,  "b": 220}, "brightness": 30,  "effect": "steady"},
    "alert":         {"color": {"r": 220, "g": 30,   "b": 30 }, "brightness": 90,  "effect": "steady"},
    "thinking":      {"color": {"r": 120, "g": 160,  "b": 255}, "brightness": 40,  "effect": "breathe"},
    "idle":          {"color": {"r": 0,   "g": 30,   "b": 80 }, "brightness": 20,  "effect": "steady"},
}


def govee_headers(api_key: str) -> dict:
    return {
        "Govee-API-Key": api_key,
        "Content-Type":  "application/json",
    }


async def govee_get(path: str, api_key: str):
    async with httpx.AsyncClient(timeout=8) as client:
        r = await client.get(f"{GOVEE_BASE}{path}", headers=govee_headers(api_key))
        return r.status_code, r.json()


async def govee_put(path: str, body: dict, api_key: str):
    async with httpx.AsyncClient(timeout=8) as client:
        r = await client.put(f"{GOVEE_BASE}{path}", json=body, headers=govee_headers(api_key))
        return r.status_code, r.json()


# ── GET /iot/devices ──────────────────────────────────────────────────────────
@router.get("/devices")
async def list_devices(user=Depends(get_current_user)):
    settings = get_settings()
    api_key  = settings.govee_api_key
    if not api_key:
        return {"error": "Govee API key not configured", "devices": []}
    status, data = await govee_get("/devices", api_key)
    if status != 200:
        return {"error": f"Govee API returned {status}", "devices": []}
    devices = data.get("data", {}).get("devices", [])
    return {"count": len(devices), "devices": devices}


# ── POST /iot/lights/scene ────────────────────────────────────────────────────
@router.post("/lights/scene")
async def trigger_scene(
    payload: dict = Body(...),
    user=Depends(get_current_user),
):
    """
    Trigger a named lighting scene on all configured Govee devices.

    Body: { "scene": "police_alert" | "speaking" | "idle" | ... }
    """
    settings  = get_settings()
    api_key   = settings.govee_api_key
    scene_name = payload.get("scene", "idle")

    if not api_key:
        return {"error": "Govee API key not configured"}

    # Get user's custom config (if any) or fall back to defaults
    user_config = await _load_user_config(user.id, settings)
    scene = (user_config.get("scenes") or {}).get(scene_name) or DEFAULT_SCENES.get(scene_name)

    if not scene:
        return {"error": f"Unknown scene: {scene_name}"}

    # Get devices
    status, data = await govee_get("/devices", api_key)
    if status != 200:
        return {"error": f"Could not fetch devices: {status}"}

    devices = data.get("data", {}).get("devices", [])
    enabled_devices = (user_config.get("enabled_devices") or [d["device"] for d in devices])

    results = []
    for device in devices:
        if device["device"] not in enabled_devices:
            continue
        # Send color command
        color_body = {
            "device": device["device"],
            "model":  device["model"],
            "cmd": {
                "name": "color",
                "value": scene["color"],
            },
        }
        s, _ = await govee_put("/devices/control", color_body, api_key)
        results.append({"device": device["device"], "color_status": s})

        # Send brightness command
        bright_body = {
            "device": device["device"],
            "model":  device["model"],
            "cmd": {
                "name": "brightness",
                "value": scene["brightness"],
            },
        }
        await govee_put("/devices/control", bright_body, api_key)

        # Ensure power is on
        power_body = {
            "device": device["device"],
            "model":  device["model"],
            "cmd": {"name": "turn", "value": "on"},
        }
        await govee_put("/devices/control", power_body, api_key)

    return {"scene": scene_name, "devices_updated": len(results), "results": results}


# ── POST /iot/lights/raw ──────────────────────────────────────────────────────
@router.post("/lights/raw")
async def raw_control(
    payload: dict = Body(...),
    user=Depends(get_current_user),
):
    """
    Low-level: send any command to a specific Govee device.
    Body: { "device": "...", "model": "...", "cmd": { "name": "...", "value": ... } }
    """
    settings = get_settings()
    api_key  = settings.govee_api_key
    if not api_key:
        return {"error": "Govee API key not configured"}
    status, data = await govee_put("/devices/control", payload, api_key)
    return {"status": status, "response": data}


# ── GET /iot/lights/config ────────────────────────────────────────────────────
@router.get("/lights/config")
async def get_config(user=Depends(get_current_user)):
    settings = get_settings()
    config   = await _load_user_config(user.id, settings)
    return {
        "scenes":          config.get("scenes") or DEFAULT_SCENES,
        "enabled_devices": config.get("enabled_devices"),
        "iot_enabled":     config.get("iot_enabled", True),
        "defaults":        DEFAULT_SCENES,
    }


# ── PUT /iot/lights/config ────────────────────────────────────────────────────
@router.put("/lights/config")
async def save_config(
    payload: dict = Body(...),
    user=Depends(get_current_user),
):
    settings = get_settings()
    sb = create_client(settings.supabase_url, settings.supabase_service_key)
    # Upsert into a govee_config table (create if not exists via DB migration)
    sb.table("govee_config").upsert({
        "user_id": user.id,
        "config":  payload,
    }, on_conflict="user_id").execute()
    return {"saved": True}


# ── Helper ────────────────────────────────────────────────────────────────────
async def _load_user_config(user_id: str, settings) -> dict:
    try:
        sb = create_client(settings.supabase_url, settings.supabase_service_key)
        res = sb.table("govee_config").select("config").eq("user_id", user_id).single().execute()
        return res.data.get("config") or {}
    except Exception:
        return {}
