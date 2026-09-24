const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')
const TOKEN_KEY = 'calidad-software.access-token'

export interface User {
  readonly id: number
  readonly identification: string
  readonly name: string
  readonly email: string
  readonly phone: string | null
  readonly role: string
  readonly is_active: boolean
  readonly email_verified_at: string | null
  readonly has_two_factor: boolean
}

export interface Faculty {
  readonly id: number
  readonly name: string
  readonly status: boolean
  readonly is_active: boolean
  readonly careers_count: number
  readonly active_careers_count: number
}

export interface Career {
  readonly id: number
  readonly faculty_id: number
  readonly faculty_name?: string
  readonly modality_id: number | null
  readonly modality_name?: string
  readonly name: string
  readonly status: boolean
  readonly cycles_count: number
  readonly active_cycles_count: number
}

export interface Cycle {
  readonly id: number
  readonly career_id: number
  readonly career_name?: string
  readonly name: string
  readonly number: number
  readonly paralelo_id: number | null
  readonly paralelo_name?: string | null
  readonly status: boolean
}

export interface Section {
  readonly id: number
  readonly name: string
  readonly is_active: boolean
}

export interface AcademicPeriod {
  readonly id: number
  readonly name: string
  readonly start_date: string
  readonly end_date: string
  readonly is_active: boolean
}

export interface Modality {
  readonly id: number
  readonly name: string
  readonly is_active: boolean
}

export interface PaginationMeta {
  readonly current_page: number
  readonly from: number | null
  readonly last_page: number
  readonly per_page: number
  readonly to: number | null
  readonly total: number
  readonly active_count: number
  readonly inactive_count: number
}

export interface UserPaginationMeta extends PaginationMeta {
  readonly admin_count: number
  readonly teacher_count: number
  readonly student_count: number
}

export type ListParams = {
  readonly page?: number
  readonly search?: string
}

export interface PaginatedResourceCollection<T, M extends PaginationMeta = PaginationMeta> {
  readonly data: readonly T[]
  readonly links?: {
    readonly first?: string | null
    readonly last?: string | null
    readonly prev?: string | null
    readonly next?: string | null
  }
  readonly meta?: M
}

interface Resource<T> {
  readonly data: T
}

interface ResourceCollection<T> {
  readonly data: readonly T[]
}

interface LoginData {
  readonly access_token: string
  readonly token_type: 'Bearer'
  readonly expires_at: string | null
  readonly user: User
}

export type CreateUserInput = {
  readonly identification: string
  readonly name: string
  readonly email: string
  readonly phone: string
  readonly role: string
  readonly password?: string
  readonly password_confirmation?: string
}

export type UpdateUserInput = {
  readonly identification?: string
  readonly name?: string
  readonly email?: string
  readonly phone?: string
  readonly role?: string
  readonly password?: string
  readonly password_confirmation?: string
}

export type FacultyInput = {
  readonly name: string
}

export type CareerInput = {
  readonly faculty_id: number
  readonly name: string
  readonly modality_id?: number | null
}

export type CycleInput = {
  readonly career_id: number
  readonly name: string
  readonly number: number
  readonly paralelo_id?: number | null
}

export type AcademicPeriodInput = {
  readonly name: string
  readonly start_date: string
  readonly end_date: string
}

export type ModalityInput = {
  readonly name: string
}

