import { useState, useEffect } from 'react'
import { useUser, UserButton } from '@clerk/clerk-react'
import { Link, useLocation } from 'react-router-dom'
import styles from './Header.module.css'
import AudioControls from './AudioControls'

const orb = "'Orbitron', sans-serif"
import GoveePanel from './GoveePanel'
import WarRoomMode from '../world/WarRoomMode'

export default function Header() {
  const { user } = useUser()
  const [time, setTime]           = useState('')
  const [date, setDate]           = useState('')
  const [goveeOpen, setGoveeOpen]       = useState(false)
  const [warRoomOpen, setWarRoomOpen]   = useState(false)

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
        <div className={styles.logoIcon}>E</div>
        <div>
          <div className={styles.logoName}>ELLIE</div>
          <div className={styles.logoSub}>EXECUTIVE LIFE LOGIC INTELLIGENCE ENGINE</div>
        </div>
      </div>

      <div className={styles.center}>
        <div className={styles.centerTitle}>DREW COMMAND CENTER</div>
        <div className={styles.centerSub}>ALL SYSTEMS NOMINAL</div>
      </div>

      <div className={styles.right}>
        {/* War Room button */}
        <button
          onClick={() => setWarRoomOpen(true)}
          title="War Room Mode — live event fusion"
          style={{
            background: 'rgba(255,59,59,0.06)',
            border: '1px solid rgba(255,59,59,0.3)',
            borderRadius: 3,
            color: '#ff3b3b',
            cursor: 'pointer',
            fontFamily: orb,
            fontSize: 7,
            letterSpacing: 2,
            padding: '4px 10px',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,59,59,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,59,59,0.06)'}
        >
          WAR ROOM
        </button>

        {/* IoT / Govee lights button */}
        <button
          onClick={() => setGoveeOpen(true)}
          title="IoT Light Control"
          style={{
            background: 'none',
            border: '1px solid rgba(0,212,255,0.2)',
            borderRadius: 3,
            color: 'rgba(0,212,255,0.6)',
            cursor: 'pointer',
            fontSize: 14,
            padding: '3px 8px',
            lineHeight: 1,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.5)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.2)' }}
        >
          💡
        </button>
        <AudioControls />
        <div className={styles.timeBlock}>
          <div className={styles.time}>{time}</div>
          <div className={styles.date}>{date}</div>
        </div>
        <div className={styles.statusDot} />
        <UserButton
          appearance={{
            elements: {
              avatarBox: { width: 28, height: 28, border: '1px solid rgba(0,212,255,0.4)' }
            }
          }}
        />
      </div>
    </header>

    {goveeOpen    && <GoveePanel  onClose={() => setGoveeOpen(false)} />}
    {warRoomOpen  && <WarRoomMode onClose={() => setWarRoomOpen(false)} />}
  </>
  )
}
