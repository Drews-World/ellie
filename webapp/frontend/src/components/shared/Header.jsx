import { useState, useEffect } from 'react'
import { UserButton } from '@clerk/clerk-react'
import GoveePanel from './GoveePanel'
import { StatusDot } from '../ui'
import styles from './Header.module.css'

export default function Header() {
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')
  const [goveeOpen, setGoveeOpen] = useState(false)

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', { hour12: false }))
      setDate(now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase())
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      <header className={styles.header}>
        <div className={styles.left}>
          <div className={styles.logoIcon}>
            <img src="/sprites/EllieSprite/EllieHeadshot.png" width={36} height={36} alt="ELLIE"
              style={{ objectFit: 'cover', display: 'block' }} />
          </div>
          <div>
            <div className={styles.logoName}>ELLIE <b>Hub</b></div>
            <div className={styles.logoSub}>Executive Life Logic Intelligence Engine</div>
          </div>
        </div>

        <div className={styles.center}>
          <div className={styles.centerTitle}>Drew Command Center</div>
          <div className={styles.centerSub}>
            <StatusDot status="online" size={6} /> All systems online
          </div>
        </div>

        <div className={styles.right}>
          <button
            className={styles.iconBtn}
            onClick={() => setGoveeOpen(true)}
            title="IoT light control"
            aria-label="IoT light control"
          >
            💡
          </button>
          <div className={styles.timeBlock}>
            <div className={styles.time}>{time}</div>
            <div className={styles.date}>{date}</div>
          </div>
          <UserButton
            appearance={{
              elements: {
                avatarBox: {
                  width: 32,
                  height: 32,
                  border: '2px solid var(--bp-hairline)',
                  borderRadius: '50%',
                },
              },
            }}
          />
        </div>
      </header>

      {goveeOpen && <GoveePanel onClose={() => setGoveeOpen(false)} />}
    </>
  )
}
