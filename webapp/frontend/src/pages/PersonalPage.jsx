import CalendarWidget from '../components/personal/CalendarWidget'
import RemindersWidget from '../components/personal/RemindersWidget'
import GoalsWidget from '../components/personal/GoalsWidget'
import NotesWidget from '../components/personal/NotesWidget'
import EllieMemoryWidget from '../components/personal/EllieMemoryWidget'
import PrayerWidget from '../components/personal/PrayerWidget'
import styles from './PersonalPage.module.css'

export default function PersonalPage() {
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.title}>PERSONAL OPS</span>
        <span className={styles.sub}>DREW LIFE MANAGEMENT // ELLIE ASSISTED</span>
      </div>
      <div className={styles.grid}>
        <div className={styles.colMain}>
          <CalendarWidget />
          <NotesWidget />
        </div>
        <div className={styles.colSide}>
          <RemindersWidget />
          <GoalsWidget />
          <PrayerWidget />
          <EllieMemoryWidget />
        </div>
      </div>
    </div>
  )
}
