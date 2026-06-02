"""
ELLIE Floors — MCP bridge
=========================
Exposes ELLIE's existing FastAPI domain routers to Hermes (her brain) as MCP tools.

This is the "clean seam" from docs/ELLIE_REFACTOR_PLAN.md: Hermes calls these tools,
each tool is a thin HTTP call to the running ELLIE backend (default :8002), and the
backend stays the system-of-record (it proxies to ellietrading and elliebusiness).

  Hermes (brain)  ──MCP──►  this server  ──HTTP──►  ELLIE backend :8002
                                                      ├── /trading/*  → ellietrading
                                                      └── /business/* → elliebusiness

Run (Hermes launches it over stdio):
    python webapp/backend/mcp_bridge/floors_server.py

Requires only `mcp` + `httpx` (both present in the Hermes venv). It does NOT import
the backend package, so it can run under any interpreter that has those two deps.

Safety note: high-stakes / irreversible actions (placing trades, launching the fund,
publishing) are deliberately NOT exposed here yet. Per the plan, those stay behind
incremental trust-gating (Phase 2 / Armory toggle). Only read + low-risk management
tools live in this bridge for now.
"""
from __future__ import annotations

import os
import httpx
from mcp.server.fastmcp import FastMCP

ELLIE_BACKEND_URL = os.environ.get("ELLIE_BACKEND_URL", "http://localhost:8002")
TIMEOUT = float(os.environ.get("ELLIE_MCP_TIMEOUT", "120"))

mcp = FastMCP("ellie-floors")


async def _get(path: str, params: dict | None = None):
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.get(f"{ELLIE_BACKEND_URL}{path}", params=params or {})
        r.raise_for_status()
        return r.json()


async def _post(path: str, body: dict | None = None):
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.post(f"{ELLIE_BACKEND_URL}{path}", json=body or {})
        r.raise_for_status()
        return r.json()


async def _patch(path: str, body: dict | None = None):
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.patch(f"{ELLIE_BACKEND_URL}{path}", json=body or {})
        r.raise_for_status()
        return r.json()


async def _delete(path: str):
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.delete(f"{ELLIE_BACKEND_URL}{path}")
        r.raise_for_status()
        return r.json()


def _safe(call):
    """Wrap a coroutine factory so tool errors return a readable dict, not a crash."""
    async def _runner(*args, **kwargs):
        try:
            return await call(*args, **kwargs)
        except httpx.HTTPStatusError as e:
            return {"error": f"backend returned {e.response.status_code}", "detail": e.response.text[:400]}
        except httpx.RequestError as e:
            return {"error": "could not reach ELLIE backend", "detail": str(e),
                    "hint": f"is the backend running at {ELLIE_BACKEND_URL}? (start.bat)"}
    return _runner


# ===========================================================================
# TRUST-GATING  — the "Armory toggle" from the refactor plan
# ---------------------------------------------------------------------------
# High-stakes / irreversible actions are OFF by default. When a gate is off, the
# tool does NOT execute — it returns a structured *proposal* so ELLIE can surface
# "here's what I want to do, approve?" to Drew without being able to pull the
# trigger herself. Drew opens a gate by setting the env var at the Hermes MCP
# registration (this is what the Armory door will toggle):
#
#   hermes mcp add ellie-floors ... --env ELLIE_ALLOW_TRADES=true
#
# Gates (all default false):
#   ELLIE_ALLOW_TRADES   → money movement: place order, launch fund, execute backlog buy
#   ELLIE_ALLOW_PUBLISH  → public content: publish listings to Etsy
#   ELLIE_ALLOW_SPEND    → paid generation: Forge designs, AI stock discovery, fund config
# Reversible operational actions (pause/resume/cancel) are NOT gated.
# ===========================================================================

def _gate_open(gate: str) -> bool:
    return os.environ.get(gate, "").strip().lower() in ("1", "true", "yes", "on")


def _proposal(gate: str, action: str, params: dict, effect: str) -> dict:
    return {
        "gated": True,
        "executed": False,
        "action": action,
        "params": params,
        "effect": effect,
        "message": (
            f"This is a high-stakes action requiring Drew's approval. It was NOT executed. "
            f"To permit it, open the '{gate}' gate (Armory). Surface this proposal to Drew and "
            f"ask for explicit approval before retrying."
        ),
        "gate_required": gate,
    }


def _gated(gate: str, action: str, effect: str, do_call, params: dict):
    """Run do_call only if the gate is open; otherwise return a proposal."""
    async def _runner():
        if not _gate_open(gate):
            return _proposal(gate, action, params, effect)
        result = await _safe(do_call)()
        if isinstance(result, dict) and "error" not in result:
            result = {"executed": True, "action": action, "result": result}
        return result
    return _runner


# ===========================================================================
# TRADING FLOOR  — manages the existing ellietrading agents (read-only for now)
# ===========================================================================

@mcp.tool()
async def trading_ping() -> dict:
    """Check whether the trading server (ellietrading) is online and reachable."""
    return await _safe(lambda: _get("/trading/ping"))()


