"""
ELLIE chat tools — the "cohesive brain" data layer.

Functions that let the ELLIE web chat query — and act on — any floor of the Hub
on demand (Etsy POD business, the agent pipeline, realized sales, designs, the
trading fund, Drew's business registry) instead of stuffing every fact into the
system prompt. Each tool returns a compact dict the model can reason over.

Most tools are read-only. The trading floor additionally exposes a small set of
WRITE tools (place_trade, launch_fund_cycle, trigger_fund_review, scan_catalysts,
set_fund_paused) that mutate the fund's paper account so ELLIE can execute when
Drew tells her to. The read tools are named get_* / list_*; the write tools carry
an action verb.

Design notes
------------
- Every tool is best-effort: it returns an {"error": ...} (reads) or
  {"ok": False, "error": ...} (writes) dict on failure rather than raising, so one
  dead floor or a rejected order never kills the whole chat.
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
        "summary": "Autonomous trading fund on Alpaca (paper) — discovers, analyzes, and "
                   "trades equities. Use get_trading_status for live account, positions, and "
                   "P&L. ELLIE can also ACT on it: place_trade to buy/sell a ticker, "
                   "launch_fund_cycle / trigger_fund_review / scan_catalysts to drive the "
                   "agents, and set_fund_paused to pause/resume.",
        "live_tools": ["get_trading_status", "place_trade", "get_recent_orders",
                       "launch_fund_cycle", "trigger_fund_review", "scan_catalysts",
                       "set_fund_paused"],
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


# ── Write / execution tools (trading floor) ──────────────────────────────────
# Unlike the read tools above, these MUTATE the fund: they place orders and drive
# the autonomous agents. The fund runs on a paper Alpaca account. Each one is
# still best-effort — it returns {"ok": False, "error": ...} instead of raising,
# so a failed trade reports back to Drew rather than killing the chat.

async def place_trade(
    ticker: str,
    side: str = "buy",
    qty: float | None = None,
    notional: float | None = None,
) -> dict:
    """Place a market order on the fund's account. Provide qty (shares) OR notional ($)."""
    if qty is None and notional is None:
        return {"ok": False, "error": "specify qty (shares) or notional (dollar amount)"}
    side = (side or "buy").lower()
    if side not in ("buy", "sell"):
        return {"ok": False, "error": f"side must be 'buy' or 'sell', got {side!r}"}
    try:
        order = await trading.place_order(ticker, side, qty=qty, notional=notional)
    except Exception as e:  # noqa: BLE001
        logger.warning("place_trade %s %s failed: %s", side, ticker, e)
        return {"ok": False, "error": str(e)}
    logger.info("ellie placed %s order: %s qty=%s notional=%s", side, ticker, qty, notional)
    return {"ok": True, "order": order}


async def get_recent_orders() -> dict:
    """Recent orders on the fund's account — use to confirm a trade filled."""
    try:
        orders = await trading.get_orders()
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)}
    return {"ok": True, "orders": orders[:25] if isinstance(orders, list) else orders}


async def launch_fund_cycle() -> dict:
    """Kick the autonomous fund: runs the discover → analyze → buy cycle."""
    try:
        res = await trading.launch_fund()
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)}
    logger.info("ellie launched fund cycle")
    return {"ok": True, "result": res}


async def trigger_fund_review() -> dict:
    """Manually trigger the fund's portfolio review (re-evaluates holdings + buys)."""
    try:
        res = await trading.trigger_fund_review()
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)}
    logger.info("ellie triggered fund review")
    return {"ok": True, "result": res}


async def scan_catalysts() -> dict:
    """Run a catalyst scan (IPOs, earnings, tracked events) to feed the fund new ideas."""
    try:
        res = await trading.trigger_catalyst_scan()
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)}
    logger.info("ellie triggered catalyst scan")
    return {"ok": True, "result": res}


async def set_fund_paused(paused: bool) -> dict:
    """Pause (True) or resume (False) the autonomous fund."""
    try:
        res = await (trading.pause_fund() if paused else trading.resume_fund())
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)}
    logger.info("ellie set fund paused=%s", paused)
    return {"ok": True, "result": res}


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
    # ── Write / execution tools — these actually trade and drive the fund ──────
    {
        "type": "function",
        "function": {
            "name": "place_trade",
            "description": "Place a market BUY or SELL order on the fund's (paper) account. "
                           "Use this when Drew tells you to buy or sell a specific ticker now "
                           "(e.g. 'get some SPCX', 'sell half my NVDA'). Provide qty (shares) "
                           "OR notional (dollar amount), not both. Check get_trading_status "
                           "first for available cash/buying power, then size the order sensibly "
                           "if Drew didn't specify. Confirm the fill with get_recent_orders.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticker": {"type": "string", "description": "Ticker symbol, e.g. SPCX."},
                    "side": {"type": "string", "enum": ["buy", "sell"], "description": "buy or sell (default buy)."},
                    "qty": {"type": "number", "description": "Number of shares (omit if using notional)."},
                    "notional": {"type": "number", "description": "Dollar amount to trade (omit if using qty)."},
                },
                "required": ["ticker"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_recent_orders",
            "description": "List recent orders on the fund's account, to confirm whether a "
                           "trade you placed filled and at what price. Use right after place_trade.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "launch_fund_cycle",
            "description": "Kick the autonomous fund into action — runs the full discover → "
                           "analyze → buy cycle so the agents go find and act on opportunities. "
                           "Use when Drew says 'get the agents working' / 'put the fund to work'.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "trigger_fund_review",
            "description": "Trigger the fund's portfolio review cycle now — it re-evaluates "
                           "current holdings and makes buy/sell/hold decisions. Use for "
                           "'review the portfolio' / 'rebalance now'.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "scan_catalysts",
            "description": "Run a catalyst scan for upcoming IPOs, earnings, and tracked market "
                           "events to feed the fund fresh ideas. Use when Drew flags something "
                           "like a new IPO he wants the fund aware of.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_fund_paused",
            "description": "Pause or resume the autonomous fund. Pause to stop all scheduled "
                           "reviews and auto-buys; resume to turn it back on.",
            "parameters": {
                "type": "object",
                "properties": {
                    "paused": {"type": "boolean", "description": "True to pause, False to resume."},
                },
                "required": ["paused"],
            },
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
    # Write / execution
    "place_trade": place_trade,
    "get_recent_orders": get_recent_orders,
    "launch_fund_cycle": launch_fund_cycle,
    "trigger_fund_review": trigger_fund_review,
    "scan_catalysts": scan_catalysts,
    "set_fund_paused": set_fund_paused,
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
