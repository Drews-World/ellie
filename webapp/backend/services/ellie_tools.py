"""
ELLIE chat tools — the "cohesive brain" data layer.

Read-only functions that let the ELLIE web chat query any floor of the Hub on
demand (Etsy POD business, the agent pipeline, realized sales, designs, the
trading fund, Drew's business registry) instead of stuffing every fact into the
system prompt. Each tool returns a compact dict the model can reason over.

Design notes
------------
- Every tool is read-only and best-effort: it returns an {"error": ...} dict on
  failure rather than raising, so one dead floor never kills the whole chat.
- Business-floor calls reuse routers.business._get (single source of truth for
  the elliebusiness base URL + auth header). Trading calls reuse the shared
  async `trading` client.
- TOOLS holds the OpenAI-compatible function schemas; TOOL_DISPATCH maps each
  name to its async implementation. ellie_service runs the tool-calling loop.
"""
from __future__ import annotations

import logging

from routers.business import _get as _biz_get
from services.ellie_trading_client import trading

logger = logging.getLogger("ellie.tools")


# ── Static registry: Drew's businesses / ventures ────────────────────────────
# The chat can recite *what exists* without a network call; live metrics come
# from the other tools. Keep this in sync as ventures change.
BUSINESS_REGISTRY = [
    {
        "id": "ellie_pod",
        "name": "ellie by drew (Etsy POD shop)",
        "type": "E-commerce / print-on-demand",
        "summary": "Autonomous Etsy print-on-demand shop run by the ELLIE agent crew "
                   "(Nova researches niches, Forge designs, Printify fulfills). "
                   "Use get_business_overview / get_sales_performance / get_pipeline_status "
                   "for live numbers.",
        "live_tools": ["get_business_overview", "get_sales_performance",
                       "get_pipeline_status", "get_designs", "get_treasury_spend"],
    },
    {
        "id": "ellie_trading",
        "name": "ELLIE Trading (autonomous fund)",
        "type": "Algorithmic investing",
        "summary": "Autonomous trading fund on Alpaca — discovers, analyzes, and trades "
                   "equities. Use get_trading_status for live account, positions, and P&L.",
        "live_tools": ["get_trading_status"],
    },
    {
        "id": "quill",
        "name": "Quill Learning",
        "type": "EdTech startup",
        "summary": "EdTech startup Drew co-founded. No live ELLIE integration yet — "
                   "ELLIE tracks it as context, not telemetry.",
        "live_tools": [],
    },
    {
        "id": "parking_lot",
        "name": "The Parking Lot",
        "type": "Streetball league / community",
        "summary": "Streetball league Drew built and runs. No live ELLIE integration yet.",
        "live_tools": [],
    },
]


# ── Tool implementations (all async, all best-effort) ────────────────────────

async def list_businesses() -> dict:
    """Static registry of Drew's ventures and which live tools cover each."""
    return {"businesses": BUSINESS_REGISTRY}


async def get_business_overview() -> dict:
    """High-level state of the Etsy POD business: agent status + revenue summary."""
    status = await _safe(_biz_get, "/status")
    summary = await _safe(_biz_get, "/summary", {"period": "daily"})
    return {
        "paused": status.get("paused"),
        "active_agents": status.get("active_agents"),
        "actions_today": status.get("actions_today"),
        "agents": status.get("agents", []),
        "alerts": status.get("alerts", []),
        "revenue_summary": {
            "revenue": summary.get("revenue"),
            "recent_activity": summary.get("recent_activity", [])[:8],
        },
    }


async def get_sales_performance() -> dict:
    """Realized Etsy sales aggregated per niche (units + revenue), best sellers first."""
    return await _safe(_biz_get, "/sales/performance")


async def get_pipeline_status() -> dict:
    """Current state of the Nova→Forge→Printify design pipeline (running step + %)."""
    return await _safe(_biz_get, "/ellie/pipeline")


async def get_designs(limit: int = 20) -> dict:
    """Recent designs the crew has produced (concept, niche, status)."""
    data = await _safe(_biz_get, "/products/designs", {"limit": limit})
    return data


async def get_market_trends(limit: int = 8) -> dict:
    """Latest niche research Nova has gathered (opportunities, tags, price ranges)."""
    return await _safe(_biz_get, "/nova/trends", {"limit": limit})


async def get_treasury_spend() -> dict:
    """How much the agent crew has spent today (LLM + image gen), broken out by agent."""
    return await _safe(_biz_get, "/treasury/spend")


