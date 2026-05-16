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

You receive four types of requests:
1. DESIGN requests — Drew wants to make new products (e.g. "let's do cats and Jesus", "make some mountain gear designs")
2. STRATEGY requests — Drew wants market analysis or planning help (e.g. "what should we focus on?", "give me a market report")
3. REPURPOSE requests — Drew wants to publish already-approved designs onto new product types without redesigning (e.g. "make stickers from my approved designs", "turn the mountain designs into canvases", "reuse my cat designs as baby onesies")
4. EXPLORE requests — Drew wants to discover what's actually trending/popular on Etsy right now, WITHOUT specifying a theme (e.g. "what's selling right now", "what's popular", "research trending products", "find me new niches", "what should we make next", "discover what's hot")

Always respond with valid JSON only."""

COMMAND_PROMPT = """Drew's instruction: "{message}"

Classify this as "design", "strategy", "repurpose", or "explore":
- "design": he wants to create brand new designs for a SPECIFIC theme/niche he named
- "strategy": he wants market analysis, product recommendations, or planning information
- "repurpose": he wants to take EXISTING approved designs and publish them on NEW product types (skip the design/image step)
- "explore": he wants to DISCOVER what's popular/trending on Etsy right now WITHOUT specifying a niche — Nova will research fresh opportunities and return a market scan report

If "strategy": return:
{{
  "command_type": "strategy",
  "understood_intent": "one sentence — what analysis he wants"
}}

If "repurpose": extract the new product types and any niche/design filter. Return:
{{
  "command_type": "repurpose",
  "understood_intent": "one sentence — what he wants to reuse and for what",
  "interpretation": "2-3 sentences describing the plan",
  "new_products": ["sticker", "canvas"],
  "filter": {{
    "niche": "mountain",
    "limit": 10
  }}
}}
- new_products: catalog keys from: t-shirt, hoodie, mug, mug_15oz, tote bag, poster, pillow, sticker, baby_bodysuit, canvas, framed_poster, notebook
- filter.niche: keyword to match against design niche (omit to use all approved designs)
- filter.limit: max designs to repurpose (default 10)

If "design": interpret as a concrete product direction. Find the COMBINATION angle ("Cats and Jesus" = designs that blend both, not two separate products).

Printify catalog we support:
- Apparel: t-shirts, hoodies, baby_bodysuit
- Accessories: tote bags
- Home & Living: mugs, poster, pillow, canvas, framed_poster
- Stationery: notebook, sticker (also for candle labels)

