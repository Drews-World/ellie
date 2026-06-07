import { NavLink, Outlet } from 'react-router-dom'
import { SectionHeader } from '../components/ui'

const SUBNAV = [
  { to: '/og/world',    label: 'World',    icon: '🌐' },
  { to: '/og/personal', label: 'Personal', icon: '◇' },
]

function pill(isActive) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '8px 16px',
    borderRadius: 'var(--bp-r-pill)',
    fontFamily: 'var(--bp-font-sans)',
    fontSize: 'var(--bp-text-sm)',
    fontWeight: 600,
    textDecoration: 'none',
    border: `1px solid ${isActive ? 'transparent' : 'var(--bp-hairline)'}`,
    background: isActive ? 'var(--bp-accent)' : 'transparent',
    color: isActive ? '#08201F' : 'var(--bp-ink-muted)',
    boxShadow: isActive ? 'var(--bp-shadow-glow)' : 'none',
    transition: 'background var(--bp-dur-fast) var(--bp-ease), color var(--bp-dur-fast) var(--bp-ease), border-color var(--bp-dur-fast) var(--bp-ease)',
  }
}

export default function OGDashboard() {
  return (
    <div className="biopunk" style={{ minHeight: '100%', padding: 'clamp(20px, 3vw, 40px)' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <SectionHeader
          kicker="OG Dashboard"
          title="World & Personal Ops"
          action={
            <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} aria-label="OG sections">
              {SUBNAV.map(({ to, label, icon }) => (
                <NavLink key={to} to={to} style={({ isActive }) => pill(isActive)}>
                  <span aria-hidden>{icon}</span>
                  {label}
                </NavLink>
              ))}
            </nav>
          }
        />
        <Outlet />
      </div>
    </div>
  )
}
