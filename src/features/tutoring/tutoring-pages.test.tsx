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

  it('sanea los caracteres del código y el nombre al registrar una asignatura', async () => {
    const user = userEvent.setup()
    render(<TutoringSubjectsPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar asignatura' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Registrar asignatura' }))
    const form = screen.getByRole('form', { name: 'Registrar asignatura' })

    const code = within(form).getByLabelText('Código')
    await user.type(code, 'sw b1#001!')
    expect(code).toHaveValue('swb1001')

    const name = within(form).getByLabelText('Nombre')
    await user.type(name, 'Cálculo 3 (avanzado)')
    expect(name).toHaveValue('Cálculo  avanzado')
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

  it('filtra asignaturas por ciclo y estado sin cerrar los otros filtros', async () => {
    const user = userEvent.setup()
    render(<TutoringSubjectsPage />)
    await screen.findByText('Matemática')
    await user.selectOptions(screen.getByLabelText('Ciclo'), '20')
    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: undefined, cycle_id: 20, status: undefined }))
    await user.selectOptions(screen.getByLabelText('Estado'), 'active')
    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: undefined, cycle_id: 20, status: 'active' }))
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: undefined, cycle_id: undefined, status: undefined }))
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeDisabled()
  })

  it('permite asignar y desasignar ciclos de una asignatura sin cerrar el diálogo', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.assignSubjectCycle).mockResolvedValue({ ...subject, cycle_ids: [20, 21] })
    vi.mocked(tutoringApi.unassignSubjectCycle).mockResolvedValue({ ...subject, cycle_ids: [] })
    render(<TutoringSubjectsPage />)
    await user.click(await screen.findByRole('button', { name: 'Gestionar ciclos de Matemática' }))
    const dialog = screen.getByRole('form', { name: 'Ciclos de la asignatura' })
    expect(within(dialog).getByText('Segundo · A')).toBeInTheDocument()

    await user.selectOptions(within(dialog).getByLabelText('Agregar un ciclo'), '21')
    await user.click(within(dialog).getByRole('button', { name: 'Agregar ciclo' }))
    await waitFor(() => expect(tutoringApi.assignSubjectCycle).toHaveBeenCalledWith(30, 21))
    expect(within(dialog).getByText('Tercero · A')).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Ciclos de la asignatura' })).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Quitar Segundo · A' }))
    await waitFor(() => expect(tutoringApi.unassignSubjectCycle).toHaveBeenCalledWith(30, 20))
    expect(within(dialog).queryByRole('button', { name: 'Quitar Segundo · A' })).not.toBeInTheDocument()
  })

  it('respeta la restricción de edición de cuentas docentes compartidas', async () => {
    vi.mocked(tutoringApi.teachers).mockResolvedValue(paginated([{ id: 1, name: 'Ana Torres', identification: '0201234567', email: 'ana@ueb.edu.ec', phone: '0999999999', is_active: true, career_ids: [10], can_manage: false }]))
    render(<TutoringTeachersPage />)
    await screen.findByText('Ana Torres')
    expect(screen.getByText(/cambios a cargo de administración/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar Ana Torres' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desactivar Ana Torres' })).not.toBeInTheDocument()
  })

  it('sanea los caracteres del formulario de docentes y valida la cédula en vivo', async () => {
    const user = userEvent.setup()
    render(<TutoringTeachersPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar docente' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Registrar docente' }))
    const form = screen.getByRole('form', { name: 'Registrar docente' })

    const identification = within(form).getByLabelText('Cédula')
    await user.type(identification, 'abc1710034065xyz')
    expect(identification).toHaveValue('1710034065')
    expect(within(form).getByLabelText('Cédula válida')).toBeInTheDocument()

    const name = within(form).getByLabelText('Nombre completo')
    await user.type(name, 'Ana123 Torres')
    expect(name).toHaveValue('Ana Torres')

    const phone = within(form).getByLabelText('Teléfono')
    await user.type(phone, 'abc0991234567xyz')
    expect(phone).toHaveValue('0991234567')

    await user.clear(identification)
    await user.type(identification, '0201234567')
    expect(within(form).getByLabelText('Cédula inválida')).toBeInTheDocument()
  })

  it('edita y desactiva un docente gestionable desde el ícono y el menú de la fila', async () => {
    const user = userEvent.setup()
    const teacher = { id: 1, name: 'Ana Torres', identification: '0201234567', email: 'ana@ueb.edu.ec', phone: '0999999999', is_active: true, career_ids: [10], can_manage: true }
    vi.mocked(tutoringApi.teachers).mockResolvedValue(paginated([teacher]))
    vi.mocked(tutoringApi.updateTeacher).mockResolvedValue({ ...teacher, name: 'Ana María Torres' })
    vi.mocked(tutoringApi.deactivateTeacher).mockResolvedValue({ ...teacher, is_active: false })
    render(<TutoringTeachersPage />)

    await user.click(await screen.findByRole('button', { name: 'Editar Ana Torres' }))
    const form = screen.getByRole('form', { name: 'Editar docente' })
    await user.clear(within(form).getByLabelText('Nombre completo'))
    await user.type(within(form).getByLabelText('Nombre completo'), 'Ana María Torres')
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(tutoringApi.updateTeacher).toHaveBeenCalledWith(1, { identification: '0201234567', name: 'Ana María Torres', email: 'ana@ueb.edu.ec', phone: '0999999999' }))

    await user.click(screen.getByRole('button', { name: 'Más acciones para Ana Torres' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Desactivar' }))
    await user.click(screen.getByRole('button', { name: 'Desactivar docente' }))
    await waitFor(() => expect(tutoringApi.deactivateTeacher).toHaveBeenCalledWith(1))
  })

  it('filtra docentes por estado', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.teachers).mockResolvedValue(paginated([{ id: 1, name: 'Ana Torres', identification: '0201234567', email: 'ana@ueb.edu.ec', phone: '0999999999', is_active: true, career_ids: [10], can_manage: true }]))
    render(<TutoringTeachersPage />)
    await screen.findByText('Ana Torres')
    await user.selectOptions(screen.getByLabelText('Estado'), 'inactive')
    await waitFor(() => expect(tutoringApi.teachers).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: undefined, status: 'inactive' }))
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    await waitFor(() => expect(tutoringApi.teachers).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: undefined, status: undefined }))
  })

  it('registra una tutoría usando solo los ciclos vinculados con la asignatura', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.createTutoring).mockResolvedValue(tutoring)
    render(<TutoringsPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar tutoría' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Registrar tutoría' }))
    const createForm = screen.getByRole('form', { name: 'Registrar tutoría' })
    await user.selectOptions(screen.getByLabelText('Asignatura'), '30')
    expect(within(createForm).queryByRole('option', { name: /Tercero/ })).not.toBeInTheDocument()
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
    await user.click(await screen.findByRole('button', { name: 'Más acciones para Matemática' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Editar' }))
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
    await user.click(await screen.findByRole('button', { name: 'Más acciones para Matemática' }))
    const cycleMenuItem = await screen.findByRole('menuitem', { name: 'Ciclo y paralelo' })
    await waitFor(() => expect(cycleMenuItem).not.toHaveAttribute('data-disabled'))
    await user.click(cycleMenuItem)
    await user.selectOptions(screen.getByLabelText('Ciclo y paralelo'), '21')
    await user.click(within(screen.getByRole('form', { name: 'Asignar ciclo y paralelo' })).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(tutoringApi.assignTutoringCycle).toHaveBeenCalledWith(40, 21))
  })

  it('filtra tutorías por ciclo y estado, y abre el detalle al supervisar', async () => {
    const user = userEvent.setup()
    render(<TutoringsPage />)
    await screen.findByText('Matemática')
    await user.selectOptions(screen.getByLabelText('Ciclo'), '20')
    await waitFor(() => expect(tutoringApi.tutorings).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: undefined, cycle_id: 20, status: undefined }))
    await user.selectOptions(screen.getByLabelText('Estado'), 'inactive')
    await waitFor(() => expect(tutoringApi.tutorings).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: undefined, cycle_id: 20, status: 'inactive' }))
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    await waitFor(() => expect(tutoringApi.tutorings).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: undefined, cycle_id: undefined, status: undefined }))

    await user.click(screen.getByRole('button', { name: 'Supervisar Matemática' }))
    expect(await screen.findByRole('button', { name: 'Volver a tutorías' })).toBeInTheDocument()
  })

  it('asigna un docente desde el ícono de la fila sin pasar por el menú', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.availableTeachers).mockResolvedValue([{ id: 70, name: 'Ana Torres', email: 'ana@ueb.edu.ec', is_active: true }])
    vi.mocked(tutoringApi.assignTeacher).mockResolvedValue({ ...tutoring, teacher_id: 70, teacher_name: 'Ana Torres', teacher_is_active: true })
    render(<TutoringsPage />)
    await user.click(await screen.findByRole('button', { name: 'Asignar docente a Matemática' }))
    const form = await screen.findByRole('form', { name: 'Asignar docente' })
    await waitFor(() => expect(within(form).getByLabelText('Docente')).toBeEnabled())
    await user.selectOptions(within(form).getByLabelText('Docente'), '70')
    await user.click(within(form).getByRole('button', { name: 'Asignar docente' }))
    await waitFor(() => expect(tutoringApi.assignTeacher).toHaveBeenCalledWith(40, 70))
  })

  it('pide confirmación antes de desactivar una asignatura', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.deactivateSubject).mockResolvedValue({ ...subject, is_active: false })
    render(<TutoringSubjectsPage />)
    await user.click(await screen.findByRole('button', { name: 'Más acciones para Matemática' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Desactivar' }))
    expect(tutoringApi.deactivateSubject).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(tutoringApi.deactivateSubject).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Más acciones para Matemática' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Desactivar' }))
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

  it('edita y desactiva un horario desde el botón Editar y el menú de la fila', async () => {
    const user = userEvent.setup()
    const schedule = { id: 5, tutoring_id: 40, day: 'lunes', start_time: '10:00', end_time: '11:30', room: 'Aula 301', is_active: true }
    vi.mocked(tutoringApi.schedules).mockResolvedValue([schedule])
    vi.mocked(tutoringApi.updateSchedule).mockResolvedValue({ ...schedule, room: 'Aula 302' })
    vi.mocked(tutoringApi.deactivateSchedule).mockResolvedValue({ ...schedule, is_active: false })
    render(<TutoringDetail tutoring={tutoring} onBack={vi.fn()} onAssignTeacher={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'Editar horario del Lunes' }))
    const form = screen.getByRole('form', { name: 'Editar horario' })
    await user.clear(within(form).getByLabelText('Aula o lugar'))
    await user.type(within(form).getByLabelText('Aula o lugar'), 'Aula 302')
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(tutoringApi.updateSchedule).toHaveBeenCalledWith(40, 5, { day: 'lunes', start_time: '10:00', end_time: '11:30', room: 'Aula 302' }))

    await user.click(screen.getByRole('button', { name: 'Más acciones para el horario del Lunes' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Desactivar' }))
    await user.click(screen.getByRole('button', { name: 'Desactivar horario' }))
    await waitFor(() => expect(tutoringApi.deactivateSchedule).toHaveBeenCalledWith(40, 5))
  })
})
