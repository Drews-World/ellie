import { useState, useEffect, useRef, useCallback } from 'react'
import RoomShell from '../components/shared/RoomShell'
import api from '../lib/api'

// ── Keyframe injection ────────────────────────────────────────────────────────
let _injected = false
function ensureKeyframes() {
  if (_injected || typeof document === 'undefined') return
  _injected = true
  const s = document.createElement('style')
  s.textContent = `
    @keyframes tf-scan {
      0%   { transform: translateY(-100%); }
      100% { transform: translateY(100vh); }
    }
    @keyframes tf-ticker {
      0%   { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    @keyframes tf-pulse-ring {
      0%   { opacity: 0.7; transform: scale(0.85); }
      100% { opacity: 0;   transform: scale(1.7); }
    }
    @keyframes tf-boot {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes tf-glow-green {
      0%, 100% { box-shadow: 0 0 8px rgba(34,211,164,0.4); }
      50%       { box-shadow: 0 0 20px rgba(34,211,164,0.9); }
    }
    @keyframes tf-glow-amber {
      0%, 100% { box-shadow: 0 0 8px rgba(255,180,0,0.4); }
      50%       { box-shadow: 0 0 20px rgba(255,180,0,0.9); }
    }
    @keyframes tf-flow {
      0%   { transform: translateX(-120%); opacity: 0; }
      15%  { opacity: 1; }
      85%  { opacity: 1; }
      100% { transform: translateX(220%); opacity: 0; }
    }
    @keyframes tf-row-in {
      from { opacity: 0; transform: translateX(-8px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    .btn-trade {
      position: relative;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      border-radius: 0;
      cursor: pointer;
      transition: box-shadow 0.18s, opacity 0.18s;
    }
    .btn-trade:disabled { opacity: 0.35; cursor: not-allowed; }
    .btn-trade .corner {
      position: absolute; width: 5px; height: 5px; pointer-events: none;
    }
    .btn-trade .corner-tl { top: 2px; left: 2px;  border-top: 1.5px solid; border-left: 1.5px solid; }
    .btn-trade .corner-tr { top: 2px; right: 2px; border-top: 1.5px solid; border-right: 1.5px solid; }
    .btn-trade .corner-bl { bottom: 2px; left: 2px;  border-bottom: 1.5px solid; border-left: 1.5px solid; }
    .btn-trade .corner-br { bottom: 2px; right: 2px; border-bottom: 1.5px solid; border-right: 1.5px solid; }
  `
  document.head.appendChild(s)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const $ = (v, digits = 2) =>
  v == null ? '—' : `$${Math.abs(Number(v)).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
const pct = (v) =>
  v == null ? '—' : `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`
const sign = (v) =>
  v == null ? '—' : `${Number(v) >= 0 ? '+' : '-'}${$(v)}`
const signColor = (v, neutral = false) =>
  v == null ? 'rgba(170,165,220,0.55)' : Number(v) > 0 ? '#22D3A4' : Number(v) < 0 ? '#FF5C72' : neutral ? 'rgba(170,165,220,0.55)' : '#FFB23F'

function timeAgo(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  const diff = Date.now() - d.getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function fmtTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ── Dark panel wrapper ────────────────────────────────────────────────────────
function Panel({ children, style = {}, accent = 'rgba(255,180,0,0.22)', label, labelColor = '#FFB400', action }) {
  return (
    <div style={{
      background: 'rgba(2,3,10,0.97)',
      border: `1px solid ${accent}`,
      borderRadius: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      animation: 'tf-boot 0.35s ease-out both',
      ...style,
    }}>
      {label && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '7px 14px',
          borderBottom: `1px solid ${accent}`,
          background: 'rgba(0,0,0,0.4)',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: labelColor, letterSpacing: '0.18em', textTransform: 'uppercase',
          }}>◈ {label}</span>
          {action}
        </div>
      )}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  )
}

// ── Trade button ──────────────────────────────────────────────────────────────
function TBtn({ onClick, disabled, color = '#FFB400', children, style = {} }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn-trade"
      style={{
        background: `color-mix(in srgb, ${color} 10%, rgba(1,2,8,0.95))`,
        border: `1px solid ${color}`,
        color,
        padding: '6px 16px',
        boxShadow: disabled ? 'none' : `0 0 10px color-mix(in srgb, ${color} 28%, transparent)`,
        ...style,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.boxShadow = `0 0 22px color-mix(in srgb, ${color} 65%, transparent)` }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.boxShadow = disabled ? 'none' : `0 0 10px color-mix(in srgb, ${color} 28%, transparent)` }}
    >
      <span className="corner corner-tl" style={{ borderColor: color }} />
      <span className="corner corner-tr" style={{ borderColor: color }} />
      <span className="corner corner-bl" style={{ borderColor: color }} />
      <span className="corner corner-br" style={{ borderColor: color }} />
      {children}
    </button>
  )
}

// ── Top status bar ────────────────────────────────────────────────────────────
function TradingStatusBar({ snap, loading, onRefresh, refreshing }) {
  const fund = snap?.fund ?? {}
  const active = fund.active && !fund.paused
  const paused = fund.paused
  const equity = snap?.account?.portfolio_value ?? snap?.account?.equity
  const pnlToday = snap?.account?.pnl_today
  const marketOpen = (() => {
    const now = new Date()
    const day = now.getDay()
    const h = now.getHours(), m = now.getMinutes()
    const mins = h * 60 + m
    return day >= 1 && day <= 5 && mins >= 570 && mins < 960 // 9:30–16:00 ET (rough UTC-4)
  })()

  const fundColor = active ? '#22D3A4' : paused ? '#FFB23F' : '#6460A8'
  const fundLabel = active ? 'FUND ACTIVE' : paused ? 'FUND PAUSED' : 'FUND OFFLINE'

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '7px 24px',
      background: 'rgba(1,2,8,0.99)',
      borderBottom: '1px solid rgba(255,180,0,0.15)',
      flexShrink: 0, gap: 0,
      backgroundImage: 'repeating-linear-gradient(transparent 0px,transparent 3px,rgba(0,0,0,0.12) 3px,rgba(0,0,0,0.12) 4px)',
      backgroundSize: '100% 4px',
      boxShadow: '0 2px 24px rgba(0,0,0,0.9)',
    }}>
      {/* ELLIE ident */}
      <div style={{ display: 'flex', flexDirection: 'column', marginRight: 28, flexShrink: 0, gap: 1 }}>
        <span style={{ fontSize: 5, fontFamily: 'var(--font-pixel)', color: 'rgba(255,180,0,0.28)', letterSpacing: '0.3em' }}>◈</span>
        <span style={{ fontSize: 5, fontFamily: 'var(--font-pixel)', color: 'rgba(255,180,0,0.4)', letterSpacing: '0.2em', textTransform: 'uppercase', lineHeight: 1.8 }}>TRADING</span>
        <span style={{ fontSize: 5, fontFamily: 'var(--font-pixel)', color: 'rgba(255,180,0,0.4)', letterSpacing: '0.2em', textTransform: 'uppercase', lineHeight: 1.8 }}>FLOOR</span>
      </div>

      {/* Fund status node */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        padding: '4px 16px',
        background: `color-mix(in srgb, ${fundColor} 8%, rgba(1,3,12,0.98))`,
        border: `1px solid color-mix(in srgb, ${fundColor} 50%, transparent)`,
        boxShadow: active ? `0 0 20px color-mix(in srgb, ${fundColor} 45%, transparent)` : 'none',
      }}>
        <div style={{ position: 'relative', width: 14, height: 14 }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%) rotate(45deg)',
            width: 8, height: 8,
            background: fundColor,
            boxShadow: `0 0 8px ${fundColor}`,
            animation: active ? 'led-blink 1.4s ease-in-out infinite' : 'none',
          }} />
          {active && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              width: 16, height: 16, borderRadius: '50%',
              border: `1px solid ${fundColor}`,
              animation: 'tf-pulse-ring 1.8s ease-out infinite',
              pointerEvents: 'none',
            }} />
          )}
        </div>
        <span style={{ fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 700, color: fundColor, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
          {fundLabel}
        </span>
      </div>

      {/* Connecting line */}
      <div style={{ flex: '0 0 20px', height: 2, background: 'rgba(255,180,0,0.3)', position: 'relative', overflow: 'hidden' }}>
        {active && <div style={{ position: 'absolute', top: 0, left: 0, width: 20, height: '100%', background: 'linear-gradient(90deg, transparent, #22D3A4, transparent)', animation: 'tf-flow 2.2s ease-in-out infinite' }} />}
      </div>

      {/* Market status */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        padding: '4px 12px',
        border: `1px solid ${marketOpen ? 'rgba(34,211,164,0.4)' : 'rgba(255,92,114,0.25)'}`,
        background: marketOpen ? 'rgba(34,211,164,0.06)' : 'rgba(255,92,114,0.04)',
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: marketOpen ? '#22D3A4' : '#FF5C72',
          boxShadow: marketOpen ? '0 0 8px rgba(34,211,164,0.8)' : 'none',
          animation: marketOpen ? 'led-blink 2s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 700, color: marketOpen ? '#22D3A4' : '#FF5C72', whiteSpace: 'nowrap' }}>
          {marketOpen ? 'MKT OPEN' : 'MKT CLOSED'}
        </span>
      </div>

      {/* Connecting line */}
      <div style={{ flex: 1, height: 1, background: 'rgba(255,180,0,0.15)', marginLeft: 16, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 48, height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,180,0,0.5), transparent)', animation: 'tf-flow 3s ease-in-out infinite 1s' }} />
      </div>

      {/* Equity readout */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 20, gap: 2 }}>
        <span style={{ fontSize: 7, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Portfolio</span>
        <span style={{ fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#FFB400', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {loading ? '—' : equity != null ? `$${Number(equity).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
        </span>
        {pnlToday != null && (
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: signColor(pnlToday), animation: 'led-blink 2.5s ease-in-out infinite' }}>
            {sign(pnlToday)} today
          </span>
        )}
      </div>

      {/* Refresh button */}
      <button
        onClick={onRefresh}
        disabled={refreshing}
        style={{
          marginLeft: 20, background: 'transparent', border: '1px solid rgba(255,180,0,0.3)',
          color: refreshing ? 'rgba(255,180,0,0.35)' : 'rgba(255,180,0,0.65)',
          fontFamily: 'var(--font-mono)', fontSize: 8, padding: '4px 10px', cursor: refreshing ? 'not-allowed' : 'pointer',
          letterSpacing: '0.1em', textTransform: 'uppercase',
          transition: 'color 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => { if (!refreshing) { e.currentTarget.style.color = '#FFB400'; e.currentTarget.style.borderColor = 'rgba(255,180,0,0.8)' }}}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,180,0,0.65)'; e.currentTarget.style.borderColor = 'rgba(255,180,0,0.3)' }}
      >
        {refreshing ? '⟳ …' : '⟳ SYNC'}
      </button>
    </div>
  )
}

