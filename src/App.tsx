import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { Toaster } from '@/components/ui/sonner'
import { ListPageSkeleton } from '@/components/ui/loading-skeletons'
import { Skeleton } from '@/components/ui/skeleton'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/features/auth/auth-context'
import { CompleteProfileModal } from '@/features/auth/complete-profile-modal'
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page'
import { LoginPage } from '@/features/auth/login-page'
import { ResetPasswordPage } from '@/features/auth/reset-password-page'
import { TwoFactorPage } from '@/features/auth/two-factor-page'
import { VerifyEmailPage } from '@/features/auth/verify-email-page'
import { applyAccessibilitySettings, getStoredAccessibility } from '@/lib/accessibility'
import { DashboardPage } from '@/pages/dashboard-page'
import { ErrorBoundary } from '@/components/error-boundary'

// Mientras se comprueba la sesión: la forma del sistema (menú, cabecera y pantalla), sin
// pantalla en blanco ni un ícono girando.
function SessionLoading() {
  return (
    <div className="flex min-h-svh bg-background">
      <div className="hidden w-64 shrink-0 flex-col gap-3 bg-sidebar p-3 md:flex" aria-hidden="true">
        <Skeleton className="mb-3 h-14 w-full bg-white/15" />
        {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-8 w-full bg-white/15" />)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col" aria-hidden="true">
        <div className="flex h-16 items-center justify-between border-b border-border bg-card px-4">
          <Skeleton className="size-7" />
          <div className="flex items-center gap-2">
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="size-8" />)}
            <Skeleton className="h-8 w-40" />
          </div>
        </div>
        <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
          <ListPageSkeleton />
        </div>
      </div>
    </div>
  )
}

function ProtectedDashboard() {
  const { status, user } = useAuth()
  if (status === 'loading') return <SessionLoading />
  if (status !== 'authenticated') return <Navigate to="/login" replace />

  const mustCompleteProfile = Boolean(user?.must_complete_profile)

  return (
    <>
      {/* `inert` bloquea foco y clics del sistema mientras el modal exige completar la cuenta. */}
      <div className="contents" inert={mustCompleteProfile}>
        <ErrorBoundary>
          <DashboardPage />
        </ErrorBoundary>
      </div>
      {mustCompleteProfile && <CompleteProfileModal />}
    </>
  )
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
        <TooltipProvider>
          <Routes>
            <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/two-factor" element={<GuestRoute><TwoFactorPage /></GuestRoute>} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/panel/:section" element={<ProtectedDashboard />} />
            <Route path="/" element={<ProtectedDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster position="top-center" />
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
