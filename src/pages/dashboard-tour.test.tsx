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
vi.mock('@/features/teacher/teacher-tutorings-page', () => ({ TeacherTutoringsPage: () => <div>Vista Mis Tutorías</div> }))
vi.mock('@/components/notification-bell', () => ({ NotificationBell: () => null }))

const teacher: User = {
  id: 7, name: 'Luis Mora', email: 'luis@ueb.edu.ec', identification: '0201234567', role: 'docente', phone: null,
  email_verified_at: null, has_two_factor: false, is_active: true, must_complete_profile: false,
}

function renderDashboard(user: User, replaceUser = vi.fn()) {
  vi.mocked(useAuth).mockReturnValue({ user, replaceUser, logout: vi.fn(), status: 'authenticated', login: vi.fn(), completeTwoFactor: vi.fn() })
  render(
    <TooltipProvider>
      <MemoryRouter initialEntries={['/panel/teacher-tutorings']}>
        <Routes><Route path="/panel/:section" element={<DashboardPage />} /></Routes>
      </MemoryRouter>
    </TooltipProvider>,
  )
  return replaceUser
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(startSystemTour).mockReturnValue({ isActive: () => false, destroy: vi.fn() } as never)
})
afterEach(cleanup)

describe('Tutorial del sistema', () => {
  it('se presenta solo la primera vez y al cerrarlo queda registrado', async () => {
    const updated = { ...teacher, tour_completed: true }
    vi.mocked(api.completeTour).mockResolvedValue(updated)
    const replaceUser = renderDashboard({ ...teacher, tour_completed: false })

    await waitFor(() => expect(startSystemTour).toHaveBeenCalledTimes(1))
    const [steps, onFinish] = vi.mocked(startSystemTour).mock.calls[0]
    expect(steps.map((step) => step.popover?.title)).toEqual(expect.arrayContaining(['Mis tutorías', 'Titulación']))

    onFinish?.()
    await waitFor(() => expect(replaceUser).toHaveBeenCalledWith(updated))
    expect(api.completeTour).toHaveBeenCalledTimes(1)
  })

  it('no se presenta solo a quien ya lo vio, pero se abre desde el botón de ayuda', async () => {
    renderDashboard({ ...teacher, tour_completed: true })
    expect(startSystemTour).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Ver tutorial del sistema' }))
    expect(startSystemTour).toHaveBeenCalledTimes(1)
    vi.mocked(startSystemTour).mock.calls[0][1]?.()
    expect(api.completeTour).not.toHaveBeenCalled()
  })

  it('espera a que la cuenta complete su perfil', () => {
    renderDashboard({ ...teacher, tour_completed: false, must_complete_profile: true })
    expect(startSystemTour).not.toHaveBeenCalled()
  })
})
