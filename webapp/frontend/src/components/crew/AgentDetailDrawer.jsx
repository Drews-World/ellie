import { useEffect } from 'react'
import { StatusPill, STATUS_META } from '../ui'
import { agentIndex } from './crews'
import ActivityTimeline from './ActivityTimeline'
import './crew.css'

const KIND_VERB = {
  flow: 'hands off to', steer: 'steers', monitor: 'monitors',
  feedback: 'feeds results back to', debate: 'debates',
}

// Shared agent detail: what it does · right now · recent activity · connections.
// `live` carries runtime info: { activity, snippet, report }.
export default function AgentDetailDrawer({ crew, agentId, status = 'idle', live = {}, events = [], onClose }) {
  const idx = agentIndex(crew)
  const agent = idx[agentId]

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!agent) return null

  const feeds = crew.edges.filter(e => e.from === agentId)
  const fedBy = crew.edges.filter(e => e.to === agentId)
  const myEvents = events.filter(e =>
    (e.agentId && e.agentId === agentId) ||
    (e.agent && e.agent.toLowerCase() === agent.name.toLowerCase())
  )
  const nowText = live.activity || live.snippet ||
    (status === 'working' ? 'Working…' : status === 'idle' ? 'On standby — not currently running.' : (STATUS_META[status] ?? STATUS_META.idle).label)

  return (
    <>
      <div className="crew-backdrop" onClick={onClose} />
      <aside className="crew-drawer" role="dialog" aria-label={`${agent.name} details`}>
        <div className="crew-drawer-head">
          <div>
            <div className="crew-drawer-title">{agent.name}</div>
            <div className="crew-drawer-role">{agent.role}</div>
          </div>
          <StatusPill status={status} style={{ marginLeft: 8 }} />
          <button className="crew-drawer-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="crew-drawer-body">
          <section className="crew-sec">
            <div className="crew-sec-label">What it does</div>
            <p>{agent.does}</p>
          </section>

          <section className="crew-sec">
            <div className="crew-sec-label">Right now</div>
            <p>{nowText}</p>
          </section>

          {live.report && (
            <section className="crew-sec">
              <div className="crew-sec-label">Latest output</div>
              <pre className="crew-report">{live.report}</pre>
            </section>
          )}

          <section className="crew-sec">
            <div className="crew-sec-label">Connections</div>
            <div className="crew-conn">
              {fedBy.map((e, i) => (
                <div className="crew-conn-row" key={`in-${i}`}>
                  <span className="crew-conn-arrow">←</span>
                  <span><strong>{idx[e.from]?.name}</strong> {KIND_VERB[e.kind]} it</span>
                </div>
              ))}
              {feeds.map((e, i) => (
                <div className="crew-conn-row" key={`out-${i}`}>
                  <span className="crew-conn-arrow">→</span>
                  <span>It {KIND_VERB[e.kind]} <strong>{idx[e.to]?.name}</strong></span>
                </div>
              ))}
              {!feeds.length && !fedBy.length && (
                <div className="crew-empty">No connections.</div>
              )}
            </div>
          </section>

          <section className="crew-sec">
            <div className="crew-sec-label">Recent activity</div>
            <ActivityTimeline events={myEvents} emptyText="No recent activity for this agent." max={12} />
          </section>
        </div>
      </aside>
    </>
  )
}
