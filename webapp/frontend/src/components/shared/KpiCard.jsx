export default function KpiCard({ label, value, sub, accent = 'var(--peach-500)', icon }) {
  return (
    <div style={{
      background: 'var(--paper-50)',
      border: '1.5px solid var(--ink-300)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px 24px',
      boxShadow: 'var(--shadow-sm)',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minWidth: 160,
      flex: 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 700,
          color: 'var(--ink-500)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          {label}
        </span>
        {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
      </div>
      <div style={{
        fontSize: 'var(--text-2xl)',
        fontWeight: 800,
        color: accent,
        fontFamily: 'var(--font-mono)',
        lineHeight: 1.1,
      }}>
        {value ?? '—'}
      </div>
      {sub && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-500)' }}>{sub}</div>
      )}
    </div>
  )
}
