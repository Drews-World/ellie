"""
Forge — design generation loop.

Steps (per BUSINESS_FACTORY.md):
1. Consult Archives for Drew's style memory
2. Consult Nova for latest trend report
3. Generate N design concept prompts via LLM
4. Generate images via GPT Image 2
5. Self-score each design
6. Discard anything below threshold
7. Save to DB with status='pending_drew_review'
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import datetime, timezone

from core.config import get_settings
from core.llm import complete
from core.supabase_client import get_db
from .prompts import FORGE_SYSTEM, CONCEPT_PROMPT, SCORE_PROMPT, SCORE_SYSTEM

logger = logging.getLogger(__name__)

SCORE_THRESHOLD = 0.30


def _parse_json(raw: str) -> dict:
    """Parse JSON from LLM output, tolerating markdown code fences."""
    raw = raw.strip()
    # Strip ```json ... ``` or ``` ... ``` fences
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    if fenced:
        raw = fenced.group(1).strip()
    return json.loads(raw)  # Discard designs scoring below this overall


def _get_style_memory(niche: str) -> str:
    """Pull Drew's approval/rejection history to guide Forge."""
    try:
        db = get_db()
        rows = (
            db.table("feedback_events")
            .select("verdict,notes,drew_tags")
            .eq("target_kind", "design")
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        if not rows.data:
            return "No feedback history yet — use sensible defaults."
        summary = []
        for r in rows.data:
            tags = ", ".join(r.get("drew_tags") or [])
            summary.append(f"[{r['verdict']}] {r.get('notes', '')} {f'tags: {tags}' if tags else ''}")
        return "\n".join(summary[:10])
    except Exception:
        return "Style memory unavailable."


def _get_trend_report(niche: str) -> str:
    """Get Nova's latest trend report for this niche."""
    try:
        db = get_db()
        rows = (
            db.table("trends")
            .select("opportunity,top_tags,raw_data")
            .eq("niche", niche)
            .order("observed_at", desc=True)
            .limit(1)
            .execute()
        )
        if not rows.data:
            return "No trend data yet for this niche."
        row = rows.data[0]
        raw = row.get("raw_data") or {}
        return (
            f"Recommendation: {row.get('opportunity', '')}\n"
            f"Top tags: {', '.join(row.get('top_tags', []))}\n"
            f"Style themes: {', '.join(raw.get('style_themes', []))}"
        )
    except Exception:
        return "Trend data unavailable."


def _get_recommended_products(niche: str) -> list[str] | None:
    """Get Nova's recommended product types for this niche (stored in raw_data)."""
    try:
        db = get_db()
        rows = (
            db.table("trends")
            .select("raw_data")
            .eq("niche", niche)
            .order("observed_at", desc=True)
            .limit(1)
            .execute()
        )
        if rows.data:
            raw = rows.data[0].get("raw_data") or {}
            return raw.get("recommended_products")
    except Exception:
        pass
    return None


def generate_concepts(niche: str, n: int = 5, products: list[str] | None = None) -> list[dict]:
    """Step 3: LLM generates design concepts. Returns list of concept dicts."""
    style_memory = _get_style_memory(niche)
    trend_report = _get_trend_report(niche)
    product_list = ", ".join(products) if products else "t-shirt, hoodie, mug, tote bag, poster, phone case"

    prompt = CONCEPT_PROMPT.format(
        n=n,
        niche=niche,
        products=product_list,
        style_memory=style_memory,
        trend_report=trend_report,
    )

    try:
        raw = complete(prompt, system=FORGE_SYSTEM, task="design_copy", json_mode=True)
        data = _parse_json(raw)
        return data.get("concepts", [])
    except Exception as e:
        logger.error(f"Forge: concept generation failed: {e}")
        return []


def score_concept(concept: dict, niche: str) -> float:
    """Step 5: LLM self-rates the concept. Returns overall score 0.0–1.0."""
    style_memory = _get_style_memory(niche)
    prompt = SCORE_PROMPT.format(
        description=concept.get("image_prompt", ""),
        niche=niche,
        style_memory=style_memory,
    )
    try:
        raw = complete(prompt, system=SCORE_SYSTEM, task="score", json_mode=True)
        scores = _parse_json(raw)
        return float(scores.get("overall", 0.5))
    except Exception:
        return 0.5


def generate_images_for_concepts(concepts: list[dict]) -> list[dict]:
    """Step 4: Generate an image for each concept. Returns enriched concepts with image_bytes."""
    try:
        from core.image_gen import generate_image
    except Exception:
        logger.warning("Forge: image gen not available (OPENAI_API_KEY not set), skipping images")
        return [{**c, "image_bytes": None} for c in concepts]

    enriched = []
    for concept in concepts:
        try:
            image_bytes = generate_image(concept["image_prompt"])
            enriched.append({**concept, "image_bytes": image_bytes})
            logger.info(f"Forge: generated image for '{concept['name']}'")
        except Exception as e:
            logger.error(f"Forge: image gen failed for '{concept['name']}': {e}")
            enriched.append({**concept, "image_bytes": None})
    return enriched


def _save_design(niche: str, concept: dict, score: float, image_url: str = "", run_id: str | None = None) -> str:
    """Persist design to Supabase. Returns design ID."""
    design_id = str(uuid.uuid4())
    try:
        db = get_db()
        row: dict = {
            "id": design_id,
            "niche": niche,
            "concept_name": concept.get("name", "Untitled"),
            "image_prompt": concept.get("image_prompt", ""),
            "sell_reason": concept.get("sell_reason", ""),
            "products": concept.get("products", ["t-shirt", "mug"]),
            "image_url": image_url,
            "forge_score": score,
            "status": "pending_drew_review",
        }
        if run_id:
            row["run_id"] = run_id
        db.table("designs").insert(row).execute()
    except Exception as e:
        logger.warning(f"Forge: DB save failed: {e}")
    return design_id


def _upload_image_to_storage(design_id: str, image_bytes: bytes) -> str:
    """Upload PNG to Supabase Storage via REST API. Returns public URL."""
    import httpx
    s = get_settings()
    path = f"{design_id}.png"
    url = f"{s.supabase_url}/storage/v1/object/designs/{path}"
    try:
        resp = httpx.put(
            url,
            content=image_bytes,
            headers={
                "Authorization": f"Bearer {s.supabase_service_key}",
                "Content-Type": "image/png",
            },
            timeout=60,
        )
        resp.raise_for_status()
        public_url = f"{s.supabase_url}/storage/v1/object/public/designs/{path}"
        logger.info(f"Forge: uploaded {path} → {public_url}")
        return public_url
    except Exception as e:
        logger.warning(f"Forge: storage upload failed for {path}: {e}")
        return ""


def run_forge(niche: str, n_concepts: int = 5, products: list[str] | None = None, progress_cb=None, run_id: str | None = None) -> list[dict]:
    """
    Full Forge run for one niche.
    Returns list of designs that passed scoring, saved to DB pending Drew review.
    progress_cb(step, detail, pct) is called at each stage if provided.
    """
    from core.activity import log as alog

    def _progress(step: str, detail: str, pct: int) -> None:
        if progress_cb:
            progress_cb(step, detail, pct)
        logger.info(f"Forge [{pct}%] {step}: {detail}")

    # Use Nova's product recommendations if no explicit products given
    if not products:
        products = _get_recommended_products(niche)

    logger.info(f"Forge: starting run for niche='{niche}', n={n_concepts}, products={products}")
    alog("forge", "forge_started", f"Forge starting: {n_concepts} concepts for '{niche}'", run_id=run_id)
    _progress("concepts", f"Generating {n_concepts} design concepts for '{niche}'…", 5)

    # Steps 1-3: Generate concepts
    concepts = generate_concepts(niche, n=n_concepts, products=products)
    if not concepts:
        logger.error("Forge: no concepts generated, aborting")
        return []

    _progress("imaging", f"Got {len(concepts)} concepts — generating images…", 25)

    # Step 4: Generate images (report per-image progress)
    concepts_with_images = []
    for i, concept in enumerate(concepts):
        pct = 25 + int((i / len(concepts)) * 40)
        _progress("imaging", f"Image {i + 1}/{len(concepts)}: {concept['name']}", pct)
        try:
            from core.image_gen import generate_image
            from integrations.printify import preferred_image_size_for_products
            concept_products = concept.get("products") or products or []
            img_size = preferred_image_size_for_products(concept_products) if concept_products else "1024x1024"
            image_bytes = generate_image(concept["image_prompt"], size=img_size)
            concepts_with_images.append({**concept, "image_bytes": image_bytes})
        except Exception as e:
            logger.warning(f"Forge: image gen skipped for '{concept['name']}': {e}")
            concepts_with_images.append({**concept, "image_bytes": None})

    _progress("scoring", "Scoring designs…", 65)

    # Step 5-6: Score and filter
    results = []
    for i, concept in enumerate(concepts_with_images):
        pct = 65 + int((i / len(concepts_with_images)) * 20)
        _progress("scoring", f"Scoring {i + 1}/{len(concepts_with_images)}: {concept['name']}", pct)
        score = score_concept(concept, niche)
        logger.info(f"Forge: '{concept['name']}' scored {score:.2f}")

        if score < SCORE_THRESHOLD:
            logger.info(f"Forge: discarding '{concept['name']}' (score {score:.2f} < {SCORE_THRESHOLD})")
            continue

        _progress("saving", f"Saving '{concept['name']}' to review queue…", 85)

        # Step 7: Save to DB
        image_url = ""
        if concept.get("image_bytes"):
            design_id = str(uuid.uuid4())
            image_url = _upload_image_to_storage(design_id, concept["image_bytes"])
            design_id = _save_design(niche, concept, score, image_url, run_id=run_id)
        else:
            design_id = _save_design(niche, concept, score, run_id=run_id)

        alog("forge", "design_created",
             f"Design ready: '{concept['name']}' — score {score:.0%}",
             metadata={"design_id": design_id, "score": score},
             run_id=run_id)

        results.append({
            "design_id": design_id,
            "name": concept["name"],
            "niche": niche,
            "score": score,
            "image_url": image_url,
            "products": concept.get("products", ["mug"]),
            "status": "pending_drew_review",
        })

    logger.info(f"Forge: {len(results)}/{len(concepts)} designs passed scoring for '{niche}'")
    alog("forge", "forge_complete",
         f"Forge done for '{niche}': {len(results)}/{len(concepts)} designs passed review",
         run_id=run_id)
    return results
