import { useState, useEffect } from 'react'
import RoomShell from '../components/shared/RoomShell'
import KpiCard from '../components/shared/KpiCard'
import StatusPill from '../components/shared/StatusPill'
import api from '../lib/api'

const AGENT_SLOTS = [
  { name: 'Forge', role: 'Business Development' },
  { name: 'Atlas', role: 'Research & Analysis' },
  { name: 'Nova', role: 'Content & Comms' },
  { name: 'Axon', role: 'Operations' },
  { name: 'Lyra', role: 'Strategy' },
]

export default function BusinessFactory() {
  const [status, setStatus] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/business/status').catch(() => null),
      api.get('/business/summary').catch(() => null),
    ]).then(([s, sum]) => {
      setStatus(s?.data ?? null)
      setSummary(sum?.data ?? null)
      setPaused(s?.data?.paused ?? false)
      setLoading(false)
    })
  }, [])

  const togglePause = async () => {
    const endpoint = paused ? '/business/resume' : '/business/pause'
    await api.post(endpoint).catch(() => null)
    setPaused(p => !p)
  }

  return (
    <RoomShell
      title="Business Factory"
      gradient="var(--grad-violet)"
      icon="⚙️"
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
          label="Revenue"
          value={summary?.revenue != null ? `$${summary.revenue.toLocaleString()}` : '—'}
          sub="all time"
          accent="var(--violet-500)"
          icon="💵"
        />
        <KpiCard
          label="Active Agents"
          value={status?.active_agents ?? '—'}
          sub="of 5 slots"
          accent="var(--rose-500)"
          icon="🤖"
        />
        <KpiCard
          label="Actions Today"
          value={status?.actions_today ?? '—'}
          sub="completed tasks"
          accent="var(--mint-500)"
          icon="✅"
        />
        <KpiCard
          label="Alerts"
          value={status?.alerts ?? 0}
          sub={status?.alerts > 0 ? 'needs attention' : 'all clear'}
          accent={status?.alerts > 0 ? 'var(--coral-500)' : 'var(--mint-500)'}
          icon="🔔"
        />
      </div>

      {/* Agent crew + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Agent crew */}
        <div style={{
          background: 'var(--paper-50)',
          border: '1.5px solid var(--ink-300)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          boxShadow: 'var(--shadow-sm)',
        }}>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
            Agent Crew
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {AGENT_SLOTS.map((agent) => {
              const live = status?.agents?.find(a => a.name === agent.name)
              return (
                <div key={agent.name} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--paper-100)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--paper-200)',
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--ink-900)' }}>{agent.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-500)' }}>{agent.role}</div>
                  </div>
                  <StatusPill status={live?.status ?? 'offline'} label={live?.status ?? 'offline'} />
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent activity */}
        <div style={{
          background: 'var(--paper-50)',
          border: '1.5px solid var(--ink-300)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          boxShadow: 'var(--shadow-sm)',
        }}>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
            Recent Activity
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
              No activity yet. Start the elliebusiness server on :8001.
            </p>
          )}
        </div>
      </div>
    </RoomShell>
  )
}
