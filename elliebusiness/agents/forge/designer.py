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
import uuid
from datetime import datetime, timezone

from core.llm import complete
from core.supabase_client import get_db
from .prompts import FORGE_SYSTEM, CONCEPT_PROMPT, SCORE_PROMPT, SCORE_SYSTEM

logger = logging.getLogger(__name__)

SCORE_THRESHOLD = 0.60  # Discard designs scoring below this overall


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
            .select("concept,evidence")
            .eq("niche", niche)
            .order("observed_at", desc=True)
            .limit(1)
            .execute()
        )
        if not rows.data:
            return "No trend data yet for this niche."
        row = rows.data[0]
        evidence = row.get("evidence") or {}
        return (
            f"Recommendation: {row['concept']}\n"
            f"Top tags: {', '.join(evidence.get('top_tags', []))}\n"
            f"Style themes: {', '.join(evidence.get('style_themes', []))}"
        )
    except Exception:
        return "Trend data unavailable."


def generate_concepts(niche: str, n: int = 5) -> list[dict]:
    """Step 3: LLM generates design concepts. Returns list of concept dicts."""
    style_memory = _get_style_memory(niche)
    trend_report = _get_trend_report(niche)

    prompt = CONCEPT_PROMPT.format(
        n=n,
        niche=niche,
        style_memory=style_memory,
        trend_report=trend_report,
    )

    try:
        raw = complete(prompt, system=FORGE_SYSTEM, fast=False, json_mode=True)
        data = json.loads(raw)
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
        raw = complete(prompt, system=SCORE_SYSTEM, fast=True, json_mode=True)
        scores = json.loads(raw)
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


def _save_design(niche: str, concept: dict, score: float, image_url: str = "") -> str:
    """Persist design to Supabase. Returns design ID."""
    design_id = str(uuid.uuid4())
    try:
        db = get_db()
        db.table("designs").insert({
            "id": design_id,
            "niche": niche,
            "prompt": concept.get("image_prompt", ""),
            "image_url": image_url,
            "forge_score": score,
            "status": "pending_drew_review",
            "model": "gpt-image-2",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        logger.warning(f"Forge: DB save failed: {e}")
    return design_id


def _upload_image_to_storage(design_id: str, image_bytes: bytes) -> str:
    """Upload PNG to Supabase Storage. Returns public URL."""
    try:
        db = get_db()
        path = f"designs/{design_id}.png"
        db.storage.from_("designs").upload(path, image_bytes, {"content-type": "image/png"})
        return db.storage.from_("designs").get_public_url(path)
    except Exception as e:
        logger.warning(f"Forge: storage upload failed: {e}")
        return ""


def run_forge(niche: str, n_concepts: int = 5) -> list[dict]:
    """
    Full Forge run for one niche.
    Returns list of designs that passed scoring, saved to DB pending Drew review.
    """
    logger.info(f"Forge: starting run for niche='{niche}', n={n_concepts}")

    # Steps 1-3: Generate concepts
    concepts = generate_concepts(niche, n=n_concepts)
    if not concepts:
        logger.error("Forge: no concepts generated, aborting")
        return []

    # Step 4: Generate images
    concepts_with_images = generate_images_for_concepts(concepts)

    # Step 5-6: Score and filter
    results = []
    for concept in concepts_with_images:
        score = score_concept(concept, niche)
        logger.info(f"Forge: '{concept['name']}' scored {score:.2f}")

        if score < SCORE_THRESHOLD:
            logger.info(f"Forge: discarding '{concept['name']}' (score {score:.2f} < {SCORE_THRESHOLD})")
            continue

        # Step 7: Save to DB
        image_url = ""
        if concept.get("image_bytes"):
            design_id = str(uuid.uuid4())
            image_url = _upload_image_to_storage(design_id, concept["image_bytes"])
            design_id = _save_design(niche, concept, score, image_url)
        else:
            design_id = _save_design(niche, concept, score)

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
    return results
