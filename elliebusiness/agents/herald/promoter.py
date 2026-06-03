"""
Herald — the promotion agent.

Closes the loop after Archives publishes: take an active Etsy listing (mockup +
copy + tags) and post a Pinterest Pin that links back to it, so the shop earns
external discovery traffic instead of waiting on Etsy search alone.

Flow per listing:
  1. Load the listing + its design (for the public image + niche).
  2. Generate Pinterest-optimized copy (keyword title + description) via LLM.
  3. Pick a board (niche match → default), create the Pin.
  4. Stamp listings.pinterest_pin_id + promoted_at so we never double-post.

Best-effort and idempotent. Skips listings with no Etsy link, no image, or an
existing pin. The scheduled sweep is gated by PINTEREST_AUTO_PROMOTE; manual
promote_listing() calls (Drew/ELLIE-initiated) always run.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone

from core.activity import log as alog
from core.config import get_settings
from core.llm import complete
from core.supabase_client import get_db
from integrations import pinterest

logger = logging.getLogger("ellie.business.herald")

COPY_SYSTEM = """You are Herald, the Pinterest marketing agent for an Etsy print-on-demand shop.
You write Pins that rank in Pinterest search and drive clicks to Etsy listings.
Always respond with valid JSON."""

COPY_PROMPT = """Write a Pinterest Pin for this Etsy product. The Pin must rank in Pinterest
search and make people click through to buy.

Product title: {title}
Niche: {niche}
Concept: {concept}
Etsy tags: {tags}

Rules:
- title: max 100 chars, front-load the strongest keywords, natural not spammy
- description: 2-3 sentences, keyword-rich, ends with a soft call to action
- hashtags: 3-5 relevant Pinterest hashtags (no '#', just the words)

