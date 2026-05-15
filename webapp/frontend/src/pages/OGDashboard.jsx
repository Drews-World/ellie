import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import RoomShell from '../components/shared/RoomShell'

const SUBNAV = [
  { to: '/og/world',    label: '🌐 World' },
  { to: '/og/personal', label: '◇ Personal' },
]

export default function OGDashboard() {
  return (
    <RoomShell title="OG Dashboard" gradient="var(--grad-mint)" icon="🌐">
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {SUBNAV.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              background: isActive ? 'var(--grad-mint)' : 'var(--paper-50)',
              color: isActive ? 'var(--paper-50)' : 'var(--ink-700)',
              border: `1.5px solid ${isActive ? 'transparent' : 'var(--ink-300)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '8px 18px',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-ui)',
              textDecoration: 'none',
              transition: 'all var(--transition)',
            })}
          >
            {label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </RoomShell>
  )
}
