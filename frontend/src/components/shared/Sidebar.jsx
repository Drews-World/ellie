import { NavLink } from 'react-router-dom'
import styles from './Sidebar.module.css'

const NAV = [
  { to: '/dashboard', label: 'OVERVIEW', icon: '◈' },
  { to: '/world',     label: 'WORLD',    icon: '◎' },
  { to: '/personal',  label: 'PERSONAL', icon: '◇' },
]

export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
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
        <div className={styles.sysLabel}>ELLIE v1.0</div>
        <div className={styles.sysLabel}>DREW BUILD</div>
      </div>
    </aside>
  )
}
