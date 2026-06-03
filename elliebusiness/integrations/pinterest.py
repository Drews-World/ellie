"""
Pinterest integration — the Herald agent's posting client (API v5).

Drives external traffic to the Etsy shop: turn a published listing's mockup +
copy into a Pin that links back to the Etsy listing. Pinterest is the #1 search/
discovery channel for POD, so every active listing should have at least one Pin.

Env-gated, best-effort, mirrors integrations/printify.py:
- Nothing here runs without PINTEREST_ACCESS_TOKEN; is_configured() gates callers.
- Every function returns a plain dict and raises PinterestError on a hard API
  failure so the Herald agent can log-and-continue rather than crash a sweep.

Auth: a single OAuth2 user-access token (Bearer). Get one by registering an app
at https://developers.pinterest.com → OAuth → scopes boards:read, pins:read,
pins:write. Trial access can post to your own boards immediately; public-scale
posting needs Pinterest's standard-access app review.
"""
from __future__ import annotations

import logging

import httpx

from core.config import get_settings

logger = logging.getLogger("ellie.business.pinterest")

TIMEOUT = 30


class PinterestError(Exception):
    """Raised on a non-2xx Pinterest API response."""

    def __init__(self, status: int, detail: str):
        self.status = status
        self.detail = detail
        super().__init__(f"Pinterest API {status}: {detail}")


def is_configured() -> bool:
    """True when a Pinterest access token is present."""
    return bool(get_settings().pinterest_access_token)


def _headers() -> dict:
    s = get_settings()
    return {
        "Authorization": f"Bearer {s.pinterest_access_token}",
        "Content-Type": "application/json",
    }


def _base() -> str:
    return get_settings().pinterest_base_url.rstrip("/")


def _request(method: str, path: str, *, json: dict | None = None, params: dict | None = None) -> dict:
    if not is_configured():
        raise PinterestError(401, "PINTEREST_ACCESS_TOKEN not set — Pinterest is dormant")
    url = f"{_base()}{path}"
    with httpx.Client(timeout=TIMEOUT) as client:
        resp = client.request(method, url, headers=_headers(), json=json, params=params)
        if resp.status_code >= 400:
            raise PinterestError(resp.status_code, resp.text[:600])
        return resp.json() if resp.content else {}


# ── Boards ────────────────────────────────────────────────────────────────────

def list_boards(page_size: int = 100) -> list[dict]:
    """Return the account's boards as [{id, name, description}, ...]."""
    data = _request("GET", "/boards", params={"page_size": page_size})
    return [
        {"id": b.get("id"), "name": b.get("name"), "description": b.get("description", "")}
        for b in data.get("items", [])
    ]


def create_board(name: str, description: str = "") -> dict:
    """Create a board. Returns {id, name}."""
    data = _request("POST", "/boards", json={"name": name, "description": description})
    return {"id": data.get("id"), "name": data.get("name")}


# ── Pins ──────────────────────────────────────────────────────────────────────

def create_pin(
    board_id: str,
    image_url: str,
    title: str,
    description: str,
    link: str,
    alt_text: str = "",
) -> dict:
    """Create an image Pin that links back to `link` (the Etsy listing).

    `image_url` must be a publicly reachable image — our design images are public
    Supabase Storage URLs, which Pinterest fetches directly.
    """
    body = {
        "board_id": board_id,
        "title": title[:100],
        "description": description[:800],
        "link": link,
        "alt_text": (alt_text or title)[:500],
        "media_source": {"source_type": "image_url", "url": image_url},
    }
    data = _request("POST", "/pins", json=body)
    return {"id": data.get("id"), "url": f"https://www.pinterest.com/pin/{data.get('id')}"}