// ── KPI card (dark trading style) ─────────────────────────────────────────────
function TKpi({ label, value, sub, accent = '#FFB400', blink = false, style = {} }) {
  return (
    <div style={{
      background: 'rgba(2,3,10,0.97)',
      border: `1px solid rgba(${accent === '#22D3A4' ? '34,211,164' : accent === '#FF5C72' ? '255,92,114' : '255,180,0'},0.28)`,
      flex: 1, minWidth: 130,
      padding: '14px 18px',
      display: 'flex', flexDirection: 'column', gap: 5,
      animation: 'tf-boot 0.3s ease-out both',
      ...style,
    }}>
      <span style={{ fontSize: 7, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.5)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
        {label}
      </span>
      <span style={{
        fontSize: 22, fontFamily: 'var(--font-mono)', fontWeight: 700, color: accent, lineHeight: 1.05,
        animation: blink ? 'led-blink 2.5s ease-in-out infinite' : 'none',
      }}>
        {value ?? '—'}
      </span>
      {sub && (
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.45)' }}>{sub}</span>
      )}
    </div>
  )
}

// ── Positions table ───────────────────────────────────────────────────────────
function PositionsTable({ positions, loading }) {
  if (loading) return (
    <div style={{ padding: 20, fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.4)', textAlign: 'center', letterSpacing: '0.1em' }}>
      ⟳ LOADING POSITIONS…
    </div>
  )
  if (!positions?.length) return (
    <div style={{ padding: 20, fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.35)', textAlign: 'center', letterSpacing: '0.08em' }}>
      — NO OPEN POSITIONS —
    </div>
  )

  const cols = ['SYMBOL', 'QTY', 'ENTRY', 'CURRENT', 'MKT VAL', 'P&L', 'P&L %']

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c} style={{
                padding: '8px 14px', textAlign: 'left',
                fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 700,
                color: 'rgba(255,180,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.12em',
                borderBottom: '1px solid rgba(255,180,0,0.15)',
                whiteSpace: 'nowrap',
              }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((pos, i) => {
            const pl = Number(pos.unrealized_pl ?? pos.unrealized_plpc * pos.market_value ?? 0)
            const plPct = Number(pos.unrealized_plpc ?? 0) * 100
            const color = signColor(pl)
            return (
              <tr key={pos.symbol ?? i} style={{
                borderBottom: '1px solid rgba(255,180,0,0.07)',
                animation: `tf-row-in 0.25s ease-out ${i * 40}ms both`,
              }}>
                <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#E8E4FF', fontSize: 12 }}>
                  {pos.symbol}
                </td>
                <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.75)', fontSize: 11 }}>
                  {Number(pos.qty).toFixed(pos.qty % 1 === 0 ? 0 : 4)}
                </td>
                <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.65)', fontSize: 11 }}>
                  ${Number(pos.avg_entry_price).toFixed(2)}
                </td>
                <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.65)', fontSize: 11 }}>
                  ${Number(pos.current_price).toFixed(2)}
                </td>
                <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.55)', fontSize: 11 }}>
                  ${Number(pos.market_value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color, fontSize: 11 }}>
                  {pl >= 0 ? '+' : '-'}${Math.abs(pl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color, fontSize: 11 }}>
                  {plPct >= 0 ? '+' : ''}{plPct.toFixed(2)}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Orders panel ──────────────────────────────────────────────────────────────
function OrdersPanel({ orders, loading }) {
  if (loading) return (
    <div style={{ padding: 16, fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.35)', textAlign: 'center' }}>⟳ …</div>
  )
  if (!orders?.length) return (
    <div style={{ padding: 16, fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.3)', textAlign: 'center' }}>— NO RECENT ORDERS —</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {orders.slice(0, 12).map((o, i) => {
        const isBuy  = o.side === 'buy'
        const status = o.status ?? 'unknown'
        const statusColor = status === 'filled' ? '#22D3A4' : status === 'canceled' || status === 'rejected' ? '#FF5C72' : '#FFB23F'
        return (
          <div key={o.id ?? i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 14px',
            borderBottom: '1px solid rgba(255,180,0,0.06)',
            animation: `tf-row-in 0.25s ease-out ${i * 30}ms both`,
          }}>
            {/* Side badge */}
            <div style={{
              width: 36, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isBuy ? 'rgba(34,211,164,0.12)' : 'rgba(255,92,114,0.12)',
              border: `1px solid ${isBuy ? 'rgba(34,211,164,0.5)' : 'rgba(255,92,114,0.5)'}`,
              fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 700,
              color: isBuy ? '#22D3A4' : '#FF5C72', letterSpacing: '0.08em',
            }}>
              {isBuy ? 'BUY' : 'SELL'}
            </div>
            {/* Symbol */}
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#E8E4FF', fontSize: 11, width: 52, flexShrink: 0 }}>
              {o.symbol}
            </span>
            {/* Qty / notional */}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(170,165,220,0.6)', flex: 1 }}>
              {o.filled_qty ? `${Number(o.filled_qty).toFixed(2)} sh` : o.qty ? `${Number(o.qty).toFixed(2)} sh` : o.notional ? `$${Number(o.notional).toFixed(2)}` : '—'}
              {o.filled_avg_price ? ` @ $${Number(o.filled_avg_price).toFixed(2)}` : ''}
            </span>
            {/* Status */}
            <span style={{ fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 700, color: statusColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {status}
            </span>
            {/* Time */}
            <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.35)', whiteSpace: 'nowrap' }}>
              {fmtTime(o.filled_at ?? o.submitted_at)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Fund control panel ────────────────────────────────────────────────────────
function FundControl({ fund, loading, onLaunch, onPause, onRefresh }) {
  const [busy, setBusy] = useState(false)

  const handleLaunch = async () => {
    setBusy(true)
    try { await onLaunch() } finally { setBusy(false) }
  }
  const handlePause = async () => {
    setBusy(true)
    try { await onPause() } finally { setBusy(false) }
  }

  const active = fund?.active && !fund?.paused
  const paused = fund?.paused
  const style_label = fund?.investment_style ?? '—'
  const pos_pct     = fund?.position_pct != null ? `${(fund.position_pct * 100).toFixed(0)}%` : '—'
  const max_pos_pct = fund?.max_position_pct != null ? `${(fund.max_position_pct * 100).toFixed(0)}%` : '—'
  const hold_days   = fund?.min_hold_days ?? '—'
  const weekly_buy  = fund?.weekly_new_buy ? 'YES' : 'NO'

  const infoRows = [
    ['STYLE',    style_label.toUpperCase()],
    ['POS SIZE', pos_pct],
    ['MAX POS',  max_pos_pct],
    ['MIN HOLD', `${hold_days}d`],
    ['WEEKLY',   weekly_buy],
  ]

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Status indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: active ? '#22D3A4' : paused ? '#FFB23F' : 'rgba(100,96,168,0.45)',
          boxShadow: active ? '0 0 12px rgba(34,211,164,0.8)' : paused ? '0 0 8px rgba(255,178,63,0.6)' : 'none',
          animation: active ? 'led-blink 1.5s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: active ? '#22D3A4' : paused ? '#FFB23F' : 'rgba(170,165,220,0.45)' }}>
          {loading ? 'CONNECTING…' : active ? 'AUTONOMOUS FUND ACTIVE' : paused ? 'FUND PAUSED' : 'FUND OFFLINE'}
        </span>
      </div>

      {/* Config grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 1, background: 'rgba(255,180,0,0.08)',
        border: '1px solid rgba(255,180,0,0.12)',
      }}>
        {infoRows.map(([k, v]) => (
          <div key={k} style={{
            display: 'flex', flexDirection: 'column', gap: 2,
            padding: '8px 12px',
            background: 'rgba(2,3,10,0.9)',
            borderRight: '1px solid rgba(255,180,0,0.08)',
          }}>
            <span style={{ fontSize: 7, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{k}</span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#FFB400' }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!active && (
          <TBtn onClick={handleLaunch} disabled={busy || loading} color="#22D3A4">
            ▶ LAUNCH FUND
          </TBtn>
        )}
        {active && (
          <TBtn onClick={handlePause} disabled={busy || loading} color="#FFB23F">
            ⏸ PAUSE FUND
          </TBtn>
        )}
        {paused && (
          <TBtn onClick={handleLaunch} disabled={busy || loading} color="#22D3A4">
            ▶ RESUME
          </TBtn>
        )}
      </div>

      {/* Next run times */}
      {(fund?.next_review || fund?.next_discovery) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 7, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>SCHEDULED</span>
          {fund.next_review && (
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.55)' }}>
              Review: <span style={{ color: '#FFB400' }}>{timeAgo(fund.next_review)}</span>
            </div>
          )}
          {fund.next_discovery && (
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.55)' }}>
              Discovery: <span style={{ color: '#FFB400' }}>{timeAgo(fund.next_discovery)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Buy backlog panel ─────────────────────────────────────────────────────────
function BacklogPanel({ backlog, loading, onExecute, onRemove }) {
  if (loading) return (
    <div style={{ padding: 16, fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.35)', textAlign: 'center' }}>⟳ …</div>
  )
  if (!backlog?.length) return (
    <div style={{ padding: 16, fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.3)', textAlign: 'center' }}>— BACKLOG CLEAR —</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 0' }}>
      {backlog.map((item, i) => (
        <div key={item.id ?? i} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
          borderBottom: '1px solid rgba(255,180,0,0.06)',
          animation: `tf-row-in 0.2s ease-out ${i * 40}ms both`,
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: '#FFB23F', boxShadow: '0 0 6px rgba(255,178,63,0.8)',
            animation: 'led-blink 1.5s ease-in-out infinite',
          }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11, color: '#E8E4FF', flex: 1 }}>
            {item.ticker ?? item.symbol ?? '?'}
          </span>
          {item.notional && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#FFB400' }}>
              ${Number(item.notional).toFixed(2)}
            </span>
          )}
          <button
            onClick={() => onExecute(item.id)}
            style={{
              background: 'rgba(34,211,164,0.1)', border: '1px solid rgba(34,211,164,0.45)',
              color: '#22D3A4', fontFamily: 'var(--font-mono)', fontSize: 7, fontWeight: 700,
              padding: '3px 8px', cursor: 'pointer', letterSpacing: '0.08em',
            }}
          >BUY</button>
          <button
            onClick={() => onRemove(item.id)}
            style={{
              background: 'transparent', border: '1px solid rgba(255,92,114,0.35)',
              color: '#FF5C72', fontFamily: 'var(--font-mono)', fontSize: 7, fontWeight: 700,
              padding: '3px 8px', cursor: 'pointer',
            }}
          >✕</button>
        </div>
      ))}
    </div>
  )
}

// ── Activity log ──────────────────────────────────────────────────────────────
function ActivityLog({ log, loading }) {
  if (loading) return (
    <div style={{ padding: 16, fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.35)', textAlign: 'center' }}>⟳ …</div>
  )
  if (!log?.length) return (
    <div style={{ padding: 16, fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.3)', textAlign: 'center' }}>— NO ACTIVITY —</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {log.slice(0, 20).map((entry, i) => {
        const type = entry.type ?? entry.action ?? ''
        const isBuy  = type.toLowerCase().includes('buy')  || type.toLowerCase().includes('purchase')
        const isSell = type.toLowerCase().includes('sell')
        const isErr  = type.toLowerCase().includes('error') || type.toLowerCase().includes('fail')
        const dotColor = isBuy ? '#22D3A4' : isSell ? '#FF5C72' : isErr ? '#FF5C72' : '#FFB400'

        const msg = entry.message ?? entry.detail ?? entry.description ?? JSON.stringify(entry)
        const ts  = entry.timestamp ?? entry.created_at ?? entry.time

        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 14px',
            borderBottom: '1px solid rgba(255,180,0,0.05)',
            animation: `tf-row-in 0.2s ease-out ${i * 25}ms both`,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor, flexShrink: 0, marginTop: 4, boxShadow: `0 0 5px ${dotColor}` }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(232,228,255,0.8)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                {msg}
              </div>
              {ts && (
                <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.35)', marginTop: 2 }}>
                  {timeAgo(ts)}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Quick order form ──────────────────────────────────────────────────────────
function QuickOrder({ onOrder }) {
  const [ticker, setTicker] = useState('')
  const [side, setSide]     = useState('buy')
  const [amount, setAmount] = useState('')
  const [mode, setMode]     = useState('notional') // 'notional' | 'qty'
  const [busy, setBusy]     = useState(false)
  const [result, setResult] = useState(null)

  const handleSubmit = async () => {
    if (!ticker.trim() || !amount) return
    setBusy(true); setResult(null)
    const payload = {
      ticker: ticker.trim().toUpperCase(),
      side,
      [mode === 'notional' ? 'notional' : 'qty']: Number(amount),
    }
    try {
      const res = await api.post('/trading/orders', payload)
      setResult({ ok: true, msg: `Order submitted: ${res.data?.id ?? 'success'}` })
      setTicker(''); setAmount('')
      onOrder?.()
    } catch (e) {
      setResult({ ok: false, msg: e?.response?.data?.detail ?? 'Order failed' })
    }
    setBusy(false)
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Side toggle */}
      <div style={{ display: 'flex', gap: 0 }}>
        {['buy', 'sell'].map(s => (
          <button key={s} onClick={() => setSide(s)} style={{
            flex: 1, padding: '8px 0',
            background: side === s ? (s === 'buy' ? 'rgba(34,211,164,0.18)' : 'rgba(255,92,114,0.18)') : 'rgba(2,3,10,0.6)',
            border: `1px solid ${side === s ? (s === 'buy' ? 'rgba(34,211,164,0.7)' : 'rgba(255,92,114,0.7)') : 'rgba(255,180,0,0.12)'}`,
            color: side === s ? (s === 'buy' ? '#22D3A4' : '#FF5C72') : 'rgba(170,165,220,0.4)',
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
            cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.12em',
          }}>{s}</button>
        ))}
      </div>

      {/* Ticker input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 7, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Ticker</span>
        <input
          value={ticker}
          onChange={e => setTicker(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="AAPL"
          maxLength={6}
          style={{
            background: 'rgba(2,3,10,0.8)', border: '1px solid rgba(255,180,0,0.3)',
            color: '#FFB400', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
            padding: '7px 10px', borderRadius: 0, outline: 'none', letterSpacing: '0.1em',
          }}
        />
      </div>

      {/* Amount + mode */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 7, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Amount</span>
          <div style={{ display: 'flex', gap: 0 }}>
            {[['notional', '$'], ['qty', 'SH']].map(([m, l]) => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: '2px 8px', fontSize: 7,
                background: mode === m ? 'rgba(255,180,0,0.18)' : 'transparent',
                border: `1px solid ${mode === m ? 'rgba(255,180,0,0.55)' : 'rgba(255,180,0,0.15)'}`,
                color: mode === m ? '#FFB400' : 'rgba(170,165,220,0.35)',
                fontFamily: 'var(--font-mono)', fontWeight: 700, cursor: 'pointer',
              }}>{l}</button>
            ))}
          </div>
        </div>
        <input
          value={amount}
          onChange={e => setAmount(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder={mode === 'notional' ? '1000.00' : '10'}
          type="number"
          style={{
            background: 'rgba(2,3,10,0.8)', border: '1px solid rgba(255,180,0,0.3)',
            color: '#E8E4FF', fontFamily: 'var(--font-mono)', fontSize: 13,
            padding: '7px 10px', borderRadius: 0, outline: 'none',
          }}
        />
      </div>

      {/* Submit */}
      <TBtn
        onClick={handleSubmit}
        disabled={busy || !ticker.trim() || !amount}
        color={side === 'buy' ? '#22D3A4' : '#FF5C72'}
        style={{ width: '100%', padding: '9px 0', fontSize: 10 }}
      >
        {busy ? '⟳ PLACING…' : `${side.toUpperCase()} ${ticker || '—'}`}
      </TBtn>

      {result && (
        <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: result.ok ? '#22D3A4' : '#FF5C72', lineHeight: 1.4 }}>
          {result.ok ? '✓' : '✕'} {result.msg}
        </div>
      )}
    </div>
  )
}

// ── Scrolling positions ticker strip ─────────────────────────────────────────
function TickerStrip({ positions }) {
  if (!positions?.length) return null
  // Duplicate for seamless scroll
  const items = [...positions, ...positions]
  return (
    <div style={{
      height: 28, overflow: 'hidden',
      background: 'rgba(0,0,0,0.55)',
      borderBottom: '1px solid rgba(255,180,0,0.12)',
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        whiteSpace: 'nowrap',
        animation: `tf-ticker ${positions.length * 4}s linear infinite`,
        width: 'max-content',
        height: '100%',
      }}>
        {items.map((pos, i) => {
          const pl = Number(pos.unrealized_pl ?? 0)
          const plpct = Number(pos.unrealized_plpc ?? 0) * 100
          const color = pl > 0 ? '#22D3A4' : pl < 0 ? '#FF5C72' : '#FFB400'
          return (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '0 20px',
              borderRight: '1px solid rgba(255,180,0,0.1)',
              fontFamily: 'var(--font-mono)', fontSize: 9,
            }}>
              <span style={{ color: '#E8E4FF', fontWeight: 700 }}>{pos.symbol}</span>
              <span style={{ color: '#FFB400' }}>${Number(pos.current_price).toFixed(2)}</span>
              <span style={{ color, fontWeight: 700 }}>
                {pl >= 0 ? '▲' : '▼'} {plpct >= 0 ? '+' : ''}{plpct.toFixed(2)}%
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TradingFloor() {
  ensureKeyframes()

  const [snap, setSnap]         = useState(null)
  const [orders, setOrders]     = useState(null)
  const [log, setLog]           = useState(null)
  const [backlog, setBacklog]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab]           = useState('positions') // 'positions' | 'orders'
  const [rightTab, setRightTab] = useState('fund')       // 'fund' | 'backlog' | 'order'
  const mountedRef              = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchAll = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    else setRefreshing(true)
    try {
      const [snapRes, ordersRes, logRes, backlogRes] = await Promise.allSettled([
        api.get('/trading/snapshot'),
        api.get('/trading/orders'),
        api.get('/trading/fund/log'),
        api.get('/trading/fund/backlog'),
      ])
      if (!mountedRef.current) return
      if (snapRes.status === 'fulfilled')    setSnap(snapRes.value.data)
      if (ordersRes.status === 'fulfilled')  setOrders(ordersRes.value.data)
      if (logRes.status === 'fulfilled')     setLog(logRes.value.data)
      if (backlogRes.status === 'fulfilled') setBacklog(backlogRes.value.data)
    } catch { /* swallow */ } finally {
      if (mountedRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(() => fetchAll(true), 30000)
    return () => clearInterval(id)
  }, [fetchAll])

  const handleLaunch = async () => {
    await api.post('/trading/fund/launch').catch(() => null)
    await fetchAll(true)
  }
  const handlePause = async () => {
    await api.post('/trading/fund/pause').catch(() => null)
    await fetchAll(true)
  }
  const handleExecuteBacklog = async (id) => {
    await api.post(`/trading/fund/backlog/${id}/buy`).catch(() => null)
    await fetchAll(true)
  }
  const handleRemoveBacklog = async (id) => {
    await api.delete(`/trading/fund/backlog/${id}`).catch(() => null)
    await fetchAll(true)
  }

  // Derived data
  const account   = snap?.account ?? {}
  const positions = snap?.positions ?? []
  const fund      = snap?.fund ?? {}

  const equity      = account.portfolio_value ?? account.equity
  const pnlToday    = account.pnl_today
  const pnlTodayPct = account.pnl_today_pct
  const cash        = account.cash
  const buyPower    = account.buying_power
  const totalUnrz   = positions.reduce((sum, p) => sum + Number(p.unrealized_pl ?? 0), 0)

  // Tab styles
  const tabStyle = (active) => ({
    padding: '6px 16px', fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.12em', cursor: 'pointer',
    border: 'none', background: 'transparent',
    color: active ? '#FFB400' : 'rgba(170,165,220,0.4)',
    borderBottom: active ? '2px solid #FFB400' : '2px solid transparent',
    transition: 'color 0.15s, border-color 0.15s',
  })
  const rtabStyle = (which) => ({
    ...tabStyle(rightTab === which),
    fontSize: 7,
    padding: '5px 12px',
  })

  return (
    <RoomShell
      title="Trading Floor"
      gradient="linear-gradient(135deg, #FFB23F 0%, #FF8A66 100%)"
      icon="📈"
      outerStyle={{
        background: 'rgba(1,2,8,0.99)',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,180,0,0.03) 39px, rgba(255,180,0,0.03) 40px)',
      }}
      contentStyle={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      headerStyle={{
        background: 'rgba(2,3,10,0.98)',
        borderBottom: '1px solid rgba(255,180,0,0.25)',
      }}
    >
      {/* Positions ticker strip */}
      <TickerStrip positions={positions} />

      {/* Top status bar */}
      <TradingStatusBar
        snap={snap}
        loading={loading}
        onRefresh={() => fetchAll(true)}
        refreshing={refreshing}
      />

      {/* KPI row */}
      <div style={{
        display: 'flex', gap: 1, padding: '1px 1px 0',
        background: 'rgba(255,180,0,0.08)',
        flexShrink: 0,
      }}>
        <TKpi
          label="Portfolio Value"
          value={loading ? '—' : equity != null ? `$${Number(equity).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
          sub="total equity"
          accent="#FFB400"
        />
        <TKpi
          label="Today P&L"
          value={loading ? '—' : pnlToday != null ? `${pnlToday >= 0 ? '+' : '-'}$${Math.abs(pnlToday).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
          sub={pnlTodayPct != null ? `${pnlTodayPct >= 0 ? '+' : ''}${Number(pnlTodayPct).toFixed(2)}%` : ''}
          accent={signColor(pnlToday)}
          blink={pnlToday != null}
        />
        <TKpi
          label="Unrealized P&L"
          value={loading ? '—' : positions.length ? `${totalUnrz >= 0 ? '+' : '-'}$${Math.abs(totalUnrz).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
          sub={`${positions.length} open position${positions.length !== 1 ? 's' : ''}`}
          accent={signColor(totalUnrz)}
        />
        <TKpi
          label="Cash"
          value={loading ? '—' : cash != null ? `$${Number(Math.abs(cash)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
          sub={cash < 0 ? 'margin used' : 'available'}
          accent={cash < 0 ? '#FF5C72' : '#48BBFF'}
        />
        <TKpi
          label="Buying Power"
          value={loading ? '—' : buyPower != null ? `$${Number(buyPower).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
          sub="deployable"
          accent="rgba(170,165,220,0.7)"
        />
      </div>

      {/* Main layout — scrollable content */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 1, padding: 1, overflow: 'auto', minHeight: 0 }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0 }}>

          {/* Positions / Orders panel */}
          <Panel
            label={null}
            accent="rgba(255,180,0,0.2)"
            style={{ flex: 2, minHeight: 240 }}
          >
            {/* Tab bar */}
            <div style={{
              display: 'flex', borderBottom: '1px solid rgba(255,180,0,0.15)',
              background: 'rgba(0,0,0,0.3)', flexShrink: 0,
            }}>
              <button style={tabStyle(tab === 'positions')} onClick={() => setTab('positions')}>
                Positions {positions.length > 0 ? `(${positions.length})` : ''}
              </button>
              <button style={tabStyle(tab === 'orders')} onClick={() => setTab('orders')}>
                Orders {orders?.length ? `(${orders.length})` : ''}
              </button>
            </div>

            {tab === 'positions' && <PositionsTable positions={positions} loading={loading} />}
            {tab === 'orders'    && <OrdersPanel orders={orders} loading={loading} />}
          </Panel>

          {/* Activity log */}
          <Panel
            label="FUND ACTIVITY LOG"
            accent="rgba(155,114,255,0.3)"
            labelColor="#9B72FF"
            style={{ flex: 1, minHeight: 160 }}
          >
            <ActivityLog log={log} loading={loading} />
          </Panel>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>

          {/* Right tab bar */}
          <div style={{
            display: 'flex',
            background: 'rgba(2,3,10,0.98)',
            border: '1px solid rgba(255,180,0,0.18)',
            borderBottom: 'none', flexShrink: 0,
          }}>
            <button style={rtabStyle('fund')}    onClick={() => setRightTab('fund')}>Fund</button>
            <button style={rtabStyle('backlog')} onClick={() => setRightTab('backlog')}>
              Backlog {backlog?.length ? `(${backlog.length})` : ''}
            </button>
            <button style={rtabStyle('order')}   onClick={() => setRightTab('order')}>Order</button>
          </div>

          <Panel
            accent="rgba(255,180,0,0.18)"
            style={{ flex: 1 }}
          >
            {rightTab === 'fund' && (
              <FundControl
                fund={fund}
                loading={loading}
                onLaunch={handleLaunch}
                onPause={handlePause}
                onRefresh={() => fetchAll(true)}
              />
            )}
            {rightTab === 'backlog' && (
              <BacklogPanel
                backlog={backlog}
                loading={loading}
                onExecute={handleExecuteBacklog}
                onRemove={handleRemoveBacklog}
              />
            )}
            {rightTab === 'order' && (
              <QuickOrder onOrder={() => setTimeout(() => fetchAll(true), 1500)} />
            )}
          </Panel>
        </div>
      </div>
    </RoomShell>
  )
}
