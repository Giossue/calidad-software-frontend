const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')
const TOKEN_KEY = 'calidad-software.access-token'

export interface User {
  readonly id: number
  readonly name: string
  readonly email: string
  readonly email_verified_at: string | null
  readonly has_two_factor: boolean
}

interface Resource<T> {
  readonly data: T
}

interface LoginData {
  readonly access_token: string
  readonly token_type: 'Bearer'
  readonly expires_at: string | null
  readonly user: User
}

interface ErrorPayload {
  readonly message?: string
  readonly code?: string
  readonly errors?: Record<string, readonly string[]>
  readonly data?: {
    readonly challenge_token?: string
    readonly expires_at?: string
  }
}

export class ApiError extends Error {
  readonly status: number
  readonly payload: ErrorPayload

  constructor(status: number, payload: ErrorPayload) {
    super(payload.message ?? 'No fue posible completar la solicitud.')
    this.status = status
    this.payload = payload
  }

  get firstValidationMessage(): string | undefined {
    return Object.values(this.payload.errors ?? {}).flat()[0]
  }
}

export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (token: string) => sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
}

const CHALLENGE_KEY = 'calidad-software.two-factor-challenge'

export const challengeStore = {
  get: () => sessionStorage.getItem(CHALLENGE_KEY),
  set: (token: string) => sessionStorage.setItem(CHALLENGE_KEY, token),
  clear: () => sessionStorage.removeItem(CHALLENGE_KEY),
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get()
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ErrorPayload
    throw new ApiError(response.status, payload)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  async login(email: string, password: string): Promise<LoginData> {
    const response = await request<Resource<LoginData>>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, device_name: 'frontend-web' }),
    })
    return response.data
  },

  async register(input: {
    name: string
    email: string
    password: string
    password_confirmation: string
  }): Promise<LoginData> {
    const response = await request<Resource<LoginData>>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ ...input, device_name: 'frontend-web' }),
    })
    return response.data
  },

  async completeTwoFactor(input: { code?: string; recovery_code?: string }): Promise<LoginData> {
    const challengeToken = challengeStore.get()
    if (!challengeToken) throw new Error('El desafío de autenticación expiró.')

    const response = await request<Resource<LoginData>>('/api/v1/auth/two-factor-challenge', {
      method: 'POST',
      headers: { Authorization: `Bearer ${challengeToken}` },
      body: JSON.stringify(input),
    })
    return response.data
  },

  forgotPassword: (email: string) => request<{ message: string }>('/api/v1/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),

  resetPassword: (input: {
    email: string
    token: string
    password: string
    password_confirmation: string
  }) => request<{ message: string }>('/api/v1/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(input),
  }),

  sendVerification: () => request<{ message: string }>('/api/v1/auth/email/verification-notification', {
    method: 'POST',
  }),

  verifyEmail: (id: string, hash: string, query: string) => request<{ message: string }>(
    `/api/v1/auth/email/verify/${encodeURIComponent(id)}/${encodeURIComponent(hash)}?${query}`,
  ),

  async currentUser(): Promise<User> {
    const response = await request<Resource<User>>('/api/v1/auth/user')
    return response.data
  },

  logout: () => request<void>('/api/v1/auth/logout', { method: 'DELETE' }),
}
