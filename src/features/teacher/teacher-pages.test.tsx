import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { teacherApi, type Enrollment, type TeacherTutoring, type TutoringTopic } from '@/lib/teacher-api'
import { dashboardSection } from '@/features/tutoring/tutoring-navigation'
import { TeacherDegreeAssignmentsPage } from './teacher-degree-assignments-page'
import { TeacherDegreeTrackingPage } from './teacher-degree-tracking-page'
import { TeacherReportsStandalonePage } from './teacher-reports-standalone-page'
import { TeacherTutoringsPage } from './teacher-tutorings-page'

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({
    user: { id: 5, name: 'María López', role: 'docente', email: 'maria.lopez@ueb.edu.ec' },
  }),
}))

vi.mock('@/lib/teacher-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/teacher-api')>()
  return { ...actual, teacherApi: Object.fromEntries(Object.keys(actual.teacherApi).map((key) => [key, vi.fn()])) }
})

const tutoring: TeacherTutoring = { id: 40, subject_id: 30, subject_name: 'Calidad de software', cycle_id: 20, cycle_name: 'Segundo', career_id: 10, career_name: 'Software', period_id: 50, period_name: '2026-2', period_start_date: '2026-01-01', period_end_date: '2026-12-31', modality_id: 60, modality_name: 'Presencial', section_id: 1, section_name: 'A', teacher_id: 5, teacher_name: 'María López', teacher_is_active: true, is_active: true, can_manage: true, active_enrollment_count: 1, schedules: [] }
const student: Enrollment = { id: 70, tutoring_id: 40, student_id: 80, identification: '0201234567', name: 'Ana Pérez', email: 'ana.perez@ueb.edu.ec', phone: '0991234567', enrolled_at: '2026-09-29', is_active: true, student_is_active: true, can_edit_profile: true, diagnostic_grade: null, partial_grade: null, second_partial_grade: null, knowledge_group: null, knowledge_group_key: null }
const topic: TutoringTopic = { id: 90, tutoring_id: 40, name: 'Pruebas', description: 'Casos de prueba', is_active: true, is_covered: false, activities: [] }
function paginated<T>(data: readonly T[], page = 1, last = 1) {
  return { data, meta: { current_page: page, last_page: last, per_page: 15, total: data.length, from: data.length ? 1 : null, to: data.length || null, active_count: data.length, inactive_count: 0 } }
}
function show(component: React.ReactNode, path = '/panel/teacher-tutorings?tutoring=40&tab=students') {
  return render(<MemoryRouter initialEntries={[path]}>{component}</MemoryRouter>)
}

const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
function attendance() {
  return show(<TeacherTutoringsPage />, `/panel/teacher-tutorings?tutoring=40&tab=attendance&session=${today}`)
}

