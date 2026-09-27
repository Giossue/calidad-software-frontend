import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CoordinatorCareersDialog } from '@/features/admin/coordinator-careers-dialog'
import { UsersPage } from '@/features/admin/users-page'
import { tokenStore } from '@/lib/api'

const coordinator = {
  id: 7,
  identification: '1710034065',
  name: 'Ana Torres',
  email: 'ana@ueb.edu.ec',
  phone: '0999999999',
  role: 'coordinador_carrera',
  is_active: true,
  email_verified_at: '2026-09-01T00:00:00Z',
  has_two_factor: false,
  coordinated_career_ids: [1],
}

const careers = [
  { id: 1, name: 'Ingeniería de Software', status: true },
  { id: 2, name: 'Administración', status: true },
]

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Asignación de carreras a coordinadores', () => {
  it('carga la selección actual y guarda las carreras usando el token administrativo', async () => {
    tokenStore.set('admin-session')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: careers }))
      .mockResolvedValueOnce(jsonResponse({ data: { ...coordinator, coordinated_career_ids: [1, 2] } }))
    vi.stubGlobal('fetch', fetchMock)
    const onSaved = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<CoordinatorCareersDialog user={coordinator} onSaved={onSaved} onClose={onClose} />)

    expect(await screen.findByRole('checkbox', { name: 'Ingeniería de Software' })).toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: 'Administración' }))
    await user.click(screen.getByRole('button', { name: 'Guardar carreras' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
    expect(onClose).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/v1/admin/users/7/careers'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ career_ids: [1, 2] }),
        headers: expect.objectContaining({ Authorization: 'Bearer admin-session' }),
      }),
    )
  })

  it('permite revocar todas las carreras y evita cerrar o duplicar el envío pendiente', async () => {
    let finishSave!: (response: Response) => void
    const pendingSave = new Promise<Response>((resolve) => { finishSave = resolve })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: careers }))
      .mockReturnValueOnce(pendingSave)
    vi.stubGlobal('fetch', fetchMock)
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<CoordinatorCareersDialog user={coordinator} onSaved={vi.fn()} onClose={onClose} />)

    await user.click(await screen.findByRole('checkbox', { name: 'Ingeniería de Software' }))
    const form = screen.getByRole('form', { name: 'Asignar carreras' })
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Cerrar modal' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[1].body).toBe(JSON.stringify({ career_ids: [] }))

    await act(async () => { finishSave(jsonResponse({ data: { ...coordinator, coordinated_career_ids: [] } })) })
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('confirma el descarte de una selección modificada', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: careers })))
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<CoordinatorCareersDialog user={coordinator} onSaved={vi.fn()} onClose={onClose} />)
    await user.click(await screen.findByRole('checkbox', { name: 'Administración' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('heading', { name: '¿Descartar los cambios?' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Sí, descartar y salir' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('permite reintentar la carga y conserva la selección cuando el servidor rechaza guardar', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Network unavailable'))
      .mockResolvedValueOnce(jsonResponse({ data: careers }))
      .mockResolvedValueOnce(jsonResponse({ errors: { career_ids: ['La carrera ya no está activa.'] } }, 422))
    vi.stubGlobal('fetch', fetchMock)
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<CoordinatorCareersDialog user={coordinator} onSaved={vi.fn()} onClose={onClose} />)
    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))
    await user.click(await screen.findByRole('checkbox', { name: 'Administración' }))
    await user.click(screen.getByRole('button', { name: 'Guardar carreras' }))
    expect(await screen.findByText('La carrera ya no está activa.')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Administración' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Guardar carreras' })).toBeEnabled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('explica cuando no hay carreras activas y permite revocar una asignación antigua', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
      .mockResolvedValueOnce(jsonResponse({ data: { ...coordinator, coordinated_career_ids: [] } }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<CoordinatorCareersDialog user={coordinator} onSaved={vi.fn()} onClose={vi.fn()} />)
    expect(await screen.findByText('No hay carreras activas')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Carrera no disponible (#1)' }))
    await user.click(screen.getByRole('button', { name: 'Guardar carreras' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock.mock.calls[1]?.[1].body).toBe(JSON.stringify({ career_ids: [] }))
  })

  it('ofrece la acción solo para coordinadores y actualiza usuarios después de guardar', async () => {
    let userListRequests = 0
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (url.includes('/api/v1/users?')) {
        userListRequests++
        return jsonResponse({ data: [coordinator, { ...coordinator, id: 8, name: 'Pedro Paz', role: 'docente' }] })
      }
      if (init.method === 'PUT') return jsonResponse({ data: { ...coordinator, coordinated_career_ids: [] } })
      return jsonResponse({ data: careers })
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<UsersPage />)
    expect(await screen.findAllByRole('button', { name: 'Asignar carreras' })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Asignar carreras' }))
    await user.click(await screen.findByRole('checkbox', { name: 'Ingeniería de Software' }))
    await user.click(screen.getByRole('button', { name: 'Guardar carreras' }))
    await waitFor(() => expect(userListRequests).toBe(2))
    expect(screen.queryByRole('form', { name: 'Asignar carreras' })).not.toBeInTheDocument()
  })

  it('conserva las carreras inactivas ya asignadas al agregar otra carrera', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: careers }))
      .mockResolvedValueOnce(jsonResponse({ data: { ...coordinator, coordinated_career_ids: [9, 1] } }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<CoordinatorCareersDialog user={{ ...coordinator, coordinated_career_ids: [9] }} onSaved={vi.fn()} onClose={vi.fn()} />)
    await user.click(await screen.findByRole('checkbox', { name: 'Ingeniería de Software' }))
    expect(screen.getByRole('checkbox', { name: 'Carrera no disponible (#9)' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Guardar carreras' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock.mock.calls[1]?.[1].body).toBe(JSON.stringify({ career_ids: [9, 1] }))
  })
})
