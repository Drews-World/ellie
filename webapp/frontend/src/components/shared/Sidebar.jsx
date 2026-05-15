import { NavLink } from 'react-router-dom'
import styles from './Sidebar.module.css'

const NAV = [
  { to: '/',         label: 'Lobby',    icon: '🏠', end: true },
  { to: '/trading',  label: 'Trading',  icon: '📈' },
  { to: '/business', label: 'Business', icon: '⚙️' },
  { to: '/og',       label: 'OG Dash',  icon: '🌐' },
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
            <span className={styles.icon}>{icon}</span>
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