export type SectionInput = {
  readonly name: string
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

function buildQuery(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter((entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== '')
  if (entries.length === 0) return ''
  return `?${new URLSearchParams(entries.map(([key, value]) => [key, String(value)])).toString()}`
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

  async listUsers(params?: ListParams & { role?: string }): Promise<PaginatedResourceCollection<User, UserPaginationMeta>> {
    const query = buildQuery({ page: params?.page, search: params?.search, role: params?.role })
    return request<PaginatedResourceCollection<User, UserPaginationMeta>>(`/api/v1/users${query}`)
  },

  async createUser(input: CreateUserInput): Promise<User> {
    const response = await request<Resource<User>>('/api/v1/users', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return response.data
  },

  async updateUser(id: number, input: UpdateUserInput): Promise<User> {
    const response = await request<Resource<User>>(`/api/v1/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    return response.data
  },

  async deactivateUser(id: number): Promise<User> {
    const response = await request<Resource<User>>(`/api/v1/users/${id}/deactivate`, {
      method: 'PATCH',
    })
    return response.data
  },

  async activateUser(id: number): Promise<User> {
    const response = await request<Resource<User>>(`/api/v1/users/${id}/activate`, {
      method: 'PATCH',
    })
    return response.data
  },

  async listFaculties(params?: ListParams): Promise<PaginatedResourceCollection<Faculty>> {
    const query = buildQuery({ page: params?.page, search: params?.search })
    return request<PaginatedResourceCollection<Faculty>>(`/api/v1/admin/faculties${query}`)
  },

  async listActiveFaculties(): Promise<readonly Faculty[]> {
    const response = await request<ResourceCollection<Faculty>>('/api/v1/admin/faculties?all=1')
    return response.data
  },

  async createFaculty(input: FacultyInput): Promise<Faculty> {
    const response = await request<Resource<Faculty>>('/api/v1/faculties', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return response.data
  },

  async updateFaculty(id: number, input: FacultyInput): Promise<Faculty> {
    const response = await request<Resource<Faculty>>(`/api/v1/faculties/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    return response.data
  },

  async deactivateFaculty(id: number): Promise<Faculty> {
    const response = await request<Resource<Faculty>>(`/api/v1/faculties/${id}/deactivate`, {
      method: 'PATCH',
    })
    return response.data
  },

  async activateFaculty(id: number): Promise<Faculty> {
    const response = await request<Resource<Faculty>>(`/api/v1/faculties/${id}/activate`, {
      method: 'PATCH',
    })
    return response.data
  },

  async listCareers(params?: ListParams): Promise<PaginatedResourceCollection<Career>> {
    const query = buildQuery({ page: params?.page, search: params?.search })
    return request<PaginatedResourceCollection<Career>>(`/api/v1/admin/careers${query}`)
  },

  async createCareer(input: CareerInput): Promise<Career> {
    const response = await request<Resource<Career>>('/api/v1/admin/careers', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return response.data
  },

  async updateCareer(id: number, input: CareerInput): Promise<Career> {
    const response = await request<Resource<Career>>(`/api/v1/admin/careers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    return response.data
  },

  async deactivateCareer(id: number): Promise<Career> {
    const response = await request<Resource<Career>>(`/api/v1/admin/careers/${id}/deactivate`, {
      method: 'PATCH',
    })
    return response.data
  },

  async activateCareer(id: number): Promise<Career> {
    const response = await request<Resource<Career>>(`/api/v1/admin/careers/${id}/activate`, {
      method: 'PATCH',
    })
    return response.data
  },

  async listCycles(params?: ListParams & { careerId?: number }): Promise<PaginatedResourceCollection<Cycle>> {
    const query = buildQuery({ page: params?.page, search: params?.search, career_id: params?.careerId })
    return request<PaginatedResourceCollection<Cycle>>(`/api/v1/admin/cycles${query}`)
  },

  async createCycle(input: CycleInput): Promise<Cycle> {
    const response = await request<Resource<Cycle>>('/api/v1/admin/cycles', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return response.data
  },

  async updateCycle(id: number, input: CycleInput): Promise<Cycle> {
    const response = await request<Resource<Cycle>>(`/api/v1/admin/cycles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    return response.data
  },

  async deactivateCycle(id: number): Promise<Cycle> {
    const response = await request<Resource<Cycle>>(`/api/v1/admin/cycles/${id}/deactivate`, {
      method: 'PATCH',
    })
    return response.data
  },

  async activateCycle(id: number): Promise<Cycle> {
    const response = await request<Resource<Cycle>>(`/api/v1/admin/cycles/${id}/activate`, {
      method: 'PATCH',
    })
    return response.data
  },

  async listAcademicPeriods(params?: ListParams): Promise<PaginatedResourceCollection<AcademicPeriod>> {
    const query = buildQuery({ page: params?.page, search: params?.search })
    return request<PaginatedResourceCollection<AcademicPeriod>>(`/api/v1/admin/academic-periods${query}`)
  },

  async createAcademicPeriod(input: AcademicPeriodInput): Promise<AcademicPeriod> {
    const response = await request<Resource<AcademicPeriod>>('/api/v1/admin/academic-periods', {
      method: 'POST',
      body: JSON.stringify({
        nombre: input.name,
        fecha_inicio: input.start_date,
        fecha_fin: input.end_date,
        name: input.name,
        start_date: input.start_date,
        end_date: input.end_date,
      }),
    })
    return response.data
  },

  async updateAcademicPeriod(id: number, input: AcademicPeriodInput): Promise<AcademicPeriod> {
    const response = await request<Resource<AcademicPeriod>>(`/api/v1/admin/academic-periods/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        nombre: input.name,
        fecha_inicio: input.start_date,
        fecha_fin: input.end_date,
        name: input.name,
        start_date: input.start_date,
        end_date: input.end_date,
      }),
    })
    return response.data
  },

  async deactivateAcademicPeriod(id: number): Promise<AcademicPeriod> {
    const response = await request<Resource<AcademicPeriod>>(`/api/v1/admin/academic-periods/${id}/deactivate`, {
      method: 'PATCH',
    })
    return response.data
  },

  async activateAcademicPeriod(id: number): Promise<AcademicPeriod> {
    const response = await request<Resource<AcademicPeriod>>(`/api/v1/admin/academic-periods/${id}/activate`, {
      method: 'PATCH',
    })
    return response.data
  },

  async listModalities(page = 1): Promise<PaginatedResourceCollection<Modality>> {
    const query = page > 1 ? `?page=${page}` : ''
    return request<PaginatedResourceCollection<Modality>>(`/api/v1/admin/modalities${query}`)
  },

  async createModality(input: ModalityInput): Promise<Modality> {
    const response = await request<Resource<Modality>>('/api/v1/admin/modalities', {
      method: 'POST',
      body: JSON.stringify({
        nombre: input.name,
        name: input.name,
      }),
    })
    return response.data
  },

  async updateModality(id: number, input: ModalityInput): Promise<Modality> {
    const response = await request<Resource<Modality>>(`/api/v1/admin/modalities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        nombre: input.name,
        name: input.name,
      }),
    })
    return response.data
  },

  async deactivateModality(id: number): Promise<Modality> {
    const response = await request<Resource<Modality>>(`/api/v1/admin/modalities/${id}/deactivate`, {
      method: 'PATCH',
    })
    return response.data
  },

  async activateModality(id: number): Promise<Modality> {
    const response = await request<Resource<Modality>>(`/api/v1/admin/modalities/${id}/activate`, {
      method: 'PATCH',
    })
    return response.data
  },

  async listSections(page = 1): Promise<PaginatedResourceCollection<Section>> {
    const query = page > 1 ? `?page=${page}` : ''
    return request<PaginatedResourceCollection<Section>>(`/api/v1/admin/sections${query}`)
  },

  async createSection(input: SectionInput): Promise<Section> {
    const response = await request<Resource<Section>>('/api/v1/admin/sections', {
      method: 'POST',
      body: JSON.stringify({
        nombre: input.name,
        name: input.name,
      }),
    })
    return response.data
  },

  async updateSection(id: number, input: SectionInput): Promise<Section> {
    const response = await request<Resource<Section>>(`/api/v1/admin/sections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        nombre: input.name,
        name: input.name,
      }),
    })
    return response.data
  },

  async deactivateSection(id: number): Promise<Section> {
    const response = await request<Resource<Section>>(`/api/v1/admin/sections/${id}/deactivate`, {
      method: 'PATCH',
    })
    return response.data
  },

  async activateSection(id: number): Promise<Section> {
    const response = await request<Resource<Section>>(`/api/v1/admin/sections/${id}/activate`, {
      method: 'PATCH',
    })
    return response.data
  },
}