Respond ONLY with valid JSON:
{{
  "title": "...",
  "description": "...",
  "hashtags": ["tag1", "tag2", "tag3"]
}}"""


def _etsy_url(listing: dict) -> str:
    """Build the public Etsy listing URL from its id."""
    lid = listing.get("etsy_listing_id")
    if not lid:
        return ""
    base = get_settings().etsy_listing_base_url.rstrip("/")
    return f"{base}/{lid}"


def _generate_pin_copy(listing: dict, design: dict) -> dict:
    """Ask the LLM for Pinterest-optimized copy. Falls back to listing fields."""
    title = listing.get("title") or design.get("concept_name") or "New design"
    niche = design.get("niche") or ""
    concept = design.get("concept_name") or ""
    tags = listing.get("tags") or []
    fallback = {
        "title": title[:100],
        "description": (listing.get("description") or title)[:800],
        "hashtags": [],
    }
    try:
        raw = complete(
            COPY_PROMPT.format(
                title=title, niche=niche, concept=concept,
                tags=", ".join(tags[:13]),
            ),
            system=COPY_SYSTEM,
            task="reply",
            json_mode=True,
        ).strip()
        fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
        if fenced:
            raw = fenced.group(1).strip()
        data = json.loads(raw)
        hashtags = [str(h).lstrip("#").strip() for h in data.get("hashtags", []) if h]
        desc = (data.get("description") or fallback["description"]).strip()
        if hashtags:
            desc = f"{desc} " + " ".join(f"#{h.replace(' ', '')}" for h in hashtags[:5])
        return {
            "title": (data.get("title") or fallback["title"])[:100],
            "description": desc[:800],
        }
    except Exception as e:  # noqa: BLE001
        logger.warning("Herald: copy generation failed, using fallback: %s", e)
        return {"title": fallback["title"], "description": fallback["description"]}


def _resolve_board(niche: str) -> str:
    """Pick a board for this niche: exact/'s substring name match → default board.

    Best-effort — if board listing fails, fall back to the configured default so
    a transient read error never blocks a post.
    """
    default = get_settings().pinterest_default_board_id
    niche_l = (niche or "").lower().strip()
    if not niche_l:
        return default
    try:
        for b in pinterest.list_boards():
            name = (b.get("name") or "").lower()
            if name and (name in niche_l or niche_l in name):
                return b.get("id") or default
    except Exception as e:  # noqa: BLE001
        logger.warning("Herald: board lookup failed, using default: %s", e)
    return default


def _load_listing_with_design(listing_id: str) -> tuple[dict, dict] | tuple[None, None]:
    db = get_db()
    rows = db.table("listings").select("*").eq("id", listing_id).limit(1).execute()
    if not rows.data:
        return None, None
    listing = rows.data[0]
    design = {}
    if listing.get("design_id"):
        drows = (
            db.table("designs")
            .select("id, niche, concept_name, image_url")
            .eq("id", listing["design_id"]).limit(1).execute()
        )
        if drows.data:
            design = drows.data[0]
    return listing, design


def promote_listing(listing_id: str, *, force: bool = False) -> dict:
    """Post one listing to Pinterest. Idempotent unless force=True.

    Returns {ok, pin_id?, url?, skipped?, reason?}.
    """
    if not pinterest.is_configured():
        return {"ok": False, "reason": "pinterest_not_configured"}

    listing, design = _load_listing_with_design(listing_id)
    if not listing:
        return {"ok": False, "reason": "listing_not_found"}
    if listing.get("pinterest_pin_id") and not force:
        return {"ok": True, "skipped": True, "reason": "already_promoted",
                "pin_id": listing["pinterest_pin_id"]}

    image_url = (design or {}).get("image_url")
    if not image_url:
        return {"ok": False, "skipped": True, "reason": "no_image"}
    link = _etsy_url(listing)
    if not link:
        return {"ok": False, "skipped": True, "reason": "no_etsy_link"}

    board_id = _resolve_board((design or {}).get("niche", ""))
    if not board_id:
        return {"ok": False, "reason": "no_board (set PINTEREST_DEFAULT_BOARD_ID or create a board)"}

    copy = _generate_pin_copy(listing, design or {})
    try:
        pin = pinterest.create_pin(
            board_id=board_id,
            image_url=image_url,
            title=copy["title"],
            description=copy["description"],
            link=link,
        )
    except Exception as e:  # noqa: BLE001
        alog("herald", "promote_failed", f"Pin failed for listing {listing_id}: {e}")
        return {"ok": False, "reason": str(e)}

    try:
        get_db().table("listings").update({
            "pinterest_pin_id": pin["id"],
            "promoted_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", listing_id).execute()
    except Exception as e:  # noqa: BLE001
        logger.warning("Herald: pin created but DB stamp failed: %s", e)

    alog("herald", "promoted", f"Pinned '{copy['title'][:60]}' → {link}")
    return {"ok": True, "pin_id": pin["id"], "url": pin["url"], "title": copy["title"]}


def promote_pending(limit: int = 10) -> dict:
    """Sweep active, un-promoted listings and post each. Returns a run summary."""
    if not pinterest.is_configured():
        return {"ok": False, "reason": "pinterest_not_configured", "promoted": 0}

    try:
        rows = (
            get_db().table("listings")
            .select("id")
            .is_("pinterest_pin_id", "null")
            .not_.is_("etsy_listing_id", "null")
            .in_("status", ["active", "draft"])
            .limit(limit).execute()
        )
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "reason": str(e), "promoted": 0}

    ids = [r["id"] for r in (rows.data or [])]
    alog("herald", "sweep_started", f"Herald promoting {len(ids)} listing(s) to Pinterest")
    results = []
    for lid in ids:
        results.append(promote_listing(lid))
    promoted = sum(1 for r in results if r.get("ok") and not r.get("skipped"))
    alog("herald", "sweep_complete", f"Herald posted {promoted}/{len(ids)} Pins")
    return {"ok": True, "candidates": len(ids), "promoted": promoted, "results": results}


def auto_promote_pending(limit: int = 10) -> dict:
    """Scheduler entrypoint — only sweeps when PINTEREST_AUTO_PROMOTE is on."""
    if not get_settings().pinterest_auto_promote:
        logger.info("Herald: auto-promote disabled (PINTEREST_AUTO_PROMOTE=0), skipping sweep")
        return {"ok": True, "skipped": True, "reason": "auto_promote_disabled", "promoted": 0}
    return promote_pending(limit=limit)


def promotion_status() -> dict:
    """Read-only promotion coverage for the dashboard / chat brain."""
    s = get_settings()
    out = {
        "configured": pinterest.is_configured(),
        "auto_promote": s.pinterest_auto_promote,
        "promoted": 0,
        "unpromoted": 0,
    }
    if not s.supabase_url:
        return out
    try:
        db = get_db()
        promoted = (
            db.table("listings").select("id", count="exact")
            .not_.is_("pinterest_pin_id", "null").execute()
        )
        pending = (
            db.table("listings").select("id", count="exact")
            .is_("pinterest_pin_id", "null")
            .not_.is_("etsy_listing_id", "null").execute()
        )
        out["promoted"] = promoted.count or 0
        out["unpromoted"] = pending.count or 0
    except Exception as e:  # noqa: BLE001
        out["error"] = str(e)
    return out
