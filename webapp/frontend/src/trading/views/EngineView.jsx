// Strategy Engine view — the deterministic layer's control room.
// Status + start/pause, per-strategy config, open positions, trade log,
// backtest runner with equity curves, and the weekly LLM oversight review.
import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { tfetch } from '../lib/tapi'
import styles from './EngineView.module.css'

const fmt = (n, dec = 2) => n == null ? '—' :
  Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
const fmtD = (n) => n == null ? '—' : `$${fmt(n)}`
const shortTs = (ts) => ts ? new Date(ts).toLocaleString('en-US',
  { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'
const shortDate = (ts) => ts ? new Date(ts).toLocaleDateString('en-US',
  { month: 'short', day: 'numeric', year: '2-digit' }) : ''

const STRATEGY_LABELS = {
  mean_reversion: 'Mean Reversion · SPY/QQQ · 15min',
  momentum_breakout: 'Momentum Breakout · BTC · 1h',
  trend_following: 'Trend Following · GLD/USO · 4h',
}
const VERDICT_CLASS = { KEEP: 'verdictKeep', ADJUST: 'verdictAdjust', PAUSE: 'verdictPause' }

// ── Equity curve chart for one backtested strategy ───────────────────────────
function EquityCurve({ curve, initialEquity }) {
  if (!curve?.length) return null
  const data = curve.map(([ts, eq]) => ({ ts, eq }))
  const last = data[data.length - 1].eq
  const isUp = last >= initialEquity
  const color = isUp ? 'var(--green, #059669)' : 'var(--red, #dc2626)'
  const step = Math.max(1, Math.floor(data.length / 8))
  const ticks = data.filter((_, i) => i % step === 0).map(d => d.ts)
  return (
    <ResponsiveContainer width="100%" height={170}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.18} />
            <stop offset="95%" stopColor={color} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="ts" ticks={ticks} tickFormatter={shortDate}
          tick={{ fontSize: 10, fill: 'var(--text-dim)' }} axisLine={false} tickLine={false} />
        <YAxis domain={['auto', 'auto']}
          tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 10, fill: 'var(--text-dim)' }} axisLine={false} tickLine={false} width={44} />
        <Tooltip
          formatter={(v) => [fmtD(v), 'Equity']}
          labelFormatter={(ts) => new Date(ts).toLocaleString()}
          contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', fontSize: 12 }} />
        <Area type="monotone" dataKey="eq" stroke={color} strokeWidth={2}
          fill="url(#eqGrad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Stat grid for backtest results ───────────────────────────────────────────
function StatGrid({ stats }) {
  if (!stats) return null
  const cells = [
    ['Return', stats.total_return_pct != null ? `${stats.total_return_pct}%` : '—',
      stats.total_return_pct > 0 ? styles.pos : styles.neg],
    ['CAGR', stats.cagr_pct != null ? `${stats.cagr_pct}%` : '—'],
    ['Max Drawdown', stats.max_drawdown_pct != null ? `−${stats.max_drawdown_pct}%` : '—', styles.neg],
    ['Win Rate', stats.win_rate_pct != null ? `${stats.win_rate_pct}%` : '—'],
    ['Trades', stats.trades ?? '—'],
    ['Profit Factor', stats.profit_factor ?? '—'],
    ['Sharpe', stats.sharpe ?? '—'],
    ['Stops Hit', stats.stops_hit ?? '—'],
  ]
  return (
    <div className={styles.statGrid}>
      {cells.map(([label, value, cls]) => (
        <div key={label} className={styles.statCell}>
          <div className={styles.statLabel}>{label}</div>
          <div className={[styles.statValue, cls].filter(Boolean).join(' ')}>{value}</div>
        </div>
      ))}
    </div>
  )
}

// ── Backtest panel ────────────────────────────────────────────────────────────
function BacktestPanel() {
  const [store, setStore] = useState(null)
  const [years, setYears] = useState(3)
  const [tab, setTab] = useState(null)
  const [starting, setStarting] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await tfetch('/engine/backtest')
      if (r.ok) setStore(await r.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!store?.running) return undefined
    const iv = setInterval(load, 5000)
    return () => clearInterval(iv)
  }, [store?.running, load])

  const run = async () => {
    setStarting(true)
    try {
      await tfetch('/engine/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ years }),
      })
      await load()
    } finally { setStarting(false) }
  }

  const latest = store?.results?.[0]
  const names = latest ? Object.keys(latest.strategies) : []
  const active = tab && names.includes(tab) ? tab : names[0]
  const res = latest?.strategies?.[active]

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.panelTitle}>Backtest</div>
          <div className={styles.panelSub}>
            No strategy ships without one — same code as the live engine, replayed over history.
          </div>
        </div>
        <div className={styles.backtestControls}>
          <select value={years} onChange={e => setYears(Number(e.target.value))} className={styles.select}>
            {[1, 2, 3, 4, 5].map(y => <option key={y} value={y}>{y} year{y > 1 ? 's' : ''}</option>)}
          </select>
          <button className={styles.primaryBtn} onClick={run} disabled={starting || store?.running}>
            {store?.running ? 'Running…' : 'Run Backtest'}
          </button>
        </div>
      </div>

      {store?.running && <div className={styles.notice}>Backtest running — fetching years of bars and replaying every strategy…</div>}
      {store?.error && <div className={styles.errorNotice}>Last backtest failed: {store.error}</div>}

      {latest && (
        <>
          <div className={styles.metaRow}>
            Ran {shortTs(latest.created_at)} · {latest.years}y · ${fmt(latest.initial_equity, 0)} start ·
            slippage {latest.slippage_bps}bps · risk {latest.config_snapshot?.risk_pct}%/trade
          </div>
          <div className={styles.tabs}>
            {names.map(n => (
              <button key={n}
                className={[styles.tab, active === n && styles.tabActive].filter(Boolean).join(' ')}
                onClick={() => setTab(n)}>
                {latest.strategies[n].label || n}
              </button>
            ))}
          </div>
          {res?.error && <div className={styles.errorNotice}>{res.error}</div>}
          {res && !res.error && (
            <>
              <StatGrid stats={res.stats} />
              <EquityCurve curve={res.equity_curve} initialEquity={latest.initial_equity} />
            </>
          )}
        </>
      )}
      {!latest && !store?.running && (
        <div className={styles.empty}>No backtests yet. Run one before starting the engine.</div>
      )}
    </div>
  )
}

