import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuth } from '@/features/auth/auth-context'
import { tutoringApi } from '@/lib/tutoring-api'
import { DashboardPage } from './dashboard-page'

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/lib/tutoring-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tutoring-api')>()
  return {
    ...actual,
    tutoringApi: {
      ...actual.tutoringApi,
      studentDegreeEnrollmentStatus: vi.fn(),
    },
  }
})

vi.mock('@/features/student/student-tutorings-page', () => ({
  StudentTutoringsPage: () => <div>Vista Mis Tutorías</div>,
}))

vi.mock('@/features/student-degree-topics/student-degree-topics-page', () => ({
  StudentDegreeTopicsPage: () => <div>Vista Mis Propuestas de Titulación</div>,
}))

vi.mock('@/features/student-degree-tracking/student-degree-tracking-page', () => ({
  StudentDegreeTrackingPage: () => <div>Vista Seguimiento Estudiante</div>,
}))

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(cleanup)

describe('DashboardPage - Pestaña de Titulación condicional para Estudiantes', () => {
  const studentUser = {
    id: 10,
    name: 'Estudiante Prueba',
    email: 'estudiante@ueb.edu.ec',
    identification: '0201234567',
    role: 'estudiante',
    phone: null,
    email_verified_at: null,
    has_two_factor: false,
    is_active: true,
  }

  it('no muestra la pestaña de titulación si el estudiante no está matriculado en titulación', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: studentUser,
      logout: vi.fn(),
      status: 'authenticated',
      login: vi.fn(),
      completeTwoFactor: vi.fn(),
    })
    vi.mocked(tutoringApi.studentDegreeEnrollmentStatus).mockResolvedValue({
      is_enrolled: false,
      period_id: 2,
      period_name: 'PAO II 2027',
    })

    render(
      <MemoryRouter initialEntries={['/panel/student-tutorings']}>
        <Routes>
          <Route path="/panel/:section" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>,
    )

    // Debe mostrar la sección de Tutorías
    expect(screen.getAllByText('Mis tutorías').length).toBeGreaterThan(0)

    // No debe mostrar la sección de Titulación ni sus elementos
    await waitFor(() => {
      expect(tutoringApi.studentDegreeEnrollmentStatus).toHaveBeenCalled()
    })
    expect(screen.queryByText('Mis propuestas')).not.toBeInTheDocument()
    expect(screen.queryByText('Seguimiento')).not.toBeInTheDocument()
    expect(screen.queryByText('Tutor y pares')).not.toBeInTheDocument()
  })

  it('habilita la pestaña de titulación cuando el estudiante está matriculado en titulación', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: studentUser,
      logout: vi.fn(),
      status: 'authenticated',
      login: vi.fn(),
      completeTwoFactor: vi.fn(),
    })
    vi.mocked(tutoringApi.studentDegreeEnrollmentStatus).mockResolvedValue({
      is_enrolled: true,
      period_id: 2,
      period_name: 'PAO II 2027',
    })

    render(
      <MemoryRouter initialEntries={['/panel/student-tutorings']}>
        <Routes>
          <Route path="/panel/:section" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>,
    )

    // Al estar matriculado, Titulación aparece en el menú lateral
    expect(await screen.findByText('Mis propuestas')).toBeInTheDocument()
    expect(screen.getByText('Seguimiento')).toBeInTheDocument()
    expect(screen.getByText('Tutor y pares')).toBeInTheDocument()
    expect(screen.getAllByText('Mis tutorías').length).toBeGreaterThan(0)
  })
})
