"""
Nova's Etsy scraper — read-only research.

Fetches top listings for a niche keyword, extracts signals:
- design concept
- price point
- tags used
- review count (proxy for sales velocity)

Respects Etsy ToS: read-only, rate-limited, no competitor store manipulation.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field

import httpx

from core.config import get_settings


@dataclass
class ListingSignal:
    listing_id: int
    title: str
    price_usd: float
    tags: list[str]
    review_count: int
    views: int
    url: str
    image_url: str = ""


def scrape_top_listings(niche: str, limit: int = 50) -> list[ListingSignal]:
    """
    Pull top listings for a niche from Etsy public API.
    Requires ETSY_API_KEY (no OAuth — read-only endpoint).
    Falls back to empty list if key is not set (so the app still boots).
    """
    s = get_settings()
    if not s.etsy_api_key:
        return []

    BASE = "https://openapi.etsy.com/v3"
    headers = {"x-api-key": s.etsy_api_key}
    params = {
        "keywords": niche,
        "limit": min(limit, 100),
        "sort_on": "score",
        "sort_order": "desc",
        "includes": ["MainImage"],
    }

    try:
        r = httpx.get(
            f"{BASE}/application/listings/active",
            headers=headers,
            params=params,
            timeout=15,
        )
        r.raise_for_status()
        results = r.json().get("results", [])
    except Exception:
        return []

    signals = []
    for item in results:
        image_url = ""
        if item.get("MainImage"):
            image_url = item["MainImage"].get("url_570xN", "")

        signals.append(ListingSignal(
            listing_id=item["listing_id"],
            title=item.get("title", ""),
            price_usd=float(item.get("price", {}).get("amount", 0)) / 100,
            tags=item.get("tags", []),
            review_count=item.get("num_favorers", 0),  # proxy — reviews not exposed
            views=item.get("views", 0),
            url=item.get("url", ""),
            image_url=image_url,
        ))

    return signals
