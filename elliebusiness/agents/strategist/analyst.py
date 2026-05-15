"""
Strategist -- product planning agent.

Sits between Nova (market data) and Forge (design execution).
Synthesizes trend signals, pipeline status, and catalog inventory into
an actionable product strategy report Drew can review before anything runs.

Responsibilities:
  - What niches are hot right now (from Nova DB)
  - Which products to make for each niche (catalog-aware)
  - What catalog gaps exist (products trending but no blueprint yet)
  - Proposed Forge runs Drew can approve with one click
  - Flag when new blueprints need to be added to the code
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone

from core.llm import complete
from core.supabase_client import get_db

logger = logging.getLogger(__name__)

# Products we currently have blueprints for
CATALOG_PRODUCTS = [
    "t-shirt", "hoodie", "mug", "mug_15oz",
    "tote bag", "poster", "pillow",
]

ANALYST_SYSTEM = """You are the Strategist, a product planning agent for a Printify/Etsy print-on-demand business.
You analyze market trend data and translate it into concrete product strategy.
You think like a product manager: prioritize by opportunity, be specific about what to make,
and flag gaps so the team knows what infrastructure to build next.
Always respond with valid JSON."""

STRATEGY_PROMPT = """Analyze the following data and produce a product strategy report.

=== NOVA TREND DATA (recent market research) ===
{trend_data}

=== CURRENT PIPELINE STATUS ===
{pipeline_status}

=== CATALOG (products we can currently produce) ===
{catalog_products}

Based on this data, produce a strategy report:

1. Rank the top 3-5 niches by opportunity (consider: signal count, price point, trend recency, pipeline saturation)
2. For each top niche, specify exactly which catalog products to run through Forge and why
3. Identify catalog gaps: product types the market wants but we can't make yet. For each gap, suggest the Printify blueprint category to look into.
4. Write 2-4 concrete proposed Forge runs (specific niche + product list + rationale)
5. Write a brief executive summary for Drew (2-3 sentences, plain English, actionable)

Respond with JSON:
{{
  "summary": "2-3 sentence plain English summary for Drew",
  "top_niches": [
    {{
      "niche": "niche name",
      "opportunity_score": 0.85,
      "reasoning": "why this is hot right now",
      "best_products": ["t-shirt", "mug"],
      "already_in_pipeline": 3,
      "recommended_action": "run Forge" | "monitor" | "saturated"
    }}
  ],
  "catalog_gaps": [
    {{
      "product_type": "baby onesie",
      "why_it_matters": "faith + family niche is strong, onesies are top-5 gifted items",
      "estimated_opportunity": "medium" | "high",
      "blueprint_note": "Look for 'infant bodysuit' or 'baby onesie' in Printify catalog"
    }}
  ],
  "proposed_runs": [
    {{
      "niche": "exact niche string to pass to Forge",
      "products": ["t-shirt", "hoodie", "mug"],
      "n_concepts": 4,
      "rationale": "one sentence",
      "priority": "high" | "medium" | "low"
    }}
  ]
}}"""


def _get_trend_data(limit: int = 20) -> list[dict]:
    """Pull recent Nova trend data from DB."""
    try:
        db = get_db()
        rows = (
            db.table("trends")
            .select("niche,signal_count,avg_price_usd,top_tags,opportunity,raw_data,observed_at")
            .order("observed_at", desc=True)
            .limit(limit)
            .execute()
        )
        return rows.data or []
    except Exception as e:
        logger.warning(f"Strategist: trend fetch failed: {e}")
        return []


def _get_pipeline_status() -> dict:
    """Summarize what's currently in the design pipeline."""
    try:
        db = get_db()
        rows = db.table("designs").select("niche,status").execute()
        data = rows.data or []
        counts: dict[str, dict] = {}
        for row in data:
            niche = (row.get("niche") or "unknown")[:60]
            status = row.get("status", "unknown")
            if niche not in counts:
                counts[niche] = {}
            counts[niche][status] = counts[niche].get(status, 0) + 1
        return counts
    except Exception as e:
        logger.warning(f"Strategist: pipeline status fetch failed: {e}")
        return {}


def run_analysis() -> dict:
    """
    Generate a full strategy report. This is the main entry point.
    Returns a structured dict with summary, top niches, gaps, and proposed runs.
    """
    logger.info("Strategist: starting analysis")

    trends = _get_trend_data(limit=30)
    pipeline = _get_pipeline_status()

    if not trends:
        return {
            "summary": "No Nova trend data available yet. Run Nova market research first.",
            "top_niches": [],
            "catalog_gaps": [],
            "proposed_runs": [],
            "error": "no_trend_data",
        }

    # Format trend data for the LLM
    trend_lines = []
    for t in trends[:20]:
        raw = t.get("raw_data") or {}
        style_themes = raw.get("style_themes", [])
        rec_products = raw.get("recommended_products", [])
        trend_lines.append(
            f"- Niche: {t['niche'][:80]}\n"
            f"  Signal count: {t.get('signal_count', '?')} | "
            f"Avg price: ${t.get('avg_price_usd', 0):.2f} | "
            f"Researched: {(t.get('observed_at') or '')[:10]}\n"
            f"  Top tags: {', '.join((t.get('top_tags') or [])[:6])}\n"
            f"  Opportunity: {t.get('opportunity', '')}\n"
            f"  Style themes: {', '.join(style_themes[:4])}\n"
            f"  Nova recommended products: {', '.join(rec_products) or 'not specified'}"
        )
    trend_data_str = "\n".join(trend_lines) if trend_lines else "No data."

    # Format pipeline status
    pipeline_lines = []
    for niche, statuses in list(pipeline.items())[:15]:
        status_summary = ", ".join(f"{v} {k}" for k, v in statuses.items())
        pipeline_lines.append(f"- {niche}: {status_summary}")
    pipeline_str = "\n".join(pipeline_lines) if pipeline_lines else "Pipeline is empty."

    prompt = STRATEGY_PROMPT.format(
        trend_data=trend_data_str,
        pipeline_status=pipeline_str,
        catalog_products=", ".join(CATALOG_PRODUCTS),
    )

    try:
        raw = complete(prompt, system=ANALYST_SYSTEM, fast=False, json_mode=True)
        raw = raw.strip()
        fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw, re.S)
        if fenced:
            raw = fenced.group(1).strip()
        report = json.loads(raw)
    except Exception as e:
        logger.error(f"Strategist: LLM analysis failed: {e}")
        return {
            "summary": "Analysis failed — LLM error. Check logs.",
            "top_niches": [],
            "catalog_gaps": [],
            "proposed_runs": [],
            "error": str(e),
        }

    report["generated_at"] = datetime.now(timezone.utc).isoformat()
    report["niches_analyzed"] = len(trends)
    logger.info(
        f"Strategist: report complete — "
        f"{len(report.get('top_niches', []))} niches, "
        f"{len(report.get('catalog_gaps', []))} gaps, "
        f"{len(report.get('proposed_runs', []))} proposed runs"
    )
    return report
