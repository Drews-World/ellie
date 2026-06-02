"""
Etsy API v3 client.

Read-only (Nova research): uses API keystring only — no OAuth needed.
Write operations (Forge listings): requires OAuth access token.

Docs: https://developers.etsy.com/documentation/
"""
from __future__ import annotations

from typing import Any

import httpx

from core.config import get_settings

BASE = "https://openapi.etsy.com/v3"


def _headers(write: bool = False) -> dict[str, str]:
    s = get_settings()
    if not s.etsy_api_key:
        raise RuntimeError("ETSY_API_KEY not set.")
    if not s.etsy_shared_secret:
        raise RuntimeError("ETSY_SHARED_SECRET not set — Etsy requires x-api-key as 'keystring:shared_secret'.")
    # Etsy expects the x-api-key header as "keystring:shared_secret", not the
    # keystring alone. Sending only the keystring returns a misleading
    # "Shared secret is required in x-api-key header." 403.
    h = {"x-api-key": f"{s.etsy_api_key}:{s.etsy_shared_secret}"}
    if write:
        if not s.etsy_access_token:
            raise RuntimeError("ETSY_ACCESS_TOKEN not set — complete OAuth flow first.")
        h["Authorization"] = f"Bearer {s.etsy_access_token}"
    return h


# ── Read-only (Nova) ──────────────────────────────────────────────────────────

def search_listings(keywords: str, limit: int = 50, sort_on: str = "score") -> list[dict]:
    """Search active listings by keyword. No auth required."""
    s = get_settings()
    params = {
        "keywords": keywords,
        "limit": limit,
        "sort_on": sort_on,
        "sort_order": "desc",
        "includes": ["MainImage"],
    }
    r = httpx.get(f"{BASE}/application/listings/active", headers=_headers(), params=params, timeout=15)
    r.raise_for_status()
    return r.json().get("results", [])


def get_listing(listing_id: int) -> dict:
    r = httpx.get(f"{BASE}/application/listings/{listing_id}", headers=_headers(), timeout=10)
    r.raise_for_status()
    return r.json()


# ── Write (Forge) ─────────────────────────────────────────────────────────────

def create_draft_listing(
    title: str,
    description: str,
    price_usd: float,
    tags: list[str],
    quantity: int = 999,
    who_made: str = "i_did",
    when_made: str = "made_to_order",
    taxonomy_id: int = 1,          # default: Art & Collectibles
) -> dict:
    """Create a draft listing on Etsy. Returns the listing object."""
    s = get_settings()
    if not s.etsy_shop_id:
        raise RuntimeError("ETSY_SHOP_ID not set.")

    payload = {
        "title": title,
        "description": description,
        "price": price_usd,
        "quantity": quantity,
        "who_made": who_made,
        "when_made": when_made,
        "taxonomy_id": taxonomy_id,
        "tags": tags[:13],   # Etsy max 13 tags
        "state": "draft",
    }
    r = httpx.post(
        f"{BASE}/application/shops/{s.etsy_shop_id}/listings",
        headers=_headers(write=True),
        json=payload,
        timeout=15,
    )
    r.raise_for_status()
    return r.json()


def publish_listing(listing_id: int) -> dict:
    """Flip a draft listing to active."""
    s = get_settings()
    r = httpx.patch(
        f"{BASE}/application/shops/{s.etsy_shop_id}/listings/{listing_id}",
        headers=_headers(write=True),
        json={"state": "active"},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()


def upload_listing_image(listing_id: int, image_bytes: bytes, rank: int = 1) -> dict:
    s = get_settings()
    r = httpx.post(
        f"{BASE}/application/shops/{s.etsy_shop_id}/listings/{listing_id}/images",
        headers=_headers(write=True),
        files={"image": ("design.png", image_bytes, "image/png")},
        data={"rank": rank},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()
