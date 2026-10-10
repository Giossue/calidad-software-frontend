import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { tutoringApi, type Subject, type Tutoring } from '@/lib/tutoring-api'
import { TutoringSubjectsPage } from './subjects-page'
import { TutoringTeachersPage } from './teachers-page'
import { TutoringDetail } from './tutoring-detail'
import { TutoringReportsPage } from './reports-page'
import { TutoringStudentsPage } from './students-page'
import { canCoordinateTutorings, dashboardSection } from './tutoring-navigation'
import { TutoringsPage } from './tutorings-page'

vi.mock('@/lib/tutoring-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tutoring-api')>()
  return { ...actual, tutoringApi: Object.fromEntries(Object.keys(actual.tutoringApi).map((key) => [key, vi.fn()])) }
})

const career = { id: 10, faculty_id: 1, modality_id: 1, name: 'Software', status: true, cycles_count: 2, active_cycles_count: 2, cycle_levels: 2 }
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
  vi.mocked(tutoringApi.sections).mockResolvedValue([{ id: 1, name: 'A', is_active: true }])
  vi.mocked(tutoringApi.subjects).mockResolvedValue(paginated([subject]))
  vi.mocked(tutoringApi.teachers).mockResolvedValue(paginated([]))
  vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([tutoring]))
  vi.mocked(tutoringApi.schedules).mockResolvedValue([])
  vi.mocked(tutoringApi.attendance).mockResolvedValue(paginated([]))
  vi.mocked(tutoringApi.reports).mockResolvedValue(paginated([]))
  vi.mocked(tutoringApi.allReports).mockResolvedValue(paginated([]))
  vi.mocked(tutoringApi.degreeStudents).mockResolvedValue(paginated([]))
})

afterEach(cleanup)

// Con una sola carrera el módulo entra directo a ella.
async function openSubjects() {
  render(<TutoringSubjectsPage />)
  await screen.findByRole('button', { name: 'Registrar asignatura' })
}

