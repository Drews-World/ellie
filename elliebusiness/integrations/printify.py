"""
Printify API client + approve-and-publish orchestrator.

Handles: blueprint/variant catalog, image upload, product creation,
listing copy generation, and the full approve→publish pipeline.
"""
from __future__ import annotations

import json
import logging
import re

import httpx

from core.config import get_settings

BASE = "https://api.printify.com/v1"
logger = logging.getLogger(__name__)

# ── Product catalog ────────────────────────────────────────────────────────────
# Maps product type name → blueprint_id, print_provider_id, variant_ids,
# print_area position name, and default retail price in cents.
#
# Blueprint/provider IDs confirmed via API discovery (May 2026):
#   t-shirt  → Gildan 64000 @ Monster Digital (bp=6, pp=41)
#   hoodie   → Gildan 18500 @ SPOD (bp=77, pp=99)
#   mug 11oz → Mug Press 11oz @ Printify Choice (bp=68, pp=1)
#   mug 15oz → Mug Press 15oz @ Printify Choice (bp=425, pp=1)
#   tote bag → AOP+ Canvas Tote (bp=553, pp=34)
#   poster   → Enhanced Matte Paper @ SPOD (bp=282, pp=99)
#   pillow   → MWW Sublimation Pillow (bp=220, pp=10)

PRODUCT_CATALOG: dict[str, dict] = {
    "t-shirt": {
        "blueprint_id": 6,
        "print_provider_id": 41,
        "variant_ids": [
            11986, 11987, 11988, 11989, 11990,   # Navy S/M/L/XL/2XL
            12100, 12101, 12102, 12103, 12104,   # White S/M/L/XL/2XL
            12124, 12125, 12126, 12127, 12128,   # Black S/M/L/XL/2XL
        ],
        "print_area": "front",
        "price_cents": 2499,
        # Print area: 12"×16" portrait at 150 DPI. Scale=0.75 fills ~9" of the 12" wide
        # chest — centered, intentional, not edge-to-edge.
        "image_scale": 0.75,
        "image_x": 0.5,
        "image_y": 0.42,  # Slightly above center (upper chest)
    },
    "hoodie": {
        "blueprint_id": 77,
        "print_provider_id": 99,
        "variant_ids": [
            32894, 32895, 32896, 32897, 32898,   # Navy S/M/L/XL/2XL
            32902, 32903, 32904, 32905, 32906,   # Sport Grey S/M/L/XL/2XL
            32910, 32911, 32912, 32913, 32914,   # White S/M/L/XL/2XL
            32918, 32919, 32920, 32921, 32922,   # Black S/M/L/XL/2XL
        ],
        "print_area": "front",
        "price_cents": 4499,
        # Same chest print area as t-shirt; slightly smaller to account for kangaroo pocket area.
        "image_scale": 0.70,
        "image_x": 0.5,
        "image_y": 0.40,
    },
    "mug": {
        "blueprint_id": 68,
        "print_provider_id": 1,
        "variant_ids": [33719],
        "print_area": "front",
        "price_cents": 1699,
        # 11oz mug wrap: ~8.07"×3.63" landscape (aspect ratio ≈ 2.22).
        # A square image at scale=1 would span full width but be clipped ~55% top/bottom.
        # scale=0.42 makes image height ≈ mug print height with small margins.
        "image_scale": 0.42,
        "image_x": 0.5,
        "image_y": 0.5,
    },
    "mug_15oz": {
        "blueprint_id": 425,
        "print_provider_id": 1,
        "variant_ids": [62014],
        "print_area": "front",
        "price_cents": 1899,
        # 15oz mug wrap: ~8.07"×4.72" landscape (aspect ratio ≈ 1.71).
        # scale=0.55 fits image height within the taller 15oz print area.
        "image_scale": 0.55,
        "image_x": 0.5,
        "image_y": 0.5,
    },
    "tote bag": {
        "blueprint_id": 553,
        "print_provider_id": 34,
        "variant_ids": [70603, 70646],
        "print_area": "front",
        "price_cents": 1999,
        # Canvas tote print area is square-ish. Scale=0.85 fills nicely with small margin.
        "image_scale": 0.85,
        "image_x": 0.5,
        "image_y": 0.5,
    },
    "poster": {
        "blueprint_id": 282,
        "print_provider_id": 99,
        "variant_ids": [43135, 43138, 43141, 43144, 43147, 43150],
        "print_area": "front",
        "price_cents": 1699,
        # Poster is portrait (12"×16" and larger). Fill edge-to-edge — art prints look best full bleed.
        "image_scale": 1.0,
        "image_x": 0.5,
        "image_y": 0.5,
    },
    "pillow": {
        "blueprint_id": 220,
        "print_provider_id": 10,
        "variant_ids": [41521, 41524, 41527, 41530, 244992, 244993],
        "print_area": "front",
        "price_cents": 2999,
        # 14"×14" square sublimation pillow. Full bleed looks great.
        "image_scale": 1.0,
        "image_x": 0.5,
        "image_y": 0.5,
    },
}

