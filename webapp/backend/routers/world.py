from fastapi import APIRouter, Query
from typing import List
import httpx
from services.world_service import (
    fetch_news, fetch_markets, fetch_crypto,
    fetch_weather, fetch_sports, fetch_threat_matrix,
    fetch_zone_intel,
)

router = APIRouter(tags=["world"])


@router.get("/news")
async def get_news(category: str = "general"):
    return await fetch_news(category)


@router.get("/markets")
async def get_markets():
    return await fetch_markets()


@router.get("/markets/crypto")
async def get_crypto():
    return await fetch_crypto()


@router.get("/weather")
async def get_weather(
    cities: str = Query(default="Seattle,New York,London,Tokyo"),
):
    city_list = [c.strip() for c in cities.split(",")]
    return await fetch_weather(city_list)


@router.get("/sports")
async def get_sports(
    leagues: str = Query(default="nba,nfl,mlb"),
):
    league_list = [l.strip() for l in leagues.split(",")]
    return await fetch_sports(league_list)


@router.get("/threat-matrix")
async def get_threat_matrix():
    return await fetch_threat_matrix()


@router.get("/zone-intel")
async def get_zone_intel(
    zone_id:   str = Query(..., description="Unique zone identifier, e.g. 'ukraine'"),
    zone_name: str = Query(..., description="Human-readable zone name"),
    keywords:  str = Query(..., description="Comma-separated search keywords"),
):
    """Fetch real-time news + Claude threat assessment for a specific globe zone."""
    kw_list = [k.strip() for k in keywords.split(",") if k.strip()]
    if not kw_list:
        return {"error": "No keywords provided"}
    return await fetch_zone_intel(zone_id, zone_name, kw_list)


# ── Live flights ─────────────────────────────────────────────────────────────
# Primary: adsb.lol (free community ADS-B, no key required)
# Fallback: OpenSky Network anonymous API
@router.get("/flights")
async def get_flights(
    lat:  float = Query(default=47.6),
    lon:  float = Query(default=-122.3),
    dist: int   = Query(default=150),    # nautical miles radius
):
    flights = []
    source  = "none"

    async with httpx.AsyncClient(timeout=12) as client:
        # ── Primary: adsb.lol ────────────────────────────────────────────────
        try:
            r = await client.get(
                f"https://api.adsb.lol/v2/lat/{lat}/{lon}/dist/{dist}",
                headers={"Accept": "application/json"},
            )
            if r.status_code == 200:
                data = r.json()
                aircraft = data.get("ac") or []
                for a in aircraft:
                    alt_baro = a.get("alt_baro")
                    if alt_baro == "ground" or alt_baro is None:
                        alt_m    = None
                        on_ground = True
                    else:
                        try:
                            alt_m    = float(alt_baro) / 3.28084   # ft → meters
                            on_ground = False
                        except (TypeError, ValueError):
                            alt_m    = None
                            on_ground = True

                    gs = a.get("gs")   # knots
                    try:
                        vel_ms = float(gs) / 1.944 if gs is not None else None
                    except (TypeError, ValueError):
                        vel_ms = None

                    flights.append({
                        "icao":      a.get("hex", ""),
                        "callsign":  (a.get("flight") or a.get("hex") or "").strip(),
                        "country":   a.get("r", ""),    # registration tail number
                        "lat":       a.get("lat"),
                        "lng":       a.get("lon"),
                        "altitude":  alt_m,
                        "on_ground": on_ground,
                        "velocity":  vel_ms,
                        "heading":   a.get("track"),
                        "vertical":  a.get("baro_rate"),
                        "squawk":    a.get("squawk"),
                    })
                source = "adsb.lol"
        except Exception:
            pass   # fall through to OpenSky

        # ── Fallback: OpenSky Network ────────────────────────────────────────
        if not flights:
            try:
                # Convert radius to a rough bounding box
                dlat = dist / 60.0
                dlon = dist / (60.0 * abs(round(lat) or 1))
                params = {
                    "lamin": lat - dlat, "lomin": lon - dlon,
                    "lamax": lat + dlat, "lomax": lon + dlon,
                }
                r = await client.get("https://opensky-network.org/api/states/all", params=params)
                if r.status_code == 200:
                    data = r.json()
                    for s in (data.get("states") or []):
                        if s[5] is None or s[6] is None:
                            continue
                        flights.append({
                            "icao":      s[0],
                            "callsign":  (s[1] or "").strip() or s[0],
                            "country":   s[2],
                            "lng":       s[5],
                            "lat":       s[6],
                            "altitude":  s[7],
                            "on_ground": s[8],
                            "velocity":  s[9],
                            "heading":   s[10],
                            "vertical":  s[11],
                            "squawk":    s[14],
                        })
                    source = "opensky"
            except Exception:
                pass

    # Filter out entries with no lat/lng
    flights = [f for f in flights if f.get("lat") is not None and f.get("lng") is not None]

    return {"source": source, "count": len(flights), "flights": flights}


# ── Police / fire dispatch (Seattle Open Data — free, no key) ────────────────
@router.get("/dispatch")
async def get_dispatch(limit: int = Query(default=40)):
    # Seattle Police Department — Call Data (Socrata dataset 33kz-ixgy)
    url = "https://data.seattle.gov/resource/33kz-ixgy.json"
    params = {
        "$limit": limit,
        "$order": "cad_event_original_time_queued DESC",
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(url, params=params, headers={"Accept": "application/json"})
            if r.status_code != 200:
                return {"error": f"API returned {r.status_code}", "incidents": []}
            incidents = r.json()
    except Exception as e:
        return {"error": str(e), "incidents": []}

    if not isinstance(incidents, list):
        return {"error": "Unexpected API response format", "incidents": []}

    cleaned = []
    for inc in incidents:
        # Skip if latitude is missing or redacted
        lat_raw = inc.get("dispatch_latitude")
        lng_raw = inc.get("dispatch_longitude")

        try:
            lat = float(lat_raw) if lat_raw and lat_raw != "REDACTED" else None
            lng = float(lng_raw) if lng_raw and lng_raw != "REDACTED" else None
        except (ValueError, TypeError):
            lat, lng = None, None

        # Build sector + beat display strings
        sector = inc.get("dispatch_precinct", "") or inc.get("dispatch_sector", "")
        beat   = inc.get("dispatch_beat", "")

        cleaned.append({
            "id":       inc.get("cad_event_number", ""),
            "type":     inc.get("initial_call_type") or inc.get("final_call_type") or inc.get("cad_event_clearance_description", "UNKNOWN"),
            "group":    inc.get("event_group", ""),
            "sector":   sector,
            "beat":     beat,
            "queued":   inc.get("cad_event_original_time_queued", ""),
            "at_scene": inc.get("cad_event_arrived_time", ""),
            "priority": inc.get("priority", ""),
            "neighborhood": inc.get("dispatch_neighborhood", ""),
            "lat":      lat,
            "lng":      lng,
        })

    return {"count": len(cleaned), "incidents": cleaned}
