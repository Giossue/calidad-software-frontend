import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
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

vi.mock('@/features/tutoring/users-page', () => ({
  TutoringUsersPage: () => <div>Vista Usuarios</div>,
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
      replaceUser: vi.fn(),
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
      replaceUser: vi.fn(),
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

describe('DashboardPage - Módulos del estudiante según su ciclo', () => {
  const baseStudent = {
    id: 11,
    name: 'Estudiante Ciclo',
    email: 'ciclo@ueb.edu.ec',
    identification: '0201234567',
    role: 'estudiante',
    phone: null,
    email_verified_at: null,
    has_two_factor: false,
    is_active: true,
  }

  function renderAs(user: typeof baseStudent & { cycle_number: number; academic_stage: 'tutorias' | 'titulacion' }) {
    vi.mocked(useAuth).mockReturnValue({ user, logout: vi.fn(), status: 'authenticated', login: vi.fn(), completeTwoFactor: vi.fn(), replaceUser: vi.fn() })
    // Aunque estuviera matriculado, el ciclo decide qué módulo se muestra.
    vi.mocked(tutoringApi.studentDegreeEnrollmentStatus).mockResolvedValue({ is_enrolled: true, period_id: 2, period_name: 'PAO II 2027' })
    render(
      <MemoryRouter initialEntries={['/panel/student-tutorings']}>
        <Routes>
          <Route path="/panel/:section" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('de primero a séptimo ciclo solo muestra tutorías', async () => {
    renderAs({ ...baseStudent, cycle_number: 7, academic_stage: 'tutorias' })

    expect(await screen.findByText('Vista Mis Tutorías')).toBeInTheDocument()
    expect(screen.getAllByText('Mis tutorías').length).toBeGreaterThan(0)
    expect(screen.queryByText('Mis propuestas')).not.toBeInTheDocument()
    expect(screen.queryByText('Tutor y pares')).not.toBeInTheDocument()
  })

  it('en el último ciclo solo muestra titulación y abre sus propuestas', async () => {
    renderAs({ ...baseStudent, cycle_number: 8, academic_stage: 'titulacion' })

    expect(await screen.findByText('Vista Mis Propuestas de Titulación')).toBeInTheDocument()
    expect(screen.getAllByText('Mis propuestas').length).toBeGreaterThan(0)
    expect(screen.getByText('Tutor y pares')).toBeInTheDocument()
    expect(screen.queryByText('Mis tutorías')).not.toBeInTheDocument()
  })
})

describe('DashboardPage - Usuarios del coordinador de carrera', () => {
  const coordinator = {
    id: 20,
    name: 'Coordinadora Prueba',
    email: 'coordinadora@ueb.edu.ec',
    identification: '0201234567',
    role: 'coordinador_carrera',
    phone: null,
    email_verified_at: null,
    has_two_factor: false,
    is_active: true,
  }

  function LocationProbe() {
    const location = useLocation()
    return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
  }

  function renderAt(entry: string) {
    vi.mocked(useAuth).mockReturnValue({ user: coordinator, logout: vi.fn(), status: 'authenticated', login: vi.fn(), completeTwoFactor: vi.fn(), replaceUser: vi.fn() })
    render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/panel/:section" element={<><DashboardPage /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('el menú lateral muestra «Usuarios» en lugar de «Docentes» y «Estudiantes»', async () => {
    renderAt('/panel/tutoring-users')

    expect(await screen.findByText('Vista Usuarios')).toBeInTheDocument()
    const items = [...document.querySelectorAll('[data-tour^="nav-"]')].map((item) => item.textContent)
    expect(items).toEqual(['Tutorías', 'Usuarios', 'Malla curricular', 'Informes'])
    expect(document.querySelector('[data-tour="nav-tutoring-users"]')).toHaveAttribute('data-active', 'true')
  })

  it('redirige la antigua sección de Estudiantes a la pestaña Estudiantes conservando el estudiante abierto', async () => {
    renderAt('/panel/tutoring-students?estudiante=103')

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/panel/tutoring-users?estudiante=103&pestana=estudiantes'))
    expect(screen.getByText('Vista Usuarios')).toBeInTheDocument()
  })

  it('redirige la antigua sección de Docentes a la pestaña Docentes', async () => {
    renderAt('/panel/tutoring-teachers?docente=5')

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/panel/tutoring-users?docente=5&pestana=docentes'))
  })
})