// ── Strategy config card ──────────────────────────────────────────────────────
function StrategyCard({ name, params, trades, onToggle, onSave }) {
  const [draft, setDraft] = useState({})
  const numericKeys = Object.keys(params).filter(k => typeof params[k] === 'number')
  const stratTrades = trades.filter(t => t.strategy === name)
  const pnl = stratTrades.reduce((s, t) => s + (t.pnl || 0), 0)
  const wins = stratTrades.filter(t => t.pnl > 0).length

  const save = () => {
    if (Object.keys(draft).length) onSave(name, draft)
    setDraft({})
  }

  return (
    <div className={[styles.stratCard, !params.enabled && styles.stratDisabled].filter(Boolean).join(' ')}>
      <div className={styles.stratHeader}>
        <div>
          <div className={styles.stratName}>{STRATEGY_LABELS[name] || name}</div>
          <div className={styles.stratSymbols}>{(params.symbols || []).join(' · ')} — {params.timeframe}</div>
        </div>
        <label className={styles.toggle}>
          <input type="checkbox" checked={!!params.enabled} onChange={() => onToggle(name, !params.enabled)} />
          <span>{params.enabled ? 'ON' : 'OFF'}</span>
        </label>
      </div>
      <div className={styles.stratStats}>
        {stratTrades.length
          ? <>Trades: {stratTrades.length} · Wins: {wins} · P&L: <span className={pnl >= 0 ? styles.pos : styles.neg}>{fmtD(pnl)}</span></>
          : 'No live trades yet'}
      </div>
      <div className={styles.paramGrid}>
        {numericKeys.map(k => (
          <label key={k} className={styles.paramField}>
            <span>{k}</span>
            <input
              type="number" step="any"
              value={draft[k] ?? params[k]}
              onChange={e => setDraft(d => ({ ...d, [k]: Number(e.target.value) }))}
            />
          </label>
        ))}
      </div>
      {Object.keys(draft).length > 0 && (
        <button className={styles.saveBtn} onClick={save}>Save params</button>
      )}
    </div>
  )
}

