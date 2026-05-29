import { NavLink } from 'react-router-dom'
import styles from './Sidebar.module.css'

// ── Emblem icons — inline SVG, infinitely crisp at any size ──────────────────

function LobbyIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"
      style={{ width: '100%', height: '100%', display: 'block' }}>
      {/* Hexagon frame */}
      <polygon points="10,1 18.5,5.5 18.5,14.5 10,19 1.5,14.5 1.5,5.5" strokeLinejoin="miter"/>
      {/* E letterform */}
      <path d="M6.5,7 h7 M6.5,10 h5 M6.5,13 h7" strokeWidth="1.9" strokeLinecap="square"/>
    </svg>
  )
}

function TradingIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor"
      style={{ width: '100%', height: '100%', display: 'block' }}>
      {/* Rising bar chart */}
      <rect x="1"  y="14" width="4" height="6"/>
      <rect x="8"  y="10" width="4" height="10"/>
      <rect x="15" y="5"  width="4" height="15"/>
      {/* Up-trend line + arrowhead */}
      <polyline points="3,13 10,9 17,4"
        fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square"/>
      <polyline points="14,4 17,4 17,7"
        fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square"/>
    </svg>
  )
}

function BusinessIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor"
      style={{ width: '100%', height: '100%', display: 'block' }}>
      {/* Main building body */}
      <rect x="0" y="11" width="20" height="9"/>
      {/* Chimneys */}
      <rect x="1"  y="5" width="3.5" height="8"/>
      <rect x="7"  y="7" width="3.5" height="6"/>
      <rect x="13" y="4" width="3.5" height="8"/>
      {/* Windows (cut-outs via no-fill stroked rects) */}
      <rect x="2"   y="13" width="2.5" height="2.5" fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="0.8"/>
      <rect x="8.75" y="13" width="2.5" height="2.5" fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="0.8"/>
      <rect x="15.5" y="13" width="2.5" height="2.5" fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="0.8"/>
    </svg>
  )
}

function OGIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4"
      style={{ width: '100%', height: '100%', display: 'block' }}>
      {/* Globe outline */}
      <circle cx="10" cy="10" r="8.5"/>
      {/* Central meridian ellipse */}
      <ellipse cx="10" cy="10" rx="3.5" ry="8.5"/>
      {/* Equator */}
      <line x1="1.5" y1="10" x2="18.5" y2="10"/>
      {/* Latitude parallels */}
      <path d="M3,6.5 Q10,8.5 17,6.5"  strokeWidth="1.1"/>
      <path d="M3,13.5 Q10,11.5 17,13.5" strokeWidth="1.1"/>
    </svg>
  )
}

// ── Nav definition ────────────────────────────────────────────────────────────
const NAV = [
  { to: '/',         label: 'Lobby',    icon: <LobbyIcon />,    end: true },
  { to: '/trading',  label: 'Trading',  icon: <TradingIcon />              },
  { to: '/business', label: 'Business', icon: <BusinessIcon />             },
  { to: '/og',       label: 'OG Dash',  icon: <OGIcon />                   },
]

export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        {NAV.map(({ to, label, icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `${styles.link} ${isActive ? styles.active : ''}`
            }
          >
            <div className={styles.icon}>
              {icon}
            </div>
            <span className={styles.label}>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className={styles.bottom}>
        <div className={styles.sysLabel}>ELLIE HUB</div>
        <div className={styles.sysLabel}>v2.0</div>
      </div>
    </aside>
  )
}