@mcp.tool()
async def trading_snapshot() -> dict:
    """Full trading snapshot in one call: account equity, cash, total P&L, open
    positions, and today's P&L series. Use this for 'how's trading doing?' questions."""
    return await _safe(lambda: _get("/trading/snapshot"))()


@mcp.tool()
async def trading_pnl(period: str = "today") -> dict:
    """Profit & loss for a period. period is one of: today, 7d, 30d, 1y, all.
    Use for 'what's my P&L?' / 'how much did I make this week?'."""
    return await _safe(lambda: _get("/trading/pnl", {"period": period}))()


@mcp.tool()
async def trading_positions() -> dict:
    """All currently open trading positions (ticker, qty, market value, unrealized P&L)."""
    return await _safe(lambda: _get("/trading/positions"))()


@mcp.tool()
async def trading_fund_status() -> dict:
    """The autonomous fund's state: active or paused, its config, and next scheduled
    run times. Use to answer 'is the fund running?'."""
    return await _safe(lambda: _get("/trading/fund/status"))()


@mcp.tool()
async def trading_fund_log() -> dict:
    """Recent fund activity log — buy/sell events and fund operation history."""
    return await _safe(lambda: _get("/trading/fund/log"))()


@mcp.tool()
async def trading_catalysts() -> dict:
    """Catalyst watch list — upcoming earnings, IPOs, and events the fund is tracking."""
    return await _safe(lambda: _get("/trading/catalysts"))()


@mcp.tool()
async def trading_market_data(ticker: str, period: str = "3mo") -> dict:
    """Price history, fundamentals, and recent news for a single ticker.
    period example: 1mo, 3mo, 6mo, 1y."""
    return await _safe(lambda: _get(f"/trading/market-data/{ticker}", {"period": period}))()


# ===========================================================================
# BUSINESS FLOOR — manages the existing elliebusiness / Etsy-shop agent crew
# ===========================================================================

@mcp.tool()
async def business_status() -> dict:
    """Business Factory status: paused state, active agent count, actions today,
    alerts, and the agent roster (Ultron, Forge, Nova, etc.)."""
    return await _safe(lambda: _get("/business/status"))()


@mcp.tool()
async def business_summary(period: str = "daily") -> dict:
    """Business performance summary for a period (daily/weekly): revenue and recent
    agent activity. Use for 'how's the Etsy store doing?'."""
    return await _safe(lambda: _get("/business/summary", {"period": period}))()


@mcp.tool()
async def business_activity(limit: int = 40) -> dict:
    """Recent Business Factory activity feed — what the agent crew has been doing."""
    return await _safe(lambda: _get("/business/activity", {"limit": limit}))()


@mcp.tool()
async def business_alerts() -> dict:
    """Open Business Factory alerts — things needing Drew's attention on the store."""
    return await _safe(lambda: _get("/business/alerts"))()


@mcp.tool()
async def business_treasury_spend() -> dict:
    """Today's business spend (API/service costs) broken down by agent. The store's
    cost side of the ledger."""
    return await _safe(lambda: _get("/business/treasury/spend"))()


@mcp.tool()
async def business_treasury_history(days: int = 7) -> dict:
    """Business spend history over the last N days (cost events)."""
    return await _safe(lambda: _get("/business/treasury/history", {"days": days}))()


@mcp.tool()
async def business_strategy_latest() -> dict:
    """The latest strategy report for the store: top niches, catalog gaps, proposed runs."""
    return await _safe(lambda: _get("/business/strategy/latest"))()


@mcp.tool()
async def business_forge_queue(limit: int = 20) -> dict:
    """Forge's design queue — pixel/merch designs generated and waiting in line."""
    return await _safe(lambda: _get("/business/forge/queue", {"limit": limit}))()


@mcp.tool()
async def business_command(command: str) -> dict:
    """Send a natural-language management command to the Business Factory supervisor
    (Ultron), e.g. 'research trending Halloween niches' or 'queue 5 cat-themed designs'.
    This is ELLIE's main lever for directing the Etsy crew. Returns a proposed plan;
    side-effectful plans must then be confirmed with business_confirm()."""
    return await _safe(lambda: _post("/business/ellie/command", {"command": command}))()


@mcp.tool()
async def business_pipeline() -> dict:
    """Current state of the Business Factory pipeline (idle/running, step, progress %)."""
    return await _safe(lambda: _get("/business/ellie/pipeline"))()


# ===========================================================================
# REVERSIBLE OPERATIONAL ACTIONS  (not gated — safe to call)
# ===========================================================================

@mcp.tool()
async def trading_fund_pause() -> dict:
    """Pause the autonomous fund — stops scheduled reviews and auto-buys. Reversible,
    risk-reducing (it only stops activity), so it is NOT gated."""
    return await _safe(lambda: _post("/trading/fund/pause"))()


@mcp.tool()
async def trading_cancel_order(order_id: str) -> dict:
    """Cancel an open (not-yet-filled) order by its ID. Reversing a pending action,
    so it is NOT gated."""
    return await _safe(lambda: _delete(f"/trading/orders/{order_id}"))()


