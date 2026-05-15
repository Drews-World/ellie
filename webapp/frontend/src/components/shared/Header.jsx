import { useState, useEffect } from 'react'
import { UserButton } from '@clerk/clerk-react'
import GoveePanel from './GoveePanel'
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
          <div className={styles.logoIcon}>🐣</div>
          <div>
            <div className={styles.logoName}>ELLIE HUB</div>
            <div className={styles.logoSub}>Executive Life Logic Intelligence Engine</div>
          </div>
        </div>

        <div className={styles.center}>
          <div className={styles.centerTitle}>DREW COMMAND CENTER</div>
          <div className={styles.centerSub}>All systems online</div>
        </div>

        <div className={styles.right}>
          <button
            onClick={() => setGoveeOpen(true)}
            title="IoT Light Control"
            style={{
              background: 'none',
              border: '1.5px solid var(--ink-300)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--ink-500)',
              cursor: 'pointer',
              fontSize: 16,
              padding: '4px 10px',
              lineHeight: 1,
              transition: 'all var(--transition)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-100)'; e.currentTarget.style.borderColor = 'var(--ink-500)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'var(--ink-300)' }}
          >
            💡
          </button>
          <div className={styles.timeBlock}>
            <div className={styles.time}>{time}</div>
            <div className={styles.date}>{date}</div>
          </div>
          <div className={styles.statusDot} />
          <UserButton
            appearance={{
              elements: {
                avatarBox: {
                  width: 30,
                  height: 30,
                  border: '2px solid var(--ink-300)',
                  borderRadius: '50%',
                }
              }
            }}
          />
        </div>
      </header>

      {goveeOpen && <GoveePanel onClose={() => setGoveeOpen(false)} />}
    </>
  )
}
