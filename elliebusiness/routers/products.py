"""
Product Maker — manual Printify draft creation with ELLIE-generated copy.

GET  /products/catalog        → dropdown options
GET  /products/designs        → recent designs with images for picker
POST /products/generate_copy  → ELLIE writes title / description / tags / price
POST /products/create_draft   → upload image + create single Printify draft
"""
from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, Query
from pydantic import BaseModel

from integrations.printify import (
    PRODUCT_CATALOG,
    _generate_listing_copy,
    _get_nova_tags,
    resolve_product,
    upload_image,
    create_product,
)

router = APIRouter(prefix="/products", tags=["products"])
logger = logging.getLogger(__name__)

CATALOG_LIST = [
    {
        "key": k,
        "label": k.replace("_", " ").title(),
        "price_usd": v["price_cents"] / 100,
    }
    for k, v in PRODUCT_CATALOG.items()
]


class GenerateCopyBody(BaseModel):
    design_id: str
    product_type: str


class CreateDraftBody(BaseModel):
    design_id: str
    product_type: str
    title: str
    description: str
    tags: list[str] = []
    price_usd: float | None = None


@router.get("/catalog")
def get_catalog() -> dict:
    """All product types available for selection."""
    return {"products": CATALOG_LIST}


@router.get("/designs")
def get_recent_designs(limit: int = Query(40, ge=1, le=100)) -> dict:
    """Recent designs that have images — for the design picker."""
    try:
        from core.supabase_client import get_db
        rows = (
            get_db().table("designs")
            .select("id, concept_name, niche, image_url, forge_score, status, products")
            .not_.is_("image_url", "null")
            .neq("image_url", "")
            .in_("status", ["approved", "draft_on_printify", "listed", "pending_drew_review"])
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return {"designs": rows.data or []}
    except Exception as e:
        logger.warning(f"Products: design fetch failed: {e}")
        return {"designs": [], "error": str(e)}


@router.post("/generate_copy")
def generate_copy(body: GenerateCopyBody) -> dict:
    """ELLIE generates SEO-optimised Etsy listing copy for a design + product combo."""
    try:
        from core.supabase_client import get_db
        row = get_db().table("designs").select("*").eq("id", body.design_id).single().execute()
        if not row.data:
            return {"error": "Design not found"}
        design = row.data
    except Exception as e:
        return {"error": str(e)}

    niche = design.get("niche", "general")
    concept_name = design.get("concept_name", "Untitled")

    spec = resolve_product(body.product_type)
    if not spec:
        return {"error": f"Unknown product type: {body.product_type}"}

    price_sweet_spot = f"${spec['price_cents'] / 100:.2f}"
    nova_tags = _get_nova_tags(niche)

    copy = _generate_listing_copy(
        niche=niche,
        design_name=concept_name,
        product_type=body.product_type,
        tags=nova_tags,
        price_sweet_spot=price_sweet_spot,
    )
    copy["design_name"] = concept_name
    copy["niche"] = niche
    copy.setdefault("price_usd", spec["price_cents"] / 100)

    try:
        from core.activity import log as alog
        alog("ellie", "copy_generated",
             f"Generated listing copy for '{concept_name}' as {body.product_type}")
    except Exception:
        pass

    return copy


@router.post("/create_draft")
def create_draft(body: CreateDraftBody) -> dict:
    """Download design image, upload to Printify, and create a product draft."""
    try:
        from core.supabase_client import get_db
        row = get_db().table("designs").select("*").eq("id", body.design_id).single().execute()
        if not row.data:
            return {"ok": False, "error": "Design not found"}
        design = row.data
    except Exception as e:
        return {"ok": False, "error": str(e)}

    image_url = design.get("image_url", "")
    concept_name = design.get("concept_name", "Untitled")

    spec = resolve_product(body.product_type)
    if not spec:
        return {"ok": False, "error": f"Unknown product type: {body.product_type}"}

    # Download image from Supabase Storage
    if not image_url:
        return {"ok": False, "error": "This design has no image URL"}

    try:
        resp = httpx.get(image_url, timeout=30)
        resp.raise_for_status()
        image_bytes = resp.content
    except Exception as e:
        return {"ok": False, "error": f"Image download failed: {e}"}

    # Upload to Printify media library
    try:
        filename = f"{body.design_id}_{body.product_type.replace(' ', '_')}.png"
        img_obj = upload_image(filename, image_bytes)
        printify_image_id = img_obj.get("id")
    except Exception as e:
        return {"ok": False, "error": f"Printify image upload failed: {e}"}

    price_cents = int((body.price_usd or spec["price_cents"] / 100) * 100)
    variants_payload = [
        {"id": vid, "price": price_cents, "is_enabled": True}
        for vid in spec["variant_ids"]
    ]
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

    try:
        product = create_product(
            title=body.title[:140],
            description=body.description,
            blueprint_id=spec["blueprint_id"],
            print_provider_id=spec["print_provider_id"],
            variants=variants_payload,
            print_areas=print_areas,
            tags=body.tags[:13],
        )
        product_id = product.get("id")
        logger.info(f"Products: draft created {product_id} for '{concept_name}' as {body.product_type}")
    except Exception as e:
        logger.error(f"Products: create_draft failed: {e}")
        return {"ok": False, "error": f"Printify product creation failed: {e}"}

    try:
        from core.activity import log as alog
        alog("archives", "design_published",
             f"Manual draft: '{concept_name}' as {body.product_type} — id {product_id}",
             metadata={"design_id": body.design_id, "product_id": product_id})
    except Exception:
        pass

    return {
        "ok": True,
        "product_id": product_id,
        "title": body.title,
        "product_type": body.product_type,
        "message": f"Draft '{body.title[:60]}' created — review in Printify dashboard",
    }