# Normalize common aliases to catalog keys
PRODUCT_ALIASES: dict[str, str] = {
    "t shirt": "t-shirt",
    "tshirt": "t-shirt",
    "shirt": "t-shirt",
    "unisex tee": "t-shirt",
    "hooded sweatshirt": "hoodie",
    "sweatshirt": "hoodie",
    "coffee mug": "mug",
    "11oz mug": "mug",
    "mug 11oz": "mug",
    "15oz mug": "mug_15oz",
    "mug 15oz": "mug_15oz",
    "tote": "tote bag",
    "canvas tote": "tote bag",
    "art print": "poster",
    "print": "poster",
    "wall art": "poster",
    "throw pillow": "pillow",
    "accent pillow": "pillow",
    "decorative pillow": "pillow",
}


def resolve_product(name: str) -> dict | None:
    """Return catalog entry for a product name, or None if not in catalog."""
    key = name.lower().strip()
    key = PRODUCT_ALIASES.get(key, key)
    return PRODUCT_CATALOG.get(key)


# ── Auth helpers ───────────────────────────────────────────────────────────────

def _headers() -> dict[str, str]:
    s = get_settings()
    if not s.printify_api_token:
        raise RuntimeError("PRINTIFY_API_TOKEN not set.")
    return {"Authorization": f"Bearer {s.printify_api_token}"}


def _shop_id() -> str:
    s = get_settings()
    if not s.printify_shop_id:
        raise RuntimeError("PRINTIFY_SHOP_ID not set.")
    return s.printify_shop_id


# ── Discovery ──────────────────────────────────────────────────────────────────

def list_shops() -> list[dict]:
    r = httpx.get(f"{BASE}/shops.json", headers=_headers(), timeout=10)
    r.raise_for_status()
    return r.json()


def list_print_providers(blueprint_id: int) -> list[dict]:
    r = httpx.get(
        f"{BASE}/catalog/blueprints/{blueprint_id}/print_providers.json",
        headers=_headers(), timeout=10,
    )
    r.raise_for_status()
    return r.json()


def get_variants(blueprint_id: int, print_provider_id: int) -> list[dict]:
    r = httpx.get(
        f"{BASE}/catalog/blueprints/{blueprint_id}/print_providers/{print_provider_id}/variants.json",
        headers=_headers(), timeout=10,
    )
    r.raise_for_status()
    data = r.json()
    # API returns a list directly for some blueprints, dict with 'variants' key for others
    return data if isinstance(data, list) else data.get("variants", [])


# ── Images ─────────────────────────────────────────────────────────────────────

def upload_image(filename: str, image_bytes: bytes) -> dict:
    """Upload a design image to Printify media library. Returns image object with id."""
    import base64
    payload = {
        "file_name": filename,
        "contents": base64.b64encode(image_bytes).decode(),
    }
    r = httpx.post(f"{BASE}/uploads/images.json", headers=_headers(), json=payload, timeout=60)
    r.raise_for_status()
    return r.json()


