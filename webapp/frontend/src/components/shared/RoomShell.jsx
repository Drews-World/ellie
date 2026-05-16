import { useNavigate } from 'react-router-dom'
import PixelLabel from './PixelLabel'

export default function RoomShell({ title, gradient, icon, children, actions, contentStyle = {} }) {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100%', background: 'var(--grad-room-bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Room header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 32px',
        borderBottom: '1.5px solid var(--ink-300)',
        background: 'var(--paper-50)',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: '1.5px solid var(--ink-300)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--ink-500)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-ui)',
              fontWeight: 600,
              padding: '6px 14px',
              cursor: 'pointer',
              transition: 'all var(--transition)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-100)'; e.currentTarget.style.borderColor = 'var(--ink-500)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'var(--ink-300)' }}
          >
            ← Lobby
          </button>
          <span style={{ fontSize: 22 }}>{icon}</span>
          <PixelLabel gradient={gradient}>{title}</PixelLabel>
        </div>
        {actions && <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{actions}</div>}
      </div>

      {/* Room content */}
      <div style={{ flex: 1, padding: '32px', overflow: 'auto', ...contentStyle }}>
        {children}
      </div>
    </div>
  )
}
