"""
Strategy router -- product planning endpoints.
"""
from __future__ import annotations

import logging
from fastapi import APIRouter

router = APIRouter(prefix="/strategy", tags=["strategy"])
logger = logging.getLogger(__name__)

_cached_report: dict | None = None


@router.get("/report")
def get_strategy_report() -> dict:
    """Generate a fresh strategy report from Nova data + pipeline status."""
    global _cached_report
    try:
        from agents.strategist.analyst import run_analysis
        report = run_analysis()
        _cached_report = report
        return report
    except Exception as e:
        logger.error(f"Strategy: report failed: {e}")
        return {"error": str(e), "summary": "Report generation failed.", "top_niches": [], "catalog_gaps": [], "proposed_runs": []}


@router.get("/latest")
def get_latest_report() -> dict:
    """Return the last generated report without re-running analysis."""
    if _cached_report:
        return _cached_report
    return {"summary": "No report generated yet. Call /strategy/report first.", "top_niches": [], "catalog_gaps": [], "proposed_runs": []}