Return a design plan:
{{
  "command_type": "design",
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

If "explore": extract any specific count Drew mentioned (e.g. "3 niches", "find 5"). Default to 7 if none stated. Return ONLY:
{{
  "command_type": "explore",
  "n_niches": 7,
  "understood_intent": "one sentence — confirm you're going to scan Etsy for fresh trending niches"
}}

If genuinely too vague to classify, add: "clarification_needed": "what you'd want to know"
Drew will confirm before anything runs."""


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


def fetch_approved_designs(niche_filter: str | None = None, limit: int = 10) -> list[dict]:
    """Return approved designs from DB, optionally filtered by niche keyword."""
    from core.supabase_client import get_db
    db = get_db()
    q = (
        db.table("designs")
        .select("id, concept_name, niche, image_url, products")
        .in_("status", ["approved", "draft_on_printify", "listed"])
        .order("created_at", desc=True)
        .limit(limit * 3)  # fetch extra so niche filter has headroom
        .execute()
    )
    rows = q.data or []
    if niche_filter:
        kw = niche_filter.lower()
        rows = [r for r in rows if kw in (r.get("niche") or "").lower()]
    return rows[:limit]


def run_repurpose(plan: dict, progress_cb=None) -> dict:
    """
    Repurpose existing approved designs onto new product types.
    Skips Nova/Forge — just calls approve_and_publish with overridden product list.
    """
    from integrations.printify import approve_and_publish

    def _p(step, detail, pct):
        if progress_cb:
            progress_cb(step, detail, pct)
        logger.info(f"Repurpose [{pct}%] {step}: {detail}")

    designs = plan.get("designs", [])
    new_products = plan.get("new_products", [])

    if not designs:
        return {"ok": False, "error": "No designs found to repurpose"}
    if not new_products:
        return {"ok": False, "error": "No product types specified"}

    results = []
    total = len(designs)
    for i, design in enumerate(designs):
        design_id = design.get("id")
        name = design.get("concept_name") or design.get("name", "Unknown")
        pct = int((i / total) * 90) + 5
        _p("publishing", f"Publishing '{name}' as {', '.join(new_products)}…", pct)
        try:
            result = approve_and_publish(design_id, products_override=new_products)
            results.append(result)
        except Exception as e:
            logger.error(f"Repurpose: failed for design {design_id}: {e}")
            results.append({"design_id": design_id, "error": str(e), "drafts": []})

    drafts_created = sum(len(r.get("drafts", [])) for r in results)
    _p("notifying", "Sending report to Discord…", 95)
    _notify_repurpose_completion(plan, results)

    _p("done", f"{drafts_created} Printify draft(s) created — review in Printify dashboard", 100)
    return {
        "results": results,
        "designs_processed": len(designs),
        "drafts_created": drafts_created,
    }


def _create_pipeline_run(plan: dict) -> str | None:
    """Create a pipeline_runs record and return its ID."""
    import uuid as _uuid
    from core.supabase_client import get_db
    run_id = str(_uuid.uuid4())
    niches = plan.get("niches", [])
    niche_str = ", ".join(n.get("name", "") for n in niches) if niches else plan.get("filter", {}).get("niche", "")
    try:
        get_db().table("pipeline_runs").insert({
            "id": run_id,
            "niche": niche_str,
            "command": plan.get("understood_intent", ""),
            "status": "running",
            "current_step": "starting",
            "initiated_by": "ellie",
        }).execute()
    except Exception as e:
        logger.warning(f"Pipeline: run record creation failed: {e}")
    return run_id


def _update_pipeline_run(run_id: str | None, **kwargs) -> None:
    if not run_id:
        return
    from core.supabase_client import get_db
    from datetime import datetime, timezone
    try:
        get_db().table("pipeline_runs").update(kwargs).eq("id", run_id).execute()
    except Exception:
        pass


def run_pipeline(plan: dict, progress_cb=None) -> dict:
    """
    Execute an approved plan.
    - command_type 'repurpose': reuse existing designs on new product types
    - command_type 'design' (default): run Nova → Forge for each niche
    progress_cb(step, detail, pct) is called throughout.
    """
    if plan.get("command_type") == "repurpose":
        return run_repurpose(plan, progress_cb)

    from agents.nova.researcher import run_research
    from agents.forge.designer import run_forge
    from core.activity import log as alog
    from datetime import datetime, timezone

    run_id = _create_pipeline_run(plan)

    def _p(step: str, detail: str, pct: int) -> None:
        if progress_cb:
            progress_cb(step, detail, pct)
        logger.info(f"Pipeline [{pct}%] {step}: {detail}")
        if run_id:
            _update_pipeline_run(run_id, current_step=step)

    niches = plan.get("niches", [])
    if not niches:
        _update_pipeline_run(run_id, status="error", current_step="error",
                             finished_at=datetime.now(timezone.utc).isoformat())
        return {"designs": [], "trends": [], "error": "No niches in plan"}

    alog("ellie", "pipeline_started",
         f"Pipeline started: {', '.join(n.get('name','') for n in niches)}",
         metadata={"niches": [n.get("name") for n in niches]}, run_id=run_id)

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

        forge_niche = description
        if style_notes:
            forge_niche += f" — {style_notes}"

        # ── Nova research ──────────────────────────────────────────────────
        pct = int(step_n / total * 80) + 5
        _p("researching", f"Nova researching '{name}'…", pct)
        try:
            trend = run_research(forge_niche, run_id=run_id)
            if trend:
                all_trends.append(trend)
        except Exception as e:
            logger.warning(f"Pipeline: Nova failed for '{name}': {e}")
            alog("nova", "error", f"Nova failed for '{name}': {e}", run_id=run_id)
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
                run_id=run_id,
            )
            all_designs.extend(designs)
        except Exception as e:
            logger.warning(f"Pipeline: Forge failed for '{name}': {e}")
            alog("forge", "error", f"Forge failed for '{name}': {e}", run_id=run_id)
        step_n += 1

    _p("notifying", "Sending completion report to Discord…", 92)
    _notify_completion(plan, all_designs)

    _update_pipeline_run(run_id,
        status="done" if all_designs else "partial",
        current_step="done",
        designs_created=len(all_designs),
        finished_at=datetime.now(timezone.utc).isoformat())
    alog("ellie", "pipeline_completed",
         f"Pipeline done: {len(all_designs)} design(s) ready for review",
         metadata={"designs_created": len(all_designs)}, run_id=run_id)

    _p("done", f"{len(all_designs)} design(s) ready for your approval", 100)
    return {
        "run_id": run_id,
        "designs": all_designs,
        "trends": all_trends,
        "niches_processed": len(niches),
        "designs_created": len(all_designs),
    }


def _notify_repurpose_completion(plan: dict, results: list[dict]) -> None:
    try:
        from agents.ELLIE.supervisor import _discord
    except Exception:
        return

    drafts = sum(len(r.get("drafts", [])) for r in results)
    products = plan.get("new_products", [])
    lines = [
        "**ELLIE** · Repurpose complete ✓",
        f"**New products:** {', '.join(products)}",
        f"**Printify drafts created:** {drafts}",
        "Review in your Printify dashboard → publish to Etsy.",
    ]
    _discord("\n".join(lines))


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
