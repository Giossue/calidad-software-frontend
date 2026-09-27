import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { tutoringApi, type Subject, type Tutoring } from '@/lib/tutoring-api'
import { TutoringSubjectsPage } from './subjects-page'
import { TutoringTeachersPage } from './teachers-page'
import { TutoringDetail } from './tutoring-detail'
import { dashboardSection } from './tutoring-navigation'
import { TutoringsPage } from './tutorings-page'

vi.mock('@/lib/tutoring-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tutoring-api')>()
  return { ...actual, tutoringApi: Object.fromEntries(Object.keys(actual.tutoringApi).map((key) => [key, vi.fn()])) }
})

const career = { id: 10, faculty_id: 1, modality_id: 1, name: 'Software', status: true, cycles_count: 2, active_cycles_count: 2 }
const cycle = { id: 20, career_id: 10, name: 'Segundo', number: 2, paralelo_id: 1, paralelo_name: 'A', status: true }
const subject: Subject = { id: 30, career_id: 10, career_name: 'Software', code: 'MAT', name: 'Matemática', is_active: true, cycle_ids: [20] }
const tutoring: Tutoring = { id: 40, subject_id: 30, subject_name: 'Matemática', cycle_id: 20, cycle_name: 'Segundo', career_id: 10, period_id: 50, period_name: '2026-2', modality_id: 60, modality_name: 'Presencial', section_id: 1, section_name: 'A', teacher_id: null, teacher_name: null, teacher_is_active: null, is_active: true }

function paginated<T>(data: readonly T[], current = 1, last = 1) {
  return { data, meta: { current_page: current, last_page: last, from: 1, to: data.length, total: data.length, per_page: 15, active_count: data.length, inactive_count: 0, enrollment_count: 3, present_count: 2, absent_count: 1 } }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(tutoringApi.careers).mockResolvedValue([career])
  vi.mocked(tutoringApi.cycles).mockResolvedValue([cycle, { ...cycle, id: 21, name: 'Tercero', number: 3 }])
  vi.mocked(tutoringApi.periods).mockResolvedValue([{ id: 50, name: '2026-2', start_date: '2026-09-01', end_date: '2027-02-01', is_active: true }])
  vi.mocked(tutoringApi.modalities).mockResolvedValue([{ id: 60, name: 'Presencial', is_active: true }])
  vi.mocked(tutoringApi.subjects).mockResolvedValue(paginated([subject]))
  vi.mocked(tutoringApi.teachers).mockResolvedValue(paginated([]))
  vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([tutoring]))
  vi.mocked(tutoringApi.schedules).mockResolvedValue([])
  vi.mocked(tutoringApi.attendance).mockResolvedValue(paginated([]))
  vi.mocked(tutoringApi.reports).mockResolvedValue(paginated([]))
})

afterEach(cleanup)