@mcp.tool()
async def business_pause() -> dict:
    """Pause the Business Factory crew — stops the agents from taking actions. Reversible, NOT gated."""
    return await _safe(lambda: _post("/business/pause"))()


@mcp.tool()
async def business_resume() -> dict:
    """Resume the Business Factory crew after a pause. Reversible, NOT gated."""
    return await _safe(lambda: _post("/business/resume"))()


# ===========================================================================
# HIGH-STAKES ACTIONS  (GATED — default OFF, return a proposal until approved)
# ===========================================================================

@mcp.tool()
async def trading_place_order(ticker: str, side: str, qty: float | None = None,
                              notional: float | None = None) -> dict:
    """Place a MARKET order. side is 'buy' or 'sell'. Supply qty (shares) OR notional (dollars).
    MONEY MOVEMENT — gated behind ELLIE_ALLOW_TRADES. When the gate is closed this returns a
    proposal for Drew to approve; it does not trade."""
    params = {"ticker": ticker, "side": side, "qty": qty, "notional": notional}
    body = {k: v for k, v in params.items() if v is not None}
    return await _gated("ELLIE_ALLOW_TRADES", "trading_place_order",
                        f"Place a {side} market order for {ticker} ({qty or ''}{(' shares' if qty else '')}"
                        f"{('$'+str(notional) if notional else '')}).",
                        lambda: _post("/trading/orders", body), params)()


@mcp.tool()
async def trading_fund_launch() -> dict:
    """Launch the autonomous fund (triggers a discover → analyze → BUY cycle).
    MONEY MOVEMENT — gated behind ELLIE_ALLOW_TRADES."""
    return await _gated("ELLIE_ALLOW_TRADES", "trading_fund_launch",
                        "Start the autonomous fund: it will discover, analyze, and buy stocks.",
                        lambda: _post("/trading/fund/launch"), {})()


@mcp.tool()
async def trading_fund_config(updates: dict) -> dict:
    """Update fund configuration (position sizing, style, model choices, etc.). Pass only the
    keys to change. Changes how the fund spends — gated behind ELLIE_ALLOW_SPEND."""
    return await _gated("ELLIE_ALLOW_SPEND", "trading_fund_config",
                        "Change the autonomous fund's configuration.",
                        lambda: _patch("/trading/fund/config", updates), {"updates": updates})()


@mcp.tool()
async def trading_fund_discover(theme: str = "", count: int = 5) -> dict:
    """Run AI-driven stock discovery (costs LLM budget). theme is optional.
    PAID GENERATION — gated behind ELLIE_ALLOW_SPEND."""
    body = {"theme": theme, "count": count}
    return await _gated("ELLIE_ALLOW_SPEND", "trading_fund_discover",
                        f"Run AI stock discovery (theme='{theme}', count={count}).",
                        lambda: _post("/trading/fund/discover", body), body)()


@mcp.tool()
async def business_forge_run(prompt: str = "", count: int = 1) -> dict:
    """Tell Forge to generate new designs (costs image-gen budget). PAID GENERATION —
    gated behind ELLIE_ALLOW_SPEND."""
    body = {"prompt": prompt, "count": count}
    return await _gated("ELLIE_ALLOW_SPEND", "business_forge_run",
                        f"Generate {count} new design(s) with Forge (prompt='{prompt}').",
                        lambda: _post("/business/forge/run", body), body)()


@mcp.tool()
async def business_publish_all() -> dict:
    """Publish all approved designs as live Etsy listings. PUBLIC CONTENT + irreversible —
    gated behind ELLIE_ALLOW_PUBLISH."""
    return await _gated("ELLIE_ALLOW_PUBLISH", "business_publish_all",
                        "Publish all approved designs as live, public Etsy listings.",
                        lambda: _post("/business/archives/publish_all"), {})()


@mcp.tool()
async def business_confirm(plan_id: str) -> dict:
    """Confirm and execute a plan previously proposed by business_command. Because a confirmed
    plan can spend or publish, this is gated behind ELLIE_ALLOW_SPEND."""
    body = {"plan_id": plan_id}
    return await _gated("ELLIE_ALLOW_SPEND", "business_confirm",
                        f"Execute the previously proposed Business Factory plan {plan_id}.",
                        lambda: _post("/business/ellie/confirm", body), body)()


# ===========================================================================
# PERMISSIONS — let ELLIE see what she is currently allowed to do
# ===========================================================================

@mcp.tool()
async def floors_permissions() -> dict:
    """Report which high-stakes action gates are currently open or closed. ELLIE should
    check this before promising to take a gated action."""
    return {
        "gates": {
            "ELLIE_ALLOW_TRADES": _gate_open("ELLIE_ALLOW_TRADES"),
            "ELLIE_ALLOW_PUBLISH": _gate_open("ELLIE_ALLOW_PUBLISH"),
            "ELLIE_ALLOW_SPEND": _gate_open("ELLIE_ALLOW_SPEND"),
        },
        "note": "Closed gates mean the action returns a proposal for Drew's approval instead of executing.",
    }


if __name__ == "__main__":
    # Default transport is stdio — which is how Hermes launches/talks to it.
    mcp.run()