// ── Oversight review panel ────────────────────────────────────────────────────
function ReviewPanel({ review, lastReview, nextReview, onRun }) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.panelTitle}>Weekly Oversight (LLM crew)</div>
          <div className={styles.panelSub}>
            Advisory only — the crew reviews the trade log and regime, you apply changes.
            {nextReview && <> Next auto-review: {shortTs(nextReview)}.</>}
          </div>
        </div>
        <button className={styles.refreshBtn} onClick={onRun}>Run review now</button>
      </div>
      {!review && <div className={styles.empty}>No review yet — runs weekly once the engine has history.</div>}
      {review && (
        <>
          {review.overall && <div className={styles.reviewOverall}>{review.overall}</div>}
          <div className={styles.verdictList}>
            {Object.entries(review.verdicts || {}).map(([n, v]) => (
              <div key={n} className={styles.verdictRow}>
                <span className={[styles.verdictBadge, styles[VERDICT_CLASS[v.verdict] || 'verdictAdjust']].join(' ')}>
                  {v.verdict || '?'}
                </span>
                <div>
                  <div className={styles.verdictName}>{STRATEGY_LABELS[n] || n}</div>
                  <div className={styles.verdictReason}>{v.reasoning}</div>
                  {v.suggested_changes && Object.keys(v.suggested_changes).length > 0 && (
                    <div className={styles.verdictChanges}>
                      Suggests: {JSON.stringify(v.suggested_changes)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className={styles.metaRow}>
            Generated {shortTs(review.generated_at)} · {review.provider}/{review.model} ·
            sample: {review.data_window?.recent_trades ?? 0} trades last 7d,
            {' '}{review.data_window?.all_time_trades ?? 0} all-time
          </div>
        </>
      )}
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────
export default function EngineView() {
  const [state, setState] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const r = await tfetch('/engine')
      if (r.ok) { setState(await r.json()); setError(null) }
    } catch (e) { setError(String(e)) }
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 30000)
    return () => clearInterval(iv)
  }, [load])

  const post = async (path, body) => {
    setBusy(true)
    try {
      const r = await tfetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(d.detail || `${path} failed`)
      } else {
        setError(null)
      }
      await load()
    } finally { setBusy(false) }
  }

  if (!state) return <div className={styles.page}><div className={styles.empty}>Loading engine…</div></div>

  const trades = state.trades || []
  const positions = Object.entries(state.positions || {})
  const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0)
  const cfg = state.config || {}

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          Strategy Engine
          <span className={styles.paperBadge}>{state.paper ? 'PAPER' : '⚠ NOT PAPER'}</span>
          <span className={[styles.statusPill, state.active ? styles.pillOn : styles.pillOff].join(' ')}>
            {state.active ? '● RUNNING' : '◌ PAUSED'}
          </span>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.refreshBtn} onClick={load}>Refresh</button>
          {state.active
            ? <button className={styles.dangerBtn} disabled={busy} onClick={() => post('/engine/pause')}>Pause</button>
            : <button className={styles.primaryBtn} disabled={busy} onClick={() => post('/engine/start')}>Start Engine</button>}
        </div>
      </div>
      {error && <div className={styles.errorNotice}>{error}</div>}

      {/* Summary cards */}
      <div className={styles.summaryRow}>
        <div className={styles.summaryCard}>
          <div className={styles.statLabel}>Open Positions</div>
          <div className={styles.statValue}>{positions.length}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.statLabel}>Completed Trades</div>
          <div className={styles.statValue}>{state.trade_count ?? trades.length}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.statLabel}>Engine P&L (closed)</div>
          <div className={[styles.statValue, totalPnl >= 0 ? styles.pos : styles.neg].join(' ')}>{fmtD(totalPnl)}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.statLabel}>Risk / Trade</div>
          <div className={styles.statValue}>{cfg.risk_pct}%</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.statLabel}>Last Tick</div>
          <div className={styles.statValueSm}>{shortTs(state.last_tick)}</div>
        </div>
      </div>

      {/* Risk settings */}
      <div className={styles.panel}>
        <div className={styles.panelTitle}>Risk Rules</div>
        <div className={styles.riskRow}>
          {[['risk_pct', 'Risk %/trade'], ['stop_atr_mult', 'Stop (ATRs)'],
            ['max_position_pct', 'Max position %'], ['max_risk_on', 'Max risk-on positions']].map(([k, label]) => (
            <label key={k} className={styles.paramField}>
              <span>{label}</span>
              <input type="number" step="any" defaultValue={cfg[k]} key={`${k}-${cfg[k]}`}
                onBlur={e => {
                  const v = Number(e.target.value)
                  if (v !== cfg[k] && !Number.isNaN(v)) post('/engine/config', { [k]: v })
                }} />
            </label>
          ))}
        </div>
        <div className={styles.panelSub}>
          Every trade risks {cfg.risk_pct}% of equity with a hard {cfg.stop_atr_mult}×ATR stop —
          swept against live quotes every tick, even while paused.
        </div>
      </div>

      {/* Strategies */}
      <div className={styles.stratRow}>
        {Object.entries(cfg.strategies || {}).map(([name, params]) => (
          <StrategyCard key={name} name={name} params={params} trades={trades}
            onToggle={(n, enabled) => post('/engine/config', { strategies: { [n]: { enabled } } })}
            onSave={(n, patch) => post('/engine/config', { strategies: { [n]: patch } })} />
        ))}
      </div>

      {/* Backtest */}
      <BacktestPanel />

      {/* Oversight */}
      <ReviewPanel review={state.review} lastReview={state.last_review}
        nextReview={state.next_review} onRun={() => post('/engine/review/run')} />

      {/* Open positions */}
      {positions.length > 0 && (
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Open Positions</div>
          <table className={styles.table}>
            <thead><tr><th>Symbol</th><th>Strategy</th><th>Qty</th><th>Entry</th><th>Stop</th><th>Bars held</th><th>Since</th></tr></thead>
            <tbody>
              {positions.map(([sym, p]) => (
                <tr key={sym}>
                  <td className={styles.sym}>{sym}</td>
                  <td>{p.strategy}</td>
                  <td>{fmt(p.qty, 4)}</td>
                  <td>{fmtD(p.entry_price)}</td>
                  <td className={styles.neg}>{fmtD(p.stop)}</td>
                  <td>{p.bars_held}</td>
                  <td>{shortTs(p.entry_time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Trade journal */}
      <div className={styles.panel}>
        <div className={styles.panelTitle}>Trade Journal</div>
        {trades.length === 0 && <div className={styles.empty}>No completed trades yet.</div>}
        {trades.length > 0 && (
          <table className={styles.table}>
            <thead><tr><th>Symbol</th><th>Strategy</th><th>Entry</th><th>Exit</th><th>P&L</th><th>%</th><th>Reason</th><th>Closed</th></tr></thead>
            <tbody>
              {trades.slice(0, 25).map(t => (
                <tr key={t.id}>
                  <td className={styles.sym}>{t.symbol}</td>
                  <td>{t.strategy}</td>
                  <td>{fmtD(t.entry_price)}</td>
                  <td>{fmtD(t.exit_price)}</td>
                  <td className={t.pnl >= 0 ? styles.pos : styles.neg}>{fmtD(t.pnl)}</td>
                  <td className={t.pnl >= 0 ? styles.pos : styles.neg}>{fmt(t.pnl_pct)}%</td>
                  <td>{t.reason}</td>
                  <td>{shortTs(t.exit_time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Engine log */}
      <div className={styles.panel}>
        <div className={styles.panelTitle}>Engine Log</div>
        <div className={styles.log}>
          {(state.log || []).slice(0, 30).map((l, i) => (
            <div key={i} className={styles.logLine}>
              <span className={styles.logTs}>{shortTs(l.ts)}</span> {l.msg}
            </div>
          ))}
          {(!state.log || state.log.length === 0) && <div className={styles.empty}>Quiet so far.</div>}
        </div>
      </div>
    </div>
  )
}
