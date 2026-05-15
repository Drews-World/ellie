"""
ELLIE Pipeline — interprets natural language commands and orchestrates
Nova → Forge for each niche in the plan.
"""
from __future__ import annotations

import json
import logging
import re

from core.llm import complete

logger = logging.getLogger(__name__)

COMMAND_SYSTEM = """You are ELLIE, the AI business manager for a Printify print-on-demand Etsy store owned by Drew.

When Drew gives you a direction — even a casual one — you:
1. Find the COMBINATION angle. "Cats and Jesus" means designs that blend both themes together, not two separate products.
2. Define specific, commercially viable niches with a clear target customer.
3. Pick the right products from Printify's full catalog for that niche.
4. Explain WHY this will sell.

Printify catalog (use any that fit — we are NOT limited to mugs):
- Apparel: t-shirts, hoodies, tank tops, long sleeves, crop tops, sweatshirts, leggings
- Accessories: phone cases, hats, beanies, tote bags, backpacks, fanny packs
- Home & Living: mugs, throw pillows, throw blankets, wall art, canvas prints, posters, doormats, coasters, ornaments
- Stationery: notebooks, stickers, greeting cards, desk mats

Always respond with valid JSON only."""

COMMAND_PROMPT = """Drew's instruction: "{message}"

Interpret this as a concrete product direction. Read between the lines — if he mentions two things, find how they combine into one compelling product.

Return a plan:
{{
  "understood_intent": "one sentence — what you think he actually wants",
  "interpretation": "2-3 sentences: the niche angle, target customer, why it will sell",
  "niches": [
    {{
      "name": "short niche name (3-5 words)",
      "description": "specific design direction — what should the designs look like, feel like, say",
      "suggested_products": ["t-shirt", "mug", "tote bag"],
      "n_concepts": 3,
      "style_notes": "tone, humor level, color palette, typography style"
    }}
  ],
  "market_reasoning": "one sentence on the commercial opportunity"
}}

If the instruction is genuinely too vague to act on, add: "clarification_needed": "what you'd want to know"
Otherwise produce the plan — Drew will confirm before anything runs."""


def parse_command(message: str) -> dict:
    """LLM interprets a natural language instruction into a structured plan."""
    try:
        raw = complete(COMMAND_PROMPT.format(message=message), system=COMMAND_SYSTEM, fast=False)
        raw = raw.strip()
        fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw, re.S)
        if fenced:
            raw = fenced.group(1).strip()
        return json.loads(raw)
    except Exception as e:
        logger.error(f"ELLIE: command parse failed: {e}")
        return {
            "understood_intent": message,
            "interpretation": "Could not interpret — try being a bit more specific.",
            "niches": [],
            "error": str(e),
        }


def run_pipeline(plan: dict, progress_cb=None) -> dict:
    """
    Execute an approved plan: for each niche, run Nova research then Forge designs.
    progress_cb(step, detail, pct) is called throughout.
    """
    from agents.nova.researcher import run_research
    from agents.forge.designer import run_forge

    def _p(step: str, detail: str, pct: int) -> None:
        if progress_cb:
            progress_cb(step, detail, pct)
        logger.info(f"Pipeline [{pct}%] {step}: {detail}")

    niches = plan.get("niches", [])
    if not niches:
        return {"designs": [], "trends": [], "error": "No niches in plan"}

    total = len(niches) * 2
    step_n = 0
    all_designs: list[dict] = []
    all_trends: list[dict] = []

    for niche_def in niches:
        name = niche_def.get("name", "unknown")
        description = niche_def.get("description", name)
        style_notes = niche_def.get("style_notes", "")
        n_concepts = int(niche_def.get("n_concepts", 3))
        products = niche_def.get("suggested_products", ["t-shirt", "mug", "tote bag"])

        # Rich prompt for Forge that includes product context
        forge_niche = description
        if style_notes:
            forge_niche += f" — {style_notes}"

        # ── Nova research ──────────────────────────────────────────────────
        pct = int(step_n / total * 80) + 5
        _p("researching", f"Nova researching '{name}'…", pct)
        try:
            trend = run_research(forge_niche)
            if trend:
                all_trends.append(trend)
        except Exception as e:
            logger.warning(f"Pipeline: Nova failed for '{name}': {e}")
        step_n += 1

        # ── Forge designs ──────────────────────────────────────────────────
        pct = int(step_n / total * 80) + 5
        _p("designing", f"Forge creating {n_concepts} designs for '{name}'…", pct)
        try:
            designs = run_forge(
                forge_niche,
                n_concepts=n_concepts,
                products=products,
                progress_cb=None,
            )
            all_designs.extend(designs)
        except Exception as e:
            logger.warning(f"Pipeline: Forge failed for '{name}': {e}")
        step_n += 1

    _p("notifying", "Sending completion report to Discord…", 92)
    _notify_completion(plan, all_designs)

    _p("done", f"{len(all_designs)} design(s) ready for your approval", 100)
    return {
        "designs": all_designs,
        "trends": all_trends,
        "niches_processed": len(niches),
        "designs_created": len(all_designs),
    }


def _notify_completion(plan: dict, designs: list[dict]) -> None:
    try:
        from agents.ELLIE.supervisor import _discord
    except Exception:
        return

    intent = plan.get("understood_intent", "pipeline run")
    niche_names = [n.get("name", "") for n in plan.get("niches", [])]

    lines = [
        "**ELLIE** · Pipeline complete ✓",
        f"**Goal:** {intent}",
        f"**Niches:** {', '.join(niche_names)}",
        f"**Designs ready for review:** {len(designs)}",
    ]
    for d in designs[:6]:
        score_pct = int(d.get("score", 0) * 100)
        lines.append(f"  · {d.get('name', 'Design')} — score {score_pct}%")
    if len(designs) > 6:
        lines.append(f"  · …and {len(designs) - 6} more")
    lines.append("\nHead to Business Factory → Archives to approve → publish.")

    _discord("\n".join(lines))
