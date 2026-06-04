import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
import LoginPage from './pages/LoginPage'
import LobbyPage from './pages/LobbyPage'
import DashboardPage from './pages/DashboardPage'
import WorldPage from './pages/WorldPage'
import PersonalPage from './pages/PersonalPage'
import TradingFloor from './pages/TradingFloor'
import BusinessFactory from './pages/BusinessFactory'
import OGDashboard from './pages/OGDashboard'
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
          <Route path="trading"  element={<TradingFloor />} />
          <Route path="business" element={<BusinessFactory />} />
          <Route path="og" element={<OGDashboard />}>
            <Route index element={<Navigate to="world" replace />} />
            <Route path="world"    element={<WorldPage />} />
            <Route path="personal" element={<PersonalPage />} />
          </Route>
          {/* Legacy direct routes still work */}
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="world"     element={<WorldPage />} />
          <Route path="personal"  element={<PersonalPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