# ── Products ───────────────────────────────────────────────────────────────────

def create_product(
    title: str,
    description: str,
    blueprint_id: int,
    print_provider_id: int,
    variants: list[dict],   # [{id: int, price: int (cents), is_enabled: bool}]
    print_areas: list[dict],
    tags: list[str] | None = None,
) -> dict:
    payload = {
        "title": title,
        "description": description,
        "blueprint_id": blueprint_id,
        "print_provider_id": print_provider_id,
        "variants": variants,
        "print_areas": print_areas,
    }
    if tags:
        payload["tags"] = tags[:13]
    r = httpx.post(
        f"{BASE}/shops/{_shop_id()}/products.json",
        headers=_headers(), json=payload, timeout=30,
    )
    r.raise_for_status()
    return r.json()


def publish_product(product_id: str) -> dict:
    """Publish a Printify product to the connected sales channel (Etsy)."""
    payload = {
        "title": True,
        "description": True,
        "images": True,
        "variants": True,
        "tags": True,
        "keyFeatures": True,
        "shipping_template": True,
    }
    r = httpx.post(
        f"{BASE}/shops/{_shop_id()}/products/{product_id}/publish.json",
        headers=_headers(), json=payload, timeout=15,
    )
    r.raise_for_status()
    return r.json()


def get_product(product_id: str) -> dict:
    r = httpx.get(
        f"{BASE}/shops/{_shop_id()}/products/{product_id}.json",
        headers=_headers(), timeout=10,
    )
    r.raise_for_status()
    return r.json()


# ── Listing copy ───────────────────────────────────────────────────────────────

def _generate_listing_copy(
    niche: str,
    design_name: str,
    product_type: str,
    tags: list[str],
    price_sweet_spot: str,
) -> dict:
    """Generate SEO-optimized Etsy listing copy via LLM."""
    from agents.forge.prompts import LISTING_COPY_PROMPT
    from core.llm import complete

    prompt = LISTING_COPY_PROMPT.format(
        niche=niche,
        design_name=design_name,
        product_type=product_type,
        tags=", ".join(tags) if tags else "none",
        price_sweet_spot=price_sweet_spot,
    )
    try:
        raw = complete(prompt, fast=False, json_mode=True)
        raw = raw.strip()
        fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
        if fenced:
            raw = fenced.group(1).strip()
        return json.loads(raw)
    except Exception as e:
        logger.warning(f"Printify: listing copy generation failed: {e}")
        return {
            "title": f"{design_name} — {product_type.title()} | {niche.title()} Gift",
            "description": f"A unique {product_type} featuring the '{design_name}' design. Perfect for {niche} fans.",
            "tags": tags[:13] if tags else [],
            "price_usd": 19.99,
        }


def _get_nova_tags(niche: str) -> list[str]:
    """Pull top tags from Nova's latest trend for this niche."""
    try:
        from core.supabase_client import get_db
        db = get_db()
        rows = (
            db.table("trends")
            .select("top_tags")
            .eq("niche", niche)
            .order("observed_at", desc=True)
            .limit(1)
            .execute()
        )
        if rows.data:
            return rows.data[0].get("top_tags") or []
    except Exception:
        pass
    return []


# ── Approve and publish ────────────────────────────────────────────────────────