function workspace(tab: string) {
  return show(<TeacherTutoringsPage />, `/panel/teacher-tutorings?tutoring=40&tab=${tab}`)
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.mocked(teacherApi.tutorings).mockResolvedValue(paginated([tutoring]))
  vi.mocked(teacherApi.allTutorings).mockResolvedValue([tutoring])
  vi.mocked(teacherApi.students).mockResolvedValue(paginated([student]))
  vi.mocked(teacherApi.allStudents).mockResolvedValue([student])
  vi.mocked(teacherApi.availableStudents).mockResolvedValue([{ id: student.student_id, name: student.name, identification: student.identification, email: student.email }])
  vi.mocked(teacherApi.gradeSettings).mockResolvedValue({ minimum: 0, maximum: 10, groups: [{ key: 'low', label: 'Bajo', min: 0, max: 3.99 }, { key: 'high', label: 'Alto', min: 7, max: 10 }] })
  vi.mocked(teacherApi.topics).mockResolvedValue(paginated([topic]))
  vi.mocked(teacherApi.allTopics).mockResolvedValue([topic])
  vi.mocked(teacherApi.sessions).mockResolvedValue(paginated([]))
  vi.mocked(teacherApi.attendance).mockResolvedValue(paginated([]))
  vi.mocked(teacherApi.allAttendance).mockResolvedValue([])
  vi.mocked(teacherApi.reports).mockResolvedValue(paginated([]))
  vi.mocked(teacherApi.degreeAssignments).mockResolvedValue(paginated([]))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('Módulo Docente', () => {
  it('ofrece destinos propios y conserva las restricciones de los demás roles', () => {
    expect(dashboardSection('docente', 'users')).toBe('teacher-tutorings')
    expect(dashboardSection('docente', 'teacher-degree-assignments')).toBe('teacher-degree-assignments')
    expect(dashboardSection('docente', 'teacher-degree-tracking')).toBe('teacher-degree-tracking')
    expect(dashboardSection('docente', 'teacher-grades')).toBe('teacher-tutorings')
    expect(dashboardSection('coordinador_carrera', 'teacher-grades')).toBe('tutorings')
    expect(dashboardSection('estudiante', 'teacher-grades')).toBe('student-tutorings')
  })

  it('consulta tutorías con paginación y abre el espacio de trabajo de la elegida', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.tutorings).mockResolvedValue(paginated([tutoring], 1, 2))
    show(<TeacherTutoringsPage />, '/panel/teacher-tutorings')
    await screen.findByText('Calidad de software')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(teacherApi.tutorings).toHaveBeenLastCalledWith({ page: 2, search: '', status: undefined }))
    await user.click(screen.getByText('Calidad de software'))
    expect(await screen.findByRole('heading', { name: 'Calidad de software' })).toBeInTheDocument()
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument()
    expect(teacherApi.students).toHaveBeenLastCalledWith(40, { page: 1, search: '', status: undefined })
  })

  it('cambia de sección dentro de la misma tutoría sin volver a elegirla', async () => {
    const user = userEvent.setup()
    workspace('students')
    await screen.findByText('Ana Pérez')
    await user.click(screen.getByRole('tab', { name: 'Calificaciones' }))
    expect(await screen.findByRole('button', { name: /^Diagnóstico/ })).toBeInTheDocument()
    expect(teacherApi.allStudents).toHaveBeenLastCalledWith(40)
    await user.click(screen.getByRole('tab', { name: 'Horarios' }))
    expect(await screen.findByText('Sin horarios registrados')).toBeInTheDocument()
    expect(teacherApi.allTutorings).toHaveBeenCalledTimes(1)
  })

  it('permite al docente editar los días y horas de tutoría de la asignatura', async () => {
    const user = userEvent.setup()
    const updatedSchedule = { id: 1, tutoring_id: 40, day: 'martes', start_time: '09:00', end_time: '11:00', room: 'Por asignar', is_active: true }
    vi.mocked(teacherApi.syncSchedules).mockImplementation(async () => {
      vi.mocked(teacherApi.allTutorings).mockResolvedValue([{ ...tutoring, schedules: [updatedSchedule] }])
      return [updatedSchedule]
    })
    workspace('schedules')
    expect(await screen.findByText('Sin horarios registrados')).toBeInTheDocument()

    // Abre el modal de editar horarios
    await user.click(screen.getByRole('button', { name: 'Editar horarios' }))
    expect(await screen.findByRole('dialog', { name: 'Editar horarios de tutoría' })).toBeInTheDocument()

    // Cambia los días: desmarca lunes y marca martes
    await user.click(screen.getByLabelText('Lunes'))
    await user.click(screen.getByLabelText('Martes'))

    // Selecciona horario para martes
    const startSelect = screen.getByLabelText(/Hora de inicio/i)
    const endSelect = screen.getByLabelText(/Hora de fin/i)
    await user.selectOptions(startSelect, '09:00')
    await user.selectOptions(endSelect, '11:00')

    // Guarda
    await user.click(screen.getByRole('button', { name: 'Guardar horarios' }))

    expect(teacherApi.syncSchedules).toHaveBeenCalledWith(40, [
      { day: 'martes', start_time: '09:00', end_time: '11:00', room: 'Por asignar' },
    ])
    expect(await screen.findByText('09:00 – 11:00')).toBeInTheDocument()
  })

  it('no muestra un botón de volver en el espacio de trabajo: se vuelve desde el menú Mis tutorías', async () => {
    workspace('students')
    await screen.findByRole('tablist', { name: 'Secciones de la tutoría' })
    expect(screen.queryByRole('button', { name: 'Volver a mis tutorías' })).not.toBeInTheDocument()
  })

  it('no consulta estudiantes cuando la tutoría ya no está asignada al docente', async () => {
    vi.mocked(teacherApi.allTutorings).mockResolvedValue([])
    workspace('students')
    expect(await screen.findByText(/ya no está asignada a tu cuenta/)).toBeInTheDocument()
    expect(teacherApi.students).not.toHaveBeenCalled()
  })

  it('evita inscripciones duplicadas y conserva el formulario cuando el servidor rechaza', async () => {
    const user = userEvent.setup()
    let reject: (error: unknown) => void = () => undefined
    vi.mocked(teacherApi.enrollStudent).mockImplementationOnce(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise }))
    workspace('students')
    await screen.findByText('Ana Pérez')
    await user.click(screen.getByRole('button', { name: 'Registrar estudiante' }))
    await user.click(screen.getByLabelText('Estudiante'))
    await user.click(await screen.findByRole('option', { name: /Ana Pérez/ }))
    const form = screen.getByRole('form', { name: 'Registrar estudiante' })
    fireEvent.submit(form); fireEvent.submit(form)
    expect(teacherApi.enrollStudent).toHaveBeenCalledTimes(1)
    expect(teacherApi.enrollStudent).toHaveBeenCalledWith(40, { student_id: 80 })
    await act(async () => reject(new ApiError(422, { message: 'No se pudo inscribir.', errors: { student_id: ['El estudiante ya está inscrito.'] } })))
    expect(await screen.findByText('El estudiante ya está inscrito.')).toBeInTheDocument()
    expect(screen.getByLabelText('Estudiante')).toHaveValue('Ana Pérez')
    expect(within(form).getByRole('button', { name: 'Inscribir estudiante' })).toBeEnabled()
  })

  it('separa claramente inscribir a un estudiante ya registrado de crear uno nuevo', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.enrollStudent).mockResolvedValue(student)
    workspace('students')
    await user.click(await screen.findByRole('button', { name: 'Registrar estudiante' }))
    const form = screen.getByRole('form', { name: 'Registrar estudiante' })
    expect(within(form).getByRole('button', { name: 'Inscribir estudiante' })).toBeDisabled()
    expect(within(form).queryByLabelText('Cédula')).not.toBeInTheDocument()

    await user.click(within(form).getByRole('tab', { name: 'Estudiante nuevo' }))
    expect(within(form).queryByLabelText('Estudiante')).not.toBeInTheDocument()
    await user.type(within(form).getByLabelText(/Cédula/i), '0201234564')
    await user.type(within(form).getByLabelText(/Nombres y Apellidos/i), 'Luis Mora')
    await user.type(within(form).getByLabelText(/Correo Institucional/i), 'luis.mora@ueb.edu.ec')
    await user.click(within(form).getByRole('button', { name: 'Crear e inscribir' }))
    await waitFor(() => expect(teacherApi.enrollStudent).toHaveBeenCalledWith(40, { identification: '0201234564', name: 'Luis Mora', email: 'luis.mora@ueb.edu.ec', phone: null }))
  })

  it('no permite editar datos del estudiante y permite añadir sus calificaciones directamente', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.saveGrades).mockResolvedValue([student])
    workspace('students')
    expect(screen.queryByRole('button', { name: /Editar datos de/i })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Añadir notas de Ana Pérez' }))
    const form = screen.getByRole('form', { name: 'Calificaciones del estudiante' })
    await user.type(within(form).getByLabelText('Diagnóstico de Ana Pérez'), '8.5')
    await user.click(within(form).getByRole('button', { name: 'Guardar calificaciones' }))
    await waitFor(() => expect(teacherApi.saveGrades).toHaveBeenCalledWith(40, [{ enrollment_id: 70, diagnostic: '8.50', partial: undefined, partial_two: undefined }]))
  })

  it('confirma la baja de la inscripción antes de enviarla', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.deactivateStudent).mockResolvedValue({ ...student, is_active: false })
    workspace('students')
    await user.click(await screen.findByRole('button', { name: 'Deshabilitar a Ana Pérez' }))
    expect(teacherApi.deactivateStudent).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Deshabilitar inscripción' }))
    await waitFor(() => expect(teacherApi.deactivateStudent).toHaveBeenCalledWith(40, 70))
  })

  it('carga las notas por etapa: todos los estudiantes de una etapa y recién ahí guarda', async () => {
    const user = userEvent.setup()
    const second = { ...student, id: 71, student_id: 81, name: 'Luis Mora', identification: '0202222222' }
    vi.mocked(teacherApi.allStudents).mockResolvedValue([student, second])
    vi.mocked(teacherApi.saveGrades).mockResolvedValue([student, second])
    workspace('grades')
    await user.click(await screen.findByRole('button', { name: /^Diagnóstico/ }))
    const first = await screen.findByRole('textbox', { name: 'Diagnóstico de Ana Pérez' })
    const other = screen.getByRole('textbox', { name: 'Diagnóstico de Luis Mora' })
    const save = screen.getByRole('button', { name: 'Guardar Diagnóstico' })
    expect(screen.queryByRole('textbox', { name: /Parcial/ })).not.toBeInTheDocument()
    expect(save).toBeDisabled()
    expect(screen.getByText('Faltan 2 notas de Diagnóstico.')).toBeInTheDocument()

    await user.type(first, '9.4267')
    expect(first).toHaveValue('9.42')
    await user.type(other, '11')
    expect(other).toHaveValue('1')
    await user.clear(other)
    await user.type(other, 'a8,5x')
    expect(other).toHaveValue('8.5')
    expect(screen.getAllByText('Alto')).toHaveLength(2)
    await user.tab()
    expect(other).toHaveValue('8.50')
    await waitFor(() => expect(save).toBeEnabled())

    await user.click(save)
    await waitFor(() => expect(teacherApi.saveGrades).toHaveBeenCalledWith(40, [{ enrollment_id: 70, diagnostic: '9.42' }, { enrollment_id: 71, diagnostic: '8.50' }]))
    expect(JSON.parse(sessionStorage.getItem('grades-draft:40') ?? '{}')[70]?.diagnostic).toBeUndefined()
  })

  it('abre en "Todas las etapas", indica el estado de cada etapa en su botón y deja volver a la consulta', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.allStudents).mockResolvedValue([{ ...student, diagnostic_grade: '8.00' }])
    workspace('grades')
    expect(await screen.findByText('8.00')).toBeInTheDocument()
    expect(screen.queryByText(/modo consulta/)).not.toBeInTheDocument()
    expect(screen.queryByText('Cargar notas de:')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Todas las etapas' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Guardar/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Diagnóstico Completo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Parcial 1 Pendiente' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Parcial 1/ }))
    expect(screen.getByRole('textbox', { name: 'Parcial 1 de Ana Pérez' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Parcial 1/ })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Todas las etapas' }))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('muestra el grupo de conocimiento en la lista de estudiantes y la evolución diagnóstica en calificaciones', async () => {
    vi.mocked(teacherApi.students).mockResolvedValue(paginated([{ ...student, knowledge_group: 'Alto' }]))
    workspace('students')
    expect(await screen.findByText('Grupo de Conocimiento')).toBeInTheDocument()
    expect(await screen.findByText('Alto')).toBeInTheDocument()

    vi.mocked(teacherApi.allStudents).mockResolvedValue([{ ...student, diagnostic_grade: '7.00', second_partial_grade: '9.50' }])
    workspace('grades')
    expect(await screen.findByText('Evolución (Diag → P2)')).toBeInTheDocument()
    expect(await screen.findByText('+2.50')).toBeInTheDocument()
  })

  it('cancela la carga de una etapa y vuelve a modo consulta, descartando lo no guardado tras confirmar', async () => {
    const user = userEvent.setup()
    workspace('grades')
    await user.click(await screen.findByRole('button', { name: /^Diagnóstico/ }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Diagnóstico/ }))
    await user.type(screen.getByRole('textbox', { name: 'Diagnóstico de Ana Pérez' }), '7.5')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.click(await screen.findByRole('button', { name: 'Seguir editando' }))
    expect(screen.getByRole('textbox', { name: 'Diagnóstico de Ana Pérez' })).toHaveValue('7.50')
    expect(teacherApi.saveGrades).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.click(await screen.findByRole('button', { name: 'Sí, descartar' }))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Diagnóstico/ }))
    expect(screen.getByRole('textbox', { name: 'Diagnóstico de Ana Pérez' })).toHaveValue('')
  })

  it('conserva las notas escritas como borrador si el docente sale de la página', async () => {
    const user = userEvent.setup()
    const view = workspace('grades')
    await user.click(await screen.findByRole('button', { name: /^Diagnóstico/ }))
    await user.type(await screen.findByRole('textbox', { name: 'Diagnóstico de Ana Pérez' }), '7.5')
    view.unmount()
    workspace('grades')
    await user.click(await screen.findByRole('button', { name: /^Diagnóstico/ }))
    expect(await screen.findByRole('textbox', { name: 'Diagnóstico de Ana Pérez' })).toHaveValue('7.5')
  })

  it('mantiene las notas escritas ante un error del servidor', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.saveGrades).mockRejectedValue(new ApiError(422, { message: 'La nota supera la escala.' }))
    workspace('grades')
    await user.click(await screen.findByRole('button', { name: /^Diagnóstico/ }))
    await user.type(await screen.findByRole('textbox', { name: 'Diagnóstico de Ana Pérez' }), '8.5')
    await user.click(screen.getByRole('button', { name: 'Guardar Diagnóstico' }))
    expect(await screen.findByText('La nota supera la escala.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Diagnóstico de Ana Pérez' })).toHaveValue('8.50')
  })

  it('registra la asistencia en un solo paso, da por ausente a quien no se marca y guarda directamente', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.saveSession).mockResolvedValue({ id: 100, tutoring_id: 40, date: today, topics_covered: false, topics: [], attendance: [] })
    attendance()
    const save = await screen.findByRole('button', { name: 'Guardar asistencia' })
    expect(screen.getByRole('checkbox', { name: 'Presente: Ana Pérez' })).not.toBeChecked()
    await user.click(save)
    await waitFor(() => expect(teacherApi.saveSession).toHaveBeenCalledWith(40, { date: today, topics_covered: false, topic_ids: [], attendance: [{ enrollment_id: 70, present: false }] }))
    expect(sessionStorage.getItem(`attendance-draft:40:${today}`)).toBeNull()
  })

  it('ordena a los estudiantes alfabéticamente, ignorando tildes y mayúsculas', async () => {
    const make = (id: number, name: string) => ({ ...student, id, student_id: 100 + id, name })
    vi.mocked(teacherApi.allStudents).mockResolvedValue([make(1, 'Zambrano Luis'), make(2, 'Álvarez Ana'), make(3, 'andrade Sofía'), make(4, 'Bravo Eva')])
    attendance()
    await screen.findByRole('checkbox', { name: 'Presente: Zambrano Luis' })
    const names = screen.getAllByRole('checkbox').map((box) => box.getAttribute('aria-label'))
    expect(names).toEqual(['Presente: Álvarez Ana', 'Presente: andrade Sofía', 'Presente: Bravo Eva', 'Presente: Zambrano Luis'])
  })

  it('muestra una tabla numerada y permite marcar a todos con un clic', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.allStudents).mockResolvedValue([student, { ...student, id: 71, student_id: 81, name: 'Luis Mora', identification: '0202222222' }])
    attendance()
    const table = within(await screen.findByRole('form', { name: 'Registrar asistencia' })).getByRole('table')
    expect(within(table).getByText('Ana Pérez').closest('tr')).toHaveTextContent('1')
    expect(within(table).getByText('Luis Mora').closest('tr')).toHaveTextContent('2')
    await user.click(screen.getByRole('button', { name: 'Marcar todos' }))
    expect(within(table).getByRole('checkbox', { name: 'Presente: Ana Pérez' })).toBeChecked()
    expect(within(table).getByRole('checkbox', { name: 'Presente: Luis Mora' })).toBeChecked()
    expect(screen.getByText('2 de 2 presentes')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Desmarcar todos' }))
    expect(screen.getByText('0 de 2 presentes')).toBeInTheDocument()
  })

  it('marca la asistencia al tocar cualquier parte de la fila sin duplicar el clic del checkbox', async () => {
    const user = userEvent.setup()
    attendance()
    const checkbox = await screen.findByRole('checkbox', { name: 'Presente: Ana Pérez' })
    await user.click(screen.getByText('Ana Pérez'))
    expect(checkbox).toBeChecked()
    await user.click(checkbox)
    expect(checkbox).not.toBeChecked()
    await user.click(screen.getByText('Ana Pérez'))
    await user.click(screen.getByText('Ana Pérez'))
    expect(checkbox).not.toBeChecked()
  })

  it('no solicita temas durante el registro de asistencia', async () => {
    attendance()
    await screen.findByRole('button', { name: 'Guardar asistencia' })
    expect(screen.queryByText(/¿Se abordaron temas/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sí, se abordaron temas' })).not.toBeInTheDocument()
  })

  it('conserva el avance como borrador y lo recupera al volver', async () => {
    const user = userEvent.setup()
    const view = attendance()
    await user.click(await screen.findByRole('checkbox', { name: 'Presente: Ana Pérez' }))
    expect(sessionStorage.getItem(`attendance-draft:40:${today}`)).not.toBeNull()
    view.unmount()
    attendance()
    expect(await screen.findByRole('checkbox', { name: 'Presente: Ana Pérez' })).toBeChecked()
    expect(screen.queryByText(/Recuperamos/)).not.toBeInTheDocument()
  })

  it('abre las sesiones anteriores a hoy solo para consulta, sin poder modificarlas', async () => {
    const user = userEvent.setup()
    const saved = { id: 100, tutoring_id: 40, date: '2026-09-29', topics_covered: true, topics: [{ id: 90, name: 'Pruebas', is_active: true }], attendance: [{ id: 1, enrollment_id: 70, student_id: 80, student_name: 'Ana Pérez', present: false }] }
    vi.mocked(teacherApi.sessions).mockResolvedValue(paginated([saved]))
    workspace('attendance')
    expect(await screen.findByText('0 de 1 presentes')).toBeInTheDocument()
    await user.click(screen.getByText('0 de 1 presentes'))
    expect(await screen.findByText('Solo consulta')).toBeInTheDocument()
    expect(screen.getByText('Ausente')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Continuar|Guardar|Marcar todos/ })).not.toBeInTheDocument()
  })

  it('permite corregir la sesión de hoy con sus marcas guardadas', async () => {
    const saved = { id: 100, tutoring_id: 40, date: today, topics_covered: false, topics: [], attendance: [{ id: 1, enrollment_id: 70, student_id: 80, student_name: 'Ana Pérez', present: false }] }
    vi.mocked(teacherApi.sessions).mockResolvedValue(paginated([saved]))
    attendance()
    expect(await screen.findByText(/La lista de hoy ya se tomó/)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Presente: Ana Pérez' })).not.toBeChecked()
  })

  it('avisa que la lista de hoy ya se tomó y solo ofrece modificarla, sin registrar una segunda', async () => {
    const user = userEvent.setup()
    const saved = { id: 100, tutoring_id: 40, date: today, topics_covered: false, topics: [], attendance: [{ id: 1, enrollment_id: 70, student_id: 80, student_name: 'Ana Pérez', present: true }] }
    vi.mocked(teacherApi.sessions).mockResolvedValue(paginated([saved]))
    workspace('attendance')
    expect(await screen.findByText('La lista de hoy ya se tomó')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar asistencia' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Modificar lista de hoy' }))
    expect(await screen.findByRole('form', { name: 'Registrar asistencia' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Presente: Ana Pérez' })).toBeChecked()
  })

  it('ofrece registrar la asistencia cuando hoy todavía no se ha tomado lista', async () => {
    workspace('attendance')
    const register = await screen.findByRole('button', { name: 'Registrar asistencia' })
    // El botón se habilita cuando termina de comprobarse si hoy ya hay lista.
    await waitFor(() => expect(register).toBeEnabled())
    expect(screen.queryByText('La lista de hoy ya se tomó')).not.toBeInTheDocument()
  })

  it('muestra las dos secciones de asistencia, muestra el día en consultar y valida los días registrados en registrar', async () => {
    const user = userEvent.setup()
    const savedMonday = {
      id: 101,
      tutoring_id: 40,
      date: '2026-09-28',
      topics_covered: false,
      topics: [],
      attendance: [{ id: 1, enrollment_id: 70, student_id: 80, student_name: 'Ana Pérez', present: true }],
    }
    const tutoringWithSchedule: TeacherTutoring = {
      ...tutoring,
      schedules: [
        { id: 1, tutoring_id: 40, day: 'lunes', start_time: '08:00', end_time: '10:00', room: 'Aula 1', is_active: true },
      ],
    }
    vi.mocked(teacherApi.allTutorings).mockResolvedValue([tutoringWithSchedule])
    vi.mocked(teacherApi.sessions).mockResolvedValue(paginated([savedMonday]))

    workspace('attendance')

    // Pestañas / secciones visibles
    expect(await screen.findByRole('tab', { name: /Consultar asistencia/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Registrar asistencia/i })).toBeInTheDocument()

    // En consultar asistencia: muestra el día (Lunes), la fecha y el resumen
    const table = await screen.findByRole('table')
    expect(within(table).getByText('Lunes')).toBeInTheDocument()
    expect(within(table).getByText(/28 sept/i)).toBeInTheDocument()
    expect(within(table).getByText('1 de 1 presentes')).toBeInTheDocument()

    // Cambiar a la sección de registrar asistencia
    await user.click(screen.getByRole('tab', { name: /Registrar asistencia/i }))
    expect(await screen.findByRole('form', { name: 'Registrar asistencia' })).toBeInTheDocument()

    // Cambiar la fecha a un martes (no registrado en el horario)
    const dateInput = screen.getByLabelText(/Fecha de la sesión/i)
    fireEvent.change(dateInput, { target: { value: '2026-09-29' } })

    // Valida que no coincide con los días registrados y bloquea guardar
    expect(await screen.findByText(/La fecha seleccionada corresponde a un/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar asistencia' })).toBeDisabled()
  })

  it('registra un tema nuevo en contenido solicitando solo el nombre, sin campo de descripción', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.createTopic).mockResolvedValue({ ...topic, id: 95, name: 'Introducción' })
    workspace('content')
    await user.click(await screen.findByRole('button', { name: 'Registrar tema' }))
    expect(screen.queryByLabelText(/Descripción/i)).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Nombre'), 'Introducción')
    await user.click(within(screen.getByRole('form', { name: 'Registrar tema' })).getByRole('button', { name: 'Registrar tema' }))
    await waitFor(() => expect(teacherApi.createTopic).toHaveBeenCalledWith(40, { name: 'Introducción', description: '' }))
  })

  it('permite al docente marcar un tema como completado o pendiente directamente desde la tabla', async () => {
    const user = userEvent.setup()
    let currentTopic = { ...topic, is_covered: false }
    vi.mocked(teacherApi.topics).mockImplementation(async () => paginated([currentTopic]))
    vi.mocked(teacherApi.toggleTopicCovered).mockImplementation(async (_tutoringId, _topicId, isCovered) => {
      currentTopic = { ...currentTopic, is_covered: Boolean(isCovered) }
      return currentTopic
    })
    workspace('content')
    await screen.findByText('Pruebas')
    expect(screen.getByRole('button', { name: /Marcar completado/i })).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Marcar completado/i }))
    await waitFor(() => expect(teacherApi.toggleTopicCovered).toHaveBeenCalledWith(40, 90, true))
    expect(await screen.findByRole('button', { name: /Marcar pendiente/i })).toBeInTheDocument()
    expect(await screen.findByText('Completado')).toBeInTheDocument()
  })

  it('recorre temas, actividades y metodologías con formularios integrados', async () => {
    const user = userEvent.setup()
    let topics = [topic]
    vi.mocked(teacherApi.topics).mockImplementation(async () => paginated(topics))
    vi.mocked(teacherApi.createActivity).mockImplementation(async () => {
      const activity = { id: 91, topic_id: 90, name: 'Diseñar casos', duration: '30 minutos', is_active: true, methodologies: [] }
      topics = [{ ...topic, activities: [activity] }]
      return activity
    })
    vi.mocked(teacherApi.createMethodology).mockImplementation(async () => {
      const method = { id: 92, activity_id: 91, description: 'Trabajo colaborativo', is_active: true }
      topics = [{ ...topics[0], activities: [{ ...topics[0].activities[0], methodologies: [method] }] }]
      return method
    })
    workspace('content')
    await user.click(await screen.findByRole('button', { name: 'Actividades' }))
    await user.click(screen.getByRole('button', { name: 'Registrar actividad' }))
    await user.type(screen.getByLabelText('Nombre'), 'Diseñar casos')
    await user.click(screen.getByRole('button', { name: '30m' }))
    await user.click(within(screen.getByRole('form', { name: 'Registrar actividad' })).getByRole('button', { name: 'Registrar actividad' }))
    await user.click(await screen.findByRole('button', { name: 'Metodologías' }))
    await user.click(screen.getByRole('button', { name: 'Registrar metodología' }))
    await user.type(screen.getByLabelText('Descripción'), 'Trabajo colaborativo')
    await user.click(within(screen.getByRole('form', { name: 'Registrar metodología' })).getByRole('button', { name: 'Registrar metodología' }))
    expect(await screen.findByText('Trabajo colaborativo')).toBeInTheDocument()
    expect(teacherApi.createMethodology).toHaveBeenCalledWith(40, 90, 91, { description: 'Trabajo colaborativo' })
  })

  it('envía el informe y permite leer el consolidado que devolvió el servidor', async () => {
    const user = userEvent.setup()
    const report = { id: 110, type: 'Informe de tutorías', author_id: 5, author_name: 'María López', generated_at: '2026-09-29T12:00:00Z', content: 'Estudiantes inscritos: 1\nObservaciones: Avance favorable.', summary: null }
    vi.mocked(teacherApi.sendReport).mockImplementation(async () => { vi.mocked(teacherApi.reports).mockResolvedValue(paginated([report])); return report })
    show(<TeacherReportsStandalonePage />)
    await user.click(await screen.findByRole('button', { name: /Ver informes de Calidad de software/i }))
    await user.click(await screen.findByRole('button', { name: 'Enviar informe' }))
    await user.type(screen.getByLabelText('Resultados y observaciones'), 'Avance favorable.')
    await user.click(within(screen.getByRole('form', { name: 'Enviar informe al coordinador' })).getByRole('button', { name: 'Enviar informe' }))
    await user.click(await screen.findByRole('button', { name: 'Leer informe' }))
    expect(screen.getByRole('article', { name: 'Contenido del informe' })).toHaveTextContent('Estudiantes inscritos: 1')
    expect(teacherApi.sendReport).toHaveBeenCalledWith(40, { title: 'Informe de tutorías', observations: 'Avance favorable.' })
  })

  it('permite revisar las actividades y estudiantes presentes en la pestaña Revisión de actividades de informes', async () => {
    const user = userEvent.setup()
    const session = {
      id: 50,
      tutoring_id: 40,
      date: '2026-10-03',
      topics_covered: true,
      topics: [{ id: 1, name: 'Arquitectura', is_active: true }],
      activities: [
        {
          id: 10,
          topic_id: 1,
          topic_name: 'Arquitectura',
          name: 'Diseño de microservicios',
          duration: '45 minutos',
          methodologies: ['Exposición dialogada'],
        },
      ],
      attendance: [
        {
          id: 1,
          enrollment_id: 70,
          student_id: 80,
          student_name: 'Ana Pérez',
          student_identification: '0201112233',
          student_email: 'ana.perez@ueb.edu.ec',
          present: true,
        },
        {
          id: 2,
          enrollment_id: 71,
          student_id: 81,
          student_name: 'Carlos Ausente',
          student_identification: '0209998877',
          student_email: 'carlos@ueb.edu.ec',
          present: false,
        },
      ],
    }
    vi.mocked(teacherApi.sessions).mockResolvedValue(paginated([session]))
    show(<TeacherReportsStandalonePage />)
    await user.click(await screen.findByRole('button', { name: /Ver informes de Calidad de software/i }))

    // Cambiar a la pestaña de Revisión de actividades
    await user.click(screen.getByRole('tab', { name: /Revisión de actividades/i }))
    expect(await screen.findByText('Fechas de tutorías con asistencia registrada')).toBeInTheDocument()

    // Comprobar que aparece la sesión con su día y resumen
    expect(screen.getByText('Sábado')).toBeInTheDocument()
    expect(screen.getByText(/1 de 2 presentes/i)).toBeInTheDocument()
    expect(screen.getByText(/1 actividad/i)).toBeInTheDocument()

    // Abrir la sesión para revisar
    await user.click(screen.getByRole('button', { name: /Revisar actividades del/i }))

    // Comprobar detalle de actividades realizadas
    expect(await screen.findByText('Diseño de microservicios')).toBeInTheDocument()
    expect(screen.getByText(/Tema: Arquitectura/)).toBeInTheDocument()
    expect(screen.getByText('45 minutos')).toBeInTheDocument()
    expect(screen.getByText('Exposición dialogada')).toBeInTheDocument()

    // Comprobar que solo los estudiantes presentes se listan como asistentes
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('0201112233 · ana.perez@ueb.edu.ec')).toBeInTheDocument()
    expect(screen.queryByText('Carlos Ausente')).not.toBeInTheDocument()

    // Volver a la lista
    await user.click(screen.getByRole('button', { name: /Volver a las fechas de tutoría/i }))
    expect(await screen.findByText('Fechas de tutorías con asistencia registrada')).toBeInTheDocument()
  })

  it('mantiene la tutoría inactiva en consulta', async () => {
    vi.mocked(teacherApi.allTutorings).mockResolvedValue([{ ...tutoring, can_manage: false }])
    workspace('students')
    expect(await screen.findByText(/Puedes consultar su historial/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar estudiante' })).toBeDisabled()
  })

  it('consulta titulación con filtro por participación y sin acciones de aprobación', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.degreeAssignments).mockResolvedValue(paginated([{ id: 120, role: 'tutor', assigned_at: '2026-09-29', topic: { id: 130, title: 'Calidad en APIs', description: 'Investigación de calidad.', status: 'aprobado' }, student: { id: 80, name: 'Ana Pérez', email: 'ana.perez@ueb.edu.ec' }, period: { id: 50, name: '2026-2' } }]))
    show(<TeacherDegreeAssignmentsPage />)
    await screen.findByText('Calidad en APIs')
    await user.click(screen.getByRole('button', { name: /Filtros/ }))
    await user.selectOptions(screen.getByLabelText('Participación'), 'par_academico')
    await waitFor(() => expect(teacherApi.degreeAssignments).toHaveBeenLastCalledWith({ page: 1, search: '', role: 'par_academico' }))
    await user.click(screen.getByRole('button', { name: 'Ver resultados' }))
    expect(screen.getByText(/Participación: Par académico/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver detalle de Calidad en APIs' }))
    expect(await screen.findByText('Investigación de calidad.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Aprobar|Rechazar/ })).not.toBeInTheDocument()
  })

  it('permite al docente consultar el seguimiento de sus temas asignados y registrar tareas', async () => {
    const user = userEvent.setup()
    const mockTopic = {
      id: 130,
      title: 'Desarrollo de Software Seguro',
      description: 'Investigación sobre ciberseguridad',
      status: 'aprobado' as const,
      proposed_at: '2026-09-01',
      reviewed_at: '2026-09-10',
      section: null,
      reviewer: null,
      student: { id: 80, name: 'Ana Pérez', identification: '0201234567', email: 'ana.perez@ueb.edu.ec', phone: null },
      academic_period: { id: 50, name: '2026-2', is_active: true },
      assignments: [
        { id: 1, role: 'tutor' as const, assigned_at: '2026-09-10', teacher: { id: 5, name: 'María López', email: 'maria.lopez@ueb.edu.ec' } },
        { id: 2, role: 'par_academico' as const, assigned_at: '2026-09-10', teacher: { id: 6, name: 'Carlos Par', email: 'carlos.par@ueb.edu.ec' } },
      ],
      observations: [],
      tracking: {
        id: 10,
        opened_at: '2026-10-01',
        progress_percentage: 50,
        status: 'en_progreso',
        activities: [
          {
            id: 201,
            description: 'Redactar introducción y objetivos',
            is_completed: false,
            registered_at: '2026-10-02',
            teacher: { id: 5, name: 'María López', email: 'maria.lopez@ueb.edu.ec', role: 'tutor' },
          },
          {
            id: 202,
            description: 'Revisión por par académico',
            is_completed: false,
            registered_at: '2026-10-02',
            teacher: { id: 6, name: 'Carlos Par', email: 'carlos.par@ueb.edu.ec', role: 'par_academico' },
          },
        ],
      },
    }

    vi.mocked(teacherApi.degreeTracking).mockResolvedValue(paginated([mockTopic]))
    vi.mocked(teacherApi.degreeTrackingTopic).mockResolvedValue(mockTopic)

    show(<TeacherDegreeTrackingPage />)

    // Debe mostrar el tema en la tabla
    expect(await screen.findByText('Desarrollo de Software Seguro')).toBeInTheDocument()
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()

    // Abrir seguimiento: muestra pestañas "Estado de la Ficha", "Equipo de Titulación", "Tareas"
    await user.click(screen.getByRole('button', { name: 'Seguimiento' }))
    expect(await screen.findByText('Estado de la Ficha de Seguimiento')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Estado de la Ficha/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Equipo de Titulación/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Tareas/i })).toBeInTheDocument()

    // Cambiar a la pestaña Equipo de Titulación
    await user.click(screen.getByRole('tab', { name: /Equipo de Titulación/i }))
    expect(await screen.findByText('Carlos Par')).toBeInTheDocument()

    // Cambiar a la pestaña Tareas
    await user.click(screen.getByRole('tab', { name: /Tareas/i }))
    expect(await screen.findByText(/Redactar introducción y objetivos/)).toBeInTheDocument()
    expect(screen.getByText(/Revisión por par académico/)).toBeInTheDocument()

    // Para la tarea propia (201), el botón de marcar como completada está disponible
    vi.mocked(teacherApi.toggleDegreeTrackingActivity).mockResolvedValue({
      data: { id: 201, is_completed: true, progress_percentage: 75 },
      message: 'Actualizado',
    })
    const ownToggleBtn = screen.getByRole('button', { name: 'Marcar como completada' })
    await user.click(ownToggleBtn)
    expect(teacherApi.toggleDegreeTrackingActivity).toHaveBeenCalledWith(130, 201, true)

    // Registrar nueva tarea
    await user.click(screen.getByRole('button', { name: /Asignar tarea \/ actividad/i }))
    expect(screen.getByText('Asignar nueva tarea de seguimiento')).toBeInTheDocument()
    const input = screen.getByLabelText(/Descripción de la tarea o entrega/i)
    await user.type(input, 'Entregar marco teórico')

    vi.mocked(teacherApi.addDegreeTrackingActivity).mockResolvedValue({
      id: 203,
      description: 'Entregar marco teórico',
      is_completed: false,
      registered_at: '2026-10-03',
    })

    await user.click(screen.getByRole('button', { name: 'Registrar tarea' }))
    await waitFor(() => {
      expect(teacherApi.addDegreeTrackingActivity).toHaveBeenCalledWith(130, {
        descripcion: 'Entregar marco teórico',
      })
    })
  })
})