async def get_promotion_status() -> dict:
    """Pinterest promotion coverage: how many listings are pinned vs awaiting a Pin."""
    return await _safe(_biz_get, "/promote/status")


async def get_trading_status() -> dict:
    """Live trading fund snapshot: account equity/cash, open positions, today's P&L, fund state."""
    try:
        snap = await trading.get_snapshot()
    except Exception as e:  # noqa: BLE001
        return {"error": f"trading floor unreachable: {e}"}
    acct = snap.get("account") or {}
    positions = snap.get("positions") or []
    fund = snap.get("fund") or {}
    return {
        "account": {
            "equity": acct.get("equity"),
            "cash": acct.get("cash"),
            "buying_power": acct.get("buying_power"),
            "pnl_today": acct.get("pnl_today") or acct.get("today_pl"),
        },
        "open_positions": [
            {
                "symbol": p.get("symbol"),
                "qty": p.get("qty"),
                "market_value": p.get("market_value"),
                "unrealized_pl": p.get("unrealized_pl"),
            }
            for p in positions[:25]
        ],
        "position_count": len(positions),
        "pnl_today": snap.get("pnl"),
        "fund": {
            "active": fund.get("active"),
            "paused": fund.get("paused"),
        },
    }


async def _safe(fn, *args):
    """Call an async fetcher, returning {'error': ...} instead of raising."""
    try:
        return await fn(*args)
    except Exception as e:  # noqa: BLE001
        logger.warning("ellie tool fetch failed (%s): %s", getattr(fn, "__name__", fn), e)
        return {"error": str(e)}


# ── OpenAI-compatible tool schemas ───────────────────────────────────────────
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "list_businesses",
            "description": "List all of Drew's businesses/ventures (Etsy POD shop, "
                           "trading fund, Quill Learning, The Parking Lot) and which live "
                           "tools provide real metrics for each. Call this first when asked "
                           "a broad question about 'my businesses' or 'the Hub'.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_business_overview",
            "description": "Get the Etsy print-on-demand business's current state: whether "
                           "the agent crew is paused, active agents, actions taken today, and "
                           "a daily revenue/activity summary.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_sales_performance",
            "description": "Get realized Etsy sales aggregated per niche — units sold and "
                           "revenue, best sellers first, plus totals. Use for 'how's the shop "
                           "selling' / 'what's selling best'.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_pipeline_status",
            "description": "Get the current state of the Nova→Forge→Printify design pipeline: "
                           "whether it's running, which step, and percent complete.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_designs",
            "description": "List recent designs the crew has produced (concept, niche, status).",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Max designs to return (default 20)."}
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_market_trends",
            "description": "Get the latest niche/market research Nova has gathered: "
                           "opportunities, top tags, price ranges, and recommendations.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Max trends to return (default 8)."}
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_treasury_spend",
            "description": "Get how much the agent crew has spent today (LLM + image generation), "
                           "broken out by agent. Use for cost/burn questions.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_promotion_status",
            "description": "Get Pinterest promotion coverage for the Etsy shop: how many "
                           "listings have been pinned vs. how many are still awaiting a Pin, "
                           "and whether Pinterest is connected. Use for marketing/traffic questions.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_trading_status",
            "description": "Get the live trading fund snapshot: account equity, cash, buying "
                           "power, open positions, today's P&L, and whether the fund is active. "
                           "Use for any question about investing/trading/the fund/portfolio.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]

TOOL_DISPATCH = {
    "list_businesses": list_businesses,
    "get_business_overview": get_business_overview,
    "get_sales_performance": get_sales_performance,
    "get_pipeline_status": get_pipeline_status,
    "get_designs": get_designs,
    "get_market_trends": get_market_trends,
    "get_treasury_spend": get_treasury_spend,
    "get_promotion_status": get_promotion_status,
    "get_trading_status": get_trading_status,
}


async def dispatch_tool(name: str, arguments: dict | None) -> dict:
    """Execute a tool by name with parsed arguments. Never raises."""
    fn = TOOL_DISPATCH.get(name)
    if not fn:
        return {"error": f"unknown tool: {name}"}
    args = arguments or {}
    try:
        return await fn(**args)
    except TypeError:
        # Model passed unexpected args — retry with none rather than failing.
        try:
            return await fn()
        except Exception as e:  # noqa: BLE001
            return {"error": str(e)}
    except Exception as e:  # noqa: BLE001
        logger.warning("ellie tool '%s' failed: %s", name, e)
        return {"error": str(e)}
