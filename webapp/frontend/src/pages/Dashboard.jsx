import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useEllieStore } from '../store'
import { signOut } from '../lib/supabase'
import Header from '../components/shared/Header'
import Ticker from '../components/shared/Ticker'
import DetailPanel from '../components/shared/DetailPanel'
import WorldView from './World'
import PersonalView from './Personal'

export default function Dashboard() {
  const { user, activeView, setActiveView, detailOpen } = useEllieStore()
  const navigate = useNavigate()
  const location = useLocation()

  const switchView = (view) => {
    setActiveView(view)
    navigate(view === 'world' ? '/' : '/personal')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#030c14' }}>
      <Header
        user={user}
        activeView={activeView}
        onSwitchView={switchView}
        onSignOut={signOut}
      />
      <Ticker />

      <Routes>
        <Route path="/" element={<WorldView />} />
        <Route path="/personal" element={<PersonalView />} />
        <Route path="/personal/:section" element={<PersonalView />} />
      </Routes>

      {detailOpen && <DetailPanel />}
    </div>
  )
}
