import { useState, useEffect } from 'react'
import RoomShell from '../components/shared/RoomShell'
import KpiCard from '../components/shared/KpiCard'
import StatusPill from '../components/shared/StatusPill'
import api from '../lib/api'

export default function TradingFloor() {
  const [status, setStatus] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/trading/status').catch(() => null),
      api.get('/trading/summary').catch(() => null),
    ]).then(([s, sum]) => {
      setStatus(s?.data ?? null)
      setSummary(sum?.data ?? null)
      setPaused(s?.data?.paused ?? false)
      setLoading(false)
    })
  }, [])

  const togglePause = async () => {
    const endpoint = paused ? '/trading/resume' : '/trading/pause'
    await api.post(endpoint).catch(() => null)
    setPaused(p => !p)
  }

  const pnl = summary?.today_pnl
  const pnlColor = pnl == null ? 'var(--ink-500)' : pnl >= 0 ? 'var(--mint-500)' : 'var(--coral-500)'
  const formatPnl = (v) => v == null ? '—' : `${v >= 0 ? '+' : ''}$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <RoomShell
      title="Trading Floor"
      gradient="var(--grad-daylight)"
      icon="📈"
      actions={
        <>
          <StatusPill status={loading ? 'offline' : paused ? 'paused' : 'online'} />
          <button
            onClick={togglePause}
            disabled={loading}
            style={{
              background: paused ? 'rgba(34,211,164,0.1)' : 'rgba(255,178,63,0.1)',
              border: `1.5px solid ${paused ? 'var(--mint-500)' : 'var(--amber-500)'}`,
              borderRadius: 'var(--radius-md)',
              color: paused ? 'var(--mint-500)' : 'var(--amber-500)',
              fontFamily: 'var(--font-ui)',
              fontWeight: 700,
              fontSize: 'var(--text-sm)',
              padding: '6px 16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition)',
            }}
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
        </>
      }
    >
      {/* KPI row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
        <KpiCard
          label="Account Value"
          value={summary?.account_value != null ? `$${summary.account_value.toLocaleString()}` : '—'}
          sub="total equity"
          accent="var(--peach-500)"
          icon="💰"
        />
        <KpiCard
          label="Today P&L"
          value={formatPnl(pnl)}
          sub={summary?.today_pnl_pct != null ? `${summary.today_pnl_pct >= 0 ? '+' : ''}${summary.today_pnl_pct.toFixed(2)}%` : null}
          accent={pnlColor}
          icon="📊"
        />
        <KpiCard
          label="Open Positions"
          value={status?.open_positions ?? '—'}
          sub="active trades"
          accent="var(--violet-500)"
          icon="🏦"
        />
        <KpiCard
          label="Alerts"
          value={status?.alerts ?? 0}
          sub={status?.alerts > 0 ? 'needs attention' : 'all clear'}
          accent={status?.alerts > 0 ? 'var(--coral-500)' : 'var(--mint-500)'}
          icon="🔔"
        />
      </div>

      {/* Positions + Decisions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, flexWrap: 'wrap' }}>
        {/* Positions table */}
        <div style={{
          background: 'var(--paper-50)',
          border: '1.5px solid var(--ink-300)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          boxShadow: 'var(--shadow-sm)',
        }}>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
            Open Positions
          </h3>
          {loading ? (
            <p style={{ color: 'var(--ink-300)', fontSize: 'var(--text-sm)' }}>Loading…</p>
          ) : summary?.positions?.length ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ color: 'var(--ink-300)', textAlign: 'left' }}>
                  {['Symbol', 'Qty', 'Entry', 'P&L'].map(h => (
                    <th key={h} style={{ padding: '4px 8px', fontWeight: 600, fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.positions.map((p, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--paper-200)' }}>
                    <td style={{ padding: '8px', fontWeight: 700, color: 'var(--ink-900)', fontFamily: 'var(--font-mono)' }}>{p.symbol}</td>
                    <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', color: 'var(--ink-700)' }}>{p.qty}</td>
                    <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', color: 'var(--ink-700)' }}>${p.entry_price?.toFixed(2)}</td>
                    <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', color: p.unrealized_pl >= 0 ? 'var(--mint-500)' : 'var(--coral-500)', fontWeight: 700 }}>
                      {formatPnl(p.unrealized_pl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: 'var(--ink-300)', fontSize: 'var(--text-sm)' }}>
              {status == null ? 'Connect ellietrading to see live positions.' : 'No open positions.'}
            </p>
          )}
        </div>

        {/* Recent decisions */}
        <div style={{
          background: 'var(--paper-50)',
          border: '1.5px solid var(--ink-300)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          boxShadow: 'var(--shadow-sm)',
        }}>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
            Recent Decisions
          </h3>
          {loading ? (
            <p style={{ color: 'var(--ink-300)', fontSize: 'var(--text-sm)' }}>Loading…</p>
          ) : summary?.recent_activity?.length ? (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {summary.recent_activity.slice(0, 8).map((a, i) => (
                <li key={i} style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-700)', paddingLeft: 12, borderLeft: '2px solid var(--paper-200)' }}>
                  {a}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: 'var(--ink-300)', fontSize: 'var(--text-sm)' }}>
              {status == null ? 'Connect ellietrading to see activity.' : 'No recent decisions today.'}
            </p>
          )}
        </div>
      </div>
    </RoomShell>
  )
}
