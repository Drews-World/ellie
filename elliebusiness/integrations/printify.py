"""
Printify API client.

Handles: listing shops, browsing blueprints/print providers,
uploading images, creating products, submitting orders.

Docs: https://developers.printify.com/
"""
from __future__ import annotations

import httpx

from core.config import get_settings

BASE = "https://api.printify.com/v1"

# Common blueprint IDs (add more as needed)
BLUEPRINTS = {
    "mug_11oz": 366,
    "mug_15oz": 368,
    "tshirt_unisex": 6,
    "poster_12x16": 52,
    "canvas_12x16": 91,
}


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


# ── Discovery ─────────────────────────────────────────────────────────────────

def list_shops() -> list[dict]:
    r = httpx.get(f"{BASE}/shops.json", headers=_headers(), timeout=10)
    r.raise_for_status()
    return r.json()


def list_print_providers(blueprint_id: int) -> list[dict]:
    r = httpx.get(f"{BASE}/catalog/blueprints/{blueprint_id}/print_providers.json", headers=_headers(), timeout=10)
    r.raise_for_status()
    return r.json()


def get_variants(blueprint_id: int, print_provider_id: int) -> list[dict]:
    r = httpx.get(
        f"{BASE}/catalog/blueprints/{blueprint_id}/print_providers/{print_provider_id}/variants.json",
        headers=_headers(), timeout=10,
    )
    r.raise_for_status()
    return r.json().get("variants", [])


# ── Images ────────────────────────────────────────────────────────────────────

def upload_image(filename: str, image_bytes: bytes) -> dict:
    """Upload a design image to Printify media library. Returns image object with id."""
    import base64
    payload = {
        "file_name": filename,
        "contents": base64.b64encode(image_bytes).decode(),
    }
    r = httpx.post(f"{BASE}/uploads/images.json", headers=_headers(), json=payload, timeout=30)
    r.raise_for_status()
    return r.json()


# ── Products ──────────────────────────────────────────────────────────────────

def create_product(
    title: str,
    description: str,
    blueprint_id: int,
    print_provider_id: int,
    variants: list[dict],           # [{id: int, price: int (cents), is_enabled: bool}]
    print_areas: list[dict],        # Printify print area spec
) -> dict:
    payload = {
        "title": title,
        "description": description,
        "blueprint_id": blueprint_id,
        "print_provider_id": print_provider_id,
        "variants": variants,
        "print_areas": print_areas,
    }
    r = httpx.post(f"{BASE}/shops/{_shop_id()}/products.json", headers=_headers(), json=payload, timeout=20)
    r.raise_for_status()
    return r.json()


def publish_product(product_id: str) -> dict:
    """Publish a Printify product to Etsy (if shop is connected)."""
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
    r = httpx.get(f"{BASE}/shops/{_shop_id()}/products/{product_id}.json", headers=_headers(), timeout=10)
    r.raise_for_status()
    return r.json()