describe('Coordinación de tutorías', () => {
  it('restringe la navegación según el rol y elige la portada correspondiente', () => {
    expect(dashboardSection('coordinador_carrera', 'users')).toBe('tutorings')
    expect(dashboardSection('coordinador_carrera', 'tutoring-subjects')).toBe('tutoring-subjects')
    expect(dashboardSection('coordinador_carrera', 'tutoring-students')).toBe('tutoring-students')
    expect(dashboardSection('coordinador_carrera', 'tutoring-reports')).toBe('tutoring-reports')
    expect(dashboardSection('administrador', 'users')).toBe('users')
    expect(dashboardSection('administrador', 'tutorings')).toBe('users')
    expect(canCoordinateTutorings('administrador')).toBe(false)
    expect(dashboardSection('docente', 'tutorings')).toBe('teacher-tutorings')
    expect(dashboardSection('estudiante', 'users')).toBe('student-tutorings')
  })

  it('explica cómo habilitar la coordinación cuando no hay carreras asignadas', async () => {
    vi.mocked(tutoringApi.careers).mockResolvedValue([])
    render(<TutoringSubjectsPage />)
    expect(await screen.findByText(/Solicita al administrador que asigne una carrera activa/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar asignatura' })).not.toBeInTheDocument()
  })

  it('conserva el formulario ante un rechazo y evita crear dos veces mientras guarda', async () => {
    const user = userEvent.setup()
    let reject: (error: unknown) => void = () => undefined
    vi.mocked(tutoringApi.createSubject).mockImplementationOnce(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise }))
    await openSubjects()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar asignatura' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Registrar asignatura' }))
    await user.type(screen.getByLabelText(/Código/), 'PROG')
    await user.type(screen.getByLabelText('Nombre'), 'Programación')
    const form = screen.getByRole('form', { name: 'Registrar asignatura' })
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(tutoringApi.createSubject).toHaveBeenCalledTimes(1)
    expect(tutoringApi.createSubject).toHaveBeenCalledWith({ career_id: 10, code: 'PROG', name: 'PROGRAMACIÓN', period_id: 50 })
    expect(within(form).getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    await act(async () => reject(new ApiError(422, { message: 'No se pudo guardar.', errors: { code: ['El código ya existe.'] } })))
    expect(await screen.findByText('El código ya existe.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveValue('PROGRAMACIÓN')
    expect(within(form).getByRole('button', { name: 'Registrar asignatura' })).toBeEnabled()
  })

  it('permite elegir el ciclo de la asignatura al registrarla con código opcional', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.createSubject).mockResolvedValue(subject)
    await openSubjects()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar asignatura' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Registrar asignatura' }))
    const form = screen.getByRole('form', { name: 'Registrar asignatura' })
    expect(within(form).queryByLabelText('Carrera')).not.toBeInTheDocument()
    expect(within(within(form).getByLabelText('Ciclo')).getByRole('option', { name: 'Seleccionar' })).toBeInTheDocument()
    // Código is optional: submit with only name and cycle
    await user.type(within(form).getByLabelText('Nombre'), 'Programación')
    await user.selectOptions(within(form).getByLabelText('Ciclo'), '20')
    await user.click(within(form).getByRole('button', { name: 'Registrar asignatura' }))
    await waitFor(() => expect(tutoringApi.createSubject).toHaveBeenCalledWith({ career_id: 10, name: 'PROGRAMACIÓN', cycle_id: 20, period_id: 50 }))
  })

  it('muestra el período académico actual sobre los demás campos de solo lectura y lo asocia automáticamente al registrar una asignatura', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.createSubject).mockResolvedValue(subject)
    await openSubjects()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar asignatura' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Registrar asignatura' }))
    const form = screen.getByRole('form', { name: 'Registrar asignatura' })

    // El período académico debe estar sobre los demás campos y ser solo lectura (no permite escoger)
    const periodInput = within(form).getByLabelText('Período académico')
    expect(periodInput).toBeDisabled()
    expect(periodInput).toHaveValue('2026-2')
    expect(within(form).getByText('PAO actual')).toBeInTheDocument()

    await user.type(within(form).getByLabelText('Nombre'), 'Estructura de Datos')
    await user.selectOptions(within(form).getByLabelText('Ciclo'), '20')
    await user.selectOptions(within(form).getByLabelText('Modalidad'), '60')
    await user.click(within(form).getByRole('button', { name: 'Registrar asignatura' }))
    await waitFor(() => expect(tutoringApi.createSubject).toHaveBeenCalledWith({
      career_id: 10,
      name: 'ESTRUCTURA DE DATOS',
      cycle_id: 20,
      modality_id: 60,
      period_id: 50,
    }))
  })

  it('permite seleccionar múltiples paralelos o crear uno nuevo tras elegir el ciclo al registrar una asignatura', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.createSubject).mockResolvedValue(subject)
    vi.mocked(tutoringApi.createSection).mockResolvedValue({ id: 2, name: 'B', is_active: true })
    await openSubjects()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar asignatura' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Registrar asignatura' }))
    const form = screen.getByRole('form', { name: 'Registrar asignatura' })

    // Select cycle
    await user.selectOptions(within(form).getByLabelText('Ciclo'), '20')

    // Select existing parallel A
    await user.click(within(form).getByLabelText(/Paralelo A/))

    // Create a new parallel B with button
    await user.click(within(form).getByRole('button', { name: /Crear nuevo paralelo/ }))
    const parallelInput = within(form).getByPlaceholderText('Ej. B')
    await user.type(parallelInput, 'B')
    await user.click(within(form).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(tutoringApi.createSection).toHaveBeenCalledWith('B'))

    // Code (optional) & Name
    await user.type(within(form).getByLabelText(/Código/), 'SW-201')
    await user.type(within(form).getByLabelText('Nombre'), 'Estructuras de Datos')

    await user.click(within(form).getByRole('button', { name: 'Registrar asignatura' }))
    await waitFor(() => expect(tutoringApi.createSubject).toHaveBeenCalledWith({
      career_id: 10,
      code: 'SW-201',
      name: 'ESTRUCTURAS DE DATOS',
      cycle_id: 20,
      parallel_ids: [1, 2],
      period_id: 50,
    }))
  })

  it('sanea los caracteres del código y el nombre al registrar una asignatura', async () => {
    const user = userEvent.setup()
    await openSubjects()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar asignatura' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Registrar asignatura' }))
    const form = screen.getByRole('form', { name: 'Registrar asignatura' })

    const code = within(form).getByLabelText(/Código/)
    await user.type(code, 'sw b1#001!')
    expect(code).toHaveValue('swb1001')

    const name = within(form).getByLabelText('Nombre')
    await user.type(name, 'Cálculo 3 (avanzado)')
    expect(name).toHaveValue('CÁLCULO  AVANZADO')
  })

  it('consulta la página siguiente de asignaturas en el servidor', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.subjects).mockImplementation(async (params) => paginated([{ ...subject, name: params?.page === 2 ? 'Física' : 'Matemática' }], params?.page, 2))
    await openSubjects()
    await screen.findByText('Matemática')
    const next = screen.getByRole('button', { name: 'Siguiente' })
    await waitFor(() => expect(next).toBeEnabled())
    await user.click(next)
    expect(await screen.findByText('Física', {}, { timeout: 10000 })).toBeInTheDocument()
    expect(tutoringApi.subjects).toHaveBeenLastCalledWith({ page: 2, search: '', career_id: career.id, cycle_number: undefined, status: undefined })
  })

  it('filtra por ciclo desde Filtros, muestra el badge del ciclo y empieza en Todos', async () => {
    const user = userEvent.setup()
    await openSubjects()
    await screen.findByText('Matemática')
    expect(screen.queryByRole('group', { name: 'Ciclo' })).not.toBeInTheDocument()
    expect(tutoringApi.subjects).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: career.id, cycle_number: undefined, status: undefined })

    await user.click(screen.getByRole('button', { name: /Filtros/ }))
    const cycleSelect = screen.getByLabelText('Ciclo')
    expect(within(cycleSelect).getAllByRole('option').map((option) => option.textContent)).toEqual(['Todos', '2° Segundo', '3° Tercero'])
    await user.selectOptions(cycleSelect, '3')
    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: career.id, cycle_number: 3, status: undefined }))
    await user.click(screen.getByRole('button', { name: 'Ver resultados' }))
    expect(screen.getByText(/Ciclo: 3° Tercero/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Quitar filtro Ciclo' }))
    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: career.id, cycle_number: undefined, status: undefined }))
    expect(screen.queryByText(/Ciclo: 3° Tercero/)).not.toBeInTheDocument()
  })

  it('con varias carreras lista primero las carreras con búsqueda y entra a la elegida; con una sola entra directo', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.careers).mockResolvedValue([career, { ...career, id: 11, name: 'Comunicación' }])
    vi.mocked(tutoringApi.cycles).mockResolvedValue([cycle, { ...cycle, id: 21, name: 'Tercero', number: 3 }, { ...cycle, id: 22, career_id: 11, name: 'Primero', number: 1 }])
    render(<TutoringSubjectsPage />)
    expect(await screen.findByTitle('Ver asignaturas de Software')).toBeInTheDocument()
    expect(screen.getByTitle('Ver asignaturas de Comunicación')).toBeInTheDocument()
    expect(screen.getByText(/de/, { selector: 'p' })).toHaveTextContent('Mostrando 2 de 2 carreras')
    expect(screen.queryByRole('button', { name: 'Registrar asignatura' })).not.toBeInTheDocument()
    expect(tutoringApi.subjects).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Buscar carrera'), 'comu')
    expect(screen.queryByTitle('Ver asignaturas de Software')).not.toBeInTheDocument()
    await user.click(screen.getByTitle('Ver asignaturas de Comunicación'))
    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: 11, cycle_number: undefined, status: undefined }))
    await user.click(screen.getByRole('button', { name: 'Asignaturas' }))
    expect(await screen.findByLabelText('Buscar carrera')).toBeInTheDocument()
  })

  it('muestra badges de filtros activos y permite quitarlos uno a uno', async () => {
    const user = userEvent.setup()
    await openSubjects()
    await screen.findByText('Matemática')
    await user.click(screen.getByRole('button', { name: /Filtros/ }))
    await user.selectOptions(screen.getByLabelText('Estado'), 'active')
    await user.click(screen.getByRole('button', { name: 'Ver resultados' }))
    expect(screen.getByText(/Estado: Activas/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quitar filtro Estado' }))
    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: career.id, cycle_number: undefined, status: undefined }))
    expect(screen.queryByText(/Estado: Activas/)).not.toBeInTheDocument()
  })

  it('permite asignar y desasignar paralelos de una asignatura sin cerrar el diálogo', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.sections).mockResolvedValue([
      { id: 1, name: 'A', is_active: true },
      { id: 2, name: 'B', is_active: true },
    ])
    vi.mocked(tutoringApi.cycles).mockResolvedValue([
      cycle,
      { ...cycle, id: 21, name: 'Segundo', number: 2, paralelo_id: 2, paralelo_name: 'B' },
    ])
    vi.mocked(tutoringApi.assignSubjectParallel).mockResolvedValue({ ...subject, cycle_ids: [20, 21] })
    vi.mocked(tutoringApi.unassignSubjectParallel).mockResolvedValue({ ...subject, cycle_ids: [] })
    await openSubjects()
    await user.click(await screen.findByRole('button', { name: 'Gestionar paralelos de Matemática' }))
    const dialog = screen.getByRole('form', { name: 'Paralelos de la asignatura' })
    expect(within(dialog).getByText('Paralelo A')).toBeInTheDocument()

    await user.selectOptions(within(dialog).getByLabelText('Seleccionar paralelo'), '2')
    await user.click(within(dialog).getByRole('button', { name: 'Agregar paralelo' }))
    await waitFor(() => expect(tutoringApi.assignSubjectParallel).toHaveBeenCalledWith(30, {
      parallel_id: 2,
      cycle_id: 20,
      new_parallel_name: undefined,
    }))
    expect(within(dialog).getByText('Paralelo B')).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Paralelos de la asignatura' })).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Quitar Paralelo A' }))
    await waitFor(() => expect(tutoringApi.unassignSubjectParallel).toHaveBeenCalledWith(30, 1))
    expect(within(dialog).queryByRole('button', { name: 'Quitar Paralelo A' })).not.toBeInTheDocument()
  })

  it('muestra los paralelos de cada asignatura directamente en la tabla', async () => {
    vi.mocked(tutoringApi.cycles).mockResolvedValue([cycle, { ...cycle, id: 21, paralelo_id: 2, paralelo_name: 'B' }])
    vi.mocked(tutoringApi.subjects).mockResolvedValue(paginated([{ ...subject, cycle_ids: [20, 21] }]))
    await openSubjects()
    const row = (await screen.findByText('Matemática')).closest('tr') as HTMLElement
    expect(within(row).getByTitle('Paralelo A')).toHaveTextContent('A')
    expect(within(row).getByTitle('Paralelo B')).toHaveTextContent('B')
    expect(screen.queryByRole('button', { name: /Ver paralelos de/i })).not.toBeInTheDocument()
  })

  it('respeta la restricción de edición de cuentas docentes compartidas', async () => {
    vi.mocked(tutoringApi.teachers).mockResolvedValue(paginated([{ id: 1, name: 'Ana Torres', identification: '0201234567', email: 'ana@ueb.edu.ec', phone: '0999999999', is_active: true, career_ids: [10], can_manage: false }]))
    render(<TutoringTeachersPage />)
    await screen.findByText('Ana Torres')
    expect(screen.getByText(/cambios a cargo de administración/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar Ana Torres' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desactivar Ana Torres' })).not.toBeInTheDocument()
  })

  it('vincula un docente existente a una carrera sin crearlo de nuevo', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.availableTeachers).mockResolvedValue([{ id: 70, name: 'Ana Torres', email: 'ana@ueb.edu.ec', is_active: true }])
    vi.mocked(tutoringApi.linkTeacherToCareer).mockResolvedValue({ id: 70, name: 'Ana Torres', identification: '0201234567', email: 'ana@ueb.edu.ec', phone: null, is_active: true, career_ids: [career.id], can_manage: true })
    render(<TutoringTeachersPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Vincular docente existente' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Vincular docente existente' }))
    const form = await screen.findByRole('form', { name: 'Vincular docente existente' })
    await user.selectOptions(within(form).getByLabelText('Carrera'), String(career.id))
    await user.type(within(form).getByLabelText('Docente'), 'ana')
    await user.click(await screen.findByRole('option', { name: /Ana Torres/ }))
    await user.click(within(form).getByRole('button', { name: 'Vincular docente' }))
    await waitFor(() => expect(tutoringApi.linkTeacherToCareer).toHaveBeenCalledWith(70, career.id))
  })

  it('abre un modal con las carreras al hacer clic en el botón Carreras de la columna en Docentes', async () => {
    const user = userEvent.setup()
    const teacher = { id: 1, name: 'Ana Torres', identification: '0201234567', email: 'ana@ueb.edu.ec', phone: '0999999999', is_active: true, career_ids: [career.id], can_manage: true }
    vi.mocked(tutoringApi.teachers).mockResolvedValue(paginated([teacher]))
    render(<TutoringTeachersPage />)
    await screen.findByText('Ana Torres')
    const viewBtn = screen.getByRole('button', { name: 'Ver carreras de Ana Torres' })
    expect(viewBtn).toBeInTheDocument()
    expect(viewBtn).toHaveTextContent('Carreras')
    await user.click(viewBtn)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Carreras asignadas')).toBeInTheDocument()
    expect(within(dialog).getByText(career.name)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('quita a un docente de una de sus carreras tras confirmar', async () => {
    const user = userEvent.setup()
    const teacher = { id: 1, name: 'Ana Torres', identification: '0201234567', email: 'ana@ueb.edu.ec', phone: '0999999999', is_active: true, career_ids: [career.id, 99], can_manage: true }
    vi.mocked(tutoringApi.teachers).mockResolvedValue(paginated([teacher]))
    vi.mocked(tutoringApi.unlinkTeacherFromCareer).mockResolvedValue({ ...teacher, career_ids: [99] })
    render(<TutoringTeachersPage />)
    await user.click(await screen.findByRole('button', { name: 'Más acciones para Ana Torres' }))
    await user.click(await screen.findByRole('menuitem', { name: `Quitar ${career.name} de Ana Torres` }))
    expect(tutoringApi.unlinkTeacherFromCareer).not.toHaveBeenCalled()
    await user.click(await screen.findByRole('button', { name: 'Quitar de la carrera' }))
    await waitFor(() => expect(tutoringApi.unlinkTeacherFromCareer).toHaveBeenCalledWith(1, career.id))
  })

  it('sanea los caracteres del formulario de docentes y valida la cédula en vivo', async () => {
    const user = userEvent.setup()
    render(<TutoringTeachersPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar docente nuevo' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Registrar docente nuevo' }))
    const form = screen.getByRole('form', { name: 'Registrar docente' })

    const identification = within(form).getByLabelText('Cédula o pasaporte')
    await user.type(identification, '17-1003 4065.')
    expect(identification).toHaveValue('1710034065')
    expect(within(form).getByLabelText('Identificación válida')).toBeInTheDocument()

    const name = within(form).getByLabelText('Nombre completo')
    await user.type(name, 'Ana123 Torres')
    expect(name).toHaveValue('Ana Torres')

    const phone = within(form).getByLabelText('Teléfono')
    await user.type(phone, 'abc0991234567xyz')
    expect(phone).toHaveValue('0991234567')

    await user.clear(identification)
    await user.type(identification, '0201234567')
    expect(within(form).getByLabelText('Identificación inválida')).toBeInTheDocument()

    await user.clear(identification)
    await user.type(identification, 'ab-1234567890')
    expect(identification).toHaveValue('AB1234567')
    expect(within(form).getByLabelText('Identificación válida')).toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: /Filtros/ }))
    await user.selectOptions(screen.getByLabelText('Estado'), 'inactive')
    await waitFor(() => expect(tutoringApi.teachers).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: undefined, status: 'inactive' }))
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    await waitFor(() => expect(tutoringApi.teachers).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: undefined, status: undefined }))
  })

  it('crea una tutoría con un solo botón: elige ciclo y asignatura y luego asigna docente y horario', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.availableTeachers).mockResolvedValue([{ id: 70, name: 'Ana Torres', email: 'ana@ueb.edu.ec', is_active: true }])
    vi.mocked(tutoringApi.createTutoring).mockResolvedValue({ ...tutoring, teacher_id: 70, teacher_name: 'Ana Torres' })

    render(<TutoringsPage />)
    await screen.findByText('Matemática')

    // Ya no hay botones de crear por fila: existe uno solo, arriba
    expect(screen.queryByRole('button', { name: 'Crear tutoría para Matemática' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Crear tutoría' }))
    await user.selectOptions(screen.getByLabelText('Ciclo'), '2')
    await user.selectOptions(screen.getByLabelText('Asignatura'), '30')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    const form = await screen.findByRole('form', { name: 'Crear tutoría' })

    // La materia ya está seleccionada y visible en el formulario
    expect(within(form).getByText('Matemática')).toBeInTheDocument()

    // Asignar docente recuperado de docentes de la carrera específica (solo nombre, sin buscador ni correo)
    await waitFor(() => expect(tutoringApi.availableTeachers).toHaveBeenCalledWith(''))
    await waitFor(() => expect(within(form).getByLabelText('Docente')).toBeEnabled())
    expect(within(form).getByRole('option', { name: 'Ana Torres' })).toBeInTheDocument()
    expect(within(form).queryByRole('option', { name: /ana@ueb.edu.ec/ })).not.toBeInTheDocument()
    await user.selectOptions(within(form).getByLabelText('Docente'), '70')

    // Asignar horario según el día (por ejemplo lunes 14:00-16:00 y miércoles 16:00-18:00, sin aula)
    expect(within(form).queryByLabelText(/Aula/)).not.toBeInTheDocument()
    expect(within(form).getByLabelText('Lunes')).toBeChecked()
    await user.click(within(form).getByLabelText('Miércoles'))

    await user.selectOptions(within(form).getByLabelText('Hora de inicio (Lunes)'), '14:00')
    await user.selectOptions(within(form).getByLabelText('Hora de fin (Lunes)'), '16:00')
    await user.selectOptions(within(form).getByLabelText('Hora de inicio (Miércoles)'), '16:00')
    await user.selectOptions(within(form).getByLabelText('Hora de fin (Miércoles)'), '18:00')

    await user.click(within(form).getByRole('button', { name: 'Crear tutoría' }))

    // Tutoría, docente y horarios se envían en una sola solicitud.
    await waitFor(() => expect(tutoringApi.createTutoring).toHaveBeenCalledWith({
      subject_id: 30,
      cycle_id: 20,
      parallel_ids: [1],
      period_id: 50,
      modality_id: 60,
      teacher_id: 70,
      schedules: [
        { day: 'lunes', start_time: '14:00', end_time: '16:00' },
        { day: 'miercoles', start_time: '16:00', end_time: '18:00' },
      ],
    }))
    expect(tutoringApi.assignTeacher).not.toHaveBeenCalled()
    expect(tutoringApi.createSchedule).not.toHaveBeenCalled()
  })

  it('avisa y no permite crear la tutoría si el docente ya tiene tutoría a esa hora', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.availableTeachers).mockResolvedValue([{
      id: 70, name: 'Ana Torres', email: 'ana@ueb.edu.ec', is_active: true,
      busy_schedules: [{ tutoring_id: 99, tutoring_name: 'Física', day: 'lunes', start_time: '09:00', end_time: '11:00' }],
    }])

    render(<TutoringsPage />)
    await screen.findByText('Matemática')
    await user.click(screen.getByRole('button', { name: 'Crear tutoría' }))
    await user.selectOptions(screen.getByLabelText('Ciclo'), '2')
    await user.selectOptions(screen.getByLabelText('Asignatura'), '30')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    const form = await screen.findByRole('form', { name: 'Crear tutoría' })
    await waitFor(() => expect(within(form).getByLabelText('Docente')).toBeEnabled())
    await user.selectOptions(within(form).getByLabelText('Docente'), '70')

    // Lunes 08:00-10:00 se cruza con Física (09:00-11:00).
    expect(within(form).getByRole('alert')).toHaveTextContent('Física (Lunes de 09:00 a 11:00)')
    expect(within(form).getByRole('button', { name: 'Crear tutoría' })).toBeDisabled()

    // Una franja contigua sí se permite.
    await user.selectOptions(within(form).getByLabelText('Hora de inicio'), '11:00')
    await user.selectOptions(within(form).getByLabelText('Hora de fin'), '12:00')
    expect(within(form).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Crear tutoría' })).toBeEnabled()
  })

  it('solo ofrece asignaturas activas al crear una tutoría', async () => {
    const user = userEvent.setup()
    const disabledSubject: Subject = {
      id: 31,
      career_id: 10,
      career_name: 'Software',
      code: 'ALG',
      name: 'Álgebra Lineal',
      is_active: false,
      cycle_ids: [20],
    }
    vi.mocked(tutoringApi.subjects).mockResolvedValue(paginated([subject, disabledSubject]))
    vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([]))

    render(<TutoringsPage />)

    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' })))
    expect(await screen.findByText(/Aún no hay tutorías/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crear tutoría' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Crear tutoría' }))
    await user.selectOptions(screen.getByLabelText('Ciclo'), '2')
    expect(screen.getByRole('option', { name: 'Matemática' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Álgebra Lineal' })).not.toBeInTheDocument()
  })

  it('muestra los paralelos de cada tutoría como badges en la tabla', async () => {
    render(<TutoringsPage />)
    const row = (await screen.findByText('Matemática')).closest('tr') as HTMLElement
    expect(within(row).getByTitle('Paralelo A')).toHaveTextContent('A')
    expect(screen.queryByRole('button', { name: /Ver paralelos de/i })).not.toBeInTheDocument()
  })

  it('abre un modal con los horarios al hacer clic en el botón Ver Horario de la columna sin cuadro de info de materia', async () => {
    const user = userEvent.setup()
    const scheduled = {
      ...tutoring,
      schedules: [
        { id: 101, tutoring_id: 40, day: 'lunes', start_time: '08:00:00', end_time: '10:00:00', room: 'Aula 101', is_active: true },
      ],
    }
    vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([scheduled]))

    render(<TutoringsPage />)

    await screen.findByText('Matemática')

    // Botón Ver Horario en la columna correspondiente
    const btn = await screen.findByRole('button', { name: 'Ver horario de Matemática' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveTextContent('Ver Horario')

    // Al hacer clic, abre el modal de horarios
    await user.click(btn)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Horarios de la asignatura')).toBeInTheDocument()
    expect(within(dialog).getByText('Lunes')).toBeInTheDocument()
    expect(within(dialog).getByText(/08:00 – 10:00/)).toBeInTheDocument()
    // No debe mostrar el cuadro de información de la asignatura
    expect(within(dialog).queryByText('Asignatura')).not.toBeInTheDocument()

    // Se puede cerrar el modal
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('en los 3 puntos solo permite editar: una tutoría creada no se desactiva', async () => {
    const user = userEvent.setup()
    render(<TutoringsPage />)
    await user.click(await screen.findByRole('button', { name: 'Más acciones para Matemática' }))
    expect(await screen.findByRole('menuitem', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Desactivar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Horarios' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Ciclo y paralelo' })).not.toBeInTheDocument()
  })

  it('permite editar la tutoría con la misma estructura e información que al crearla', async () => {
    const user = userEvent.setup()
    const scheduledTutoring = {
      ...tutoring,
      teacher_id: 70,
      teacher_name: 'Ana Torres',
      schedules: [
        { id: 101, tutoring_id: 40, day: 'lunes', start_time: '08:00', end_time: '10:00', room: 'Aula 1', is_active: true },
      ],
    }
    vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([scheduledTutoring]))
    vi.mocked(tutoringApi.availableTeachers).mockResolvedValue([
      { id: 70, name: 'Ana Torres', email: 'ana@ueb.edu.ec', is_active: true },
      { id: 71, name: 'Carlos Mendoza', email: 'carlos@ueb.edu.ec', is_active: true },
    ])
    vi.mocked(tutoringApi.schedules).mockResolvedValue([
      { id: 101, tutoring_id: 40, day: 'lunes', start_time: '08:00', end_time: '10:00', room: 'Aula 1', is_active: true },
    ])
    vi.mocked(tutoringApi.configureTutoring).mockResolvedValue({ ...scheduledTutoring, teacher_id: 71, teacher_name: 'Carlos Mendoza' })

    render(<TutoringsPage />)
    await screen.findByText('Matemática')
    await user.click(await screen.findByRole('button', { name: 'Más acciones para Matemática' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Editar' }))

    const form = await screen.findByRole('form', { name: 'Editar tutoría' })

    // Contiene la misma información de la creación: materia, docente, horario y paralelos
    expect(within(form).getByText('Matemática')).toBeInTheDocument()
    expect(within(form).getByLabelText('Docente')).toHaveValue('70')
    expect(within(form).getByLabelText('Lunes')).toBeChecked()
    expect(within(form).getByLabelText('Hora de inicio')).toHaveValue('08:00')
    expect(within(form).getByLabelText('Hora de fin')).toHaveValue('10:00')
    expect(within(form).getByLabelText(/Paralelo A/)).toBeChecked()

    // Cambiar docente y guardar cambios
    await user.selectOptions(within(form).getByLabelText('Docente'), '71')
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(tutoringApi.configureTutoring).toHaveBeenCalledWith(40, {
      teacher_id: 71,
      schedules: [{ day: 'lunes', start_time: '08:00', end_time: '10:00', room: 'Aula 1' }],
    }))
    expect(tutoringApi.assignTeacher).not.toHaveBeenCalled()
  })

  it('filtra tutorías por ciclo y estado, y abre el detalle al supervisar', async () => {
    const user = userEvent.setup()
    render(<TutoringsPage />)
    await screen.findByText('Matemática')
    expect(tutoringApi.tutorings).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: career.id, cycle_number: undefined, status: undefined })
    await user.click(screen.getByRole('button', { name: /Filtros/ }))
    expect(screen.queryByLabelText('Carrera')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Ciclo'), '2')
    await waitFor(() => expect(tutoringApi.tutorings).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: career.id, cycle_number: 2, status: undefined }))
    await user.selectOptions(screen.getByLabelText('Estado'), 'inactive')
    await waitFor(() => expect(tutoringApi.tutorings).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: career.id, cycle_number: 2, status: 'inactive' }))
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    await waitFor(() => expect(tutoringApi.tutorings).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: career.id, cycle_number: undefined, status: undefined }))
    await user.click(screen.getByRole('button', { name: 'Ver resultados' }))

    await user.click(screen.getByRole('button', { name: 'Supervisar Matemática' }))
    expect(await screen.findByRole('button', { name: 'Volver a tutorías' })).toBeInTheDocument()
    expect(screen.getByText('Docente responsable')).toBeInTheDocument()
    expect(screen.getByText('Supervisión de asistencias')).toBeInTheDocument()
    expect(screen.queryByText('Horarios de la tutoría')).not.toBeInTheDocument()
    expect(screen.queryByText('Informes de tutoría')).not.toBeInTheDocument()
  })

  it('reactiva una tutoría inactiva desde su fila', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([{ ...tutoring, is_active: false }]))
    vi.mocked(tutoringApi.activateTutoring).mockResolvedValue(tutoring)
    render(<TutoringsPage />)
    await user.click(await screen.findByRole('button', { name: 'Activar Matemática' }))
    await waitFor(() => expect(tutoringApi.activateTutoring).toHaveBeenCalledWith(40))
    expect(screen.queryByRole('button', { name: 'Asignar docente a Matemática' })).not.toBeInTheDocument()
  })

  it('no muestra los botones de asignar docente ni asignar horario una vez creada la tutoría', async () => {
    render(<TutoringsPage />)
    await screen.findByText('Matemática')

    // No debe haber botones individuales de "Asignar docente" ni "Asignar horario"
    expect(screen.queryByRole('button', { name: 'Asignar docente a Matemática' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Asignar horario a Matemática' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cambiar docente' })).not.toBeInTheDocument()
  })

  it('muestra una sola tabla con el ciclo de cada tutoría y el contador, sin acordeones por ciclo', async () => {
    render(<TutoringsPage />)
    await screen.findByText('Matemática')
    expect(screen.getByRole('heading', { level: 2, name: 'Software' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3, name: 'Segundo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Expandir todos/ })).not.toBeInTheDocument()
    expect(screen.getByText('2°')).toBeInTheDocument()
    expect(screen.getByText('Mostrando 1 de 1 tutoría')).toBeInTheDocument()
  })

  it('con varias carreras de tutorías pide elegir la carrera antes de ver las tutorías', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.careers).mockResolvedValue([career, { ...career, id: 11, name: 'Comunicación' }])
    render(<TutoringsPage />)
    expect(await screen.findByTitle('Ver tutorías de Comunicación')).toBeInTheDocument()
    expect(tutoringApi.tutorings).not.toHaveBeenCalled()
    await user.click(screen.getByTitle('Ver tutorías de Software'))
    await waitFor(() => expect(tutoringApi.tutorings).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: career.id, cycle_number: undefined, status: undefined }))
    await user.click(screen.getByRole('button', { name: 'Tutorías' }))
    expect(await screen.findByTitle('Ver tutorías de Comunicación')).toBeInTheDocument()
  })

  it('permite modificar horarios al editar la tutoría seleccionando días y horas', async () => {
    const user = userEvent.setup()
    const scheduledTutoring = {
      ...tutoring,
      teacher_id: 70,
      teacher_name: 'Ana Torres',
      schedules: [
        { id: 101, tutoring_id: 40, day: 'lunes', start_time: '08:00', end_time: '10:00', room: 'Aula 101', is_active: true },
      ],
    }
    vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([scheduledTutoring]))
    vi.mocked(tutoringApi.availableTeachers).mockResolvedValue([
      { id: 70, name: 'Ana Torres', email: 'ana@ueb.edu.ec', is_active: true },
    ])
    vi.mocked(tutoringApi.schedules).mockResolvedValue([
      { id: 101, tutoring_id: 40, day: 'lunes', start_time: '08:00', end_time: '10:00', room: 'Aula 101', is_active: true },
    ])
    vi.mocked(tutoringApi.configureTutoring).mockResolvedValue(scheduledTutoring)

    render(<TutoringsPage />)
    await screen.findByText('Matemática')
    await user.click(await screen.findByRole('button', { name: 'Más acciones para Matemática' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Editar' }))

    const form = await screen.findByRole('form', { name: 'Editar tutoría' })
    // Agregar Miércoles
    await user.click(within(form).getByLabelText('Miércoles'))
    await user.selectOptions(within(form).getByLabelText('Hora de inicio (Miércoles)'), '14:00')
    await user.selectOptions(within(form).getByLabelText('Hora de fin (Miércoles)'), '16:00')

    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(tutoringApi.configureTutoring).toHaveBeenCalledWith(40, {
      teacher_id: 70,
      schedules: [
        { day: 'lunes', start_time: '08:00', end_time: '10:00', room: 'Aula 101' },
        { day: 'miercoles', start_time: '14:00', end_time: '16:00' },
      ],
    }))
    expect(tutoringApi.createSchedule).not.toHaveBeenCalled()
  })

  it('pide confirmación antes de desactivar una asignatura', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.deactivateSubject).mockResolvedValue({ ...subject, is_active: false })
    await openSubjects()
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

  it('al supervisar una tutoría no muestra la sección de horarios, informes ni el botón de cambiar docente', async () => {
    render(<TutoringDetail tutoring={tutoring} onBack={vi.fn()} />)
    expect(screen.getByText('Docente responsable')).toBeInTheDocument()
    expect(screen.getByText('Supervisión de asistencias')).toBeInTheDocument()
    expect(screen.queryByText('Horarios de la tutoría')).not.toBeInTheDocument()
    expect(screen.queryByText('Informes de tutoría')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar horario' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cambiar docente' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Asignar docente' })).not.toBeInTheDocument()
  })

  it('en informes muestra la tabla sin tarjeta contenedora, el contador y permite leer el informe en el diálogo', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.allReports).mockResolvedValue(paginated([
      {
        id: 1,
        tutoring_id: 40,
        subject_name: 'Matemática',
        career_name: 'Software',
        cycle_name: 'Segundo',
        section_name: 'A',
        type: 'Avance',
        author_id: 2,
        author_name: 'Ana Torres',
        generated_at: '2026-09-27T12:00:00Z',
        content: 'Se reforzaron conceptos de álgebra y límites.',
      },
      {
        id: 2,
        tutoring_id: 40,
        subject_name: 'Matemática',
        career_name: 'Software',
        cycle_name: 'Segundo',
        section_name: 'A',
        type: 'Histórico',
        author_id: 2,
        author_name: 'Ana Torres',
        generated_at: '2026-09-20T12:00:00Z',
        content: null,
      },
    ]))

    render(<TutoringReportsPage />)
    expect(await screen.findByRole('heading', { level: 2, name: 'Software' })).toBeInTheDocument()
    expect(screen.queryByText('Asistencias registradas')).not.toBeInTheDocument()
    expect(screen.getByText('Mostrando 2 de 2 informes')).toBeInTheDocument()
    expect(tutoringApi.allReports).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: career.id, cycle_number: undefined })

    expect(screen.getAllByText('Matemática')).toHaveLength(2)
    expect(screen.getByText('Avance')).toBeInTheDocument()
    expect(screen.getByText('Sin contenido adjunto')).toBeInTheDocument()

    const readBtn = screen.getByRole('button', { name: 'Leer informe' })
    await user.click(readBtn)

    const reader = screen.getByRole('article', { name: 'Contenido del informe' })
    expect(within(reader).getByText('Se reforzaron conceptos de álgebra y límites.')).toBeVisible()
    expect(within(reader).getByText('Ana Torres')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Cerrar informe' }))
    expect(screen.queryByRole('article', { name: 'Contenido del informe' })).not.toBeInTheDocument()
  })

  it('permite al coordinador listar estudiantes y abrir el formulario de registro', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.allStudents).mockResolvedValue(paginated([
      {
        id: 101,
        identification: '0201999999',
        name: 'Carlos Estudiante',
        email: 'carlos@ueb.edu.ec',
        phone: '0981112233',
        is_active: true,
        tutoring_count: 1,
        tutorings: [
          {
            enrollment_id: 501,
            tutoring_id: 40,
            subject_name: 'Matemática',
            cycle_name: 'Segundo',
            section_name: 'A',
            period_name: '2026-2',
            is_active: true,
          },
        ],
      },
    ]))
    vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([tutoring]))

    render(<TutoringStudentsPage />)

    expect(await screen.findByRole('heading', { level: 2, name: 'Software' })).toBeInTheDocument()
    expect(await screen.findByText('Carlos Estudiante')).toBeInTheDocument()
    expect(screen.getByText('0201999999')).toBeInTheDocument()
    expect(screen.getByText('carlos@ueb.edu.ec')).toBeInTheDocument()
    expect(screen.getByText('Matemática · A')).toBeInTheDocument()
    expect(screen.getByText('Mostrando 1 de 1 estudiante')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gestionar tutorías' })).toBeInTheDocument()

    const newBtn = screen.getByRole('button', { name: 'Nuevo estudiante' })
    await user.click(newBtn)

    expect(screen.getByRole('form', { name: 'Registrar Nuevo Estudiante' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Cédula o pasaporte/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Nombres y Apellidos/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Correo Institucional/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Teléfono/i)).toBeInTheDocument()

    const cycleSelect = screen.getByLabelText(/Ciclo/i)
    const tutoringSelect = screen.getByLabelText(/Tutoría/i)
    expect(cycleSelect).toBeInTheDocument()
    expect(tutoringSelect).toBeDisabled()

    await user.selectOptions(cycleSelect, String(cycle.id))
    expect(tutoringSelect).toBeEnabled()
    expect(screen.getByRole('option', { name: /Matemática/i })).toBeInTheDocument()
  })

  it('exige el ciclo al registrar un estudiante y no ofrece tutorías en el ciclo de titulación', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.allStudents).mockResolvedValue(paginated([]))
    vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([tutoring]))
    vi.mocked(tutoringApi.createCoordinatorStudent).mockResolvedValue({ data: { id: 1, identification: '0926687856', name: 'Ana Nueva', email: 'ana@ueb.edu.ec', is_active: true, tutoring_count: 0, tutorings: [] } })

    render(<TutoringStudentsPage />)
    await user.click(await screen.findByRole('button', { name: 'Nuevo estudiante' }))
    const form = screen.getByRole('form', { name: 'Registrar Nuevo Estudiante' })
    await user.type(within(form).getByLabelText(/Cédula o pasaporte/i), '0926687856')
    await user.type(within(form).getByLabelText(/Nombres y Apellidos/i), 'Ana Nueva')
    await user.type(within(form).getByLabelText(/Correo Institucional/i), 'ana@ueb.edu.ec')

    // Sin ciclo no se puede registrar.
    const submit = within(form).getByRole('button', { name: 'Registrar estudiante' })
    expect(submit).toBeDisabled()

    // Tercero es el último ciclo de la carrera: titulación, sin tutorías.
    await user.selectOptions(within(form).getByLabelText(/Ciclo/i), '21')
    expect(within(form).getByRole('option', { name: /Tercero - Paralelo A · Titulación/ })).toBeInTheDocument()
    expect(within(form).getByLabelText(/Tutoría/i)).toBeDisabled()

    await user.click(submit)
    await waitFor(() => expect(tutoringApi.createCoordinatorStudent).toHaveBeenCalledWith({
      identification: '0926687856', name: 'Ana Nueva', email: 'ana@ueb.edu.ec', phone: null, cycle_id: 21, tutoring_id: undefined, career_id: 10,
    }))
  })

  it('no permite matricular en titulación a un estudiante de un ciclo anterior al último', async () => {
    const user = userEvent.setup()
    const student = {
      id: 102, student_id: 102, identification: '0201777777', name: 'Pedro Quinto', email: 'pedro@ueb.edu.ec', phone: null,
      cycle_number: 5, academic_stage: 'tutorias' as const,
      is_degree_enrolled: false, degree_enrollment_id: null, enrolled_at: null, period_id: 50, period_name: '2026-2',
    }
    vi.mocked(tutoringApi.allStudents).mockResolvedValue(paginated([]))
    vi.mocked(tutoringApi.degreeStudents).mockResolvedValue({ data: [student], meta: { ...paginated([student]).meta, current_period: { id: 50, name: '2026-2' } } })

    render(<TutoringStudentsPage />)
    await user.click(await screen.findByRole('tab', { name: /Titulación/i }))

    expect(await screen.findByText('Ciclo 5')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Matricular en Titulación' })).toBeDisabled()
  })

  it('permite al coordinador de carrera cambiar a la pestaña de titulación y matricular a un estudiante', async () => {
    const user = userEvent.setup()
    const degreeStudent = {
      id: 101,
      student_id: 101,
      identification: '0201888888',
      name: 'María Estudiante',
      email: 'maria@ueb.edu.ec',
      phone: '0991234567',
      is_active: true,
      is_degree_enrolled: false,
      degree_enrollment_id: null,
      enrolled_at: null,
      period_id: 50,
      period_name: '2026-2',
    }

    vi.mocked(tutoringApi.allStudents).mockResolvedValue(paginated([]))
    vi.mocked(tutoringApi.degreeStudents).mockResolvedValue({
      data: [degreeStudent],
      meta: {
        ...paginated([degreeStudent]).meta,
        current_period: { id: 50, name: '2026-2' },
      },
    })
    vi.mocked(tutoringApi.enrollDegreeStudent).mockResolvedValue({
      data: { ...degreeStudent, is_degree_enrolled: true },
      message: 'Estudiante matriculado en titulación exitosamente.',
    })

    render(<TutoringStudentsPage />)

    // Click on "Titulación" tab
    const degreeTab = await screen.findByRole('tab', { name: /Titulación/i })
    await user.click(degreeTab)

    expect(await screen.findByRole('heading', { level: 2, name: 'Matrícula en Titulación' })).toBeInTheDocument()
    expect(screen.getByText('María Estudiante')).toBeInTheDocument()
    expect(screen.getByText('0201888888')).toBeInTheDocument()
    expect(screen.getByText('No matriculado')).toBeInTheDocument()
    expect(screen.queryByText(/Período actual/)).not.toBeInTheDocument()

    const enrollBtn = screen.getByRole('button', { name: 'Matricular en Titulación' })
    await user.click(enrollBtn)

    // Confirm modal opens
    expect(screen.getByRole('heading', { level: 2, name: /¿Matricular a María Estudiante en Titulación\?/i })).toBeInTheDocument()
    const confirmBtn = screen.getByRole('button', { name: 'Confirmar matrícula' })
    await user.click(confirmBtn)

    await waitFor(() => expect(tutoringApi.enrollDegreeStudent).toHaveBeenCalledWith(101))
  })
})
