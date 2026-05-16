import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import Header from './Header'
import Sidebar from './Sidebar'
import EllieChat from './EllieChat'
import { setAuthToken } from '../../lib/api'
import { useGoveeSync } from '../../lib/govee'
import styles from './Layout.module.css'

export default function Layout() {
  const { getToken } = useAuth()
  const location = useLocation()

  // IoT: sync ELLIE avatar state → Govee lights (best-effort, silently ignores errors)
  useGoveeSync(true)

  useEffect(() => {
    let mounted = true

    const attachToken = async () => {
      try {
        const token = await getToken()
        if (token && mounted) setAuthToken(token)
      } catch {
        // Clerk not ready yet — retry will happen on next interval tick
      }
    }

    // Attach immediately, then refresh every 55 s (Clerk tokens expire in 60 s)
    attachToken()
    const interval = setInterval(attachToken, 55_000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [getToken])

  return (
    <div className={styles.root}>
      <Header />
      <div className={styles.body}>
        <Sidebar />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
      {!location.pathname.startsWith('/business') && <EllieChat />}
    </div>
  )
}
