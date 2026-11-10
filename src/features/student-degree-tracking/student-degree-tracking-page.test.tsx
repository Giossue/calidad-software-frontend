import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { degreeCoordinationApi, type DegreeTopic } from '@/lib/degree-coordination-api'
import { StudentDegreeTrackingPage } from './student-degree-tracking-page'

vi.mock('@/lib/degree-coordination-api', () => ({
  degreeCoordinationApi: { studentTopics: vi.fn() },
}))

const mockApprovedTopic: DegreeTopic = {
  id: 1,
  title: 'Sistema de Gestión de Calidad',
  description: 'Desarrollo del software',
  status: 'aprobado',
  proposed_at: '2026-09-01',
  reviewed_at: '2026-09-10',
  student: { id: 10, name: 'Carlos Estudiante', email: 'carlos@example.com', identification: '0200000001', phone: null },
  section: { id: 1, name: 'A' },
  academic_period: { id: 1, name: 'PAO 2026-1', is_active: true },
  assignments: [
    { id: 1, role: 'tutor', assigned_at: '2026-09-10', teacher: { id: 30, name: 'Ing. Docente Tutor', email: 'tutor@example.com' } },
    { id: 2, role: 'par_academico', assigned_at: '2026-09-10', teacher: { id: 31, name: 'Dra. Par Académico', email: 'par@example.com' } },
  ],
  reviewer: null,
  observations: [],
  tracking: {
    id: 1,
    degree_topic_id: 1,
    status: 'en_progreso',
    progress_percentage: 50,
    opened_at: '2026-09-11',
    closed_at: null,
    activities: [
      {
        id: 1,
        description: 'Revisión del capítulo 1',
        is_completed: true,
        registered_at: '2026-09-15',
        completed_at: '2026-09-20',
        teacher: { id: 30, name: 'Ing. Docente Tutor', email: 'tutor@example.com', role: 'tutor' },
      },
      {
        id: 2,
        description: 'Correcciones metodológicas',
        is_completed: false,
        registered_at: '2026-09-22',
        completed_at: null,
        teacher: { id: 31, name: 'Dra. Par Académico', email: 'par@example.com', role: 'par_academico' },
      },
    ],
  },
}

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(cleanup)

describe('StudentDegreeTrackingPage con pestañas', () => {
  it('organiza el seguimiento en pestañas: Estado de la Ficha, Equipo de Titulación y Tareas', async () => {
    const user = userEvent.setup()
    vi.mocked(degreeCoordinationApi.studentTopics).mockResolvedValue([mockApprovedTopic])

    render(<StudentDegreeTrackingPage />)

    // Wait for topic to load and tabs to appear
    expect(await screen.findByRole('tab', { name: /Estado de la Ficha/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Equipo de Titulación/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Tareas \(2\)/i })).toBeInTheDocument()

    // 1. Estado de la Ficha is active by default
    expect(screen.getByText('Sistema de Gestión de Calidad')).toBeInTheDocument()
    // Mismo nombre de estado que ve coordinación, y el estado de la ficha legible.
    expect(screen.getByText('Aprobada')).toBeInTheDocument()
    expect(screen.getByText('En progreso')).toBeInTheDocument()
    expect(screen.queryByText(/en[_ ]progreso/)).not.toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('En ficha de seguimiento')).toBeInTheDocument()

    // 2. Switch to Equipo de Titulación
    await user.click(screen.getByRole('tab', { name: /Equipo de Titulación/i }))
    expect(await screen.findByText('Docente tutor')).toBeInTheDocument()
    expect(screen.getByText('Ing. Docente Tutor')).toBeInTheDocument()
    expect(screen.getByText('Pares académicos')).toBeInTheDocument()
    expect(screen.getByText('Dra. Par Académico')).toBeInTheDocument()

    // 3. Switch to Tareas
    await user.click(screen.getByRole('tab', { name: /Tareas \(2\)/i }))
    expect(await screen.findByText('Tareas y actividades de seguimiento')).toBeInTheDocument()
    expect(screen.getByText('Revisión del capítulo 1')).toBeInTheDocument()
    expect(screen.getByText('Correcciones metodológicas')).toBeInTheDocument()
    expect(screen.getByText('Completada')).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
  })

  it('filtra las tareas con desplegables de estado y docente, sin filas de botones', async () => {
    const user = userEvent.setup()
    vi.mocked(degreeCoordinationApi.studentTopics).mockResolvedValue([mockApprovedTopic])
    render(<StudentDegreeTrackingPage />)

    await user.click(await screen.findByRole('tab', { name: /Tareas \(2\)/i }))
    expect(screen.queryByRole('group', { name: 'Filtrar por estado' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Pendientes/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: 'Filtrar por estado' }))
    await user.click(screen.getByRole('option', { name: 'Pendientes' }))
    expect(screen.queryByText('Revisión del capítulo 1')).not.toBeInTheDocument()
    expect(screen.getByText('Correcciones metodológicas')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Limpiar' }))
    await user.click(screen.getByRole('combobox', { name: 'Filtrar por docente' }))
    await user.click(screen.getByRole('option', { name: 'Tutor' }))
    expect(screen.getByText('Revisión del capítulo 1')).toBeInTheDocument()
    expect(screen.queryByText('Correcciones metodológicas')).not.toBeInTheDocument()
  })

  it('redondea el avance a un porcentaje entero', async () => {
    vi.mocked(degreeCoordinationApi.studentTopics).mockResolvedValue([{ ...mockApprovedTopic, tracking: { ...mockApprovedTopic.tracking!, progress_percentage: 66.67 } }])
    render(<StudentDegreeTrackingPage />)
    expect(await screen.findByText('67%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Avance de titulación' })).toHaveAttribute('aria-valuenow', '67')
  })

  it('elige entre varios temas aprobados con un desplegable', async () => {
    const user = userEvent.setup()
    const second: DegreeTopic = { ...mockApprovedTopic, id: 2, title: 'Repositorio institucional', tracking: { ...mockApprovedTopic.tracking!, id: 2, degree_topic_id: 2, progress_percentage: 20 } }
    vi.mocked(degreeCoordinationApi.studentTopics).mockResolvedValue([mockApprovedTopic, second])
    render(<StudentDegreeTrackingPage />)

    const picker = await screen.findByRole('combobox', { name: 'Tema de titulación' })
    expect(screen.queryByRole('button', { name: 'Repositorio institucional' })).not.toBeInTheDocument()
    expect(within(picker).getByText('Sistema de Gestión de Calidad')).toBeInTheDocument()
    await user.click(picker)
    await user.click(screen.getByRole('option', { name: 'Repositorio institucional' }))
    expect(screen.getByText('20%')).toBeInTheDocument()
  })

  it('en la primera carga muestra toda la pantalla como esqueleto y un solo aviso de carga', async () => {
    let resolve: (value: DegreeTopic[]) => void = () => undefined
    vi.mocked(degreeCoordinationApi.studentTopics).mockReturnValue(new Promise((done) => { resolve = done }))
    render(<StudentDegreeTrackingPage />)
    const statuses = screen.getAllByRole('status')
    expect(statuses).toHaveLength(1)
    expect(statuses[0]).toHaveAccessibleName(/^Cargando/)
    expect(screen.queryByRole('heading', { level: 1, name: 'Seguimiento de titulación' })).not.toBeInTheDocument()
    await act(async () => resolve([mockApprovedTopic]))
    expect(await screen.findByRole('heading', { level: 1, name: 'Seguimiento de titulación' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Estado de la Ficha/i })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
