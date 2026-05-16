# -*- coding: utf-8 -*-
"""
Printify blueprint discovery — finds correct blueprint/provider/variant IDs
for new product types and prints catalog-ready entries.

Run from the elliebusiness/ directory:
    python scripts/discover_blueprints.py
"""
from __future__ import annotations
import os, sys, pathlib, json
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(pathlib.Path(__file__).parent.parent / ".env")

import httpx

TOKEN = os.environ.get("PRINTIFY_API_TOKEN", "")
BASE  = "https://api.printify.com/v1"

if not TOKEN:
    print("ERROR: PRINTIFY_API_TOKEN not set in .env")
    sys.exit(1)

HEADERS = {"Authorization": f"Bearer {TOKEN}"}

# ── Product types to discover ─────────────────────────────────────────────────
# (search_terms, canonical_name, target_price_cents)
TARGETS = [
    (["kiss-cut sticker", "sticker sheet", "sticker"],         "sticker",        699),
    (["infant bodysuit", "baby bodysuit", "onesie", "baby"],   "baby_bodysuit",  1999),
    (["canvas", "stretched canvas", "gallery canvas"],         "canvas",         3999),
    (["framed poster", "framed print", "framed"],              "framed_poster",  4999),
    (["notebook", "journal", "spiral notebook"],               "notebook",       1799),
]

def fetch_all_blueprints() -> list[dict]:
    print("Fetching full Printify blueprint catalog...")
    r = httpx.get(f"{BASE}/catalog/blueprints.json", headers=HEADERS, timeout=30)
    r.raise_for_status()
    data = r.json()
    blueprints = data if isinstance(data, list) else data.get("data", data)
    print(f"  → {len(blueprints)} blueprints total\n")
    return blueprints

def find_matches(blueprints: list[dict], search_terms: list[str]) -> list[dict]:
    results = []
    for bp in blueprints:
        title = (bp.get("title") or "").lower()
        desc  = (bp.get("description") or "").lower()
        for term in search_terms:
            if term.lower() in title or term.lower() in desc:
                results.append(bp)
                break
    return results

def fetch_providers(blueprint_id: int) -> list[dict]:
    r = httpx.get(
        f"{BASE}/catalog/blueprints/{blueprint_id}/print_providers.json",
        headers=HEADERS, timeout=15,
    )
    if r.status_code != 200:
        return []
    data = r.json()
    return data if isinstance(data, list) else data.get("print_providers", [])

def fetch_variants(blueprint_id: int, provider_id: int) -> list[dict]:
    r = httpx.get(
        f"{BASE}/catalog/blueprints/{blueprint_id}/print_providers/{provider_id}/variants.json",
        headers=HEADERS, timeout=15,
    )
    if r.status_code != 200:
        return []
    data = r.json()
    variants = data if isinstance(data, list) else data.get("variants", [])
    return variants

def pick_provider(providers: list[dict]) -> dict | None:
    """Prefer Printify Choice (id=1), then lowest ID available."""
    if not providers:
        return None
    for p in providers:
        if p.get("id") == 1:
            return p
    return min(providers, key=lambda p: p.get("id", 9999))

def pick_variants(variants: list[dict], max_count: int = 20) -> list[int]:
    """Return a reasonable subset of variant IDs (enabled variants only)."""
    enabled = [v for v in variants if v.get("is_available", True)]
    ids = [v["id"] for v in enabled[:max_count]]
    return ids

# ── Main ─────────────────────────────────────────────────────────────────────
blueprints = fetch_all_blueprints()

catalog_entries = {}

for search_terms, canonical, price_cents in TARGETS:
    print(f"{'─'*60}")
    print(f"SEARCHING: {canonical} (terms: {search_terms})")

    matches = find_matches(blueprints, search_terms)
    if not matches:
        print(f"  ✗ No matches found for any search term")
        continue

    print(f"  Found {len(matches)} matching blueprints:")
    for bp in matches[:5]:
        print(f"    [{bp['id']}] {bp['title']}")

    # Use first match (usually most basic/popular)
    chosen_bp = matches[0]
    bp_id = chosen_bp["id"]
    print(f"\n  Using blueprint [{bp_id}]: {chosen_bp['title']}")

    providers = fetch_providers(bp_id)
    if not providers:
        print(f"  ✗ No print providers found")
        continue

    provider = pick_provider(providers)
    pp_id = provider["id"]
    print(f"  Print provider [{pp_id}]: {provider.get('title', '?')}")

    variants = fetch_variants(bp_id, pp_id)
    variant_ids = pick_variants(variants)
    print(f"  Variants: {len(variant_ids)} enabled (first few: {variant_ids[:5]})")

    # Detect print area name
    if variants:
        sample = variants[0]
        placeholders = sample.get("placeholders") or []
        print_area = placeholders[0].get("position", "front") if placeholders else "front"
    else:
        print_area = "front"

    catalog_entries[canonical] = {
        "blueprint_id": bp_id,
        "blueprint_title": chosen_bp["title"],
        "print_provider_id": pp_id,
        "print_provider_title": provider.get("title", ""),
        "variant_ids": variant_ids,
        "print_area": print_area,
        "price_cents": price_cents,
    }
    print()

# ── Output ready-to-paste catalog entries ────────────────────────────────────
print("\n" + "="*60)
print("CATALOG ENTRIES — paste into integrations/printify.py:")
print("="*60)
for name, entry in catalog_entries.items():
    bp_title = entry.pop("blueprint_title", "")
    pp_title = entry.pop("print_provider_title", "")
    print(f'\n    "{name}": {{')
    print(f'        # {bp_title} @ {pp_title}')
    print(f'        "blueprint_id": {entry["blueprint_id"]},')
    print(f'        "print_provider_id": {entry["print_provider_id"]},')
    print(f'        "variant_ids": {entry["variant_ids"]},')
    print(f'        "print_area": "{entry["print_area"]}",')
    print(f'        "price_cents": {entry["price_cents"]},')
    print(f'        "image_scale": 1.0,  # TODO: adjust after test print')
    print(f'        "image_x": 0.5,')
    print(f'        "image_y": 0.5,')
    print(f'    }},')

print("\n" + "="*60)
print("Raw JSON (for manual editing):")
print(json.dumps(catalog_entries, indent=2))
