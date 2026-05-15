"""
Nova — research agent.

Daily job: for each active niche, scrapes Etsy top listings,
extracts trending concepts via LLM, writes to the `trends` table.
Also surfaces strong new concepts to Drew via Hub activity feed.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from core.llm import complete
from core.supabase_client import get_db
from .scrapers.etsy import scrape_top_listings, ListingSignal

logger = logging.getLogger(__name__)

# Default niches to research until Drew configures them
DEFAULT_NICHES = [
    "minimalist mountain mug",
    "funny cat coffee mug",
    "motivational quote poster",
    "aesthetic candle label",
]

RESEARCH_SYSTEM = """You are Nova, the research agent for an Etsy print-on-demand business.
Analyze Etsy listing data and extract actionable trend insights for the design team.
Always respond with valid JSON."""

RESEARCH_PROMPT = """Analyze these top Etsy listings for the niche: "{niche}"

Listings:
{listings_json}

Extract:
1. Top 3 trending design concepts (specific, actionable)
2. Common price range (what sells)
3. Tag patterns (which tags appear most)
4. Design style themes (minimalist, bold, retro, etc.)
5. One-line recommendation for our designer

Respond with JSON:
{{
  "concepts": ["concept 1", "concept 2", "concept 3"],
  "price_range": {{"low": 12.0, "high": 28.0, "sweet_spot": 18.0}},
  "top_tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "style_themes": ["minimalist", "bold"],
  "recommendation": "one sentence for the designer"
}}"""


def _listings_to_json(signals: list[ListingSignal]) -> str:
    data = [
        {
            "title": s.title,
            "price": s.price_usd,
            "tags": s.tags[:8],
            "favorites": s.review_count,
            "views": s.views,
        }
        for s in signals[:30]  # cap tokens
    ]
    return json.dumps(data, indent=2)


def run_research(niche: str) -> dict | None:
    """
    Run a full research pass for one niche.
    Returns the trend dict or None if nothing actionable found.
    """
    logger.info(f"Nova: researching niche='{niche}'")

    signals = scrape_top_listings(niche, limit=50)
    if len(signals) < 5:
        logger.warning(f"Nova: too few listings for '{niche}' ({len(signals)}), skipping")
        return None

    prompt = RESEARCH_PROMPT.format(
        niche=niche,
        listings_json=_listings_to_json(signals),
    )

    try:
        raw = complete(prompt, system=RESEARCH_SYSTEM, fast=True, json_mode=True)
        analysis = json.loads(raw)
    except Exception as e:
        logger.error(f"Nova: LLM failed for '{niche}': {e}")
        return None

    trend = {
        "niche": niche,
        "source": "etsy-top-listings",
        "concept": analysis.get("recommendation", ""),
        "evidence": analysis,
        "observed_at": datetime.now(timezone.utc).isoformat(),
    }

    # Persist to Supabase if available
    try:
        db = get_db()
        db.table("trends").insert(trend).execute()
    except Exception as e:
        logger.warning(f"Nova: DB write failed (Supabase not configured?): {e}")

    return trend


def run_all_niches(niches: list[str] | None = None) -> list[dict]:
    """Run research for all niches. Called by scheduler at 6am UTC."""
    targets = niches or DEFAULT_NICHES
    results = []
    for niche in targets:
        result = run_research(niche)
        if result:
            results.append(result)
    logger.info(f"Nova: completed {len(results)}/{len(targets)} niches")
    return results