describe('Coordinación de tutorías', () => {
  it('restringe la navegación según el rol y elige la portada correspondiente', () => {
    expect(dashboardSection('coordinador_carrera', 'users')).toBe('tutorings')
    expect(dashboardSection('coordinador_carrera', 'tutoring-subjects')).toBe('tutoring-subjects')
    expect(dashboardSection('administrador', 'users')).toBe('users')
    expect(dashboardSection('administrador', 'tutorings')).toBe('tutorings')
    expect(dashboardSection('docente', 'tutorings')).toBe('home')
    expect(dashboardSection('estudiante', 'users')).toBe('student-degree-topics')
  })

  it('explica cómo habilitar la coordinación cuando no hay carreras asignadas', async () => {
    vi.mocked(tutoringApi.careers).mockResolvedValue([])
    render(<TutoringSubjectsPage />)
    expect(await screen.findByText(/Solicita al administrador que asigne una carrera activa/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar asignatura' })).toBeDisabled()
  })

  it('conserva el formulario ante un rechazo y evita crear dos veces mientras guarda', async () => {
    const user = userEvent.setup()
    let reject: (error: unknown) => void = () => undefined
    vi.mocked(tutoringApi.createSubject).mockImplementationOnce(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise }))
    render(<TutoringSubjectsPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar asignatura' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Registrar asignatura' }))
    await user.type(screen.getByLabelText('Código'), 'PROG')
    await user.type(screen.getByLabelText('Nombre'), 'Programación')
    const form = screen.getByRole('form', { name: 'Registrar asignatura' })
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(tutoringApi.createSubject).toHaveBeenCalledTimes(1)
    expect(tutoringApi.createSubject).toHaveBeenCalledWith({ career_id: 10, code: 'PROG', name: 'Programación' })
    expect(within(form).getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    await act(async () => reject(new ApiError(422, { message: 'No se pudo guardar.', errors: { code: ['El código ya existe.'] } })))
    expect(await screen.findByText('El código ya existe.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveValue('Programación')
    expect(within(form).getByRole('button', { name: 'Registrar asignatura' })).toBeEnabled()
  })

  it('consulta la página siguiente de asignaturas en el servidor', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.subjects).mockImplementation(async (params) => paginated([{ ...subject, name: params?.page === 2 ? 'Física' : 'Matemática' }], params?.page, 2))
    render(<TutoringSubjectsPage />)
    await screen.findByText('Matemática')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText('Física')).toBeInTheDocument()
    expect(tutoringApi.subjects).toHaveBeenLastCalledWith({ page: 2, search: '', career_id: undefined })
  })

  it('respeta la restricción de edición de cuentas docentes compartidas', async () => {
    vi.mocked(tutoringApi.teachers).mockResolvedValue(paginated([{ id: 1, name: 'Ana Torres', identification: '0201234567', email: 'ana@ueb.edu.ec', phone: '0999999999', is_active: true, career_ids: [10], can_manage: false }]))
    render(<TutoringTeachersPage />)
    await screen.findByText('Ana Torres')
    expect(screen.getByText(/cambios a cargo de administración/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar Ana Torres' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desactivar Ana Torres' })).not.toBeInTheDocument()
  })

  it('registra una tutoría usando solo los ciclos vinculados con la asignatura', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.createTutoring).mockResolvedValue(tutoring)
    render(<TutoringsPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar tutoría' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Registrar tutoría' }))
    await user.selectOptions(screen.getByLabelText('Asignatura'), '30')
    expect(screen.queryByRole('option', { name: /Tercero/ })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Ciclo y paralelo'), '20')
    await user.selectOptions(screen.getByLabelText('Período académico'), '50')
    await user.selectOptions(screen.getByLabelText('Modalidad'), '60')
    await user.click(within(screen.getByRole('form', { name: 'Registrar tutoría' })).getByRole('button', { name: 'Registrar tutoría' }))
    await waitFor(() => expect(tutoringApi.createTutoring).toHaveBeenCalledWith({ subject_id: 30, cycle_id: 20, period_id: 50, modality_id: 60 }))
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Registrar tutoría' })).not.toBeInTheDocument())
  })

  it('permite conservar el período y modalidad históricos al editar una tutoría', async () => {
    const user = userEvent.setup()
    const historical = { ...tutoring, period_id: 51, period_name: '2025-2', modality_id: 61, modality_name: 'Virtual' }
    vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([historical]))
    vi.mocked(tutoringApi.updateTutoring).mockResolvedValue(historical)
    render(<TutoringsPage />)
    await user.click(await screen.findByRole('button', { name: 'Editar Matemática' }))
    expect(screen.getByRole('option', { name: '2025-2 (actual, inactivo)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Virtual (actual, inactiva)' })).toBeInTheDocument()
    expect(screen.getByLabelText('Período académico')).toHaveValue('51')
    expect(screen.getByLabelText('Modalidad')).toHaveValue('61')
    await user.click(within(screen.getByRole('form', { name: 'Editar tutoría' })).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(tutoringApi.updateTutoring).toHaveBeenCalledWith(40, { period_id: 51, modality_id: 61 }))
  })

  it('permite asignar un ciclo de la misma carrera a una tutoría histórica sin asignatura', async () => {
    const user = userEvent.setup()
    const historical = { ...tutoring, subject_id: null }
    vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([historical]))
    vi.mocked(tutoringApi.assignTutoringCycle).mockResolvedValue({ ...historical, cycle_id: 21 })
    render(<TutoringsPage />)
    const cycleButton = await screen.findByRole('button', { name: 'Ciclo' })
    await waitFor(() => expect(cycleButton).toBeEnabled())
    await user.click(cycleButton)
    await user.selectOptions(screen.getByLabelText('Ciclo y paralelo'), '21')
    await user.click(within(screen.getByRole('form', { name: 'Asignar ciclo y paralelo' })).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(tutoringApi.assignTutoringCycle).toHaveBeenCalledWith(40, 21))
  })

  it('pide confirmación antes de desactivar una asignatura', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.deactivateSubject).mockResolvedValue({ ...subject, is_active: false })
    render(<TutoringSubjectsPage />)
    await user.click(await screen.findByRole('button', { name: 'Desactivar Matemática' }))
    expect(tutoringApi.deactivateSubject).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(tutoringApi.deactivateSubject).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Desactivar Matemática' }))
    await user.click(screen.getByRole('button', { name: 'Desactivar asignatura' }))
    await waitFor(() => expect(tutoringApi.deactivateSubject).toHaveBeenCalledWith(30))
  })

  it('abre el informe fuera de la tabla con sus datos y conserva los registros sin contenido', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.reports).mockResolvedValue(paginated([
      { id: 1, type: 'Avance', author_id: 2, author_name: 'Ana Torres', generated_at: '2026-09-27T12:00:00Z', content: 'Se reforzaron conceptos de álgebra.' },
      { id: 2, type: 'Histórico', author_id: 2, author_name: 'Ana Torres', generated_at: '2026-09-20T12:00:00Z', content: null },
    ]))
    render(<TutoringDetail tutoring={tutoring} onBack={vi.fn()} onAssignTeacher={vi.fn()} />)
    await screen.findByRole('button', { name: 'Leer informe' })
    expect(screen.queryByText('Se reforzaron conceptos de álgebra.')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Leer informe' }))
    const reader = screen.getByRole('article', { name: 'Contenido del informe' })
    expect(within(reader).getByText('Se reforzaron conceptos de álgebra.')).toBeVisible()
    expect(reader.closest('td')).toBeNull()
    expect(within(reader).getByText('Ana Torres')).toBeVisible()
    expect(within(reader).getByText('Fecha de generación')).toBeVisible()
    expect(screen.getByText(/no tiene contenido adjunto/)).toBeInTheDocument()
    expect(screen.getByText('Estudiantes inscritos')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cerrar informe' }))
    expect(screen.queryByRole('article', { name: 'Contenido del informe' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leer informe' })).toBeEnabled()
  })

  it('envía días sin tildes y horas HH:mm al registrar un horario', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.createSchedule).mockResolvedValue({ id: 1, tutoring_id: 40, day: 'miercoles', start_time: '09:00', end_time: '10:00', room: 'Aula 3', is_active: true })
    render(<TutoringDetail tutoring={tutoring} onBack={vi.fn()} onAssignTeacher={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Registrar horario' }))
    await user.selectOptions(screen.getByLabelText('Día'), 'miercoles')
    fireEvent.change(screen.getByLabelText('Hora de inicio'), { target: { value: '09:00' } })
    fireEvent.change(screen.getByLabelText('Hora de fin'), { target: { value: '10:00' } })
    await user.type(screen.getByLabelText('Aula o lugar'), 'Aula 3')
    await user.click(within(screen.getByRole('form', { name: 'Registrar horario' })).getByRole('button', { name: 'Registrar horario' }))
    await waitFor(() => expect(tutoringApi.createSchedule).toHaveBeenCalledWith(40, { day: 'miercoles', start_time: '09:00', end_time: '10:00', room: 'Aula 3' }))
  })
})
