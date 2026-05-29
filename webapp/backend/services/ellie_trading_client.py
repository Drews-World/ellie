"""
ellie_trading_client.py
-----------------------
Single-import client for the ELLIE trading server at http://159.89.139.43:8000.

Usage (async, inside FastAPI handlers):
    from services.ellie_trading_client import trading
    account  = await trading.get_account()
    snapshot = await trading.get_snapshot()
    await trading.place_order("NVDA", "buy", qty=5)

Usage (sync, inside scripts / CLI / non-async code):
    from services.ellie_trading_client import trading
    account = trading.get_account_sync()

All functions raise EllieTradeError on non-2xx responses.
Base URL is read from ELLIETRADING_URL env var (set in .env).
"""

from __future__ import annotations

import asyncio
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Any, Optional

import httpx

# ---------------------------------------------------------------------------
# Error type
# ---------------------------------------------------------------------------

class EllieTradeError(Exception):
    """Raised when the trading server returns a non-2xx status."""
    def __init__(self, status: int, detail: str):
        self.status = status
        self.detail = detail
        super().__init__(f"ELLIE trading error {status}: {detail}")


# ---------------------------------------------------------------------------
# Config helpers — called at request time so env changes take effect
# ---------------------------------------------------------------------------

def _base_url() -> str:
    url = os.environ.get("ELLIETRADING_URL", "").strip()
    if not url:
        try:
            from core.config import get_settings
            url = get_settings().ellietrading_url
        except Exception:
            url = "http://159.89.139.43:8000"
    return url.rstrip("/")


def _auth_token() -> str:
    tok = os.environ.get("ELLIETRADING_AUTH_TOKEN", "").strip()
    if not tok:
        try:
            from core.config import get_settings
            tok = get_settings().ellietrading_auth_token or ""
        except Exception:
            pass
    return tok


def _headers() -> dict:
    h = {"Content-Type": "application/json", "Accept": "application/json"}
    tok = _auth_token()
    if tok:
        h["Authorization"] = f"Bearer {tok}"
    return h


TIMEOUT = 15  # seconds


# ---------------------------------------------------------------------------
# Async helpers (httpx) — for use inside FastAPI async handlers
# ---------------------------------------------------------------------------

async def _aget(path: str, params: dict | None = None) -> Any:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(f"{_base_url()}{path}", params=params, headers=_headers())
        if r.status_code >= 400:
            raise EllieTradeError(r.status_code, r.text[:600])
        return r.json()


async def _apost(path: str, body: dict | None = None) -> Any:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.post(f"{_base_url()}{path}", json=body or {}, headers=_headers())
        if r.status_code >= 400:
            raise EllieTradeError(r.status_code, r.text[:600])
        return r.json()


async def _apatch(path: str, body: dict | None = None) -> Any:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.patch(f"{_base_url()}{path}", json=body or {}, headers=_headers())
        if r.status_code >= 400:
            raise EllieTradeError(r.status_code, r.text[:600])
        return r.json()


async def _adelete(path: str) -> Any:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.delete(f"{_base_url()}{path}", headers=_headers())
        if r.status_code >= 400:
            raise EllieTradeError(r.status_code, r.text[:600])
        return r.json()


# ---------------------------------------------------------------------------
# Sync helpers (urllib stdlib) — for scripts, CLI, notebooks
# ---------------------------------------------------------------------------

def _sync_req(method: str, path: str, body: dict | None = None, params: dict | None = None) -> Any:
    url = f"{_base_url()}{path}"
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    data = json.dumps(body).encode() if body is not None else None
    req  = urllib.request.Request(url, data=data, headers=_headers(), method=method.upper())
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        raise EllieTradeError(exc.code, exc.read().decode()[:600]) from exc
    except Exception as exc:
        raise EllieTradeError(502, str(exc)) from exc


def _sget(path, params=None):   return _sync_req("GET",    path, params=params)
def _spost(path, body=None):    return _sync_req("POST",   path, body=body)
def _spatch(path, body=None):   return _sync_req("PATCH",  path, body=body)
def _sdelete(path):             return _sync_req("DELETE", path)


