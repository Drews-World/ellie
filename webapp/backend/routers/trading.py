"""
Trading Floor router
--------------------
Exposes the ELLIE trading server to the local frontend via clean REST endpoints.
All heavy lifting is in services/ellie_trading_client.py — this file is thin glue.

Base prefix: /trading
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from services.ellie_trading_client import trading, EllieTradeError

router = APIRouter(prefix="/trading", tags=["trading"])


# ---------------------------------------------------------------------------
# Error helper
# ---------------------------------------------------------------------------

def _wrap(exc: EllieTradeError) -> HTTPException:
    return HTTPException(status_code=exc.status, detail=exc.detail)


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class OrderRequest(BaseModel):
    ticker: str
    side: str                        # "buy" | "sell"
    qty: Optional[float] = None
    notional: Optional[float] = None


class FundConfigRequest(BaseModel):
    llm_provider: Optional[str]       = None
    deep_think_llm: Optional[str]     = None
    quick_think_llm: Optional[str]    = None
    initial_stocks: Optional[int]     = None
    position_pct: Optional[float]     = None
    max_position_pct: Optional[float] = None
    weekly_new_buy: Optional[bool]    = None
    min_hold_days: Optional[int]      = None
    investment_style: Optional[str]   = None   # "longterm" | "shortterm" | "mixed"
    discovery_count: Optional[int]    = None
    auto_buy_backlog: Optional[bool]  = None


class DiscoverRequest(BaseModel):
    llm_provider: str = "google"
    model: str        = "gemini-2.5-flash"
    theme: str        = ""
    count: int        = 5


class AnalyzeRequest(BaseModel):
    ticker: str
    date: Optional[str]           = None
    llm_provider: str             = "google"
    deep_think_llm: str           = "gemini-2.5-pro"
    quick_think_llm: str          = "gemini-2.5-flash"
    max_debate_rounds: int        = 1


# ---------------------------------------------------------------------------
# Health / connectivity
# ---------------------------------------------------------------------------

@router.get("/ping")
async def ping():
    """Check whether the trading server is reachable."""
    alive = await trading.ping()
    return {"online": alive}


# ---------------------------------------------------------------------------
# Account & portfolio snapshot
# ---------------------------------------------------------------------------

@router.get("/snapshot")
async def snapshot():
    """
    Single call: account equity, cash, P&L, positions, and today's P&L series.
    Used by the trading floor dashboard.
    """
    try:
        return await trading.get_snapshot()
    except EllieTradeError as e:
        raise _wrap(e)


@router.get("/account")
async def get_account():
    """Raw Alpaca account data — equity, cash, buying_power, P&L fields."""
    try:
        return await trading.get_account()
    except EllieTradeError as e:
        raise _wrap(e)


@router.get("/positions")
async def get_positions():
    """All currently open positions."""
    try:
        return await trading.get_positions()
    except EllieTradeError as e:
        raise _wrap(e)


@router.get("/pnl")
async def get_pnl(period: str = Query("today", description="today | 7d | 30d | 1y | all")):
    """Period P&L data — pass ?period=7d etc."""
    try:
        return await trading.get_pnl(period)
    except EllieTradeError as e:
        raise _wrap(e)


@router.get("/orders")
async def get_orders():
    """Recent Alpaca orders."""
    try:
        return await trading.get_orders()
    except EllieTradeError as e:
        raise _wrap(e)


# ---------------------------------------------------------------------------
# Order placement & cancellation
# ---------------------------------------------------------------------------

@router.post("/orders")
async def place_order(req: OrderRequest):
    """Place a market order. Supply qty (shares) or notional (dollars)."""
    try:
        return await trading.place_order(
            req.ticker, req.side, qty=req.qty, notional=req.notional
        )
    except EllieTradeError as e:
        raise _wrap(e)


@router.delete("/orders/{order_id}")
async def cancel_order(order_id: str):
    """Cancel an open order by ID."""
    try:
        return await trading.cancel_order(order_id)
    except EllieTradeError as e:
        raise _wrap(e)


# ---------------------------------------------------------------------------
# Fund management
# ---------------------------------------------------------------------------

@router.get("/fund/status")
async def fund_status():
    """Fund active/paused state, config, and next scheduled run times."""
    try:
        return await trading.get_fund_status()
    except EllieTradeError as e:
        raise _wrap(e)


@router.get("/fund/log")
async def fund_log():
    """Activity log — buy/sell events and fund operation history."""
    try:
        return await trading.get_fund_log()
    except EllieTradeError as e:
        raise _wrap(e)


@router.post("/fund/launch")
async def fund_launch():
    """Launch the autonomous fund. Triggers discover → analyze → buy cycle."""
    try:
        return await trading.launch_fund()
    except EllieTradeError as e:
        raise _wrap(e)


@router.post("/fund/pause")
async def fund_pause():
    """Pause the fund — stops scheduled reviews and auto-buys."""
    try:
        return await trading.pause_fund()
    except EllieTradeError as e:
        raise _wrap(e)


@router.patch("/fund/config")
async def update_fund_config(req: FundConfigRequest):
    """Update fund config fields. Only include keys you want to change."""
    try:
        updates = req.model_dump(exclude_none=True)
        return await trading.update_fund_config(**updates)
    except EllieTradeError as e:
        raise _wrap(e)


@router.post("/fund/discover")
async def fund_discover(req: DiscoverRequest):
    """Trigger manual AI-driven stock discovery."""
    try:
        return await trading.discover_stocks(
            llm_provider=req.llm_provider,
            model=req.model,
            theme=req.theme,
            count=req.count,
        )
    except EllieTradeError as e:
        raise _wrap(e)


# ---------------------------------------------------------------------------
# Buy backlog
# ---------------------------------------------------------------------------

@router.get("/fund/backlog")
async def get_backlog():
    """Pending buy backlog — orders queued due to insufficient cash."""
    try:
        return await trading.get_backlog()
    except EllieTradeError as e:
        raise _wrap(e)


@router.post("/fund/backlog/{item_id}/buy")
async def execute_backlog_item(item_id: str):
    """Execute a specific backlog buy immediately."""
    try:
        return await trading.execute_backlog_item(item_id)
    except EllieTradeError as e:
        raise _wrap(e)


@router.delete("/fund/backlog/{item_id}")
async def remove_backlog_item(item_id: str):
    """Remove a single item from the buy backlog."""
    try:
        return await trading.remove_backlog_item(item_id)
    except EllieTradeError as e:
        raise _wrap(e)


@router.post("/fund/backlog/clear")
async def clear_backlog():
    """Wipe the entire buy backlog."""
    try:
        return await trading.clear_backlog()
    except EllieTradeError as e:
        raise _wrap(e)


# ---------------------------------------------------------------------------
# Market data & analysis
# ---------------------------------------------------------------------------

@router.get("/market-data/{ticker}")
async def get_market_data(ticker: str, period: str = Query("3mo")):
    """Price history, fundamentals, and recent news for a ticker."""
    try:
        return await trading.get_market_data(ticker, period)
    except EllieTradeError as e:
        raise _wrap(e)


@router.post("/analyze")
async def analyze(req: AnalyzeRequest):
    """
    Run full multi-agent AI analysis for a ticker.
    Long-running — 3–8 min depending on model.
    """
    try:
        return await trading.analyze(
            ticker=req.ticker,
            date=req.date,
            llm_provider=req.llm_provider,
            deep_think_llm=req.deep_think_llm,
            quick_think_llm=req.quick_think_llm,
            max_debate_rounds=req.max_debate_rounds,
        )
    except EllieTradeError as e:
        raise _wrap(e)


# ---------------------------------------------------------------------------
# Catalysts & portfolio history
# ---------------------------------------------------------------------------

@router.get("/catalysts")
async def get_catalysts():
    """Catalyst watch list — upcoming earnings, IPOs, and events being tracked."""
    try:
        return await trading.get_catalysts()
    except EllieTradeError as e:
        raise _wrap(e)


@router.get("/portfolio")
async def get_portfolio():
    """All past analysis runs with current prices and P&L."""
    try:
        return await trading.get_portfolio()
    except EllieTradeError as e:
        raise _wrap(e)


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

@router.post("/discord/test")
async def discord_test():
    """Fire a test message to the trading server's configured Discord webhook."""
    try:
        return await trading.test_discord()
    except EllieTradeError as e:
        raise _wrap(e)
