"""
Nova's Etsy research scraper — three-tier fallback:
  1. Etsy public API (requires approved API key)
  2. Etsy web scrape via __NEXT_DATA__ JSON (no key needed)
  3. LLM market research (always works — uses model's knowledge of the niche)
"""
from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass, field

import httpx

from core.config import get_settings

logger = logging.getLogger(__name__)


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


# ── Tier 1: Etsy public API ───────────────────────────────────────────────────

def _parse_price(price_obj: dict) -> float:
    """Convert Etsy price object → float USD."""
    amount = float(price_obj.get("amount", 0))
    divisor = float(price_obj.get("divisor", 100)) or 100
    return amount / divisor


def _api_scrape(niche: str, limit: int) -> list[ListingSignal]:
    s = get_settings()
    if not s.etsy_api_key:
        return []
    headers = {"x-api-key": f"{s.etsy_api_key}:{s.etsy_shared_secret}"}
    if s.etsy_access_token:
        headers["Authorization"] = f"Bearer {s.etsy_access_token}"
    try:
        r = httpx.get(
            "https://api.etsy.com/v3/application/listings/active",
            headers=headers,
            params={
                "keywords": niche,
                "limit": min(limit, 100),
                "sort_on": "score",
                "sort_order": "desc",
            },
            timeout=20,
        )
        if r.status_code != 200:
            logger.warning(f"Nova: Etsy API {r.status_code} — {r.text[:300]}")
            r.raise_for_status()
        data = r.json()
        results = data.get("results", [])
        signals = []
        for item in results:
            price_obj = item.get("price") or {}
            signals.append(ListingSignal(
                listing_id=int(item.get("listing_id", 0)),
                title=item.get("title", ""),
                price_usd=_parse_price(price_obj),
                tags=item.get("tags") or [],
                review_count=int(item.get("num_favorers", 0)),
                views=int(item.get("views", 0)),
                url=item.get("url", ""),
            ))
        logger.info(f"Nova: Etsy API returned {len(signals)} listings for '{niche}'")
        return signals
    except Exception as e:
        logger.warning(f"Nova: Etsy API scrape failed: {e}")
        return []


# ── Tier 2: Etsy web scrape ───────────────────────────────────────────────────

def _web_scrape(niche: str, limit: int) -> list[ListingSignal]:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    try:
        r = httpx.get(
            "https://www.etsy.com/search",
            headers=headers,
            params={"q": niche, "explicit": "1", "order": "most_relevant"},
            timeout=20,
            follow_redirects=True,
        )
        r.raise_for_status()
    except Exception as e:
        logger.debug(f"Nova: web fetch failed: {e}")
        return []

    # Extract __NEXT_DATA__ JSON embedded in the page
    match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', r.text, re.S)
    if not match:
        logger.debug("Nova: __NEXT_DATA__ not found in Etsy page")
        return []

    try:
        page_data = json.loads(match.group(1))
    except Exception:
        return []

    # Walk the nested structure to find listing results
    def dig(obj, *keys):
        for k in keys:
            if not isinstance(obj, dict):
                return None
            obj = obj.get(k)
        return obj

    # Try common locations Etsy has used
    results = (
        dig(page_data, "props", "pageProps", "prefetchedQueries") or
        dig(page_data, "props", "pageProps", "initialData", "searchResults", "hits") or
        []
    )

    # If prefetchedQueries, dig further
    if isinstance(results, list) and results and isinstance(results[0], dict) and "data" in results[0]:
        for q in results:
            hits = dig(q, "data", "listingsV2", "results") or dig(q, "data", "hits")
            if hits:
                results = hits
                break

    if not isinstance(results, list) or not results:
        logger.debug("Nova: could not locate listings in __NEXT_DATA__")
        return []

    signals = []
    for item in results[:limit]:
        if not isinstance(item, dict):
            continue
        title = item.get("title") or item.get("listing", {}).get("title", "")
        price_raw = (
            item.get("price", {}).get("amount")
            or item.get("listing", {}).get("price", {}).get("amount", 0)
        )
        signals.append(ListingSignal(
            listing_id=int(item.get("listingId") or item.get("listing_id") or 0),
            title=str(title),
            price_usd=float(price_raw or 0) / 100 if float(price_raw or 0) > 100 else float(price_raw or 0),
            tags=item.get("tags") or [],
            review_count=int(item.get("numFavorers") or item.get("num_favorers") or 0),
            views=int(item.get("views") or 0),
            url=item.get("url") or "",
        ))

    logger.info(f"Nova: web scrape got {len(signals)} listings for '{niche}'")
    return signals


# ── Tier 3: LLM market research ───────────────────────────────────────────────

def _llm_research(niche: str, n: int = 20) -> list[ListingSignal]:
    """Generate realistic market signals using LLM knowledge of the niche."""
    from core.llm import complete

    prompt = f"""Generate {n} realistic Etsy listing examples for the niche: "{niche}"

Use your knowledge of what actually sells well on Etsy — real-feeling titles, accurate price points, relevant tags.

Respond with JSON only:
{{
  "listings": [
    {{
      "title": "Mountain Sunrise Minimalist Mug — Nature Coffee Cup Hiker Gift",
      "price_usd": 18.99,
      "tags": ["mountain mug", "minimalist mug", "nature gift", "hiker gift", "coffee lover"],
      "review_count": 234
    }}
  ]
}}"""

    try:
        from core.llm import complete
        raw = complete(prompt, system="You are a market research assistant. Always respond with valid JSON.", fast=True)
        raw = raw.strip()
        fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
        if fenced:
            raw = fenced.group(1).strip()
        data = json.loads(raw)
        listings = data.get("listings", [])
        signals = []
        for i, item in enumerate(listings[:n]):
            signals.append(ListingSignal(
                listing_id=i + 1,
                title=item.get("title", ""),
                price_usd=float(item.get("price_usd", 18.0)),
                tags=item.get("tags", []),
                review_count=int(item.get("review_count", 0)),
                views=0,
                url="",
            ))
        logger.info(f"Nova: LLM generated {len(signals)} market signals for '{niche}'")
        return signals
    except Exception as e:
        logger.error(f"Nova: LLM research failed: {e}")
        return []


# ── Public interface ──────────────────────────────────────────────────────────

def scrape_top_listings(niche: str, limit: int = 50) -> list[ListingSignal]:
    """
    Pull top listings for a niche using the best available source.
    Tier 1: Etsy API (if approved key present)
    Tier 2: Etsy web scrape (no key needed)
    Tier 3: LLM market research (always works)
    """
    signals = _api_scrape(niche, limit)
    if len(signals) >= 5:
        logger.info(f"Nova: API returned {len(signals)} listings for '{niche}'")
        return signals

    signals = _web_scrape(niche, limit)
    if len(signals) >= 5:
        return signals

    logger.info(f"Nova: falling back to LLM research for '{niche}'")
    return _llm_research(niche, n=20)
