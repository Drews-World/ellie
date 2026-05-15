import { useState, useEffect, useRef, useCallback } from 'react'
import RoomShell from '../components/shared/RoomShell'
import KpiCard from '../components/shared/KpiCard'
import StatusPill from '../components/shared/StatusPill'
import api from '../lib/api'

const AGENTS = [
  { name: 'ELLIE',    role: 'Supervisor',       icon: '🧠' },
  { name: 'Forge',    role: 'Designer',          icon: '🔨' },
  { name: 'Nova',     role: 'Research',          icon: '🔭' },
  { name: 'Archives', role: 'Memory & Feedback', icon: '🗄️' },
  { name: 'Treasury', role: 'Cost Tracker',      icon: '💰' },
]

const KIND_COLORS = {
  notification: 'var(--violet-500)',
  forge:        'var(--amber-500)',
  nova:         'var(--mint-500)',
  sale:         'var(--rose-500)',
  error:        'var(--coral-500)',
  info:         'var(--ink-400)',
}

function formatTs(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch { return '' }
}

function LogPanel({ items, loading }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [items.length])

  return (
    <div style={{
      background: '#0d0d0d',
      border: '1.5px solid var(--ink-300)',
      borderRadius: 'var(--radius-lg)',
      padding: '16px 0 8px',
      display: 'flex',
      flexDirection: 'column',
      height: 320,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 16px 12px',
        borderBottom: '1px solid #1f1f1f',
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: loading ? 'var(--ink-300)' : '#22d18a',
          boxShadow: loading ? 'none' : '0 0 6px #22d18a88',
          display: 'inline-block',
        }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Live Log
        </span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#444' }}>
          {items.length} entries
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {items.length === 0 ? (
          <div style={{ padding: '24px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#333' }}>
            {loading ? 'connecting...' : '// no activity yet — start elliebusiness on :8001'}
          </div>
        ) : (
          items.map((item, i) => (
            <div key={i} style={{
              display: 'flex',
              gap: 12,
              padding: '3px 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              lineHeight: 1.5,
            }}>
              <span style={{ color: '#444', flexShrink: 0, width: 80 }}>{formatTs(item.ts)}</span>
              <span style={{
                color: KIND_COLORS[item.kind] || KIND_COLORS.info,
                flexShrink: 0,
                width: 90,
              }}>[{item.kind}]</span>
              <span style={{ color: '#ccc' }}>{item.summary}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function DesignCard({ design, onVerdict }) {
  return (
    <div style={{
      background: 'var(--paper-50)',
      border: '1.5px solid var(--ink-300)',
      borderRadius: 'var(--radius-md)',
      padding: 16,
      display: 'flex',
      gap: 16,
      alignItems: 'flex-start',
    }}>
      {design.image_url ? (
        <img src={design.image_url} alt={design.concept_name}
          style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div style={{
          width: 80, height: 80, borderRadius: 8, background: 'var(--paper-200)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, flexShrink: 0,
        }}>🎨</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--ink-900)', marginBottom: 2 }}>
          {design.concept_name}
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-500)', marginBottom: 4 }}>
          {design.niche} · score {(design.forge_score * 100).toFixed(0)}%
        </div>
        {design.sell_reason && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-400)', marginBottom: 8, fontStyle: 'italic' }}>
            {design.sell_reason}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onVerdict(design.id, 'approve')} style={verdictBtn('var(--mint-500)')}>✓ Approve</button>
          <button onClick={() => onVerdict(design.id, 'iterate')} style={verdictBtn('var(--amber-500)')}>↻ Iterate</button>
          <button onClick={() => onVerdict(design.id, 'reject')} style={verdictBtn('var(--coral-500)')}>✕ Reject</button>
        </div>
      </div>
    </div>
  )
}

function verdictBtn(color) {
  return {
    background: 'transparent',
    border: `1px solid ${color}`,
    borderRadius: 'var(--radius-sm)',
    color,
    fontFamily: 'var(--font-ui)',
    fontWeight: 700,
    fontSize: 11,
    padding: '4px 10px',
    cursor: 'pointer',
  }
}

export default function BusinessFactory() {
  const [status, setStatus]     = useState(null)
  const [summary, setSummary]   = useState(null)
  const [logItems, setLogItems] = useState([])
  const [queue, setQueue]       = useState([])
  const [spend, setSpend]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [paused, setPaused]     = useState(false)
  const [forgeNiche, setForgeNiche] = useState('minimalist mountain mug')
  const [runningForge, setRunningForge] = useState(false)
  const seenLogIds = useRef(new Set())

  const fetchAll = useCallback(async () => {
    const [s, sum, sp] = await Promise.all([
      api.get('/business/status').catch(() => null),
      api.get('/business/summary').catch(() => null),
      api.get('/business/treasury/spend').catch(() => null),
    ])
    setStatus(s?.data ?? null)
    setSummary(sum?.data ?? null)
    setSpend(sp?.data ?? null)
    setPaused(s?.data?.paused ?? false)
    setLoading(false)
  }, [])

  const fetchLog = useCallback(async () => {
    const res = await api.get('/business/activity', { params: { limit: 60 } }).catch(() => null)
    if (!res?.data?.items) return
    setLogItems(prev => {
      const newItems = res.data.items.filter(item => {
        const key = `${item.ts}-${item.summary}`
        if (seenLogIds.current.has(key)) return false
        seenLogIds.current.add(key)
        return true
      })
      if (!newItems.length) return prev
      return [...prev, ...newItems].slice(-200)
    })
  }, [])

  const fetchQueue = useCallback(async () => {
    const res = await api.get('/business/forge/queue', { params: { limit: 10 } }).catch(() => null)
    setQueue(res?.data?.designs ?? [])
  }, [])

  useEffect(() => {
    fetchAll()
    fetchLog()
    fetchQueue()
    const interval = setInterval(() => {
      fetchLog()
      fetchQueue()
    }, 5000)
    const slowInterval = setInterval(fetchAll, 30000)
    return () => { clearInterval(interval); clearInterval(slowInterval) }
  }, [fetchAll, fetchLog, fetchQueue])

  const togglePause = async () => {
    const endpoint = paused ? '/business/resume' : '/business/pause'
    await api.post(endpoint, {}).catch(() => null)
    setPaused(p => !p)
    setTimeout(fetchAll, 500)
  }

  const handleVerdict = async (designId, verdict) => {
    await api.post('/business/archives/feedback', {
      target_kind: 'design',
      target_id: designId,
      verdict,
      notes: '',
    }).catch(() => null)
    setQueue(q => q.filter(d => d.id !== designId))
  }

  const triggerForge = async () => {
    if (!forgeNiche.trim()) return
    setRunningForge(true)
    await api.post('/business/forge/run', { niche: forgeNiche.trim(), n_concepts: 5 }).catch(() => null)
    setRunningForge(false)
    setTimeout(fetchLog, 2000)
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
            }}
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
        </>
      }
    >
      {/* KPI row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <KpiCard label="Revenue" value={summary?.revenue != null ? `$${Number(summary.revenue).toLocaleString()}` : '—'} sub="all time" accent="var(--violet-500)" icon="💵" />
        <KpiCard label="Spend Today" value={spend?.today_usd != null ? `$${Number(spend.today_usd).toFixed(2)}` : '—'} sub="LLM + image gen" accent="var(--amber-500)" icon="📊" />
        <KpiCard label="Review Queue" value={queue.length || '—'} sub="designs pending" accent="var(--rose-500)" icon="🎨" />
        <KpiCard label="Active Agents" value={status?.active_agents ?? 0} sub="of 5" accent="var(--mint-500)" icon="🤖" />
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, marginBottom: 20 }}>
        {/* Agent crew */}
        <div style={{ background: 'var(--paper-50)', border: '1.5px solid var(--ink-300)', borderRadius: 'var(--radius-lg)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Agent Crew</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {AGENTS.map(agent => {
              const live = summary?.agents?.find(a => a.name === agent.name)
              return (
                <div key={agent.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--paper-100)', borderRadius: 'var(--radius-md)', border: '1px solid var(--paper-200)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{agent.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--ink-900)' }}>{agent.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink-400)' }}>{agent.role}</div>
                    </div>
                  </div>
                  <StatusPill status={live?.status ?? 'offline'} label={live?.status ?? 'offline'} />
                </div>
              )
            })}
          </div>

          {/* Forge trigger */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--paper-200)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Trigger Forge</div>
            <input
              value={forgeNiche}
              onChange={e => setForgeNiche(e.target.value)}
              placeholder="niche..."
              style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', border: '1px solid var(--ink-300)', borderRadius: 'var(--radius-sm)', background: 'var(--paper-100)', color: 'var(--ink-900)', fontFamily: 'var(--font-ui)', fontSize: 12, marginBottom: 8 }}
            />
            <button
              onClick={triggerForge}
              disabled={runningForge || paused}
              style={{ width: '100%', padding: '7px', background: 'rgba(139,92,246,0.15)', border: '1.5px solid var(--violet-500)', borderRadius: 'var(--radius-sm)', color: 'var(--violet-500)', fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 12, cursor: runningForge || paused ? 'not-allowed' : 'pointer', opacity: runningForge || paused ? 0.5 : 1 }}
            >
              {runningForge ? '⏳ Starting…' : '▶ Run Forge'}
            </button>
          </div>
        </div>

        {/* Live log */}
        <LogPanel items={logItems} loading={loading} />
      </div>

      {/* Design queue */}
      {queue.length > 0 && (
        <div style={{ background: 'var(--paper-50)', border: '1.5px solid var(--ink-300)', borderRadius: 'var(--radius-lg)', padding: 20, boxShadow: 'var(--shadow-sm)', marginBottom: 20 }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
            Archives — {queue.length} Design{queue.length !== 1 ? 's' : ''} Awaiting Review
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {queue.map(design => (
              <DesignCard key={design.id} design={design} onVerdict={handleVerdict} />
            ))}
          </div>
        </div>
      )}
    </RoomShell>
  )
}
