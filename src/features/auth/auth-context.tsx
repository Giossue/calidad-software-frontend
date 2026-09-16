// oxlint-disable react/only-export-components
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { api, ApiError, challengeStore, tokenStore, type User } from '@/lib/api'

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

interface AuthContextValue {
  readonly status: AuthStatus
  readonly user: User | null
  readonly login: (email: string, password: string) => Promise<void>
  readonly register: (input: { identification: string; name: string; email: string; password: string; password_confirmation: string }) => Promise<void>
  readonly completeTwoFactor: (input: { code?: string; recovery_code?: string }) => Promise<void>
  readonly logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [status, setStatus] = useState<AuthStatus>(() => tokenStore.get() ? 'loading' : 'anonymous')
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    if (!tokenStore.get()) {
      return
    }

    api.currentUser()
      .then((currentUser) => {
        setUser(currentUser)
        setStatus('authenticated')
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) tokenStore.clear()
        setStatus('anonymous')
      })
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    async login(email, password) {
      let session
      try {
        session = await api.login(email, password)
      } catch (error: unknown) {
        if (error instanceof ApiError && error.payload.code === 'two_factor_required') {
          const challengeToken = error.payload.data?.challenge_token
          if (challengeToken) challengeStore.set(challengeToken)
        }
        throw error
      }
      tokenStore.set(session.access_token)
      setUser(session.user)
      setStatus('authenticated')
    },
    async register(input) {
      const session = await api.register(input)
      tokenStore.set(session.access_token)
      setUser(session.user)
      setStatus('authenticated')
    },
    async completeTwoFactor(input) {
      const session = await api.completeTwoFactor(input)
      challengeStore.clear()
      tokenStore.set(session.access_token)
      setUser(session.user)
      setStatus('authenticated')
    },
    async logout() {
      try {
        await api.logout()
      } finally {
        tokenStore.clear()
        challengeStore.clear()
        setUser(null)
        setStatus('anonymous')
      }
    },
  }), [status, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider.')
  return context
}
