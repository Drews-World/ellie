import { StatusPill, STATUS_META } from '../ui'
import './crew.css'

// Compact agent card for the floor grid. Click → opens the detail drawer.
export default function AgentCard({ agent, status = 'idle', activity, onSelect, selected }) {
  const color = (STATUS_META[status] ?? STATUS_META.idle).color
  return (
    <button
      type="button"
      className="crew-card"
      style={{ '--nc': color, ...(selected ? { borderColor: color } : null) }}
      onClick={() => onSelect?.(agent.id)}
      aria-label={`${agent.name}, ${agent.role}`}
    >
      <div className="crew-card-head">
        <div style={{ flex: 1 }}>
          <div className="crew-card-name">{agent.name}</div>
          <div className="crew-card-role">{agent.role}</div>
        </div>
        <StatusPill status={status} />
      </div>
      <div className="crew-card-activity">
        {activity || (status === 'idle' ? 'On standby' : (STATUS_META[status] ?? STATUS_META.idle).label)}
      </div>
    </button>
  )
}
