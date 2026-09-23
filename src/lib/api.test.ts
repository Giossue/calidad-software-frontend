import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, ApiError, challengeStore, tokenStore } from './api'

const user = {
  id: 1,
  identification: '0201234567',
  name: 'Ana Torres',
  email: 'ana@example.com',
  role: 'estudiante',
  email_verified_at: null,
  has_two_factor: false,
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('API de autenticación', () => {
  it('envía credenciales y devuelve la sesión normalizada', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        access_token: 'plain-token',
        token_type: 'Bearer',
        expires_at: null,
        user,
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const session = await api.login('ana@example.com', 'password')

    expect(session.access_token).toBe('plain-token')
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/api/v1/auth/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'ana@example.com', password: 'password', device_name: 'frontend-web' }),
    }))
  })

  it('conserva el contrato del desafío 2FA cuando la API responde conflicto', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: 'Se requiere autenticación de dos factores.',
      code: 'two_factor_required',
      data: { challenge_token: 'challenge-token' },
    }), { status: 409, headers: { 'Content-Type': 'application/json' } })))

    const error = await api.login('ana@example.com', 'password').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).payload.data?.challenge_token).toBe('challenge-token')
  })

  it('usa el desafío para 2FA y el token de sesión para cerrar sesión', async () => {
    challengeStore.set('challenge-token')
    tokenStore.set('session-token')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { access_token: 'new-token', token_type: 'Bearer', expires_at: null, user },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await api.completeTwoFactor({ code: '123456' })
    await api.logout()

    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer challenge-token' }))
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer session-token' }))
  })
})

describe('API de administración', () => {
  beforeEach(() => {
    tokenStore.set('admin-token')
  })

  afterEach(() => {
    tokenStore.clear()
    challengeStore.clear()
    vi.unstubAllGlobals()
  })

  it('expone los errores de permisos del backend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'No tienes permisos para esta operación.' }, 403)))

    const error = await api.listUsers().catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(403)
    expect((error as ApiError).message).toBe('No tienes permisos para esta operación.')
  })

  it('gestiona usuarios con el contrato administrativo', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: [user] }))
      .mockResolvedValueOnce(jsonResponse({ data: user }, 201))
      .mockResolvedValueOnce(jsonResponse({ data: user }))
      .mockResolvedValueOnce(jsonResponse({ data: user }))
    vi.stubGlobal('fetch', fetchMock)

    await api.listUsers()
    await api.createUser({
      identification: '0201234567',
      name: 'Ana Torres',
      email: 'ana@example.com',
      phone: '',
      role: 'estudiante',
      password: 'password123',
      password_confirmation: 'password123',
    })
    await api.updateUser(1, { name: 'Ana Torres actualizada' })
    await api.deactivateUser(1)

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ['http://localhost:8000/api/v1/users', undefined],
      ['http://localhost:8000/api/v1/users', 'POST'],
      ['http://localhost:8000/api/v1/users/1', 'PATCH'],
      ['http://localhost:8000/api/v1/users/1/deactivate', 'PATCH'],
    ])
  })

  it('gestiona facultades con sus rutas públicas de administración', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 2, name: 'Facultad de Ingeniería', status: true, is_active: true } }, 201))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 2, name: 'Facultad de Ciencias', status: true, is_active: true } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 2, name: 'Facultad de Ciencias', status: false, is_active: false } }))
    vi.stubGlobal('fetch', fetchMock)

    await api.listFaculties()
    await api.createFaculty({ name: 'Facultad de Ingeniería' })
    await api.updateFaculty(2, { name: 'Facultad de Ciencias' })
    await api.deactivateFaculty(2)

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ['http://localhost:8000/api/v1/admin/faculties', undefined],
      ['http://localhost:8000/api/v1/faculties', 'POST'],
      ['http://localhost:8000/api/v1/faculties/2', 'PATCH'],
      ['http://localhost:8000/api/v1/faculties/2/deactivate', 'PATCH'],
    ])
  })

  it('consulta períodos paginados y ejecuta sus mutaciones', async () => {
    const period = { id: 3, name: '2026-1', start_date: '2026-04-01', end_date: '2026-08-31', is_active: true }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: [period], meta: { current_page: 2, last_page: 3, per_page: 15, total: 45, active_count: 40, inactive_count: 5 } }))
      .mockResolvedValueOnce(jsonResponse({ data: period }, 201))
      .mockResolvedValueOnce(jsonResponse({ data: period }))
      .mockResolvedValueOnce(jsonResponse({ data: { ...period, is_active: false } }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await api.listAcademicPeriods({ page: 2 })
    await api.createAcademicPeriod({ name: period.name, start_date: period.start_date, end_date: period.end_date })
    await api.updateAcademicPeriod(3, { name: period.name, start_date: period.start_date, end_date: period.end_date })
    await api.deactivateAcademicPeriod(3)

    expect(response.meta?.last_page).toBe(3)
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ['http://localhost:8000/api/v1/admin/academic-periods?page=2', undefined],
      ['http://localhost:8000/api/v1/admin/academic-periods', 'POST'],
      ['http://localhost:8000/api/v1/admin/academic-periods/3', 'PATCH'],
      ['http://localhost:8000/api/v1/admin/academic-periods/3/deactivate', 'PATCH'],
    ])
  })

  it('consulta modalidades paginadas y ejecuta sus mutaciones', async () => {
    const modality = { id: 4, name: 'Presencial', is_active: true }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: [modality], meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 } }))
      .mockResolvedValueOnce(jsonResponse({ data: modality }, 201))
      .mockResolvedValueOnce(jsonResponse({ data: modality }))
      .mockResolvedValueOnce(jsonResponse({ data: { ...modality, is_active: false } }))
    vi.stubGlobal('fetch', fetchMock)

    await api.listModalities()
    await api.createModality({ name: modality.name })
    await api.updateModality(4, { name: 'Virtual' })
    await api.deactivateModality(4)

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ['http://localhost:8000/api/v1/admin/modalities', undefined],
      ['http://localhost:8000/api/v1/admin/modalities', 'POST'],
      ['http://localhost:8000/api/v1/admin/modalities/4', 'PATCH'],
      ['http://localhost:8000/api/v1/admin/modalities/4/deactivate', 'PATCH'],
    ])
  })
})