# ---------------------------------------------------------------------------
# Client class
# ---------------------------------------------------------------------------

class EllieTrading:
    """
    Full async client for the ELLIE trading server.
    Async methods (no suffix) are awaitable — use inside FastAPI.
    Sync methods (_sync suffix) use urllib — use in scripts.

    Verified live endpoints: http://159.89.139.43:8000
    """

    # ── Health ───────────────────────────────────────────────────────────────

    async def ping(self) -> bool:
        """Return True if the trading server is reachable."""
        try:
            await _aget("/health")
            return True
        except Exception:
            return False

    def ping_sync(self) -> bool:
        try:
            _sget("/health")
            return True
        except Exception:
            return False


    # ── Alpaca — account & portfolio ─────────────────────────────────────────

    async def get_account(self) -> dict:
        """Portfolio equity, cash, buying_power, and pre-computed P&L fields."""
        return await _aget("/alpaca/account")

    def get_account_sync(self) -> dict:
        return _sget("/alpaca/account")


    async def get_positions(self) -> list:
        """All currently open Alpaca positions."""
        return await _aget("/alpaca/positions")

    def get_positions_sync(self) -> list:
        return _sget("/alpaca/positions")


    async def get_position(self, symbol: str) -> dict:
        """Single position by ticker symbol."""
        return await _aget(f"/alpaca/positions/{symbol.upper()}")

    def get_position_sync(self, symbol: str) -> dict:
        return _sget(f"/alpaca/positions/{symbol.upper()}")


    async def get_pnl(self, period: str = "today") -> dict:
        """Period P&L. period: today | 7d | 30d | 1y | all"""
        return await _aget("/alpaca/pnl", params={"period": period})

    def get_pnl_sync(self, period: str = "today") -> dict:
        return _sget("/alpaca/pnl", params={"period": period})


    async def get_orders(self) -> list:
        """Recent Alpaca orders."""
        return await _aget("/alpaca/orders")

    def get_orders_sync(self) -> list:
        return _sget("/alpaca/orders")


    async def place_order(
        self,
        ticker: str,
        side: str,
        qty: Optional[float] = None,
        notional: Optional[float] = None,
    ) -> dict:
        """Place a market order. Provide qty (shares) OR notional (dollar amount)."""
        body: dict = {"symbol": ticker.upper(), "side": side.lower()}
        if qty      is not None: body["qty"]      = qty
        if notional is not None: body["notional"] = notional
        return await _apost("/alpaca/order", body)

    def place_order_sync(self, ticker: str, side: str,
                         qty: Optional[float] = None,
                         notional: Optional[float] = None) -> dict:
        body: dict = {"symbol": ticker.upper(), "side": side.lower()}
        if qty      is not None: body["qty"]      = qty
        if notional is not None: body["notional"] = notional
        return _spost("/alpaca/order", body)


    async def cancel_order(self, order_id: str) -> dict:
        """Cancel an open order by ID."""
        return await _adelete(f"/alpaca/orders/{order_id}")

    def cancel_order_sync(self, order_id: str) -> dict:
        return _sdelete(f"/alpaca/orders/{order_id}")


    async def get_alpaca_config(self) -> dict:
        """Current Alpaca auto-trade config (position sizing, signals, etc.)."""
        return await _aget("/alpaca/config")

    def get_alpaca_config_sync(self) -> dict:
        return _sget("/alpaca/config")


    # ── Fund management ───────────────────────────────────────────────────────

    async def get_fund_status(self) -> dict:
        """Fund active/paused state, config, and next scheduled run times."""
        return await _aget("/fund")

    def get_fund_status_sync(self) -> dict:
        return _sget("/fund")


    async def get_fund_log(self) -> list:
        """Activity log — buy/sell events and fund operation history."""
        return await _aget("/fund/log")

    def get_fund_log_sync(self) -> list:
        return _sget("/fund/log")


    async def launch_fund(self) -> dict:
        """Launch the autonomous fund. Triggers discover → analyze → buy cycle."""
        return await _apost("/fund/launch")

    def launch_fund_sync(self) -> dict:
        return _spost("/fund/launch")


    async def pause_fund(self) -> dict:
        """Pause the fund — stops scheduled reviews and auto-buys."""
        return await _apost("/fund/pause")

    def pause_fund_sync(self) -> dict:
        return _spost("/fund/pause")


    async def resume_fund(self) -> dict:
        """Resume a paused fund."""
        return await _apost("/fund/resume")

    def resume_fund_sync(self) -> dict:
        return _spost("/fund/resume")


    async def reset_fund(self) -> dict:
        """Reset fund state (stops and clears). Use with caution."""
        return await _apost("/fund/reset")

    def reset_fund_sync(self) -> dict:
        return _spost("/fund/reset")


    async def trigger_fund_review(self) -> dict:
        """Manually trigger the daily portfolio review cycle."""
        return await _apost("/fund/review")

    def trigger_fund_review_sync(self) -> dict:
        return _spost("/fund/review")


    async def update_fund_config(self, **kwargs) -> dict:
        """
        Update fund config fields.
        Valid keys: llm_provider, deep_think_llm, quick_think_llm,
                    initial_stocks, position_pct, max_position_pct,
                    weekly_new_buy, min_hold_days, investment_style,
                    discovery_count, auto_buy_backlog
        """
        return await _apatch("/fund/config", kwargs)

    def update_fund_config_sync(self, **kwargs) -> dict:
        return _spatch("/fund/config", kwargs)


    async def fund_discover(
        self,
        llm_provider: str = "google",
        model: str = "gemini-2.5-flash",
        theme: str = "",
        count: int = 5,
    ) -> dict:
        """Trigger AI-driven stock discovery within the fund context."""
        return await _apost("/fund/discover", {
            "llm_provider": llm_provider, "model": model,
            "theme": theme, "count": count,
        })

    def fund_discover_sync(self, llm_provider="google", model="gemini-2.5-flash",
                           theme="", count=5) -> dict:
        return _spost("/fund/discover", {
            "llm_provider": llm_provider, "model": model,
            "theme": theme, "count": count,
        })


    # ── Buy backlog ───────────────────────────────────────────────────────────

    async def get_backlog(self) -> list:
        """Pending buy backlog — orders queued due to insufficient cash."""
        return await _aget("/fund/backlog")

    def get_backlog_sync(self) -> list:
        return _sget("/fund/backlog")


    async def execute_backlog_item(self, item_id: str) -> dict:
        """Execute a specific backlog buy immediately."""
        return await _apost(f"/fund/backlog/{item_id}/buy")

    def execute_backlog_item_sync(self, item_id: str) -> dict:
        return _spost(f"/fund/backlog/{item_id}/buy")


    async def remove_backlog_item(self, item_id: str) -> dict:
        """Remove a single item from the backlog."""
        return await _adelete(f"/fund/backlog/{item_id}")

    def remove_backlog_item_sync(self, item_id: str) -> dict:
        return _sdelete(f"/fund/backlog/{item_id}")


    async def clear_backlog(self) -> dict:
        """Wipe the entire buy backlog."""
        return await _apost("/fund/backlog/clear")

    def clear_backlog_sync(self) -> dict:
        return _spost("/fund/backlog/clear")


    # ── Catalysts ─────────────────────────────────────────────────────────────

    async def get_catalysts(self) -> list:
        """Catalyst watch list — upcoming earnings, IPOs, and tracked events."""
        return await _aget("/fund/catalysts")

    def get_catalysts_sync(self) -> list:
        return _sget("/fund/catalysts")


    async def trigger_catalyst_scan(self) -> dict:
        """Manually trigger a catalyst scan (runs AI discovery + Finnhub lookup)."""
        return await _apost("/fund/catalysts/scan")

    def trigger_catalyst_scan_sync(self) -> dict:
        return _spost("/fund/catalysts/scan")


    async def trigger_catalyst(self, catalyst_id: str) -> dict:
        """Manually trigger analysis for a specific catalyst."""
        return await _apost(f"/fund/catalysts/{catalyst_id}/trigger")

    def trigger_catalyst_sync(self, catalyst_id: str) -> dict:
        return _spost(f"/fund/catalysts/{catalyst_id}/trigger")


    async def remove_catalyst(self, catalyst_id: str) -> dict:
        """Remove a catalyst from the watch list."""
        return await _adelete(f"/fund/catalysts/{catalyst_id}")

    def remove_catalyst_sync(self, catalyst_id: str) -> dict:
        return _sdelete(f"/fund/catalysts/{catalyst_id}")


    # ── Market data & analysis ────────────────────────────────────────────────

    async def get_market_data(self, ticker: str, period: str = "3mo") -> dict:
        """Price history, fundamental metrics, and recent news for a ticker."""
        return await _aget(f"/market-data/{ticker.upper()}", params={"period": period})

    def get_market_data_sync(self, ticker: str, period: str = "3mo") -> dict:
        return _sget(f"/market-data/{ticker.upper()}", params={"period": period})


    async def analyze(
        self,
        ticker: str,
        date: Optional[str] = None,
        llm_provider: str = "google",
        deep_think_llm: str = "gemini-2.5-pro",
        quick_think_llm: str = "gemini-2.5-flash",
        max_debate_rounds: int = 1,
    ) -> dict:
        """
        Run full multi-agent AI analysis for a ticker.
        Long-running — 3–8 minutes. Consider calling from a background task.
        """
        return await _apost("/analyze", {
            "ticker":            ticker.upper(),
            "date":              date or datetime.utcnow().strftime("%Y-%m-%d"),
            "llm_provider":      llm_provider,
            "deep_think_llm":    deep_think_llm,
            "quick_think_llm":   quick_think_llm,
            "max_debate_rounds": max_debate_rounds,
        })

    def analyze_sync(self, ticker: str, date: Optional[str] = None,
                     llm_provider="google", deep_think_llm="gemini-2.5-pro",
                     quick_think_llm="gemini-2.5-flash", max_debate_rounds=1) -> dict:
        return _spost("/analyze", {
            "ticker": ticker.upper(),
            "date": date or datetime.utcnow().strftime("%Y-%m-%d"),
            "llm_provider": llm_provider, "deep_think_llm": deep_think_llm,
            "quick_think_llm": quick_think_llm, "max_debate_rounds": max_debate_rounds,
        })


    async def discover_stocks(
        self,
        llm_provider: str = "google",
        model: str = "gemini-2.5-flash",
        theme: str = "",
        count: int = 5,
    ) -> dict:
        """Standalone stock discovery (not tied to fund). Returns {picks: [...]}"""
        return await _apost("/discover", {
            "llm_provider": llm_provider, "model": model,
            "theme": theme, "count": count,
        })

    def discover_stocks_sync(self, llm_provider="google", model="gemini-2.5-flash",
                              theme="", count=5) -> dict:
        return _spost("/discover", {
            "llm_provider": llm_provider, "model": model,
            "theme": theme, "count": count,
        })


    # ── Monitor ───────────────────────────────────────────────────────────────

    async def get_monitors(self) -> dict:
        """All active monitors and their alert history."""
        return await _aget("/monitor")

    def get_monitors_sync(self) -> dict:
        return _sget("/monitor")


    async def run_monitor(self, monitor_id: str) -> dict:
        """Manually trigger a monitor run."""
        return await _apost(f"/monitor/{monitor_id}/run")

    def run_monitor_sync(self, monitor_id: str) -> dict:
        return _spost(f"/monitor/{monitor_id}/run")


    async def delete_monitor(self, monitor_id: str) -> dict:
        return await _adelete(f"/monitor/{monitor_id}")

    def delete_monitor_sync(self, monitor_id: str) -> dict:
        return _sdelete(f"/monitor/{monitor_id}")


    async def mark_all_alerts_read(self) -> dict:
        return await _apost("/monitor/alerts/read-all")

    def mark_all_alerts_read_sync(self) -> dict:
        return _spost("/monitor/alerts/read-all")


    # ── Scout (autonomous agent) ──────────────────────────────────────────────

    async def get_scout(self) -> dict:
        """Scout state — config, last run, recommendations."""
        return await _aget("/scout")

    def get_scout_sync(self) -> dict:
        return _sget("/scout")


    async def update_scout_config(self, **kwargs) -> dict:
        """Update scout config (enabled, interval_hours, theme, max_stocks, etc.)."""
        return await _apatch("/scout/config", kwargs)

    def update_scout_config_sync(self, **kwargs) -> dict:
        return _spatch("/scout/config", kwargs)


    async def run_scout(self) -> dict:
        """Manually trigger a scout cycle."""
        return await _apost("/scout/run")

    def run_scout_sync(self) -> dict:
        return _spost("/scout/run")


    async def dismiss_scout_recommendation(self, rec_id: str) -> dict:
        return await _adelete(f"/scout/recommendations/{rec_id}")

    def dismiss_scout_recommendation_sync(self, rec_id: str) -> dict:
        return _sdelete(f"/scout/recommendations/{rec_id}")


    # ── Portfolio history ─────────────────────────────────────────────────────

    async def get_portfolio(self) -> dict:
        """All past analysis runs with current prices and P&L."""
        return await _aget("/portfolio")

    def get_portfolio_sync(self) -> dict:
        return _sget("/portfolio")


    async def get_portfolio_history(self) -> list:
        """Raw buy/sell/hold action log."""
        return await _aget("/portfolio/history")

    def get_portfolio_history_sync(self) -> list:
        return _sget("/portfolio/history")


    async def delete_portfolio_run(self, run_id: str) -> dict:
        return await _adelete(f"/portfolio/{run_id}")

    def delete_portfolio_run_sync(self, run_id: str) -> dict:
        return _sdelete(f"/portfolio/{run_id}")


    # ── Previews (read-only dry-runs) ─────────────────────────────────────────

    async def preview_daily_review(self) -> dict:
        """Preview what a daily review would do without executing."""
        return await _aget("/preview/daily-review")

    async def preview_signals(self) -> dict:
        """Preview current signals for held positions."""
        return await _aget("/preview/signals")

    async def preview_weekly_report(self) -> dict:
        """Preview the weekly report content."""
        return await _aget("/preview/weekly-report")


    # ── Logs ─────────────────────────────────────────────────────────────────

    async def get_logs(self) -> list:
        """Server application logs (recent entries)."""
        return await _aget("/logs")

    def get_logs_sync(self) -> list:
        return _sget("/logs")


    # ── Discord ───────────────────────────────────────────────────────────────

    async def test_discord(self) -> dict:
        """Fire a test message to the configured Discord webhook."""
        return await _apost("/discord/test")

    def test_discord_sync(self) -> dict:
        return _spost("/discord/test")


    # ── Convenience: parallel dashboard snapshot ──────────────────────────────

    async def get_snapshot(self) -> dict:
        """
        Fetch account, positions, P&L, and fund status in parallel.
        Returns a nested dict: { account, positions, pnl, fund }
        for clean dashboard rendering.
        """
        account_t   = asyncio.create_task(_aget("/alpaca/account"))
        positions_t = asyncio.create_task(_aget("/alpaca/positions"))
        pnl_t       = asyncio.create_task(_aget("/alpaca/pnl", {"period": "today"}))
        fund_t      = asyncio.create_task(_aget("/fund"))

        account, positions, pnl, fund = await asyncio.gather(
            account_t, positions_t, pnl_t, fund_t,
            return_exceptions=True,
        )

        return {
            "account":   account   if isinstance(account,   dict)  else {},
            "positions": positions if isinstance(positions,  list)  else [],
            "pnl":       pnl       if isinstance(pnl,       (dict, list)) else None,
            "fund":      fund      if isinstance(fund,       dict)  else {},
        }


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

trading = EllieTrading()
