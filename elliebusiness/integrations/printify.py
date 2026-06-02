"""
Printify API client + approve-and-publish orchestrator.

Handles: blueprint/variant catalog, image upload, product creation,
listing copy generation, and the full approve→publish pipeline.
"""
from __future__ import annotations

import json
import logging
import re
import time

import httpx

from core.config import get_settings

BASE = "https://api.printify.com/v1"
logger = logging.getLogger(__name__)

# ── Product catalog ────────────────────────────────────────────────────────────
# Maps product type name → blueprint_id, print_provider_id, variant_ids,
# print_area position name, and default retail price in cents.
#
# Blueprint/provider IDs confirmed via API discovery (May 2026):
#   t-shirt       → Gildan 64000 @ Monster Digital (bp=6, pp=41)
#   hoodie        → Gildan 18500 @ SPOD (bp=77, pp=99)
#   mug 11oz      → Mug Press 11oz @ Printify Choice (bp=68, pp=1)
#   mug 15oz      → Mug Press 15oz @ Printify Choice (bp=425, pp=1)
#   tote bag      → AOP+ Canvas Tote (bp=553, pp=34)
#   poster        → Enhanced Matte Paper @ SPOD (bp=282, pp=99)
#   pillow        → MWW Sublimation Pillow (bp=220, pp=10)
#   sticker       → Kiss-Cut Stickers @ SPOKE (bp=400, pp=1)
#   baby_bodysuit → Infant Fine Jersey Bodysuit @ T Shirt and Sons (bp=33, pp=6)
#   canvas        → Stretched Canvas @ Prodigi (bp=555, pp=69)
#   framed_poster → Vertical Framed Poster @ Print Pigeons (bp=492, pp=36)
#   notebook      → Spiral Notebook @ SPOKE (bp=74, pp=1)

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
        "preferred_image_size": "1024x1024",
        "remove_bg": True,   # transparent design floats on shirt color
        "image_scale": 0.75,
        "image_x": 0.5,
        "image_y": 0.42,
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
        "preferred_image_size": "1024x1024",
        "remove_bg": True,
        "image_scale": 0.60,
        "image_x": 0.5,
        "image_y": 0.45,
    },
    "mug": {
        "blueprint_id": 68,
        "print_provider_id": 1,
        "variant_ids": [33719],
        "print_area": "front",
        "price_cents": 1699,
        "preferred_image_size": "1024x1024",
        "remove_bg": False,
        "image_scale": 0.45,
        "image_x": 0.5,
        "image_y": 0.5,
    },
    "mug_15oz": {
        "blueprint_id": 425,
        "print_provider_id": 1,
        "variant_ids": [62014],
        "print_area": "front",
        "price_cents": 1899,
        "preferred_image_size": "1024x1024",
        "remove_bg": False,
        "image_scale": 0.45,
        "image_x": 0.5,
        "image_y": 0.5,
    },
    "tote bag": {
        "blueprint_id": 553,
        "print_provider_id": 34,
        "variant_ids": [70603, 70646],
        "print_area": "front",
        "price_cents": 1999,
        "preferred_image_size": "1024x1024",
        "remove_bg": True,
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
        # Portrait image fills the print area edge-to-edge.
        "preferred_image_size": "1024x1536",
        "remove_bg": False,  # full-bleed art — keep background
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
        "preferred_image_size": "1024x1024",
        "remove_bg": True,
        "image_scale": 0.80,
        "image_x": 0.5,
        "image_y": 0.5,
    },
    "sticker": {
        "blueprint_id": 400,
        "print_provider_id": 1,
        "variant_ids": [45747, 45748, 45749, 45750, 45751, 45752, 45753, 45754],
        "print_area": "front",
        "price_cents": 699,
        "preferred_image_size": "1024x1024",
        "remove_bg": True,   # essential for die-cut stickers
        "image_scale": 0.90,
        "image_x": 0.5,
        "image_y": 0.5,
    },
    "baby_bodysuit": {
        "blueprint_id": 33,
        "print_provider_id": 6,
        "variant_ids": [
            62371, 62357, 62363, 62365, 62366,   # White/Black/LtBlue/Navy/Pink — NB (0-3M)
            31472, 31442, 31458, 31463, 31465,   # White/Black/LtBlue/Navy/Pink — 6M
            31436, 31406, 31422, 31427, 31429,   # White/Black/LtBlue/Navy/Pink — 12M
            31508, 31478, 31494, 31501,          # White/Black/LtBlue/Pink — 18M
        ],
        "print_area": "front",
        "price_cents": 1999,
        "preferred_image_size": "1024x1024",
        "remove_bg": True,
        "image_scale": 0.55,
        "image_x": 0.5,
        "image_y": 0.40,
    },
    "canvas": {
        "blueprint_id": 555,
        "print_provider_id": 69,
        "variant_ids": [70880, 70882, 70883, 70886, 70888],
        "print_area": "front",
        "price_cents": 3999,
        "preferred_image_size": "1024x1536",
        "remove_bg": False,  # gallery art — keep full background
        "image_scale": 1.0,
        "image_x": 0.5,
        "image_y": 0.5,
    },
    "framed_poster": {
        "blueprint_id": 492,
        "print_provider_id": 36,
        "variant_ids": [65400, 65401, 65402, 65403, 65406, 65407, 65410, 65411,
                        66164, 66165, 66226, 66227, 66228, 66229],
        "print_area": "front",
        "price_cents": 4999,
        "preferred_image_size": "1024x1536",
        "remove_bg": False,
        "image_scale": 0.95,
        "image_x": 0.5,
        "image_y": 0.5,
    },
    "notebook": {
        "blueprint_id": 74,
        "print_provider_id": 1,
        "variant_ids": [34240],
        "print_area": "front",
        "price_cents": 1799,
        "preferred_image_size": "1024x1024",
        "remove_bg": True,
        "image_scale": 0.85,
        "image_x": 0.5,
        "image_y": 0.5,
    },
}


