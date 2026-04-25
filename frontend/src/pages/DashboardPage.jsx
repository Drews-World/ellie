import { useUser } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'
import styles from './DashboardPage.module.css'

export default function DashboardPage() {
  const { user } = useUser()

  return (
    <div className={styles.root}>
      <div className={styles.greeting}>
        <span className={styles.greetLabel}>GOOD MORNING,</span>
        <span className={styles.greetName}>Drew</span>
      </div>
      <div className={styles.greetSub}>ELLIE IS ONLINE. ALL FEEDS NOMINAL. WHAT ARE WE MONITORING TODAY?</div>

      <div className={styles.modes}>
        <Link to="/world" className={styles.modeCard}>
          <div className={styles.modeIcon}>◎</div>
          <div className={styles.modeTitle}>WORLD MODE</div>
          <div className={styles.modeSub}>Global news · Markets · Sports · Weather · Threats</div>
          <div className={styles.modeArrow}>ENTER →</div>
        </Link>
        <Link to="/personal" className={styles.modeCard}>
          <div className={styles.modeIcon}>◇</div>
          <div className={styles.modeTitle}>PERSONAL MODE</div>
          <div className={styles.modeSub}>Calendar · Reminders · Goals · Notes · ELLIE memory</div>
          <div className={styles.modeArrow}>ENTER →</div>
        </Link>
      </div>

      <div className={styles.quickStats}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>EVENTS TODAY</div>
          <div className={styles.statVal}>—</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>OPEN REMINDERS</div>
          <div className={styles.statVal}>—</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>MARKET STATUS</div>
          <div className={styles.statVal} style={{color:'var(--green-ok)'}}>OPEN</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>THREAT LEVEL</div>
          <div className={styles.statVal} style={{color:'var(--amber)'}}>ELEVATED</div>
        </div>
      </div>
    </div>
  )
}
