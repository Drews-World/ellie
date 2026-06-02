"""
Sales-feedback loop — close the gap between what we MAKE and what actually SELLS.

Source of truth: Printify orders (read-only). Printify receives every Etsy order
for our POD products, and each line item carries the Printify product_id plus the
retail price and the Etsy listing title. We map that back to our design → niche so
the agents can learn which niches earn money, not just which ones look good.

Flow:
  Printify orders ──> map product_id|title ──> design ──> niche
                  └─> persist into `listings` (sales, revenue) + `orders`
  Forge / Nova ───> read niche_performance() ──> boost proven sellers in scoring

Everything is defensive: a failure here must never break the pipeline, so all DB
and API access is wrapped and degrades to "no signal" rather than raising.
"""
from __future__ import annotations

import logging
import re

from core.supabase_client import get_db

logger = logging.getLogger(__name__)


# ── Text matching (backfill linkage for products published before listings rows) ──

def _norm_words(s: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", (s or "").lower()))


def _load_designs() -> list[dict]:
    try:
        rows = (
            get_db().table("designs")
            .select("id,niche,concept_name,printify_id")
            .limit(2000)
            .execute()
        )
        return rows.data or []
    except Exception as e:
        logger.warning(f"performance: design load failed: {e}")
        return []


def _load_listings_by_pid() -> dict[str, dict]:
    out: dict[str, dict] = {}
    try:
        rows = get_db().table("listings").select("*").limit(2000).execute()
        for r in rows.data or []:
            pid = r.get("printify_id")
            if pid:
                out[str(pid)] = r
    except Exception as e:
        logger.warning(f"performance: listing load failed: {e}")
    return out


def _resolve_design(
    product_id: str,
    title: str,
    listings_by_pid: dict[str, dict],
    designs: list[dict],
    designs_by_id: dict[str, dict],
) -> dict | None:
    """Map a sold Printify line item back to one of our designs.

    1. Exact link via an existing listings row (printify_id → design_id).
    2. Fallback: fuzzy-match the Etsy listing title against design concept names
       (recovers sales for products published before we stored the linkage).
    """
    l = listings_by_pid.get(str(product_id))
    if l and l.get("design_id"):
        d = designs_by_id.get(l["design_id"])
        if d:
            return d

    title_words = _norm_words(title)
    if not title_words:
        return None
    best, best_overlap = None, 0.0
    for d in designs:
        concept_words = _norm_words(d.get("concept_name", ""))
        if not concept_words:
            continue
        overlap = len(concept_words & title_words) / len(concept_words)
        if overlap > best_overlap:
            best_overlap, best = overlap, d
    # Require a strong majority of the concept's words to appear in the title.
    return best if best_overlap >= 0.6 else None


# ── Persistence helpers ───────────────────────────────────────────────────────

def _ensure_listing(
    design: dict | None,
    product_id: str,
    title: str,
    price_usd: float,
    listings_by_pid: dict[str, dict],
) -> str | None:
    """Return the listings.id for this Printify product, creating/back-filling it."""
    existing = listings_by_pid.get(str(product_id))
    if existing and existing.get("id"):
        return existing["id"]
    row = {
        "design_id": (design or {}).get("id"),
        "printify_id": str(product_id),
        "title": (title or "")[:255],
        "price_usd": round(float(price_usd), 2),
        "status": "active",
    }
    try:
        res = get_db().table("listings").insert(row).execute()
        if res.data:
            created = res.data[0]
            listings_by_pid[str(product_id)] = created
            return created.get("id")
    except Exception as e:
        logger.warning(f"performance: listing upsert failed for {product_id}: {e}")
    return None


def _upsert_order(order_id, line_id, listing_id, amount_usd, status, ordered_at) -> None:
    row = {
        "etsy_order_id": f"pf_{order_id}_{line_id}",  # reuse unique text col as idempotency key
        "listing_id": listing_id,
        "amount_usd": round(float(amount_usd), 2),
        "net_usd": round(float(amount_usd), 2),
        "status": status or "pending",
        "ordered_at": ordered_at,
    }
    try:
        get_db().table("orders").upsert(row, on_conflict="etsy_order_id").execute()
    except Exception as e:
        logger.warning(f"performance: order upsert failed for {order_id}/{line_id}: {e}")


def _set_listing_totals(listing_id: str, units: int, revenue: float) -> None:
    try:
        get_db().table("listings").update(
            {"sales": int(units), "revenue_usd": round(float(revenue), 2)}
        ).eq("id", listing_id).execute()
    except Exception as e:
        logger.warning(f"performance: listing totals update failed for {listing_id}: {e}")


# ── Public API ────────────────────────────────────────────────────────────────

def sync_sales(limit: int = 100) -> dict:
    """Pull Printify orders and reconcile them into listings/orders + niche totals.

    Idempotent: re-running recomputes listing totals from the current order set,
    so it's safe to call on a schedule. Returns a summary report.
    """
    from integrations.printify import fetch_orders
    from core.activity import log as alog

    try:
        orders = fetch_orders(limit=limit)
    except Exception as e:
        logger.warning(f"performance: fetch_orders failed: {e}")
        return {"ok": False, "error": str(e), "orders": 0, "units": 0, "revenue_usd": 0.0, "niches": {}}

    designs = _load_designs()
    designs_by_id = {d["id"]: d for d in designs}
    listings_by_pid = _load_listings_by_pid()

    listing_totals: dict[str, dict] = {}   # listing_id -> {units, revenue}
    niche_totals: dict[str, dict] = {}     # niche -> {units, revenue, orders}
    n_lines = 0

    for o in orders:
        order_id = o.get("id")
        created = o.get("created_at")
        status = o.get("status")
        for li in o.get("line_items", []):
            n_lines += 1
            pid = str(li.get("product_id") or "")
            qty = int(li.get("quantity") or 1)
            meta = li.get("metadata") or {}
            retail_cents = float(meta.get("price") or 0)
            title = meta.get("title", "")
            revenue = (retail_cents * qty) / 100.0

            design = _resolve_design(pid, title, listings_by_pid, designs, designs_by_id)
            listing_id = _ensure_listing(design, pid, title, retail_cents / 100.0, listings_by_pid)
            _upsert_order(order_id, li.get("id"), listing_id, revenue, status, created)

            if listing_id:
                t = listing_totals.setdefault(listing_id, {"units": 0, "revenue": 0.0})
                t["units"] += qty
                t["revenue"] += revenue

            niche = (design or {}).get("niche") or "unknown"
            n = niche_totals.setdefault(niche, {"units": 0, "revenue": 0.0, "orders": 0})
            n["units"] += qty
            n["revenue"] += revenue
            n["orders"] += 1

    for listing_id, agg in listing_totals.items():
        _set_listing_totals(listing_id, agg["units"], round(agg["revenue"], 2))

    total_units = sum(n["units"] for n in niche_totals.values())
    total_rev = round(sum(n["revenue"] for n in niche_totals.values()), 2)
    matched = {k: v for k, v in niche_totals.items() if k != "unknown"}

    alog("treasury", "sales_synced",
         f"Sales sync: {len(orders)} orders, {total_units} units, ${total_rev:.2f} — "
         f"{len(matched)} niche(s) attributed")

    return {
        "ok": True,
        "orders": len(orders),
        "line_items": n_lines,
        "units": total_units,
        "revenue_usd": total_rev,
        "niches": {k: {"units": v["units"], "revenue_usd": round(v["revenue"], 2)}
                   for k, v in sorted(niche_totals.items(), key=lambda kv: kv[1]["units"], reverse=True)},
    }


def niche_performance() -> dict[str, dict]:
    """Aggregate realized sales per niche from the persisted listings table.

    Returns {niche: {"units": int, "revenue_usd": float, "listings": int}}.
    This is the read path the agents consult — fast, no Printify call.
    """
    try:
        listings = get_db().table("listings").select("design_id,sales,revenue_usd").limit(5000).execute().data or []
        designs = _load_designs()
        niche_of = {d["id"]: d.get("niche") for d in designs}
    except Exception as e:
        logger.warning(f"performance: niche_performance read failed: {e}")
        return {}

    out: dict[str, dict] = {}
    for l in listings:
        units = int(l.get("sales") or 0)
        if units <= 0:
            continue
        niche = niche_of.get(l.get("design_id")) or "unknown"
        agg = out.setdefault(niche, {"units": 0, "revenue_usd": 0.0, "listings": 0})
        agg["units"] += units
        agg["revenue_usd"] = round(agg["revenue_usd"] + float(l.get("revenue_usd") or 0), 2)
        agg["listings"] += 1
    return out


def niche_sales_boost(niche: str) -> float:
    """Scoring nudge for a niche based on realized sales. Range 0.0–0.25.

    Proven money-makers should out-rank pretty-but-unsold concepts. We cap the
    boost so taste/quality still dominate — sales tilt the scale, they don't own it.
    """
    if not niche:
        return 0.0
    try:
        units = niche_performance().get(niche, {}).get("units", 0)
    except Exception:
        return 0.0
    return round(min(units * 0.05, 0.25), 3)


def proven_sellers_text(niche: str | None = None, limit: int = 6) -> str:
    """Human/LLM-readable summary of what's actually selling, for prompt injection."""
    perf = niche_performance()
    if not perf:
        return "No realized sales data yet — no proven sellers to learn from."
    ranked = sorted(perf.items(), key=lambda kv: kv[1]["units"], reverse=True)

    lines = []
    if niche and niche in perf:
        p = perf[niche]
        lines.append(f"THIS niche has proven sales: {p['units']} unit(s), ${p['revenue_usd']:.2f} — lean into what worked.")
    lines.append("Top selling niches so far (realized Etsy sales):")
    for n, p in ranked[:limit]:
        label = (n[:70] + "…") if len(n) > 70 else n
        lines.append(f"  • {label}: {p['units']} sold, ${p['revenue_usd']:.2f}")
    return "\n".join(lines)
