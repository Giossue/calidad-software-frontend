import { describe, expect, it, vi } from 'vitest'

import { api, ApiError, challengeStore, tokenStore } from './api'

const user = {
  id: 1,
  name: 'Ana Torres',
  email: 'ana@example.com',
  email_verified_at: null,
  has_two_factor: false,
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
