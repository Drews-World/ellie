import { agentIndex } from './crews'
import { STATUS_META } from '../ui'
import './crew.css'

// Per-edge visual treatment by kind.
const EDGE_STYLE = {
  flow:     { width: 2,   dash: null,    op: 0.5  },
  steer:    { width: 1.4, dash: '5 5',   op: 0.42 },
  monitor:  { width: 1.2, dash: '2 6',   op: 0.32 },
  feedback: { width: 1.2, dash: '1 7',   op: 0.3  },
  debate:   { width: 1.6, dash: '4 4',   op: 0.45 },
}

function statusColor(status) {
  return (STATUS_META[status] ?? STATUS_META.idle).color
}

// Cubic bezier with horizontal-ish tangents — reads as a flow diagram.
function edgePath(a, b) {
  const dx = b.x - a.x
  const cx = Math.max(12, Math.abs(dx) * 0.45)
  const c1x = a.x + (dx >= 0 ? cx : -cx)
  const c2x = b.x - (dx >= 0 ? cx : -cx)
  return `M ${a.x} ${a.y} C ${c1x} ${a.y}, ${c2x} ${b.y}, ${b.x} ${b.y}`
}

export default function CrewGraph({
  crew, statusByAgent = {}, activeId = null, selectedId = null, onSelect, ellieFace,
}) {
  const idx = agentIndex(crew)

  return (
    <div className="crew-graph" role="group" aria-label={`${crew.label} crew graph`}>
      {/* Edges */}
      <svg className="crew-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {crew.edges.map((e, i) => {
          const a = idx[e.from], b = idx[e.to]
          if (!a || !b) return null
          const style = EDGE_STYLE[e.kind] ?? EDGE_STYLE.flow
          const fromStatus = statusByAgent[e.from]
          const toStatus = statusByAgent[e.to]
          // active = handoff into the currently-working node, or out of it
          const active = (activeId && (e.to === activeId || e.from === activeId))
          const complete = fromStatus === 'done' && (toStatus === 'done' || toStatus === 'working')
          const color = active ? 'var(--bp-accent-bright)'
            : complete ? 'var(--bp-sage)'
            : 'var(--bp-ink-faint)'
          return (
            <path
              key={i}
              d={edgePath(a, b)}
              fill="none"
              stroke={color}
              strokeWidth={active ? style.width + 0.8 : style.width}
              strokeOpacity={active ? 0.95 : complete ? 0.7 : style.op}
              strokeDasharray={active ? '6 6' : style.dash || undefined}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className={active ? 'crew-edge-active' : undefined}
            />
          )
        })}
      </svg>

      {/* Nodes */}
      {crew.agents.map(agent => {
        const status = statusByAgent[agent.id] ?? 'idle'
        const meta = STATUS_META[status] ?? STATUS_META.idle
        const cls = [
          'crew-node',
          status === 'working' && 'crew-node-working',
          selectedId === agent.id && 'crew-node-selected',
          agent.isEllie && 'crew-node-ellie',
        ].filter(Boolean).join(' ')
        return (
          <button
            key={agent.id}
            type="button"
            className={cls}
            style={{ left: `${agent.x}%`, top: `${agent.y}%`, '--nc': statusColor(status) }}
            onClick={() => onSelect?.(agent.id)}
            aria-label={`${agent.name}, ${agent.role}, ${meta.label}`}
            title={`${agent.name} — ${meta.label}`}
          >
            <span className="crew-node-ring" aria-hidden />
            {agent.isEllie && ellieFace
              ? <img className="crew-node-avatar" src={ellieFace} alt="" draggable={false} />
              : <span className="crew-node-dot" aria-hidden />}
            <span className="crew-node-name">{agent.name}</span>
            <span className="crew-node-role">{agent.role}</span>
          </button>
        )
      })}

      {/* Legend */}
      <div className="crew-legend">
        <span><i style={{ background: 'var(--bp-st-working)' }} /> Working</span>
        <span><i style={{ background: 'var(--bp-st-done)' }} /> Done</span>
        <span><i style={{ background: 'var(--bp-st-idle)' }} /> Idle</span>
        <span><i style={{ background: 'var(--bp-ellie)' }} /> ELLIE</span>
      </div>
    </div>
  )
}
