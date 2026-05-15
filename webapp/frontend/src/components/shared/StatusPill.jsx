const STATES = {
  online:  { bg: 'rgba(34,211,164,0.12)', color: 'var(--mint-500)',  dot: '●', label: 'Online' },
  paused:  { bg: 'rgba(255,178,63,0.12)',  color: 'var(--amber-500)', dot: '⏸', label: 'Paused' },
  alert:   { bg: 'rgba(255,92,114,0.12)',  color: 'var(--coral-500)', dot: '●', label: 'Alert' },
  offline: { bg: 'rgba(122,110,142,0.12)', color: 'var(--ink-500)',   dot: '○', label: 'Offline' },
}

export default function StatusPill({ status = 'online', label }) {
  const s = STATES[status] ?? STATES.offline
  return (
    <span style={{
      background: s.bg,
      color: s.color,
      borderRadius: 'var(--radius-full)',
      padding: '4px 12px',
      fontSize: 'var(--text-xs)',
      fontWeight: 700,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      transition: 'background 0.25s, color 0.25s',
    }}>
      <span>{s.dot}</span>
      {label ?? s.label}
    </span>
  )
}
