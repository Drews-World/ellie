import './crew.css'

function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d)) return ''
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

// Generic activity feed. Events: { agent, message, ts }.
export default function ActivityTimeline({ events = [], emptyText = 'No activity yet.', max = 40 }) {
  if (!events.length) return <p className="crew-empty">{emptyText}</p>
  return (
    <div className="crew-timeline">
      {events.slice(0, max).map((e, i) => (
        <div className="crew-tl-row" key={e.id ?? i}>
          <span className="crew-tl-agent">{e.agent || '—'}</span>
          <span className="crew-tl-msg">{e.message}</span>
          <span className="crew-tl-time">{fmtTime(e.ts)}</span>
        </div>
      ))}
    </div>
  )
}
