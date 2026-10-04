import { cleanup, render, screen } from '@testing-library/react'
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
    expect(screen.getByText('Propuesta aprobada')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('En ficha de seguimiento')).toBeInTheDocument()

    // 2. Switch to Equipo de Titulación
    await user.click(screen.getByRole('tab', { name: /Equipo de Titulación/i }))
    expect(await screen.findByText('Docente Tutor')).toBeInTheDocument()
    expect(screen.getByText('Ing. Docente Tutor')).toBeInTheDocument()
    expect(screen.getByText('Pares Académicos')).toBeInTheDocument()
    expect(screen.getByText('Dra. Par Académico')).toBeInTheDocument()

    // 3. Switch to Tareas
    await user.click(screen.getByRole('tab', { name: /Tareas \(2\)/i }))
    expect(await screen.findByText('Tareas y actividades de seguimiento')).toBeInTheDocument()
    expect(screen.getByText('Revisión del capítulo 1')).toBeInTheDocument()
    expect(screen.getByText('Correcciones metodológicas')).toBeInTheDocument()
    expect(screen.getByText('Completada')).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
  })
})
