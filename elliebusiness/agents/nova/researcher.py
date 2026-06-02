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

from core.config import get_settings
from core.llm import complete
from core.supabase_client import get_db
from .scrapers.etsy import (
    scrape_top_listings_with_source,
    ListingSignal,
    SYNTHETIC_SOURCES,
    SOURCE_LLM,
)

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

RESEARCH_PROMPT = """Analyze these real Etsy listings for the niche: "{niche}"

Listings (title / price / favorites / tags):
{listings_json}

Our full product catalog: t-shirt, hoodie, mug, mug_15oz, tote bag, poster, pillow, sticker, baby_bodysuit, canvas, framed_poster, notebook

Extract the following from the listing data:

1. Top 3–5 specific design concepts that clearly sell (based on high favorites/views in the data)
2. Price range — low, high, and sweet spot where most volume clusters
3. Top 8 tags that appear most frequently across listings
4. Visual style themes (e.g. minimalist line art, bold typography, watercolor, cottagecore, snarky humor)
5. ONE crisp recommendation sentence for our designer — what to make and why it'll sell
6. Which 2–4 of our product types best match this niche's buying intent
7. What to avoid — patterns in low-performers or oversaturated styles

Respond ONLY with valid JSON:
{{
  "concepts": [
    "specific concept 1 with visual description",
    "specific concept 2",
    "specific concept 3"
  ],
  "price_range": {{"low": 12.0, "high": 32.0, "sweet_spot": 19.99}},
  "top_tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"],
  "style_themes": ["minimalist", "bold typography"],
  "recommendation": "one sentence — what to design and why it converts",
  "recommended_products": ["mug", "t-shirt"],
  "avoid": "one sentence — what not to make or pitfalls to dodge"
}}"""


def _listings_to_json(signals: list[ListingSignal]) -> str:
    # Sort by favorites descending so the strongest signals come first
    sorted_signals = sorted(signals, key=lambda s: s.review_count, reverse=True)
    data = [
        {
            "title": s.title,
            "price_usd": round(s.price_usd, 2),
            "favorites": s.review_count,
            "views": s.views,
            "tags": s.tags[:10],
        }
        for s in sorted_signals[:40]  # cap tokens; best signals first
    ]
    return json.dumps(data, indent=2)


def run_research(niche: str, run_id: str | None = None) -> dict | None:
    """
    Run a full research pass for one niche.
    Returns the trend dict or None if nothing actionable found.
    """
    from core.activity import log as alog
    logger.info(f"Nova: researching niche='{niche}'")
    alog("nova", "research_started", f"Researching niche: '{niche}'", run_id=run_id)

    signals, source = scrape_top_listings_with_source(niche, limit=50)
    is_synthetic = source in SYNTHETIC_SOURCES

    # Guardrail: do not silently pass off fabricated data as real market signal.
    # When the only data we could get is the LLM's guess, either refuse outright
    # (default — keeps trends honest) or flag it loudly if explicitly allowed.
    if is_synthetic:
        allow = get_settings().nova_allow_synthetic
        if not allow:
            logger.warning(
                f"Nova: refusing '{niche}' — only SYNTHETIC data available "
                f"(set NOVA_ALLOW_SYNTHETIC=1 to permit flagged synthetic research)"
            )
            alog("nova", "research_refused",
                 f"Refused '{niche}': no real Etsy data (synthetic fallback blocked)",
                 run_id=run_id)
            return None
        logger.warning(f"Nova: '{niche}' using SYNTHETIC data — will be flagged in output")
        alog("nova", "research_synthetic",
             f"⚠️ '{niche}' based on SYNTHETIC (model-generated) data, not real Etsy listings",
             run_id=run_id)

    if len(signals) < 5:
        logger.warning(f"Nova: too few listings for '{niche}' ({len(signals)}), skipping")
        return None

    prompt = RESEARCH_PROMPT.format(
        niche=niche,
        listings_json=_listings_to_json(signals),
    )

    try:
        raw = complete(prompt, system=RESEARCH_SYSTEM, task="screen", json_mode=True)
        raw = raw.strip()
        import re as _re
        fenced = _re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
        if fenced:
            raw = fenced.group(1).strip()
        analysis = json.loads(raw)
    except Exception as e:
        logger.error(f"Nova: LLM failed for '{niche}': {e}")
        alog("nova", "error", f"Research failed for '{niche}': {e}", run_id=run_id)
        return None

    price_range = analysis.get("price_range", {})
    recommendation = analysis.get("recommendation", "")
    if is_synthetic:
        # Make the warning impossible to miss wherever the text is surfaced.
        recommendation = f"⚠️ SYNTHETIC (not real Etsy data): {recommendation}"
    trend = {
        "niche": niche,
        "signal_count": len(signals),
        "avg_price_usd": price_range.get("sweet_spot") or price_range.get("low", 0),
        "top_tags": analysis.get("top_tags", []),
        "opportunity": recommendation,
        "data_source": source,
        "is_synthetic": is_synthetic,
        "raw_data": analysis,  # includes recommended_products, concepts, avoid, style_themes
    }

    alog("nova", "research_complete",
         f"Nova done for '{niche}': {analysis.get('recommendation', '')[:100]}",
         run_id=run_id)

    # Persist to Supabase if available
    try:
        db = get_db()
        db.table("trends").insert(trend).execute()
    except Exception as e:
        logger.warning(f"Nova: DB write failed: {e}")

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


# ── Trend discovery — finds NEW niches, not repeating existing ones ───────────

