import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import WorldPage from './pages/WorldPage'
import PersonalPage from './pages/PersonalPage'
import Layout from './components/shared/Layout'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <>
              <SignedIn>
                <Layout />
              </SignedIn>
              <SignedOut>
                <RedirectToSignIn />
              </SignedOut>
            </>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="world" element={<WorldPage />} />
          <Route path="personal" element={<PersonalPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
