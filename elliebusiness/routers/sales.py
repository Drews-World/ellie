"""
Sales-feedback router — reconcile Printify orders into design/niche performance.

POST /sales/sync         → pull Printify orders, attribute to designs, update totals
GET  /sales/performance  → realized sales per niche (read path the agents use)
"""
from __future__ import annotations

from fastapi import APIRouter

from core.performance import sync_sales, niche_performance

router = APIRouter(prefix="/sales", tags=["sales"])


@router.post("/sync")
def sync(limit: int = 100) -> dict:
    """Pull Printify orders and reconcile them into listings/orders + niche totals."""
    return sync_sales(limit=limit)


@router.get("/performance")
def performance() -> dict:
    """Realized sales aggregated per niche (from persisted listings)."""
    perf = niche_performance()
    ranked = sorted(perf.items(), key=lambda kv: kv[1]["units"], reverse=True)
    return {
        "niches": [{"niche": n, **v} for n, v in ranked],
        "total_units": sum(v["units"] for v in perf.values()),
        "total_revenue_usd": round(sum(v["revenue_usd"] for v in perf.values()), 2),
    }
