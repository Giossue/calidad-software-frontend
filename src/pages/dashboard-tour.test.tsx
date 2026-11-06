import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import { useAuth } from '@/features/auth/auth-context'
import { startSystemTour } from '@/features/help/system-tour'
import { api, type User } from '@/lib/api'
import { DashboardPage } from './dashboard-page'

vi.mock('@/features/auth/auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('@/features/help/system-tour', () => ({ startSystemTour: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { ...actual.api, completeTour: vi.fn() } }
})
vi.mock('@/features/teacher/teacher-tutorings-page', () => ({
  TeacherTutoringsPage: () => <div><div data-tour="page-header">Mis tutorías</div><div data-tour="page-table" /></div>,
}))
vi.mock('@/components/notification-bell', () => ({ NotificationBell: () => null }))

const teacher: User = {
  id: 7, name: 'Luis Mora', email: 'luis@ueb.edu.ec', identification: '0201234567', role: 'docente', phone: null,
  email_verified_at: null, has_two_factor: false, is_active: true, must_complete_profile: false,
}

const WAIT = { timeout: 3000 }
const tourTitles = (call: number) => vi.mocked(startSystemTour).mock.calls[call][0].map((step) => step.popover?.title)

function renderDashboard(user: User) {
  vi.mocked(useAuth).mockReturnValue({ user, replaceUser: vi.fn(), logout: vi.fn(), status: 'authenticated', login: vi.fn(), completeTwoFactor: vi.fn() })
  render(
    <TooltipProvider>
      <MemoryRouter initialEntries={['/panel/teacher-tutorings']}>
        <Routes><Route path="/panel/:section" element={<DashboardPage />} /></Routes>
      </MemoryRouter>
    </TooltipProvider>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
  vi.mocked(startSystemTour).mockReturnValue({ isActive: () => false, destroy: vi.fn() } as never)
  vi.mocked(api.completeTour).mockImplementation(async (tour) => ({ ...teacher, completed_tours: [tour] }))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Tutorial del sistema', () => {
  it('la primera vez presenta el recorrido general y después la guía de la pantalla', async () => {
    renderDashboard({ ...teacher, completed_tours: [] })

    await waitFor(() => expect(startSystemTour).toHaveBeenCalledTimes(1), WAIT)
    expect(tourTitles(0)).toEqual(expect.arrayContaining(['¡Hola, Luis!', 'Mis tutorías', 'Titulación']))

    vi.mocked(startSystemTour).mock.calls[0][1]?.()
    expect(api.completeTour).toHaveBeenCalledWith('general')

    await waitFor(() => expect(startSystemTour).toHaveBeenCalledTimes(2), WAIT)
    expect(tourTitles(1)).toEqual(['Mis tutorías', 'Listado'])
    vi.mocked(startSystemTour).mock.calls[1][1]?.()
    expect(api.completeTour).toHaveBeenLastCalledWith('teacher-tutorings')
  })

  it('no repite guías ya vistas, pero se abren desde el botón de ayuda', async () => {
    renderDashboard({ ...teacher, completed_tours: ['general', 'teacher-tutorings'] })
    await new Promise((resolve) => setTimeout(resolve, 1200))
    expect(startSystemTour).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Ayuda' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Guía de esta pantalla' }))
    expect(tourTitles(0)).toEqual(['Mis tutorías', 'Listado'])

    await userEvent.click(screen.getByRole('button', { name: 'Ayuda' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Recorrido general del sistema' }))
    expect(tourTitles(1)[0]).toBe('¡Hola, Luis!')
    expect(api.completeTour).not.toHaveBeenCalled()
  })

  it('espera a que la cuenta complete su perfil', async () => {
    renderDashboard({ ...teacher, completed_tours: [], must_complete_profile: true })
    await new Promise((resolve) => setTimeout(resolve, 1200))
    expect(startSystemTour).not.toHaveBeenCalled()
  })
})
