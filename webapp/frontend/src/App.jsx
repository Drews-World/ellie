import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
import LoginPage from './pages/LoginPage'
import LobbyPage from './pages/LobbyPage'
import DashboardPage from './pages/DashboardPage'
import OwnerSuitePage from './pages/OwnerSuitePage'
import WorldOpsPage from './pages/WorldOpsPage'
import TradingDashboard from './trading/TradingDashboard'
import BusinessFactory from './pages/BusinessFactory'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Layout from './components/shared/Layout'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* Public — must be reachable without auth (Pinterest app review).
            Pinterest requires the company name in the privacy-policy URL to
            verify ownership, so the canonical path includes the brand slug. */}
        <Route path="/ellie-by-drew/privacy" element={<PrivacyPolicy />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route
          path="/"
          element={
            <>
              <SignedIn><Layout /></SignedIn>
              <SignedOut><RedirectToSignIn /></SignedOut>
            </>
          }
        >
          <Route index element={<LobbyPage />} />
          <Route path="trading"   element={<TradingDashboard />} />
          <Route path="business"  element={<BusinessFactory />} />
          {/* Floors split out of the old OG dashboard */}
          <Route path="world-ops" element={<WorldOpsPage />} />
          <Route path="suite"     element={<OwnerSuitePage />} />
          {/* Legacy redirects — old OG / world / personal links keep working */}
          <Route path="og"          element={<Navigate to="/world-ops" replace />} />
          <Route path="og/world"    element={<Navigate to="/world-ops" replace />} />
          <Route path="og/personal" element={<Navigate to="/suite" replace />} />
          <Route path="world"       element={<Navigate to="/world-ops" replace />} />
          <Route path="personal"    element={<Navigate to="/suite" replace />} />
          {/* Legacy dashboard still works */}
          <Route path="dashboard" element={<DashboardPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
