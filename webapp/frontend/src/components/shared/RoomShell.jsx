import { useNavigate } from 'react-router-dom'
import PixelLabel from './PixelLabel'

export default function RoomShell({ title, gradient, icon, children, actions, contentStyle = {}, outerStyle = {}, headerStyle = {} }) {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100%', background: 'var(--grad-room-bg)', display: 'flex', flexDirection: 'column', ...outerStyle }}>
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
        ...headerStyle,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'rgba(2,3,10,0.8)',
              border: '1px solid rgba(255,220,0,0.45)',
              borderRadius: 0,
              color: 'rgba(255,220,0,0.75)',
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              padding: '7px 16px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              boxShadow: '0 0 10px rgba(255,220,0,0.18)',
              transition: 'box-shadow 0.18s, color 0.18s',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              position: 'relative',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 22px rgba(255,220,0,0.55)'; e.currentTarget.style.color = '#FFE600' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 10px rgba(255,220,0,0.18)'; e.currentTarget.style.color = 'rgba(255,220,0,0.75)' }}
            onMouseDown={e => { e.currentTarget.style.transform = 'translateY(2px)' }}
            onMouseUp={e => { e.currentTarget.style.transform = 'translateY(0)' }}
          >
            ← LOBBY
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