DISCOVERY_SYSTEM = """You are Nova, market research agent for a Printify print-on-demand Etsy shop.
Your job is to identify fresh, profitable niches that have NOT been designed yet.
Always respond with valid JSON."""

DISCOVERY_PROMPT = """Suggest {n} diverse, profitable Etsy POD niche search terms to research RIGHT NOW.

Already in our catalog (do NOT suggest these or anything too similar):
{existing}

Rules:
- Each must be a specific, searchable Etsy keyword phrase (2-5 words)
- Span DIFFERENT audiences and themes — no two should overlap
- Good POD fit: designs that work on t-shirts, mugs, tote bags, posters, or stickers
- Favor niches with gift-buying intent, humor, identity/hobby expression, or seasonal relevance
- Think broadly: hobbies, professions, relationship milestones, fandoms, lifestyle aesthetics, animals, sports, seasons
- Do NOT suggest: cat-related, Christian/faith-based (already covered), anything in the catalog above

Respond with JSON only:
{{
  "niches": [
    "specific niche keyword phrase 1",
    "specific niche keyword phrase 2"
  ]
}}"""


def _get_existing_niches(limit: int = 30) -> list[str]:
    """Pull recently researched/designed niches from DB to avoid repetition."""
    existing = []
    try:
        rows = (
            get_db().table("trends")
            .select("niche")
            .order("observed_at", desc=True)
            .limit(limit)
            .execute()
        )
        existing = [r["niche"] for r in (rows.data or []) if r.get("niche")]
    except Exception:
        pass
    try:
        rows = (
            get_db().table("designs")
            .select("niche")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        for r in (rows.data or []):
            n = r.get("niche", "")
            if n and n not in existing:
                existing.append(n)
    except Exception:
        pass
    return existing


def generate_discovery_niches(n: int = 8, existing: list[str] | None = None) -> list[str]:
    """Ask LLM to generate fresh, diverse POD niches we haven't tried yet."""
    existing_list = existing or _get_existing_niches()
    existing_str = "\n".join(f"- {e}" for e in existing_list[:25]) if existing_list else "None yet"
    prompt = DISCOVERY_PROMPT.format(n=n, existing=existing_str)
    try:
        raw = complete(prompt, system=DISCOVERY_SYSTEM, task="ideate", json_mode=True)
        raw = raw.strip()
        import re as _re
        fenced = _re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
        if fenced:
            raw = fenced.group(1).strip()
        data = json.loads(raw)
        niches = [str(n).strip() for n in data.get("niches", []) if n]
        logger.info(f"Nova: discovery generated {len(niches)} candidate niches")
        return niches[:n]
    except Exception as e:
        logger.error(f"Nova: discovery niche generation failed: {e}")
        return []


def _score_opportunity(trend: dict) -> float:
    """Simple opportunity score: signal count + tag richness + favorable price."""
    raw = trend.get("raw_data", {})
    score = 0.0
    score += min(trend.get("signal_count", 0) / 50, 1.0) * 0.4   # real market signals
    score += min(len(trend.get("top_tags", [])) / 8, 1.0) * 0.2   # tag richness
    price = float(trend.get("avg_price_usd", 0))
    if 15 <= price <= 35:
        score += 0.4   # sweet spot for POD margin
    elif 10 <= price < 15 or 35 < price <= 50:
        score += 0.2
    # Synthetic data is a guess, not a signal — halve its score so real,
    # observed niches always rank above fabricated ones.
    if trend.get("is_synthetic"):
        score *= 0.5
    # Realized sales are the strongest possible signal: a niche we've actually
    # earned money in beats one we only think looks good. Add a capped boost.
    try:
        from core.performance import niche_sales_boost
        score = min(1.0, score + niche_sales_boost(trend.get("niche", "")))
    except Exception:
        pass
    return round(score, 3)


def run_trend_discovery(n_niches: int = 7) -> dict:
    """
    Discover what's actually trending on Etsy right now.
    Generates fresh niches, runs real API research on each, ranks opportunities.
    Returns a discovery report — not a design plan.
    """
    from core.activity import log as alog
    alog("nova", "discovery_started", f"Market discovery: researching {n_niches} fresh niches")

    existing = _get_existing_niches()
    candidate_niches = generate_discovery_niches(n=n_niches + 2, existing=existing)

    if not candidate_niches:
        return {"opportunities": [], "error": "Could not generate candidate niches"}

    opportunities = []
    for niche in candidate_niches[:n_niches]:
        logger.info(f"Nova: discovery research for '{niche}'")
        trend = run_research(niche)
        if trend:
            raw = trend.get("raw_data", {})
            opp = {
                "niche": niche,
                "opportunity": trend.get("opportunity", ""),
                "avg_price_usd": trend.get("avg_price_usd", 0),
                "signal_count": trend.get("signal_count", 0),
                "top_tags": trend.get("top_tags", [])[:6],
                "style_themes": raw.get("style_themes", []),
                "concepts": raw.get("concepts", [])[:3],
                "recommended_products": raw.get("recommended_products", []),
                "avoid": raw.get("avoid", ""),
                "opportunity_score": _score_opportunity(trend),
                "price_range": raw.get("price_range", {}),
                "data_source": trend.get("data_source"),
                "is_synthetic": trend.get("is_synthetic", False),
            }
            opportunities.append(opp)

    opportunities.sort(key=lambda o: o["opportunity_score"], reverse=True)
    alog("nova", "discovery_complete",
         f"Discovery done: {len(opportunities)} opportunities found — top: {opportunities[0]['niche'] if opportunities else 'none'}")

    return {
        "niches_researched": len(opportunities),
        "opportunities": opportunities,
    }