def preferred_image_size_for_products(product_names: list[str]) -> str:
    """Pick the best image generation size given a list of product types."""
    sizes = {
        resolve_product(p).get("preferred_image_size", "1024x1024")
        for p in product_names
        if resolve_product(p)
    }
    if "1536x1024" in sizes:
        return "1536x1024"
    if sizes == {"1024x1536"}:
        return "1024x1536"
    return "1024x1024"

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
    # Stickers / candle labels
    "kiss cut sticker": "sticker",
    "kiss-cut sticker": "sticker",
    "sticker sheet": "sticker",
    "candle label": "sticker",
    "label": "sticker",
    "vinyl sticker": "sticker",
    # Baby bodysuit
    "baby onesie": "baby_bodysuit",
    "onesie": "baby_bodysuit",
    "infant onesie": "baby_bodysuit",
    "baby bodysuit": "baby_bodysuit",
    "infant bodysuit": "baby_bodysuit",
    "baby": "baby_bodysuit",
    # Canvas
    "stretched canvas": "canvas",
    "gallery canvas": "canvas",
    "canvas print": "canvas",
    "gallery wrap": "canvas",
    "art canvas": "canvas",
    # Framed poster
    "framed print": "framed_poster",
    "framed art": "framed_poster",
    "framed wall art": "framed_poster",
    "fine art print": "framed_poster",
    "framed canvas": "framed_poster",
    # Notebook
    "journal": "notebook",
    "spiral notebook": "notebook",
    "hardcover journal": "notebook",
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
    max_retries: int = 3,
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

    last_exc: Exception | None = None
    for attempt in range(max_retries):
        try:
            r = httpx.post(
                f"{BASE}/shops/{_shop_id()}/products.json",
                headers=_headers(), json=payload, timeout=90,
            )
            r.raise_for_status()
            return r.json()
        except httpx.HTTPStatusError as e:
            last_exc = e
            if e.response.status_code == 500 and attempt < max_retries - 1:
                wait = 2 ** attempt  # 1s, 2s, 4s
                logger.warning(f"Printify: 500 on attempt {attempt + 1}, retrying in {wait}s…")
                time.sleep(wait)
                continue
            raise
        except Exception as e:
            last_exc = e
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
                continue
            raise
    raise last_exc  # type: ignore


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
        raw = complete(prompt, task="listing_copy", json_mode=True)
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

def approve_and_publish(
    design_id: str,
    products_override: list[str] | None = None,
    progress_cb=None,   # callable(step, current_product, products_done, products_total)
) -> dict:
    """
    Full pipeline: approved design → Printify drafts ready for your review.

    Products are created in Printify as drafts with correct placement/scaling.
    You approve and publish from the Printify dashboard — nothing goes live automatically.

    products_override: if given, use these product types instead of the design's stored list.
                       Used for repurpose runs (reusing existing designs on new product types).

    1. Fetch design from DB
    2. Download image from Supabase Storage
    3. For each product type in the design's products list (or products_override):
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
    products = products_override or design.get("products") or ["t-shirt", "mug"]

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
    total_products = len(products)

    for idx, product_name in enumerate(products):
        if progress_cb:
            progress_cb("creating", product_name, idx, total_products)

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

        # Optionally strip background before upload
        upload_bytes = image_bytes
        if image_bytes and spec.get("remove_bg"):
            try:
                from core.image_gen import remove_background
                upload_bytes = remove_background(image_bytes)
                logger.info(f"Printify: background removed for {product_name}")
            except Exception as e:
                logger.warning(f"Printify: bg removal failed for {product_name}, using original: {e}")

        # Upload image to Printify (or reuse placeholder if no image)
        printify_image_id = None
        if upload_bytes:
            try:
                filename = f"{design_id}_{product_name.replace(' ', '_')}.png"
                img_obj = upload_image(filename, upload_bytes)
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

        # Build print_areas — extra_placements adds more images to the same placeholder
        # (used for mugs: two copies of the design on the same wrap-around print area)
        primary_image = {
            "id": printify_image_id,
            "x": spec.get("image_x", 0.5),
            "y": spec.get("image_y", 0.5),
            "scale": spec.get("image_scale", 0.8),
            "angle": 0,
        }
        all_images = [primary_image] + [
            {"id": printify_image_id, "x": p["x"], "y": p["y"],
             "scale": p["scale"], "angle": 0}
            for p in spec.get("extra_placements", [])
        ]
        print_areas = [{
            "variant_ids": spec["variant_ids"],
            "placeholders": [{
                "position": spec["print_area"],
                "images": all_images,
            }],
        }]

        # Build merged tag list: LLM copy tags + Nova research tags, deduplicated
        copy_tags = copy.get("tags") or []
        merged_tags = copy_tags + [t for t in nova_tags if t not in copy_tags]
        final_tags = merged_tags[:13]

        # Create product as draft (no publish call — Drew approves in Printify)
        try:
            product = create_product(
                title=copy["title"][:140],
                description=copy["description"],
                blueprint_id=spec["blueprint_id"],
                print_provider_id=spec["print_provider_id"],
                variants=variants_payload,
                print_areas=print_areas,
                tags=final_tags,
            )
            product_id = product.get("id")
            logger.info(f"Printify: created draft {product_id} for '{product_name}'")

            # Wait briefly then re-fetch so Printify can finish generating all mockup images
            time.sleep(2)
            try:
                full_product = get_product(product_id)
                n_images = len(full_product.get("images", []))
                logger.info(f"Printify: {n_images} mockup image(s) generated for {product_id}")
            except Exception:
                pass
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