def approve_and_publish(design_id: str) -> dict:
    """
    Full pipeline: approved design → Printify drafts ready for your review.

    Products are created in Printify as drafts with correct placement/scaling.
    You approve and publish from the Printify dashboard — nothing goes live automatically.

    1. Fetch design from DB
    2. Download image from Supabase Storage
    3. For each product type in the design's products list:
       a. Resolve to Printify blueprint/variants
       b. Generate listing copy
       c. Upload image to Printify
       d. Create product (draft — no publish call)
    4. Update design status to 'draft_on_printify'
    5. Return summary
    """
    from core.supabase_client import get_db

    db = get_db()

    # 1. Fetch design
    result = db.table("designs").select("*").eq("id", design_id).single().execute()
    if not result.data:
        raise ValueError(f"Design {design_id} not found")
    design = result.data

    niche = design.get("niche", "general")
    concept_name = design.get("concept_name", "Untitled")
    image_url = design.get("image_url", "")
    products = design.get("products") or ["t-shirt", "mug"]

    logger.info(f"Printify: publishing design '{concept_name}' ({design_id}) → {products}")

    # 2. Download image
    image_bytes: bytes | None = None
    if image_url:
        try:
            resp = httpx.get(image_url, timeout=30)
            resp.raise_for_status()
            image_bytes = resp.content
            logger.info(f"Printify: downloaded image ({len(image_bytes)} bytes)")
        except Exception as e:
            logger.warning(f"Printify: image download failed: {e}")

    # 3. Get Nova tags for listing copy
    nova_tags = _get_nova_tags(niche)

    published = []
    skipped = []

    for product_name in products:
        spec = resolve_product(product_name)
        if not spec:
            logger.warning(f"Printify: unknown product type '{product_name}', skipping")
            skipped.append({"product": product_name, "reason": "not in catalog"})
            continue

        price_usd = spec["price_cents"] / 100
        price_sweet_spot = f"${price_usd:.2f}"

        # Generate listing copy
        copy = _generate_listing_copy(
            niche=niche,
            design_name=concept_name,
            product_type=product_name,
            tags=nova_tags,
            price_sweet_spot=price_sweet_spot,
        )

        # Upload image to Printify (or reuse placeholder if no image)
        printify_image_id = None
        if image_bytes:
            try:
                filename = f"{design_id}_{product_name.replace(' ', '_')}.png"
                img_obj = upload_image(filename, image_bytes)
                printify_image_id = img_obj.get("id")
                logger.info(f"Printify: uploaded image → id={printify_image_id}")
            except Exception as e:
                logger.warning(f"Printify: image upload failed for {product_name}: {e}")

        if not printify_image_id:
            skipped.append({"product": product_name, "reason": "no image to upload"})
            continue

        # Build variants list
        variant_price = copy.get("price_usd", price_usd)
        price_in_cents = int(float(variant_price) * 100)
        variants_payload = [
            {"id": vid, "price": price_in_cents, "is_enabled": True}
            for vid in spec["variant_ids"]
        ]

        # Build print_areas using per-product scale/position from catalog
        print_areas = [{
            "variant_ids": spec["variant_ids"],
            "placeholders": [{
                "position": spec["print_area"],
                "images": [{
                    "id": printify_image_id,
                    "x": spec.get("image_x", 0.5),
                    "y": spec.get("image_y", 0.5),
                    "scale": spec.get("image_scale", 0.8),
                    "angle": 0,
                }],
            }],
        }]

        # Create product as draft (no publish call — Drew approves in Printify)
        try:
            product = create_product(
                title=copy["title"][:140],
                description=copy["description"],
                blueprint_id=spec["blueprint_id"],
                print_provider_id=spec["print_provider_id"],
                variants=variants_payload,
                print_areas=print_areas,
                tags=copy.get("tags", nova_tags)[:13],
            )
            product_id = product.get("id")
            logger.info(f"Printify: created draft {product_id} for '{product_name}'")
        except Exception as e:
            logger.error(f"Printify: product creation failed for {product_name}: {e}")
            skipped.append({"product": product_name, "reason": str(e)})
            continue

        published.append({
            "product": product_name,
            "product_id": product_id,
            "title": copy["title"][:80],
            "price_usd": variant_price,
        })

    # 4. Update design status
    final_status = "draft_on_printify" if published else "publish_failed"
    try:
        db.table("designs").update({"status": final_status}).eq("id", design_id).execute()
    except Exception as e:
        logger.warning(f"Printify: DB status update failed: {e}")

    return {
        "design_id": design_id,
        "concept_name": concept_name,
        "drafts": published,
        "skipped": skipped,
        "status": final_status,
    }
