// The full trading control panel, merged into the hub at /trading.
// Adapted from the standalone trading app's App.jsx: the password gate and
// PublicView are gone (Clerk already guards this route), and API calls go
// through tfetch (hub backend passthrough) instead of same-origin fetch.
import { useState, useEffect } from 'react'
import './trading-global.css'
import styles from './App.module.css'
import Header from './components/Header'
import NavSidebar from './components/NavSidebar'
import AnalyzeView from './views/AnalyzeView'
import PortfolioView from './views/PortfolioView'
import SettingsView from './views/SettingsView'
import BrokerageView from './views/BrokerageView'
import FundView from './views/FundView'
import OperationsView from './views/OperationsView'
import { tfetch } from './lib/tapi'

export default function TradingDashboard() {
  const [activeView, setActiveView] = useState('analyze')
  const [monitorUnread, setMonitorUnread] = useState(0)

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await tfetch('/monitor')
        const d = await r.json()
        setMonitorUnread((d.alerts || []).filter((a) => !a.read).length)
      } catch {
        /* ignore */
      }
    }
    poll()
    const iv = setInterval(poll, 60000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="tradingRoot">
      <div className={styles.app}>
        <Header activeView={activeView} onNav={setActiveView} />
        <div className={styles.body}>
          <NavSidebar activeView={activeView} onNav={setActiveView} monitorUnread={monitorUnread} />
          <main className={styles.main}>
            {activeView === 'analyze' && <AnalyzeView />}
            {activeView === 'portfolio' && <PortfolioView />}
            {activeView === 'operations' && <OperationsView />}
            {activeView === 'fund' && <FundView />}
            {activeView === 'brokerage' && <BrokerageView />}
            {activeView === 'settings' && <SettingsView />}
          </main>
        </div>
      </div>
    </div>
  )
}
