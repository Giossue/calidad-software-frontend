import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { ToastContainer } from '@/components/ui/toast-system'
import { AuthProvider, useAuth } from '@/features/auth/auth-context'
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page'
import { LoginPage } from '@/features/auth/login-page'
import { ResetPasswordPage } from '@/features/auth/reset-password-page'
import { TwoFactorPage } from '@/features/auth/two-factor-page'
import { VerifyEmailPage } from '@/features/auth/verify-email-page'
import { applyAccessibilitySettings, getStoredAccessibility } from '@/lib/accessibility'
import { DashboardPage } from '@/pages/dashboard-page'

function ProtectedDashboard() {
  const { status } = useAuth()
  if (status === 'loading') return null

  return status === 'authenticated' ? <DashboardPage /> : <Navigate to="/login" replace />
}

function GuestRoute({ children }: Readonly<{ children: React.ReactNode }>) {
  const { status } = useAuth()
  return status === 'authenticated' ? <Navigate to="/" replace /> : children
}

export default function App() {
  useEffect(() => {
    applyAccessibilitySettings(getStoredAccessibility())
  }, [])

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/two-factor" element={<GuestRoute><TwoFactorPage /></GuestRoute>} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/" element={<ProtectedDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastContainer />
      </AuthProvider>
    </BrowserRouter>
  )
}

