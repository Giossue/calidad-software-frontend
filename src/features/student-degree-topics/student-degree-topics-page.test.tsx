import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { degreeCoordinationApi, type DegreeTopic } from '@/lib/degree-coordination-api'
import { StudentDegreeTopicsPage } from './student-degree-topics-page'

vi.mock('@/lib/degree-coordination-api', () => ({ degreeCoordinationApi: { studentTopics: vi.fn() } }))

const topic: DegreeTopic = {
  id: 1, title: 'Seguimiento académico', description: 'Propuesta del estudiante.', status: 'aprobado', proposed_at: '2026-09-01', reviewed_at: '2026-09-10',
  student: { id: 10, name: 'Estudiante', email: 'estudiante@example.com', identification: '0200000001', phone: null },
  section: { id: 1, name: 'A' }, academic_period: { id: 1, name: 'PAO II 2026', is_active: true },
  reviewer: { id: 20, name: 'Coordinadora', email: 'coordinacion@example.com' },
  assignments: [
    { id: 1, role: 'tutor', assigned_at: '2026-09-10', teacher: { id: 30, name: 'Tutora asignada', email: 'tutora@example.com' } },
    { id: 2, role: 'par_academico', assigned_at: '2026-09-10', teacher: { id: 31, name: 'Par académico asignado', email: 'par@example.com' } },
  ],
  observations: [{ id: 1, observation: 'Precisar el alcance de la evaluación.', registered_at: '2026-09-10', coordinator: { id: 20, name: 'Coordinadora', email: 'coordinacion@example.com' } }],
}

beforeEach(() => { vi.resetAllMocks() })
afterEach(cleanup)

describe('Consulta de titulación del estudiante', () => {
  it('muestra el resultado, los docentes y las observaciones sin acciones de coordinación', async () => {
    vi.mocked(degreeCoordinationApi.studentTopics).mockResolvedValue([topic])
    render(<StudentDegreeTopicsPage />)
    expect(await screen.findByText('Seguimiento académico')).toBeInTheDocument()
    expect(screen.getByText('Aprobada')).toBeInTheDocument()
    expect(screen.getByText('Tutora asignada')).toBeInTheDocument()
    expect(screen.getByText('Par académico asignado')).toBeInTheDocument()
    expect(screen.getByText('Precisar el alcance de la evaluación.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Aprobar|Rechazar|Registrar/ })).not.toBeInTheDocument()
  })

  it('permite reintentar un error de servidor y presenta el estado vacío', async () => {
    const user = userEvent.setup()
    vi.mocked(degreeCoordinationApi.studentTopics).mockRejectedValueOnce(new ApiError(500, { message: 'Server Error' })).mockResolvedValueOnce([])
    render(<StudentDegreeTopicsPage />)
    expect(await screen.findByText('No se pudieron cargar tus propuestas. Inténtalo de nuevo.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText(/Aún no tienes propuestas de titulación registradas/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toHaveTextContent('Aún no tienes')
    await waitFor(() => expect(degreeCoordinationApi.studentTopics).toHaveBeenCalledTimes(2))
  })
})
