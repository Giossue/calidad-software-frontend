import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast as sonnerToast } from 'sonner'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import type { DiagnosticReportSummary } from '@/lib/diagnostic-report'
import type { FinalPaoReportSummary } from '@/lib/final-pao-report'
import type { FollowUpReportSummary } from '@/lib/follow-up-report'
import { teacherApi, type Enrollment, type TeacherTutoring, type TutoringTopic } from '@/lib/teacher-api'
import { dashboardSection } from '@/features/tutoring/tutoring-navigation'
import { TeacherDegreeAssignmentsPage } from './teacher-degree-assignments-page'
import { TeacherDegreeTrackingPage } from './teacher-degree-tracking-page'
import { TeacherReportsStandalonePage } from './teacher-reports-standalone-page'
import { TeacherTutoringsPage } from './teacher-tutorings-page'
import { formatDate } from '@/lib/format'

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({
    user: { id: 5, name: 'María López', role: 'docente', email: 'maria.lopez@ueb.edu.ec' },
  }),
}))

vi.mock('@/lib/teacher-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/teacher-api')>()
  return { ...actual, teacherApi: Object.fromEntries(Object.keys(actual.teacherApi).map((key) => [key, vi.fn()])) }
})

const tutoring: TeacherTutoring = { id: 40, subject_id: 30, subject_name: 'Calidad de software', cycle_id: 20, cycle_name: 'Segundo', career_id: 10, career_name: 'Software', period_id: 50, period_name: '2026-2', period_start_date: '2026-01-01', period_end_date: '2099-12-31', modality_id: 60, modality_name: 'Presencial', section_id: 1, section_name: 'A', teacher_id: 5, teacher_name: 'María López', teacher_is_active: true, is_active: true, can_manage: true, active_enrollment_count: 1, schedules: [] }
const student: Enrollment = { id: 70, tutoring_id: 40, student_id: 80, identification: '0201234567', name: 'Ana Pérez', email: 'ana.perez@ueb.edu.ec', phone: '0991234567', enrolled_at: '2026-09-29', is_active: true, student_is_active: true, can_edit_profile: true, diagnostic_grade: null, partial_grade: null, second_partial_grade: null, knowledge_group: null, knowledge_group_key: null, enrollment_number: 1, attendance_required: false }
const topic: TutoringTopic = { id: 90, tutoring_id: 40, name: 'Pruebas', description: 'Casos de prueba', is_active: true, is_covered: false, activities: [] }
function paginated<T>(data: readonly T[], page = 1, last = 1) {
  return { data, meta: { current_page: page, last_page: last, per_page: 15, total: data.length, from: data.length ? 1 : null, to: data.length || null, active_count: data.length, inactive_count: 0 } }
}
// Los selects son de shadcn (Radix): se abren y se elige la opción por su texto.
async function choose(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, option: RegExp | string) {
  await user.click(trigger)
  await user.click(await screen.findByRole('option', { name: option }))
}
// Etapa de calificación: un desplegable que indica si cada etapa está completa o pendiente.
async function pickStage(user: ReturnType<typeof userEvent.setup>, stage: RegExp | string) {
  await user.click(await screen.findByRole('combobox', { name: 'Etapa' }))
  await user.click(await screen.findByRole('option', { name: stage }))
}
// Botón «atrás» del navegador: vuelve a la entrada anterior del historial.
function BrowserBack() {
  const navigate = useNavigate()
  return <button type="button" onClick={() => navigate(-1)}>Atrás del navegador</button>
}
function show(component: React.ReactNode, path = '/panel/teacher-tutorings?tutoring=40&tab=students') {
  return render(<MemoryRouter initialEntries={[path]}>{component}<BrowserBack /></MemoryRouter>)
}

const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
const todayName = DAY_NAMES[new Date().getDay()]
// Una semana atrás: el mismo día de la semana que hoy, con clase.
const lastWeek = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
/** Nombre accesible del día en el calendario: «lunes 28 de septiembre de 2026». */
function dayLabel(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return `${WEEKDAY_NAMES[new Date(year, month - 1, day).getDay()]} ${day} de ${MONTH_NAMES[month - 1]} de ${year}`
}
// Clase todo el día de hoy (y cada semana ese mismo día).
const inClass: TeacherTutoring = { ...tutoring, schedules: [{ id: 9, tutoring_id: 40, day: todayName, start_time: '00:00', end_time: '23:59', room: 'Aula 1', is_active: true }] }

function duringClass() {
  vi.mocked(teacherApi.tutorings).mockResolvedValue(paginated([inClass]))
  vi.mocked(teacherApi.allTutorings).mockResolvedValue([inClass])
}

function attendance() {
  duringClass()
  return show(<TeacherTutoringsPage />, `/panel/teacher-tutorings?tutoring=40&tab=attendance&session=${today}`)
}

function workspace(tab: string) {
  return show(<TeacherTutoringsPage />, `/panel/teacher-tutorings?tutoring=40&tab=${tab}`)
}

/** Despliega un tema de la sesión para ver sus actividades y metodologías en la misma pantalla. */
async function expandTopic(user: ReturnType<typeof userEvent.setup>, name: string) {
  const section = await screen.findByRole('region', { name: `Tema ${name}` }, { timeout: 5000 })
  await user.click(within(section).getByRole('button', { expanded: false }))
  return section
}

/** Contenido abierto en la fila «Temas sin sesión» (donde quedan los temas aún no tratados). */
function contentWithoutSession() {
  return show(<TeacherTutoringsPage />, '/panel/teacher-tutorings?tutoring=40&tab=content&content-session=none')
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
  vi.mocked(teacherApi.allSessions).mockResolvedValue([])
  vi.mocked(teacherApi.absenceNotices).mockResolvedValue([])
  vi.mocked(teacherApi.jointTutorings).mockResolvedValue([])
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
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }))
    await waitFor(() => expect(teacherApi.tutorings).toHaveBeenLastCalledWith({ page: 2, search: '', status: undefined }))
    // «Limpiar» borra la búsqueda junto con los filtros.
    await user.type(screen.getByLabelText('Buscar'), 'calidad')
    await choose(user, screen.getByLabelText('Filtrar por Estado'), 'En curso')
    await user.click(await screen.findByRole('button', { name: 'Limpiar' }))
    expect(screen.getByLabelText('Buscar')).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Limpiar' })).not.toBeInTheDocument()
    await user.click(screen.getByText('Calidad de software'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Calidad de software' })).toBeInTheDocument()
    // Abre en Asistencia; las pestañas van en el orden de trabajo del docente, en un solo nivel.
    const sections = screen.getByRole('tablist', { name: 'Secciones de la tutoría' })
    expect(within(sections).getAllByRole('tab').map((item) => item.textContent)).toEqual(['Asistencia', 'Contenido', 'Horarios', 'Estudiantes', 'Calificaciones', 'Informes'])
    expect(within(sections).getByRole('tab', { name: 'Asistencia' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByRole('tablist')).toHaveLength(1)
    await user.click(within(sections).getByRole('tab', { name: 'Estudiantes' }))
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument()
    expect(teacherApi.students).toHaveBeenLastCalledWith(40, { page: 1, search: '', status: undefined })
    expect(screen.getAllByRole('tablist')).toHaveLength(1)
    await user.click(within(sections).getByRole('tab', { name: 'Calificaciones' }))
    expect(await screen.findByRole('tab', { name: 'Calificaciones', selected: true })).toBeInTheDocument()
    expect(await screen.findByRole('combobox', { name: 'Etapa' })).toBeInTheDocument()
  })

  it('mientras carga la tutoría y luego sus notas, muestra esqueletos con la forma de cada pantalla', async () => {
    let resolveTutorings: (value: TeacherTutoring[]) => void = () => undefined
    vi.mocked(teacherApi.allTutorings).mockReturnValue(new Promise((resolve) => { resolveTutorings = resolve }))
    vi.mocked(teacherApi.allStudents).mockReturnValue(new Promise(() => {}))
    workspace('grades')
    const workspaceLoading = await screen.findByRole('status', { name: 'Cargando tutoría' })
    expect(workspaceLoading.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(10)
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    await act(async () => resolveTutorings([tutoring]))
    const gradesLoading = await screen.findByRole('status', { name: 'Cargando calificaciones' })
    expect(gradesLoading.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(10)
    expect(screen.getByRole('tab', { name: 'Calificaciones' })).toHaveAttribute('aria-selected', 'true')
  })

  it('registra el resultado final en Calificaciones, junto a las notas, con la sugerencia según los parciales', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.allStudents).mockResolvedValue([{ ...student, final_result: null, suggested_result: 'approved' }])
    vi.mocked(teacherApi.setFinalResult).mockResolvedValue({ ...student, final_result: 'approved' })
    workspace('grades')
    expect(await screen.findByText('Sugerido: Aprobó')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Resultado final' })).toBeInTheDocument()
    await choose(user, screen.getByLabelText('Resultado final de Ana Pérez'), 'Aprobó')
    await waitFor(() => expect(teacherApi.setFinalResult).toHaveBeenCalledWith(40, student.id, 'approved'))
  })

  it('cambia de sección dentro de la misma tutoría sin volver a elegirla', async () => {
    const user = userEvent.setup()
    workspace('students')
    await screen.findByText('Ana Pérez')
    expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent('#')
    await user.click(screen.getByRole('tab', { name: 'Calificaciones' }))
    expect(await screen.findByRole('columnheader', { name: '#' })).toBeInTheDocument()
    expect(await screen.findByRole('combobox', { name: 'Etapa' })).toBeInTheDocument()
    expect(teacherApi.allStudents).toHaveBeenLastCalledWith(40)
    await user.click(screen.getByRole('tab', { name: 'Horarios' }))
    expect(await screen.findByText('Sin horarios registrados')).toBeInTheDocument()
    expect(teacherApi.allTutorings).toHaveBeenCalledTimes(1)
  })

  it('el docente edita el horario con filas (día, desde, hasta) y no puede guardarlo vacío', async () => {
    const user = userEvent.setup()
    const updatedSchedule = { id: 1, tutoring_id: 40, day: 'martes', start_time: '09:00', end_time: '11:00', room: 'Por asignar', is_active: true }
    vi.mocked(teacherApi.syncSchedules).mockImplementation(async () => {
      vi.mocked(teacherApi.allTutorings).mockResolvedValue([{ ...tutoring, schedules: [updatedSchedule] }])
      return [updatedSchedule]
    })
    workspace('schedules')
    expect(await screen.findByText('Sin horarios registrados')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Editar horarios' }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar horarios de tutoría' })
    const form = within(dialog).getByRole('form')
    // Sin casillas de días: filas con «Agregar horario». Sin filas, «Guardar» se bloquea.
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument()
    const addButton = within(dialog).getByRole('button', { name: 'Agregar horario' })
    const field = addButton.closest('[data-slot="field"]') as HTMLElement
    expect(field).toHaveTextContent('(obligatorio)')
    const save = within(dialog).getByRole('button', { name: 'Guardar horarios' })
    expect(save).toBeDisabled()
    expect(within(dialog).queryByText('Agrega al menos un horario para la tutoría.')).not.toBeInTheDocument()
    await user.hover(save.parentElement as HTMLElement)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Agrega al menos un horario para la tutoría.')
    fireEvent.submit(form)
    expect(await within(field).findByText('Agrega al menos un horario para la tutoría.')).toBeInTheDocument()
    expect(teacherApi.syncSchedules).not.toHaveBeenCalled()

    await user.click(addButton)
    await choose(user, within(dialog).getByLabelText('Día'), 'Martes')
    await choose(user, within(dialog).getByLabelText('Hora de inicio'), '09:00')
    await choose(user, within(dialog).getByLabelText('Hora de fin'), '11:00')
    expect(within(dialog).getByRole('button', { name: 'Quitar horario' })).toBeInTheDocument()

    const success = vi.spyOn(sonnerToast, 'success')
    await user.click(save)
    await waitFor(() => expect(success.mock.calls.at(-1)?.[0]).toMatch(/^Horarios de tutoría actualizados\.?$/))
    expect(teacherApi.syncSchedules).toHaveBeenCalledWith(40, [
      { day: 'martes', start_time: '09:00', end_time: '11:00', room: 'Por asignar' },
    ])
    expect(await screen.findByText('09:00 – 11:00')).toBeInTheDocument()
  })

  it('el horario quitado por error desaparece de la tabla y solo se listan los vigentes', async () => {
    const user = userEvent.setup()
    const tuesday = { id: 8, tutoring_id: 40, day: 'martes', start_time: '08:00:00', end_time: '10:00:00', room: 'Aula 2', is_active: true }
    const monday = { id: 9, tutoring_id: 40, day: 'lunes', start_time: '10:00:00', end_time: '12:00:00', room: 'Aula 1', is_active: true }
    const removed = { ...tuesday, is_active: false }
    vi.mocked(teacherApi.allTutorings).mockResolvedValue([{ ...tutoring, schedules: [tuesday, monday] }])
    vi.mocked(teacherApi.syncSchedules).mockImplementation(async () => {
      vi.mocked(teacherApi.allTutorings).mockResolvedValue([{ ...tutoring, schedules: [removed, monday] }])
      return [monday]
    })
    workspace('schedules')
    expect(await screen.findByText('08:00 – 10:00')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Editar horarios' }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar horarios de tutoría' })
    // Filas ordenadas por día: Lunes, Martes. Se quita el martes ingresado por error.
    await user.click(within(dialog).getAllByRole('button', { name: 'Quitar horario' })[1])
    await user.click(within(dialog).getByRole('button', { name: 'Guardar horarios' }))

    await waitFor(() => expect(teacherApi.syncSchedules).toHaveBeenCalledWith(40, [
      { day: 'lunes', start_time: '10:00', end_time: '12:00', room: 'Aula 1' },
    ]))
    await waitFor(() => expect(screen.queryByText('08:00 – 10:00')).not.toBeInTheDocument())
    expect(screen.getByText('10:00 – 12:00')).toBeInTheDocument()
    expect(screen.queryByText('Inactivo')).not.toBeInTheDocument()
  })

  it('al editar el horario conserva el aula de cada día y envía lo mismo que antes', async () => {
    const user = userEvent.setup()
    const monday = { id: 9, tutoring_id: 40, day: 'lunes', start_time: '08:00:00', end_time: '10:00:00', room: 'Aula 1', is_active: true }
    vi.mocked(teacherApi.allTutorings).mockResolvedValue([{ ...tutoring, schedules: [monday] }])
    vi.mocked(teacherApi.syncSchedules).mockResolvedValue([monday])
    workspace('schedules')
    await user.click(await screen.findByRole('button', { name: 'Editar horarios' }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar horarios de tutoría' })
    expect(within(dialog).getByLabelText('Día')).toHaveTextContent('Lunes')
    expect(within(dialog).getByLabelText('Hora de inicio')).toHaveTextContent('08:00')
    await user.click(within(dialog).getByRole('button', { name: 'Agregar horario' }))
    // Un día ya usado no se ofrece en otra fila.
    await user.click(within(dialog).getByLabelText('Día (horario 2)'))
    expect(await screen.findByRole('option', { name: 'Lunes' })).toHaveAttribute('aria-disabled', 'true')
    await user.click(screen.getByRole('option', { name: 'Jueves' }))
    await choose(user, within(dialog).getByLabelText('Hora de inicio (horario 2)'), '14:00')
    await choose(user, within(dialog).getByLabelText('Hora de fin (horario 2)'), '16:00')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar horarios' }))
    await waitFor(() => expect(teacherApi.syncSchedules).toHaveBeenCalledWith(40, [
      { day: 'lunes', start_time: '08:00', end_time: '10:00', room: 'Aula 1' },
      { day: 'jueves', start_time: '14:00', end_time: '16:00', room: 'Por asignar' },
    ]))
  })

  it('avisa en la tutoría y en «Mis tutorías» cuando aún no tiene horario', async () => {
    const user = userEvent.setup()
    const scheduled = { ...tutoring, id: 41, subject_name: 'Redes', schedules: [{ id: 9, tutoring_id: 41, day: 'lunes', start_time: '08:00:00', end_time: '10:00:00', room: 'Aula 1', is_active: true }] }
    vi.mocked(teacherApi.tutorings).mockResolvedValue(paginated([tutoring, scheduled]))
    show(<TeacherTutoringsPage />, '/panel/teacher-tutorings')
    await screen.findByText('Calidad de software')
    expect(screen.getByRole('columnheader', { name: 'Horario' })).toBeInTheDocument()
    expect(screen.getByText('Sin horario')).toBeInTheDocument()
    expect(screen.getByText('Lunes 08:00 – 10:00')).toBeInTheDocument()

    await user.click(screen.getByText('Calidad de software'))
    await screen.findByRole('heading', { level: 1, name: 'Calidad de software' })
    const notice = screen.getByText(/Esta tutoría aún no tiene horario: defínelo en/)
    await user.click(within(notice).getByRole('button', { name: 'Horarios' }))
    expect(await screen.findByRole('tab', { name: 'Horarios', selected: true })).toBeInTheDocument()
    expect(screen.queryByText(/Esta tutoría aún no tiene horario/)).not.toBeInTheDocument()
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
    const form = screen.getByRole('form', { name: 'Registrar estudiante' })
    await user.click(within(form).getByLabelText(/^Estudiante/))
    await user.click(await screen.findByRole('option', { name: /Ana Pérez/ }))
    fireEvent.submit(form); fireEvent.submit(form)
    expect(teacherApi.enrollStudent).toHaveBeenCalledTimes(1)
    expect(teacherApi.enrollStudent).toHaveBeenCalledWith(40, { student_id: 80, enrollment_number: 1 })
    await act(async () => reject(new ApiError(422, { message: 'No se pudo inscribir.', errors: { student_id: ['El estudiante ya está inscrito.'] } })))
    expect(await screen.findByText('El estudiante ya está inscrito.')).toBeInTheDocument()
    expect(within(form).getByLabelText(/^Estudiante/)).toHaveValue('Ana Pérez')
    expect(within(form).getByRole('button', { name: 'Inscribir estudiante' })).toBeEnabled()
  })

  it('separa claramente inscribir a un estudiante ya registrado de crear uno nuevo', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.enrollStudent).mockResolvedValue(student)
    workspace('students')
    await user.click(await screen.findByRole('button', { name: 'Registrar estudiante' }))
    const form = screen.getByRole('form', { name: 'Registrar estudiante' })
    expect(within(form).getByRole('button', { name: 'Inscribir estudiante' })).toBeDisabled()
    expect(within(form).queryByLabelText(/^Cédula o pasaporte/)).not.toBeInTheDocument()

    await user.click(within(form).getByRole('tab', { name: 'Estudiante nuevo' }))
    expect(within(form).queryByLabelText(/^Estudiante/)).not.toBeInTheDocument()
    // Lo que exige el registro lleva asterisco; el teléfono es opcional.
    for (const field of ['Cédula o pasaporte', 'Nombres', 'Apellidos', 'Correo institucional']) {
      expect(within(within(form).getByText(field).closest('label') as HTMLElement).getByText('(obligatorio)')).toBeInTheDocument()
    }
    expect(within(within(form).getByText('Teléfono').closest('label') as HTMLElement).queryByText('(obligatorio)')).not.toBeInTheDocument()
    await user.type(within(form).getByLabelText(/Cédula/i), '0201234564')
    await user.type(within(form).getByLabelText(/^Nombres/), 'Luis  Alberto ')
    await user.type(within(form).getByLabelText(/^Apellidos/), 'Mora Vera')
    await user.type(within(form).getByLabelText(/Correo Institucional/i), 'luis.mora@ueb.edu.ec')
    await user.click(within(form).getByRole('button', { name: 'Crear e inscribir' }))
    await waitFor(() => expect(teacherApi.enrollStudent).toHaveBeenCalledWith(40, { identification: '0201234564', first_names: 'Luis Alberto', last_names: 'Mora Vera', email: 'luis.mora@ueb.edu.ec', phone: null, enrollment_number: 1 }))
  })

  it('en «Estudiante nuevo» pide Nombres y luego Apellidos, con uno o dos de cada uno', async () => {
    const user = userEvent.setup()
    workspace('students')
    await user.click(await screen.findByRole('button', { name: 'Registrar estudiante' }))
    const form = screen.getByRole('form', { name: 'Registrar estudiante' })
    await user.click(within(form).getByRole('tab', { name: 'Estudiante nuevo' }))
    const [first, second] = within(form).getAllByRole('textbox')
    expect(first).toHaveAccessibleName(/^Nombres/)
    expect(second).toHaveAccessibleName(/^Apellidos/)
    expect(within(form).queryByLabelText(/^Nombres y apellidos/)).not.toBeInTheDocument()
    await user.type(within(form).getByLabelText(/^Cédula o pasaporte/), '0201234564')
    await user.type(within(form).getByLabelText(/^Correo institucional/), 'luis.mora@ueb.edu.ec')
    const submit = within(form).getByRole('button', { name: 'Crear e inscribir' })

    // Vacíos: al salir del campo se avisa que son obligatorios.
    await user.click(first); await user.click(second); await user.tab()
    expect(within(form).getByText('Los nombres son obligatorios.')).toBeInTheDocument()
    expect(within(form).getByText('Los apellidos son obligatorios.')).toBeInTheDocument()
    expect(submit).toBeDisabled()

    await user.type(first, 'Luis Alberto José')
    await user.type(second, 'Mora Vera Paz')
    expect(within(form).getByText('Ingresa uno o dos nombres.')).toBeInTheDocument()
    expect(within(form).getByText('Ingresa tus dos apellidos, o uno solo si tu registro civil tiene un único apellido.')).toBeInTheDocument()
    expect(submit).toBeDisabled()

    // Un solo apellido es la excepción admitida.
    await user.clear(first); await user.type(first, 'Luis')
    await user.clear(second); await user.type(second, 'Mora')
    expect(submit).toBeEnabled()
    await user.click(submit)
    await waitFor(() => expect(teacherApi.enrollStudent).toHaveBeenCalledWith(40, { identification: '0201234564', first_names: 'Luis', last_names: 'Mora', email: 'luis.mora@ueb.edu.ec', phone: null, enrollment_number: 1 }))
  })

  it('en «Estudiante nuevo» pide primero el nombre, avisa la cédula inválida bajo el campo y devuelve el foco al botón al crear', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.enrollStudent).mockResolvedValue(student)
    workspace('students')
    const trigger = await screen.findByRole('button', { name: 'Registrar estudiante' })
    await user.click(trigger)
    const form = screen.getByRole('form', { name: 'Registrar estudiante' })
    await user.click(within(form).getByRole('tab', { name: 'Estudiante nuevo' }))
    expect(within(form).getAllByRole('textbox')[0]).toHaveAccessibleName(/^Nombres/)
    const cedula = within(form).getByLabelText(/^Cédula o pasaporte/)
    await user.type(cedula, '123')
    await user.tab()
    expect(within(form).getByText('La cédula o pasaporte no es válido.')).toBeInTheDocument()
    expect(cedula).toHaveAttribute('aria-invalid', 'true')
    await user.clear(cedula)
    await user.type(cedula, '0201234564')
    await user.type(within(form).getByLabelText(/^Nombres/), 'Luis')
    await user.type(within(form).getByLabelText(/^Apellidos/), 'Mora')
    await user.type(within(form).getByLabelText(/^Correo institucional/), 'luis.mora@ueb.edu.ec')
    await user.click(within(form).getByRole('button', { name: 'Crear e inscribir' }))
    await waitFor(() => expect(form).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('muestra bajo su campo el error del servidor sobre la cédula o el correo', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.enrollStudent).mockRejectedValue(new ApiError(422, { message: 'El correo ya está registrado.', errors: { email: ['El correo ya está registrado.'] } }))
    workspace('students')
    await user.click(await screen.findByRole('button', { name: 'Registrar estudiante' }))
    const form = screen.getByRole('form', { name: 'Registrar estudiante' })
    await user.click(within(form).getByRole('tab', { name: 'Estudiante nuevo' }))
    await user.type(within(form).getByLabelText(/^Nombres/), 'Luis')
    await user.type(within(form).getByLabelText(/^Apellidos/), 'Mora')
    await user.type(within(form).getByLabelText(/^Cédula o pasaporte/), '0201234564')
    const email = within(form).getByLabelText(/^Correo institucional/)
    await user.type(email, 'luis.mora@ueb.edu.ec')
    await user.click(within(form).getByRole('button', { name: 'Crear e inscribir' }))
    const message = await within(form).findByText('El correo ya está registrado.')
    expect(message.closest('[data-slot="field"]')).toContainElement(email)
    expect(within(form).getAllByText('El correo ya está registrado.')).toHaveLength(1)
    expect(email).toHaveAttribute('aria-invalid', 'true')
  })

  it('la fila abre la inscripción del estudiante, sin notas: se registran en «Calificaciones»', async () => {
    const user = userEvent.setup()
    workspace('students')
    expect(screen.queryByRole('button', { name: /Editar datos de/i })).not.toBeInTheDocument()
    // La fila abre la inscripción: no hay columna de íconos sueltos.
    await user.click(await screen.findByText('Ana Pérez'))
    const form = screen.getByRole('form', { name: 'Inscripción del estudiante' })
    expect(within(form).queryByLabelText(/^Diagnóstico de/)).not.toBeInTheDocument()
    expect(within(form).getByText(/se registran en la pestaña «Calificaciones»/)).toBeInTheDocument()
    // Sin cambiar la matrícula no se puede guardar.
    expect(within(form).getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    expect(teacherApi.updateStudent).not.toHaveBeenCalled()
  })

  it('marca «Asistencia obligatoria» y la matrícula solo a quien está en 2.ª matrícula o más', async () => {
    const second = { ...student, id: 71, student_id: 81, name: 'Luis Mora', identification: '0202222222', enrollment_number: 2 as const, attendance_required: true }
    vi.mocked(teacherApi.students).mockResolvedValue(paginated([student, second]))
    workspace('students')
    await screen.findByText('Luis Mora')
    expect(screen.getAllByText('Asistencia obligatoria')).toHaveLength(1)
    expect(screen.getByText('Asistencia obligatoria').closest('[data-slot="badge"]')).not.toBeNull()
    const luis = screen.getAllByRole('row').find((row) => within(row).queryByText('Luis Mora')) as HTMLElement
    expect(within(luis).getByText('Asistencia obligatoria')).toBeInTheDocument()
    expect(within(luis).getByText('2.ª matrícula')).toBeInTheDocument()
    expect(screen.queryByText('1.ª matrícula')).not.toBeInTheDocument()
  })

  it('inscribe a un estudiante registrado con la matrícula elegida (1.ª por defecto)', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.enrollStudent).mockResolvedValue(student)
    workspace('students')
    await user.click(await screen.findByRole('button', { name: 'Registrar estudiante' }))
    const form = screen.getByRole('form', { name: 'Registrar estudiante' })
    expect(within(form).getByRole('combobox', { name: /^Matrícula/ })).toHaveTextContent('1.ª matrícula')
    await user.click(within(form).getByLabelText(/^Estudiante/))
    await user.click(await screen.findByRole('option', { name: /Ana Pérez/ }))
    await choose(user, within(form).getByRole('combobox', { name: /^Matrícula/ }), '2.ª matrícula')
    await user.click(within(form).getByRole('button', { name: 'Inscribir estudiante' }))
    await waitFor(() => expect(teacherApi.enrollStudent).toHaveBeenCalledWith(40, { student_id: 80, enrollment_number: 2 }))
  })

  it('crea e inscribe a un estudiante nuevo en 3.ª matrícula', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.enrollStudent).mockResolvedValue(student)
    workspace('students')
    await user.click(await screen.findByRole('button', { name: 'Registrar estudiante' }))
    const form = screen.getByRole('form', { name: 'Registrar estudiante' })
    await user.click(within(form).getByRole('tab', { name: 'Estudiante nuevo' }))
    await user.type(within(form).getByLabelText(/^Nombres/), 'Luis')
    await user.type(within(form).getByLabelText(/^Apellidos/), 'Mora')
    await user.type(within(form).getByLabelText(/^Cédula o pasaporte/), '0201234564')
    await user.type(within(form).getByLabelText(/^Correo institucional/), 'luis.mora@ueb.edu.ec')
    await choose(user, within(form).getByRole('combobox', { name: /^Matrícula/ }), '3.ª matrícula')
    await user.click(within(form).getByRole('button', { name: 'Crear e inscribir' }))
    await waitFor(() => expect(teacherApi.enrollStudent).toHaveBeenCalledWith(40, { identification: '0201234564', first_names: 'Luis', last_names: 'Mora', email: 'luis.mora@ueb.edu.ec', phone: null, enrollment_number: 3 }))
  })

  it('cambia la matrícula desde el registro del estudiante y solo la envía si cambió', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.updateStudent).mockResolvedValue({ ...student, enrollment_number: 2, attendance_required: true })
    workspace('students')
    await user.click(await screen.findByText('Ana Pérez'))
    const form = screen.getByRole('form', { name: 'Inscripción del estudiante' })
    const select = within(form).getByRole('combobox', { name: /^Matrícula/ })
    expect(select).toHaveTextContent('1.ª matrícula')
    expect(within(form).getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    await choose(user, select, '2.ª matrícula')
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))
    // El teléfono registrado se reenvía para no borrarlo.
    await waitFor(() => expect(teacherApi.updateStudent).toHaveBeenCalledWith(40, 70, { phone: '0991234567', enrollment_number: 2 }))
    expect(teacherApi.saveGrades).not.toHaveBeenCalled()
  })

  it('confirma la baja de la inscripción, que se pide desde el registro del estudiante y no desde una columna de acciones', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.deactivateStudent).mockResolvedValue({ ...student, is_active: false })
    workspace('students')
    await user.click(await screen.findByText('Ana Pérez'))
    expect(screen.queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument()
    const form = screen.getByRole('form', { name: 'Inscripción del estudiante' })
    await user.click(within(screen.getByRole('dialog', { name: 'Inscripción del estudiante' })).getByRole('button', { name: 'Deshabilitar inscripción' }))
    expect(teacherApi.deactivateStudent).not.toHaveBeenCalled()
    const confirm = await screen.findByRole('dialog', { name: '¿Deshabilitar inscripción?' })
    await user.click(within(confirm).getByRole('button', { name: 'Deshabilitar inscripción' }))
    await waitFor(() => expect(teacherApi.deactivateStudent).toHaveBeenCalledWith(40, 70))
    await waitFor(() => expect(form).not.toBeInTheDocument())
  })

  it('registra el abandono con su motivo desde el modal del estudiante y lo marca en la lista', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.setAbandonment).mockResolvedValue({ ...student, is_abandoned: true, abandonment_reason: 'Consiguió trabajo' })
    workspace('students')
    await user.click(await screen.findByText('Ana Pérez'))
    await user.click(within(screen.getByRole('dialog', { name: 'Inscripción del estudiante' })).getByRole('button', { name: 'Registrar abandono' }))

    const dialog = await screen.findByRole('dialog', { name: 'Registrar abandono' })
    const submit = within(dialog).getByRole('button', { name: 'Registrar abandono' })
    expect(submit).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/^Motivo/), 'Consiguió trabajo')
    expect(submit).toBeEnabled()
    await user.click(submit)

    await waitFor(() => expect(teacherApi.setAbandonment).toHaveBeenCalledWith(40, 70, { abandoned: true, reason: 'Consiguió trabajo' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Registrar abandono' })).not.toBeInTheDocument())
    expect(screen.queryByRole('form', { name: 'Inscripción del estudiante' })).not.toBeInTheDocument()
  })

  it('un estudiante que abandonó se marca, no admite notas ni resultado final y su fila muestra el motivo para quitarlo', async () => {
    const user = userEvent.setup()
    const abandoned = { ...student, is_abandoned: true, abandoned_at: '2026-09-29T12:00:00Z', abandonment_reason: 'Se mudó de ciudad' }
    vi.mocked(teacherApi.students).mockResolvedValue(paginated([abandoned]))
    vi.mocked(teacherApi.setAbandonment).mockResolvedValue({ ...student, is_abandoned: false })
    workspace('students')
    expect(await screen.findByText('Abandonó')).toBeInTheDocument()
    // El resultado final no está en Estudiantes: se registra en Calificaciones.
    expect(screen.queryByRole('combobox', { name: 'Resultado final de Ana Pérez' })).not.toBeInTheDocument()

    await user.click(screen.getByText('Ana Pérez'))
    expect(screen.queryByRole('form', { name: 'Inscripción del estudiante' })).not.toBeInTheDocument()
    const dialog = await screen.findByRole('dialog', { name: 'Abandono de la tutoría' })
    expect(within(dialog).getByLabelText(/^Motivo/)).toHaveValue('Se mudó de ciudad')
    expect(within(dialog).getByRole('button', { name: 'Guardar motivo' })).toBeDisabled()

    await user.click(within(dialog).getByRole('button', { name: 'Quitar abandono' }))
    const confirm = await screen.findByRole('dialog', { name: '¿Quitar el abandono?' })
    expect(teacherApi.setAbandonment).not.toHaveBeenCalled()
    await user.click(within(confirm).getByRole('button', { name: 'Quitar abandono' }))
    await waitFor(() => expect(teacherApi.setAbandonment).toHaveBeenCalledWith(40, 70, { abandoned: false }))
  })

  it('reinscribe con clic en la fila de una inscripción deshabilitada, tras confirmar', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.students).mockResolvedValue(paginated([{ ...student, is_active: false }]))
    vi.mocked(teacherApi.enrollStudent).mockResolvedValue(student)
    workspace('students')
    await user.click(await screen.findByText('Ana Pérez'))
    expect(screen.queryByRole('form', { name: 'Inscripción del estudiante' })).not.toBeInTheDocument()
    const confirm = await screen.findByRole('dialog', { name: '¿Reinscribir a Ana Pérez?' })
    expect(teacherApi.enrollStudent).not.toHaveBeenCalled()
    await user.click(within(confirm).getByRole('button', { name: 'Reinscribir estudiante' }))
    await waitFor(() => expect(teacherApi.enrollStudent).toHaveBeenCalledWith(40, { student_id: 80, enrollment_number: 1 }))
  })

  it('carga las notas por etapa: todos los estudiantes de una etapa y recién ahí guarda', async () => {
    const user = userEvent.setup()
    const second = { ...student, id: 71, student_id: 81, name: 'Luis Mora', identification: '0202222222' }
    vi.mocked(teacherApi.allStudents).mockResolvedValue([student, second])
    vi.mocked(teacherApi.saveGrades).mockResolvedValue([student, second])
    workspace('grades')
    await pickStage(user, /^Diagnóstico/)
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

  it('abre en "Todas las etapas", indica el estado de cada etapa en el desplegable y deja volver a la consulta', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.allStudents).mockResolvedValue([{ ...student, diagnostic_grade: '8.00' }])
    workspace('grades')
    expect(await screen.findByText('8.00')).toBeInTheDocument()
    expect(screen.queryByText(/modo consulta/)).not.toBeInTheDocument()
    expect(screen.queryByText('Cargar notas de:')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Etapa' })).toHaveTextContent('Todas las etapas')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Guardar/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('combobox', { name: 'Etapa' }))
    expect(await screen.findByRole('option', { name: 'Diagnóstico · Completo' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Parcial 1 · Pendiente' })).toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: /^Parcial 1/ }))
    expect(screen.getByRole('textbox', { name: 'Parcial 1 de Ana Pérez' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Etapa' })).toHaveTextContent(/^Parcial 1/)
    await pickStage(user, 'Todas las etapas')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('lista una fila por estudiante, sin notas ni resultado final (van en Calificaciones)', async () => {
    vi.mocked(teacherApi.students).mockResolvedValue(paginated([
      { ...student, diagnostic_grade: '7.40', partial_grade: '9.30', second_partial_grade: null },
      { ...student, id: 2, name: 'Luis Mora', identification: '0201111111', diagnostic_grade: null, partial_grade: null, second_partial_grade: null },
    ]))
    workspace('students')
    await screen.findByText('Luis Mora')
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['#', 'Apellidos y nombres', 'Contacto', 'Grupo de Conocimiento', 'Inscripción'])
    expect(screen.queryByText('7.40')).not.toBeInTheDocument()
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(within(rows[1]).getAllByRole('cell')[0]).toHaveTextContent('2')
  })

  it('muestra el grupo de conocimiento en la lista de estudiantes y la evolución entre parciales en calificaciones', async () => {
    vi.mocked(teacherApi.students).mockResolvedValue(paginated([{ ...student, knowledge_group: 'Alto' }]))
    workspace('students')
    expect(await screen.findByText('Alto')).toBeInTheDocument()
    expect(screen.getByText('Grupo de Conocimiento')).toBeInTheDocument()

    // La nota diagnóstica no entra en el cálculo: solo Parcial 1 y Parcial 2.
    vi.mocked(teacherApi.allStudents).mockResolvedValue([{ ...student, diagnostic_grade: '7.00', partial_grade: '8.00', second_partial_grade: '9.50' }])
    workspace('grades')
    expect(await screen.findByText('+1.50')).toBeInTheDocument()
    expect(screen.queryByText('+2.50')).not.toBeInTheDocument()
    expect(screen.getByText('Evolución (P1 → P2)')).toBeInTheDocument()
    // La evolución es un valor, no un estado: va como texto, sin badge.
    expect(screen.getByText('+1.50').closest('.rounded-full')).toBeNull()
  })

  it('no calcula evolución sin la nota del Parcial 1, aunque haya diagnóstico', async () => {
    vi.mocked(teacherApi.allStudents).mockResolvedValue([{ ...student, diagnostic_grade: '7.00', partial_grade: null, second_partial_grade: '9.50' }])
    workspace('grades')
    expect(await screen.findByText('9.50')).toBeInTheDocument()
    expect(screen.queryByText('+2.50')).not.toBeInTheDocument()
    expect(screen.queryByText('Pendiente P2')).not.toBeInTheDocument()
  })

  it('cancela la carga de una etapa y vuelve a modo consulta, descartando lo no guardado tras confirmar', async () => {
    const user = userEvent.setup()
    workspace('grades')
    await pickStage(user, /^Diagnóstico/)
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    await pickStage(user, /^Diagnóstico/)
    await user.type(screen.getByRole('textbox', { name: 'Diagnóstico de Ana Pérez' }), '7.5')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.click(await screen.findByRole('button', { name: 'Seguir editando' }))
    expect(screen.getByRole('textbox', { name: 'Diagnóstico de Ana Pérez' })).toHaveValue('7.50')
    expect(teacherApi.saveGrades).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.click(await screen.findByRole('button', { name: 'Sí, descartar' }))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await pickStage(user, /^Diagnóstico/)
    expect(screen.getByRole('textbox', { name: 'Diagnóstico de Ana Pérez' })).toHaveValue('')
  })

  it('conserva las notas escritas como borrador si el docente sale de la página', async () => {
    const user = userEvent.setup()
    const view = workspace('grades')
    await pickStage(user, /^Diagnóstico/)
    await user.type(await screen.findByRole('textbox', { name: 'Diagnóstico de Ana Pérez' }), '7.5')
    view.unmount()
    workspace('grades')
    await pickStage(user, /^Diagnóstico/)
    expect(await screen.findByRole('textbox', { name: 'Diagnóstico de Ana Pérez' })).toHaveValue('7.5')
  })

  it('mantiene las notas escritas ante un error del servidor', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.saveGrades).mockRejectedValue(new ApiError(422, { message: 'La nota supera la escala.' }))
    workspace('grades')
    await pickStage(user, /^Diagnóstico/)
    await user.type(await screen.findByRole('textbox', { name: 'Diagnóstico de Ana Pérez' }), '8.5')
    await user.click(screen.getByRole('button', { name: 'Guardar Diagnóstico' }))
    expect(await screen.findByText('La nota supera la escala.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Diagnóstico de Ana Pérez' })).toHaveValue('8.50')
  })

  it('al cambiar de etapa con notas sin guardar pide confirmar el descarte, y la consulta muestra solo lo guardado', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.allStudents).mockResolvedValue([{ ...student, diagnostic_grade: '7.00', partial_grade: '7.00' }])
    const view = workspace('grades')
    await pickStage(user, /^Parcial 2/)
    await user.type(screen.getByRole('textbox', { name: 'Parcial 2 de Ana Pérez' }), '8')
    expect(screen.getByText('Sin guardar')).toBeInTheDocument()
    await pickStage(user, /^Parcial 1/)
    const confirm = await screen.findByRole('dialog', { name: '¿Descartar las notas de Parcial 2?' })
    expect(within(confirm).getByText(/pasarás a Parcial 1/)).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Seguir editando' }))
    expect(screen.getByRole('textbox', { name: 'Parcial 2 de Ana Pérez' })).toHaveValue('8.00')
    expect(screen.queryByRole('textbox', { name: 'Parcial 1 de Ana Pérez' })).not.toBeInTheDocument()

    // Al volver a la pantalla, el borrador no se muestra como nota guardada ni cuenta en la evolución.
    view.unmount()
    workspace('grades')
    expect(await screen.findByText(/Tienes notas sin guardar de Parcial 2/)).toBeInTheDocument()
    expect(screen.queryByText('8.00')).not.toBeInTheDocument()
    expect(screen.getByText('Pendiente P2').closest('[data-slot="badge"]')).not.toBeNull()

    await pickStage(user, /^Parcial 2/)
    expect(screen.getByRole('textbox', { name: 'Parcial 2 de Ana Pérez' })).toHaveValue('8.00')
    await pickStage(user, /^Parcial 1/)
    await user.click(within(await screen.findByRole('dialog', { name: '¿Descartar las notas de Parcial 2?' })).getByRole('button', { name: 'Sí, descartar' }))
    expect(await screen.findByRole('textbox', { name: 'Parcial 1 de Ana Pérez' })).toHaveValue('7.00')
    expect(JSON.parse(sessionStorage.getItem('grades-draft:40') ?? '{}')[70]?.partial_two).toBeUndefined()
  })

  it('elige la etapa con un desplegable sin etiqueta visible ni línea de ayuda', async () => {
    workspace('grades')
    expect(await screen.findByRole('combobox', { name: 'Etapa' })).toBeInTheDocument()
    expect(screen.queryByText('Etapa')).not.toBeInTheDocument()
    expect(screen.queryByText(/Elige una etapa/)).not.toBeInTheDocument()
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

  it('al tomar y consultar la asistencia marca «Asistencia obligatoria» solo a quien la tiene', async () => {
    const second = { ...student, id: 71, student_id: 81, name: 'Luis Mora', identification: '0202222222', enrollment_number: 2 as const, attendance_required: true }
    vi.mocked(teacherApi.allStudents).mockResolvedValue([student, second])
    attendance()
    await screen.findByRole('checkbox', { name: 'Presente: Luis Mora' })
    expect(screen.getAllByText('Asistencia obligatoria')).toHaveLength(1)
    const luis = screen.getAllByRole('row').find((row) => within(row).queryByText('Luis Mora')) as HTMLElement
    expect(within(luis).getByText('Asistencia obligatoria')).toBeInTheDocument()
    expect(within(luis).getByText('2.ª matrícula')).toBeInTheDocument()
    cleanup()

    const saved = { id: 100, tutoring_id: 40, number: 3, date: '2026-09-29', topics_covered: true, topics: [], attendance: [
      { id: 1, enrollment_id: 70, student_id: 80, student_name: 'Ana Pérez', present: true, attendance_required: false },
      { id: 2, enrollment_id: 71, student_id: 81, student_name: 'Luis Mora', present: false, attendance_required: true },
    ] }
    vi.mocked(teacherApi.sessions).mockResolvedValue(paginated([saved]))
    show(<TeacherTutoringsPage />, '/panel/teacher-tutorings?tutoring=40&tab=attendance&consult=2026-09-29')
    await screen.findByRole('heading', { name: /Sesión 3/ })
    expect(screen.getAllByText('Asistencia obligatoria')).toHaveLength(1)
    const consulted = screen.getAllByRole('row').find((row) => within(row).queryByText('Luis Mora')) as HTMLElement
    expect(within(consulted).getByText('Asistencia obligatoria')).toBeInTheDocument()
  })

  it('la asistencia y la carga de notas por etapa no incluyen a quien abandonó la tutoría', async () => {
    const user = userEvent.setup()
    const abandoned = { ...student, id: 71, student_id: 81, name: 'Luis Mora', identification: '0202222222', is_abandoned: true, abandonment_reason: 'Se mudó de ciudad' }
    vi.mocked(teacherApi.allStudents).mockResolvedValue([student, abandoned])
    attendance()
    await screen.findByRole('checkbox', { name: 'Presente: Ana Pérez' })
    expect(screen.queryByRole('checkbox', { name: 'Presente: Luis Mora' })).not.toBeInTheDocument()
    cleanup()
    workspace('grades')
    await pickStage(user, /^Diagnóstico/)
    expect(await screen.findByRole('textbox', { name: 'Diagnóstico de Ana Pérez' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Diagnóstico de Luis Mora' })).not.toBeInTheDocument()
  })

  it('muestra el aviso de inasistencia del estudiante y el docente decide presente o ausente', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.allStudents).mockResolvedValue([student, { ...student, id: 71, student_id: 81, name: 'Luis Mora', identification: '0202222222' }])
    vi.mocked(teacherApi.absenceNotices).mockResolvedValue([{ id: 1, enrollment_id: 70, student_name: 'Ana Pérez', date: today, reason: 'Cita médica' }])
    vi.mocked(teacherApi.saveSession).mockResolvedValue({ id: 100, tutoring_id: 40, date: today, topics_covered: false, topics: [], attendance: [] })
    attendance()

    expect(await screen.findByText('Avisó que no asistirá: Cita médica')).toBeInTheDocument()
    expect(screen.getByText(/Ana Pérez avisó que no asistirá en esta fecha/)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Justificar' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Presente: Luis Mora' }))

    await user.click(screen.getByRole('button', { name: 'Guardar asistencia' }))
    await waitFor(() => expect(teacherApi.saveSession).toHaveBeenCalledWith(40, expect.objectContaining({ attendance: [
      { enrollment_id: 70, present: false },
      { enrollment_id: 71, present: true },
    ] })))
  })

  it('en una clase conjunta toma asistencia a ambos grupos y la guarda en cada tutoría', async () => {
    const user = userEvent.setup()
    const other = { ...student, id: 75, tutoring_id: 41, student_id: 85, name: 'Bruno Vera' }
    vi.mocked(teacherApi.jointTutorings).mockResolvedValue([{ id: 41, name: 'CALIDAD DE SOFTWARE', career_name: 'Tecnologías de la Información', cycle_number: 3, section_name: 'A', days: [todayName], can_manage: true }])
    vi.mocked(teacherApi.allStudents).mockImplementation(async (id: number) => (id === 41 ? [other] : [student]))
    vi.mocked(teacherApi.saveSession).mockResolvedValue({ id: 100, tutoring_id: 40, date: today, topics_covered: false, topics: [], attendance: [] })
    attendance()

    expect(await screen.findByText(/Clase conjunta con Tecnologías de la Información · paralelo A/)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Grupo Software · paralelo A' })).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Presente: Bruno Vera' }))
    expect(screen.getByText('1 de 2 presentes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Guardar asistencia' }))
    await waitFor(() => expect(teacherApi.saveSession).toHaveBeenCalledTimes(2))
    expect(teacherApi.saveSession).toHaveBeenCalledWith(40, expect.objectContaining({ attendance: [{ enrollment_id: 70, present: false }] }))
    expect(teacherApi.saveSession).toHaveBeenCalledWith(41, expect.objectContaining({ attendance: [{ enrollment_id: 75, present: true }] }))
  })

  it('en una clase conjunta se puede trabajar solo con el grupo propio', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.jointTutorings).mockResolvedValue([{ id: 41, name: 'CALIDAD DE SOFTWARE', career_name: 'TI', cycle_number: 3, section_name: null, days: [todayName], can_manage: true }])
    vi.mocked(teacherApi.allStudents).mockImplementation(async (id: number) => (id === 41 ? [{ ...student, id: 75, tutoring_id: 41, name: 'Bruno Vera' }] : [student]))
    vi.mocked(teacherApi.saveSession).mockResolvedValue({ id: 100, tutoring_id: 40, date: today, topics_covered: false, topics: [], attendance: [] })
    attendance()

    await user.click(await screen.findByRole('checkbox', { name: 'Incluir el grupo conjunto' }))
    expect(screen.queryByText('Bruno Vera')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar asistencia' }))
    await waitFor(() => expect(teacherApi.saveSession).toHaveBeenCalledTimes(1))
    expect(teacherApi.saveSession).toHaveBeenCalledWith(40, expect.anything())
  })

  it('en una clase conjunta califica a ambos grupos y guarda las notas en cada tutoría', async () => {
    const user = userEvent.setup()
    const other = { ...student, id: 75, tutoring_id: 41, student_id: 85, name: 'Bruno Vera' }
    vi.mocked(teacherApi.jointTutorings).mockResolvedValue([{ id: 41, name: 'CALIDAD DE SOFTWARE', career_name: 'TI', cycle_number: 3, section_name: 'A', days: ['lunes'], can_manage: true }])
    vi.mocked(teacherApi.allStudents).mockImplementation(async (id: number) => (id === 41 ? [other] : [student]))
    vi.mocked(teacherApi.saveGrades).mockResolvedValue([])
    workspace('grades')

    await pickStage(user, /^Diagnóstico/)
    await user.type(screen.getByRole('textbox', { name: 'Diagnóstico de Ana Pérez' }), '9')
    await user.type(screen.getByRole('textbox', { name: 'Diagnóstico de Bruno Vera' }), '7')
    await user.click(screen.getByRole('button', { name: 'Guardar Diagnóstico' }))

    await waitFor(() => expect(teacherApi.saveGrades).toHaveBeenCalledTimes(2))
    expect(teacherApi.saveGrades).toHaveBeenCalledWith(40, [{ enrollment_id: 70, diagnostic: '9.00' }])
    expect(teacherApi.saveGrades).toHaveBeenCalledWith(41, [{ enrollment_id: 75, diagnostic: '7.00' }])
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
    await screen.findByRole('button', { name: 'Guardar asistencia' }, { timeout: 5000 })
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

  it('abre una sesión anterior del período en el mismo formulario para modificarla, conservando sus temas', async () => {
    const user = userEvent.setup()
    const saved = { id: 100, tutoring_id: 40, number: 1, date: lastWeek, topics_covered: true, linked_topic_ids: [90], topics: [{ id: 90, name: 'Pruebas', is_active: true }], attendance: [{ id: 1, enrollment_id: 70, student_id: 80, student_name: 'Ana Pérez', present: false, attendance_required: false }] }
    vi.mocked(teacherApi.sessions).mockImplementation(async (_id, params) => paginated(params?.date && params.date !== lastWeek ? [] : [saved]))
    vi.mocked(teacherApi.allSessions).mockResolvedValue([saved])
    vi.mocked(teacherApi.saveSession).mockResolvedValue(saved)
    duringClass()
    workspace('attendance')
    await user.click(await screen.findByText('0 de 1 presentes'))

    const form = await screen.findByRole('form', { name: 'Registrar asistencia' })
    expect(screen.queryByText('Solo consulta')).not.toBeInTheDocument()
    expect(within(form).getByText(/La sesión de esta fecha ya está registrada/)).toBeInTheDocument()
    const checkbox = within(form).getByRole('checkbox', { name: 'Presente: Ana Pérez' })
    expect(checkbox).not.toBeChecked()
    await user.click(checkbox)
    await user.click(within(form).getByRole('button', { name: 'Guardar asistencia' }))
    await waitFor(() => expect(teacherApi.saveSession).toHaveBeenCalledWith(40, { date: lastWeek, topics_covered: true, topic_ids: [90], attendance: [{ enrollment_id: 70, present: true }] }))
  })

  it('desde una sesión ya registrada lleva a Contenido para asignar sus temas', async () => {
    const user = userEvent.setup()
    const saved = { id: 100, tutoring_id: 40, number: 1, date: lastWeek, topics_covered: false, topics: [], attendance: [{ id: 1, enrollment_id: 70, student_id: 80, student_name: 'Ana Pérez', present: true, attendance_required: false }] }
    vi.mocked(teacherApi.sessions).mockImplementation(async (_id, params) => paginated(params?.date && params.date !== lastWeek ? [] : [saved]))
    vi.mocked(teacherApi.allSessions).mockResolvedValue([saved])
    duringClass()
    workspace('attendance')
    await user.click(await screen.findByText('1 de 1 presentes'))

    const form = await screen.findByRole('form', { name: 'Registrar asistencia' })
    await user.click(within(form).getByRole('button', { name: 'Asignar temas en Contenido' }))
    expect(await screen.findByRole('tab', { name: 'Contenido', selected: true })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Asignar temas' })).toBeInTheDocument()
  })

  it('en una sesión nueva avisa que los temas se asignan en Contenido después de guardar', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.allSessions).mockResolvedValue([])
    duringClass()
    workspace('attendance')
    const calendar = await screen.findByRole('group', { name: 'Calendario de sesiones' })
    if (lastWeek.slice(0, 7) !== today.slice(0, 7)) await user.click(within(calendar).getByRole('button', { name: 'Mes anterior' }))
    await user.click(within(calendar).getByRole('button', { name: dayLabel(lastWeek) }))

    const form = await screen.findByRole('form', { name: 'Registrar asistencia' })
    expect(within(form).getByText('Después de guardar, asigna los temas de esta sesión en «Contenido».')).toBeInTheDocument()
    expect(within(form).queryByRole('button', { name: 'Asignar temas en Contenido' })).not.toBeInTheDocument()
  })

  it('el calendario marca los días con sesión y al elegir un día con clase registra la sesión de esa fecha', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.allSessions).mockResolvedValue([])
    vi.mocked(teacherApi.saveSession).mockResolvedValue({ id: 100, tutoring_id: 40, date: lastWeek, topics_covered: false, topics: [], attendance: [] })
    duringClass()
    workspace('attendance')
    const calendar = await screen.findByRole('group', { name: 'Calendario de sesiones' })
    if (lastWeek.slice(0, 7) !== today.slice(0, 7)) await user.click(within(calendar).getByRole('button', { name: 'Mes anterior' }))
    await user.click(within(calendar).getByRole('button', { name: dayLabel(lastWeek) }))

    const form = await screen.findByRole('form', { name: 'Registrar asistencia' })
    expect(teacherApi.sessions).toHaveBeenCalledWith(40, { date: lastWeek })
    await user.click(within(form).getByRole('checkbox', { name: 'Presente: Ana Pérez' }))
    await user.click(within(form).getByRole('button', { name: 'Guardar asistencia' }))
    await waitFor(() => expect(teacherApi.saveSession).toHaveBeenCalledWith(40, { date: lastWeek, topics_covered: false, topic_ids: [], attendance: [{ enrollment_id: 70, present: true }] }))
  })

  it('en una tutoría de un período cerrado las sesiones solo se consultan', async () => {
    const user = userEvent.setup()
    const closed: TeacherTutoring = { ...inClass, can_manage: false }
    const saved = { id: 100, tutoring_id: 40, number: 1, date: lastWeek, topics_covered: false, topics: [], attendance: [{ id: 1, enrollment_id: 70, student_id: 80, student_name: 'Ana Pérez', present: false, attendance_required: false }] }
    vi.mocked(teacherApi.tutorings).mockResolvedValue(paginated([closed]))
    vi.mocked(teacherApi.allTutorings).mockResolvedValue([closed])
    vi.mocked(teacherApi.sessions).mockResolvedValue(paginated([saved]))
    vi.mocked(teacherApi.allSessions).mockResolvedValue([saved])
    workspace('attendance')
    // La cabecera de la tutoría ya dice «Solo consulta»; la sesión abierta lleva su propia insignia.
    expect(await screen.findAllByText('Solo consulta')).toHaveLength(1)
    await user.click(screen.getByText('0 de 1 presentes'))
    expect(await screen.findByRole('heading', { name: /Sesión 1/ })).toBeInTheDocument()
    expect(screen.getAllByText('Solo consulta')).toHaveLength(2)
    expect(screen.getAllByText('Solo consulta').every((element) => element.closest('[data-slot="badge"]') !== null)).toBe(true)
    expect(screen.getByText('Ausente')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Modificar|Guardar|Marcar todos/ })).not.toBeInTheDocument()
    // La sesión abierta va en la URL: «atrás» del navegador vuelve a la lista de sesiones.
    await user.click(screen.getByRole('button', { name: 'Atrás del navegador' }))
    expect(await screen.findByText('0 de 1 presentes')).toBeInTheDocument()
    expect(screen.getAllByText('Solo consulta')).toHaveLength(1)
  })

  it('abre una sesión pasada desde la URL', async () => {
    const saved = { id: 100, tutoring_id: 40, number: 3, date: '2026-09-29', topics_covered: true, topics: [], attendance: [{ id: 1, enrollment_id: 70, student_id: 80, student_name: 'Ana Pérez', present: true, attendance_required: false }] }
    vi.mocked(teacherApi.sessions).mockResolvedValue(paginated([saved]))
    show(<TeacherTutoringsPage />, '/panel/teacher-tutorings?tutoring=40&tab=attendance&consult=2026-09-29')
    expect(await screen.findByRole('heading', { name: /Sesión 3/ })).toBeInTheDocument()
    expect(teacherApi.sessions).toHaveBeenCalledWith(40, { date: '2026-09-29' })
    expect(screen.getByText('Presente')).toBeInTheDocument()
  })

  it('permite corregir la sesión de hoy con sus marcas guardadas', async () => {
    const saved = { id: 100, tutoring_id: 40, date: today, topics_covered: false, topics: [], attendance: [{ id: 1, enrollment_id: 70, student_id: 80, student_name: 'Ana Pérez', present: false, attendance_required: false }] }
    vi.mocked(teacherApi.sessions).mockResolvedValue(paginated([saved]))
    attendance()
    expect(await screen.findByText(/La lista de hoy ya se tomó/)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Presente: Ana Pérez' })).not.toBeChecked()
  })

  it('avisa que la lista de hoy ya se tomó y solo ofrece modificarla, sin registrar una segunda', async () => {
    const user = userEvent.setup()
    const saved = { id: 100, tutoring_id: 40, date: today, topics_covered: false, topics: [], attendance: [{ id: 1, enrollment_id: 70, student_id: 80, student_name: 'Ana Pérez', present: true, attendance_required: false }] }
    vi.mocked(teacherApi.sessions).mockResolvedValue(paginated([saved]))
    duringClass()
    workspace('attendance')
    expect(await screen.findByText('La lista de hoy ya se tomó')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar asistencia' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Modificar lista de hoy' }))
    expect(await screen.findByRole('form', { name: 'Registrar asistencia' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Presente: Ana Pérez' })).toBeChecked()
    // Desde la toma de lista se vuelve a las sesiones sin una segunda fila de pestañas.
    await user.click(screen.getByRole('button', { name: 'Volver a las sesiones' }))
    expect(await screen.findByText('La lista de hoy ya se tomó')).toBeInTheDocument()
  })

  it('ofrece registrar la asistencia cuando hoy todavía no se ha tomado lista', async () => {
    duringClass()
    workspace('attendance')
    const register = await screen.findByRole('button', { name: 'Registrar asistencia' })
    // El botón se habilita cuando termina de comprobarse si hoy ya hay lista.
    await waitFor(() => expect(register).toBeEnabled())
    expect(screen.queryByText('La lista de hoy ya se tomó')).not.toBeInTheDocument()
  })

  it('muestra las sesiones sin pestañas internas y no ofrece registrar hoy si no hay clase', async () => {
    const savedMonday = {
      id: 101,
      tutoring_id: 40,
      date: '2026-09-28',
      topics_covered: false,
      topics: [],
      attendance: [{ id: 1, enrollment_id: 70, student_id: 80, student_name: 'Ana Pérez', present: true, attendance_required: false }],
    }
    // La clase es mañana: hoy no se puede tomar asistencia.
    const tomorrow = DAY_NAMES[(new Date().getDay() + 1) % 7]
    const tutoringWithSchedule: TeacherTutoring = {
      ...tutoring,
      schedules: [
        { id: 1, tutoring_id: 40, day: tomorrow, start_time: '08:00', end_time: '10:00', room: 'Aula 1', is_active: true },
      ],
    }
    vi.mocked(teacherApi.tutorings).mockResolvedValue(paginated([tutoringWithSchedule]))
    vi.mocked(teacherApi.allTutorings).mockResolvedValue([tutoringWithSchedule])
    // Hoy todavía no hay lista; el historial tiene la del lunes.
    vi.mocked(teacherApi.sessions).mockImplementation(async (_id, params) => paginated(params?.date ? [] : [savedMonday]))

    const view = workspace('attendance')

    // Un solo nivel de pestañas: las sesiones y, arriba, la acción de registrar.
    await screen.findByText('1 de 1 presentes')
    expect(screen.queryByRole('tab', { name: /Consultar asistencia|Registrar asistencia/i })).not.toBeInTheDocument()

    // En consultar asistencia: muestra el día (Lunes), la fecha y el resumen
    // La tabla de sesiones (el calendario es otra tabla, dentro de su grupo).
    const table = (await screen.findAllByRole('table')).find((element) => !element.closest('[role="group"]')) as HTMLElement
    expect(within(table).getByText('Lunes')).toBeInTheDocument()
    expect(within(table).getByText(/28 sept/i)).toBeInTheDocument()
    expect(within(table).getByText('1 de 1 presentes')).toBeInTheDocument()

    // Hoy no hay clase: no se ofrece registrar la de hoy
    expect(screen.getByText(/Hoy no hay clase de esta tutoría/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar asistencia' })).toBeDisabled())
    // El motivo del bloqueo se lee en el tooltip del botón.
    await userEvent.setup().hover(screen.getByRole('button', { name: 'Registrar asistencia' }).parentElement as HTMLElement)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/Hoy no hay clase de esta tutoría/)

    // Ni abriendo la toma de lista por enlace: la lista queda bloqueada
    view.unmount()
    show(<TeacherTutoringsPage />, `/panel/teacher-tutorings?tutoring=40&tab=attendance&session=${today}`)
    const form = await screen.findByRole('form', { name: 'Registrar asistencia' })
    expect(within(form).getByText('La tutoría no tiene clase ese día.')).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Guardar asistencia' })).toBeDisabled()
    expect(within(form).getByRole('checkbox', { name: 'Presente: Ana Pérez' })).toBeDisabled()
  })

  it('muestra el contenido por sesiones con su fecha; al abrir una se ven sus temas, recursos y estado', async () => {
    const user = userEvent.setup()
    const other = { ...topic, id: 91, name: 'Integración', is_covered: true, files: [{ id: 3, name: 'guia.pdf', mime_type: 'application/pdf', size: 1024, uploaded_at: null }] }
    const loose = { ...topic, id: 92, name: 'Despliegue' }
    const disabled = { ...topic, id: 93, name: 'Tema viejo', is_active: false }
    vi.mocked(teacherApi.allTopics).mockResolvedValue([topic, other, loose, disabled])
    vi.mocked(teacherApi.allSessions).mockResolvedValue([
      { id: 2, tutoring_id: 40, number: 2, date: '2026-09-28', topics_covered: true, topics: [{ id: 91, name: 'Integración', is_active: true }], attendance: [] },
      { id: 1, tutoring_id: 40, number: 1, date: '2026-09-21', topics_covered: false, topics: [{ id: 90, name: 'Pruebas', is_active: true }, { id: 91, name: 'Integración', is_active: true }], attendance: [] },
    ])
    workspace('content')

    const first = await screen.findByRole('row', { name: /Sesión 1/ }, { timeout: 5000 })
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Sesión', 'Fecha', 'Temas', 'Acciones'])
    expect(within(first).getByText(formatDate('2026-09-21'))).toBeInTheDocument()
    expect(within(first).getByText('2')).toBeInTheDocument()
    expect(within(first).getByRole('button', { name: 'Editar la Sesión 1' })).toBeInTheDocument()
    expect(within(first).getByRole('button', { name: 'Eliminar la Sesión 1' })).toBeInTheDocument()
    // Los temas sin sesión son una fila más (sin acciones); los deshabilitados no se cuentan.
    const pending = screen.getByRole('row', { name: /Temas sin sesión/ })
    expect(within(pending).getByText('1')).toBeInTheDocument()
    expect(within(pending).queryByRole('button')).not.toBeInTheDocument()
    // Sin filtros de sesión ni de estado.
    expect(screen.queryByRole('combobox', { name: 'Filtrar por Sesión' })).not.toBeInTheDocument()

    await user.click(within(screen.getByRole('row', { name: /Sesión 2/ })).getByText('Sesión 2'))
    expect(await screen.findByRole('heading', { name: `Sesión 2 · ${formatDate('2026-09-28')}` })).toBeInTheDocument()
    // Los temas de la sesión se listan en la misma pantalla, cada uno desplegable.
    const integration = screen.getByRole('region', { name: 'Tema Integración' })
    expect(within(integration).getByText(/1 archivo/)).toBeInTheDocument()
    expect(within(integration).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Tema Pruebas' })).not.toBeInTheDocument()
    expect(screen.queryByText('Habilitado')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sesiones' }))
    await user.click(within(await screen.findByRole('row', { name: /Temas sin sesión/ })).getByText('Temas sin sesión'))
    expect(await screen.findByRole('region', { name: 'Tema Despliegue' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Tema Tema viejo' })).not.toBeInTheDocument()
  })

  it('elimina, previa confirmación, un tema registrado por error en una sesión', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.allTopics).mockResolvedValue([topic])
    vi.mocked(teacherApi.allSessions).mockResolvedValue([{ id: 1, tutoring_id: 40, number: 1, date: '2026-09-21', topics_covered: true, topics: [{ id: 90, name: 'Pruebas', is_active: true }], attendance: [] }])
    vi.mocked(teacherApi.deleteTopic).mockResolvedValue(undefined)
    show(<TeacherTutoringsPage />, '/panel/teacher-tutorings?tutoring=40&tab=content&content-session=1')

    await user.click(await screen.findByRole('button', { name: 'Eliminar el tema Pruebas' }, { timeout: 5000 }))
    const dialog = await screen.findByRole('dialog', { name: '¿Eliminar el tema?' })
    expect(within(dialog).getByText(/Se eliminará «Pruebas»/)).toBeInTheDocument()
    expect(teacherApi.deleteTopic).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar tema' }))
    await waitFor(() => expect(teacherApi.deleteTopic).toHaveBeenCalledWith(40, 90))
    // Sigue en la sesión.
    expect(await screen.findByRole('heading', { name: 'Sesión 1 · 21 sept 2026' })).toBeInTheDocument()
  })

  it('sin sesiones avisa que se habilitan al tomar asistencia', async () => {
    vi.mocked(teacherApi.allSessions).mockResolvedValue([])
    workspace('content')
    expect(await screen.findByText(/Las sesiones se habilitan al tomar asistencia/)).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Temas sin sesión/ })).toBeInTheDocument()
  })

  it('registra un tema nuevo en contenido solicitando solo el nombre, sin campo de descripción', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.createTopic).mockResolvedValue({ ...topic, id: 95, name: 'Introducción' })
    contentWithoutSession()
    await user.click(await screen.findByRole('button', { name: 'Registrar tema' }))
    expect(screen.queryByLabelText(/Descripción/i)).not.toBeInTheDocument()
    // El nombre es obligatorio: asterisco y aviso para lectores de pantalla.
    const nameLabel = screen.getByText('Nombre').closest('label') as HTMLElement
    expect(within(nameLabel).getByText('(obligatorio)')).toHaveClass('sr-only')
    await user.type(screen.getByLabelText(/^Nombre/), 'Introducción')
    await user.click(within(screen.getByRole('form', { name: 'Registrar tema' })).getByRole('button', { name: 'Registrar tema' }))
    await waitFor(() => expect(teacherApi.createTopic).toHaveBeenCalledWith(40, { name: 'Introducción', description: '' }))
    // Fuera de una sesión, el tema queda sin sesión.
    expect(teacherApi.updateSessionTopics).not.toHaveBeenCalled()
  })

  it('dentro de una sesión registra el tema ya en esa sesión y asigna temas existentes', async () => {
    const user = userEvent.setup()
    const loose = { ...topic, id: 92, name: 'Despliegue' }
    vi.mocked(teacherApi.allTopics).mockResolvedValue([topic, loose])
    vi.mocked(teacherApi.allSessions).mockResolvedValue([{ id: 1, tutoring_id: 40, number: 1, date: '2026-09-21', topics_covered: false, topics: [{ id: 90, name: 'Pruebas', is_active: true }], attendance: [] }])
    vi.mocked(teacherApi.createTopic).mockResolvedValue({ ...topic, id: 95, name: 'Introducción' })
    vi.mocked(teacherApi.updateSessionTopics).mockResolvedValue({ id: 1, tutoring_id: 40, number: 1, date: '2026-09-21', topics_covered: true, topics: [], attendance: [] })
    show(<TeacherTutoringsPage />, '/panel/teacher-tutorings?tutoring=40&tab=content&content-session=1')

    await user.click(await screen.findByRole('button', { name: 'Registrar tema' }))
    const form = screen.getByRole('form', { name: 'Registrar tema' })
    await user.type(within(form).getByLabelText(/^Nombre/), 'Introducción')
    await user.click(within(form).getByRole('button', { name: 'Registrar tema' }))
    await waitFor(() => expect(teacherApi.updateSessionTopics).toHaveBeenCalledWith(40, 1, [90, 95]))

    await user.click(await screen.findByRole('button', { name: 'Asignar temas' }))
    const assign = await screen.findByRole('form', { name: /^Asignar temas a la Sesión 1/ })
    await user.click(within(assign).getByText('Despliegue'))
    await user.click(within(assign).getByRole('button', { name: 'Guardar temas de la sesión' }))
    await waitFor(() => expect(teacherApi.updateSessionTopics).toHaveBeenLastCalledWith(40, 1, [90, 92]))
  })

  it('adjunta recursos al registrar un tema y rechaza los archivos no permitidos', async () => {
    const user = userEvent.setup({ applyAccept: false })
    vi.mocked(teacherApi.createTopic).mockResolvedValue({ ...topic, id: 95, name: 'Introducción', files: [] })
    vi.mocked(teacherApi.uploadTopicFile).mockResolvedValue({ id: 1, name: 'guia.pdf', mime_type: 'application/pdf', size: 2048, uploaded_at: null })
    contentWithoutSession()
    await user.click(await screen.findByRole('button', { name: 'Registrar tema' }))
    const form = screen.getByRole('form', { name: 'Registrar tema' })
    await user.type(within(form).getByLabelText(/^Nombre/), 'Introducción')

    const input = form.querySelector<HTMLInputElement>('input[type="file"]')!
    const pdf = new File(['%PDF'], 'guia.pdf', { type: 'application/pdf' })
    const exe = new File(['MZ'], 'virus.exe', { type: 'application/x-msdownload' })
    await user.upload(input, [pdf, exe])
    expect(within(form).getByText('guia.pdf')).toBeInTheDocument()
    expect(within(form).getByText(/Se subirá al guardar/)).toBeInTheDocument()
    expect(within(form).getByText(/«virus.exe» no es un PDF/)).toBeInTheDocument()
    expect(within(form).queryByText('virus.exe')).not.toBeInTheDocument()

    await user.click(within(form).getByRole('button', { name: 'Registrar tema' }))
    await waitFor(() => expect(teacherApi.uploadTopicFile).toHaveBeenCalledWith(40, 95, pdf))
    expect(teacherApi.uploadTopicFile).toHaveBeenCalledTimes(1)
  })

  it('quita y descarga los recursos ya adjuntos de un tema', async () => {
    const user = userEvent.setup()
    const stored = { id: 7, name: 'Clase 1.pptx', mime_type: 'application/vnd.ms-powerpoint', size: 3 * 1024 * 1024, uploaded_at: null }
    const withFiles = { ...topic, files: [stored, { ...stored, id: 8, name: 'Lectura.docx' }] }
    vi.mocked(teacherApi.allTopics).mockResolvedValue([withFiles])
    vi.mocked(teacherApi.updateTopic).mockResolvedValue(withFiles)
    vi.mocked(teacherApi.deleteTopicFile).mockResolvedValue(undefined)
    vi.mocked(teacherApi.downloadTopicFile).mockResolvedValue(undefined)
    contentWithoutSession()
    expect(await screen.findByText(/2 archivos/, undefined, { timeout: 5000 })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Editar el tema Pruebas' }))
    const form = await screen.findByRole('form', { name: 'Editar tema' })
    expect(within(form).getByText(/Presentación · 3.0 MB/)).toBeInTheDocument()
    await user.click(within(form).getByRole('button', { name: 'Descargar Clase 1.pptx' }))
    expect(teacherApi.downloadTopicFile).toHaveBeenCalledWith(40, 90, stored)

    await user.click(within(form).getByRole('button', { name: 'Quitar Lectura.docx' }))
    expect(within(form).queryByText('Lectura.docx')).not.toBeInTheDocument()
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(teacherApi.deleteTopicFile).toHaveBeenCalledWith(40, 90, 8))
    expect(teacherApi.uploadTopicFile).not.toHaveBeenCalled()
  })

  it('cada tema de la sesión tiene Editar (abre su formulario) y Eliminar (con confirmación), sin desplegarlo', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.deleteTopic).mockResolvedValue(undefined)
    contentWithoutSession()
    const section = await screen.findByRole('region', { name: 'Tema Pruebas' }, { timeout: 5000 })
    await user.click(within(section).getByRole('button', { name: 'Editar el tema Pruebas' }))
    expect(await screen.findByRole('form', { name: 'Editar tema' })).toBeInTheDocument()
    // La acción no despliega además el tema.
    expect(within(section).getByRole('button', { expanded: false })).toBeInTheDocument()
    await user.click(within(screen.getByRole('form', { name: 'Editar tema' })).getByRole('button', { name: 'Cancelar' }))

    await user.click(within(section).getByRole('button', { name: 'Eliminar el tema Pruebas' }))
    const confirm = await screen.findByRole('dialog', { name: '¿Eliminar el tema?' })
    expect(teacherApi.deleteTopic).not.toHaveBeenCalled()
    await user.click(within(confirm).getByRole('button', { name: 'Eliminar tema' }))
    await waitFor(() => expect(teacherApi.deleteTopic).toHaveBeenCalledWith(40, 90))
  })

  it('una sesión se edita en su asistencia y se elimina con su asistencia, tras confirmar', async () => {
    const user = userEvent.setup()
    const session = { id: 2, tutoring_id: 40, number: 1, date: '2026-09-21', topics_covered: true, topics: [{ id: 90, name: 'Pruebas', is_active: true }], attendance: [{ id: 1, enrollment_id: 70, student_id: 80, student_name: 'Ana Pérez', present: true, attendance_required: false }] }
    vi.mocked(teacherApi.allSessions).mockResolvedValue([session])
    vi.mocked(teacherApi.deleteSession).mockResolvedValue(undefined)
    const view = workspace('content')
    await user.click(within(await screen.findByRole('row', { name: /Sesión 1/ }, { timeout: 5000 })).getByRole('button', { name: 'Eliminar la Sesión 1' }))
    const confirm = await screen.findByRole('dialog', { name: '¿Eliminar la Sesión 1?' })
    expect(confirm).toHaveTextContent('con su asistencia (1 registro)')
    expect(confirm).toHaveTextContent('Sus temas se conservan y quedan sin sesión')
    await user.click(within(confirm).getByRole('button', { name: 'Eliminar sesión' }))
    await waitFor(() => expect(teacherApi.deleteSession).toHaveBeenCalledWith(40, 2))

    view.unmount()
    workspace('content')
    await user.click(within(await screen.findByRole('row', { name: /Sesión 1/ }, { timeout: 5000 })).getByRole('button', { name: 'Editar la Sesión 1' }))
    // Editar abre la asistencia de ese día.
    expect(await screen.findByRole('tab', { name: 'Asistencia', selected: true })).toBeInTheDocument()
  })

  it('al desplegar el tema se ven sus actividades y metodologías con Editar y Eliminar, en la misma pantalla', async () => {
    const user = userEvent.setup()
    const method = { id: 92, activity_id: 91, description: 'Trabajo colaborativo', is_active: true }
    const withActivity = { ...topic, activities: [
      { id: 91, topic_id: 90, name: 'Diseñar casos', duration: '30 minutos', is_active: true, methodologies: [method, { id: 93, activity_id: 91, description: 'Vieja', is_active: false }] },
      { id: 94, topic_id: 90, name: 'Deshabilitada', duration: '30 minutos', is_active: false, methodologies: [] },
    ] }
    vi.mocked(teacherApi.allTopics).mockResolvedValue([withActivity])
    vi.mocked(teacherApi.deleteActivity).mockResolvedValue(undefined)
    vi.mocked(teacherApi.deleteMethodology).mockResolvedValue(undefined)
    contentWithoutSession()
    const section = await expandTopic(user, 'Pruebas')
    // Solo lo habilitado; la ruta no suma niveles.
    const activityGroup = within(section).getByRole('group', { name: 'Actividad Diseñar casos' })
    expect(within(section).queryByRole('group', { name: 'Actividad Deshabilitada' })).not.toBeInTheDocument()
    expect(within(activityGroup).getByText('Trabajo colaborativo')).toBeInTheDocument()
    expect(within(activityGroup).queryByText('Vieja')).not.toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Ruta' })).getAllByRole('button').map((item) => item.textContent)).toEqual(['Sesiones'])

    await user.click(within(activityGroup).getByRole('button', { name: 'Editar la actividad Diseñar casos' }))
    expect(await screen.findByRole('form', { name: 'Editar actividad' })).toBeInTheDocument()
    await user.click(within(screen.getByRole('form', { name: 'Editar actividad' })).getByRole('button', { name: 'Cancelar' }))

    await user.click(within(activityGroup).getByRole('button', { name: /^Eliminar la metodología/ }))
    await user.click(within(await screen.findByRole('dialog', { name: '¿Eliminar la metodología?' })).getByRole('button', { name: 'Eliminar metodología' }))
    await waitFor(() => expect(teacherApi.deleteMethodology).toHaveBeenCalledWith(40, 90, 91, 92))

    await user.click(within(activityGroup).getByRole('button', { name: 'Eliminar la actividad Diseñar casos' }))
    const confirm = await screen.findByRole('dialog', { name: '¿Eliminar la actividad?' })
    expect(confirm).toHaveTextContent('con sus metodologías')
    await user.click(within(confirm).getByRole('button', { name: 'Eliminar actividad' }))
    await waitFor(() => expect(teacherApi.deleteActivity).toHaveBeenCalledWith(40, 90, 91))
  })

  it('edita el tema desde su bloque y lo deshabilita desde la cabecera del modal', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.updateTopic).mockResolvedValue({ ...topic, name: 'Pruebas 2' })
    vi.mocked(teacherApi.deactivateTopic).mockResolvedValue({ ...topic, is_active: false })
    contentWithoutSession()
    await user.click(await screen.findByRole('button', { name: 'Editar el tema Pruebas' }, { timeout: 5000 }))
    const form = await screen.findByRole('form', { name: 'Editar tema' })
    // Sin cambios no se puede guardar.
    expect(within(form).getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    await user.type(within(form).getByLabelText(/^Nombre/), ' 2')
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(teacherApi.updateTopic).toHaveBeenCalledWith(40, 90, { name: 'Pruebas 2', description: '' }))

    await user.click(await screen.findByRole('button', { name: 'Editar el tema Pruebas' }))
    await user.click(await screen.findByRole('button', { name: 'Deshabilitar tema' }))
    await user.click(within(await screen.findByRole('dialog', { name: '¿Deshabilitar tema?' })).getByRole('button', { name: 'Deshabilitar tema' }))
    await waitFor(() => expect(teacherApi.deactivateTopic).toHaveBeenCalledWith(40, 90))
    expect(await screen.findByRole('heading', { name: 'Temas sin sesión' })).toBeInTheDocument()
  })

  it('registra el tema con sus actividades y metodologías en un solo formulario', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.createTopic).mockResolvedValue({ ...topic, id: 95, name: 'Pruebas unitarias' })
    vi.mocked(teacherApi.createActivity).mockResolvedValue({ id: 200, topic_id: 95, name: 'Diseñar casos', duration: '1 hora y 30 minutos', is_active: true, methodologies: [] })
    vi.mocked(teacherApi.createMethodology).mockImplementation(async (_id, _topic, activity, input) => ({ id: 300, activity_id: activity, description: input.description, is_active: true }))
    contentWithoutSession()
    await user.click(await screen.findByRole('button', { name: 'Registrar tema' }))
    const form = screen.getByRole('form', { name: 'Registrar tema' })
    await user.type(within(form).getByLabelText(/^Nombre/), 'Pruebas unitarias')
    // La primera actividad ya viene lista para escribir, con su primera metodología.
    const first = within(form).getByRole('region', { name: 'Actividad 1' })
    await user.type(within(first).getByRole('textbox', { name: /^Actividad/ }), 'Diseñar casos')
    await choose(user, within(first).getByRole('combobox', { name: 'Horas de la actividad 1' }), '1 hora')
    await user.type(within(first).getByRole('textbox', { name: 'Metodología 1 de la actividad 1' }), 'Trabajo en parejas')
    await user.click(within(first).getByRole('button', { name: 'Agregar metodología' }))
    await user.type(within(first).getByRole('textbox', { name: 'Metodología 2 de la actividad 1' }), 'Revisión del docente')
    // Una actividad agregada y dejada en blanco no se registra.
    await user.click(within(form).getByRole('button', { name: 'Agregar actividad' }))
    expect(within(form).getByRole('region', { name: 'Actividad 2' })).toBeInTheDocument()
    await user.click(within(form).getByRole('button', { name: 'Registrar tema' }))

    await waitFor(() => expect(teacherApi.createMethodology).toHaveBeenCalledTimes(2))
    expect(teacherApi.createTopic).toHaveBeenCalledWith(40, { name: 'Pruebas unitarias', description: '' })
    expect(teacherApi.createActivity).toHaveBeenCalledTimes(1)
    expect(teacherApi.createActivity).toHaveBeenCalledWith(40, 95, { name: 'Diseñar casos', duration: '1 hora y 30 minutos' })
    expect(teacherApi.createMethodology).toHaveBeenNthCalledWith(1, 40, 95, 200, { description: 'Trabajo en parejas' })
    expect(teacherApi.createMethodology).toHaveBeenNthCalledWith(2, 40, 95, 200, { description: 'Revisión del docente' })
  })

  it('al editar el tema corrige, quita y deshace actividades y metodologías; lo quitado se elimina al guardar', async () => {
    const user = userEvent.setup()
    const methods = [{ id: 92, activity_id: 91, description: 'Trabajo colaborativo', is_active: true }, { id: 93, activity_id: 91, description: 'Exposición', is_active: true }]
    const withActivities = { ...topic, activities: [
      { id: 91, topic_id: 90, name: 'Diseñar casos', duration: '30 minutos', is_active: true, methodologies: methods },
      { id: 94, topic_id: 90, name: 'Ejecutar pruebas', duration: '1 hora', is_active: true, methodologies: [] },
      { id: 95, topic_id: 90, name: 'Actividad vieja', duration: '30 minutos', is_active: false, methodologies: [] },
    ] }
    vi.mocked(teacherApi.allTopics).mockResolvedValue([withActivities])
    vi.mocked(teacherApi.updateTopic).mockResolvedValue(withActivities)
    vi.mocked(teacherApi.updateActivity).mockResolvedValue(withActivities.activities[0])
    vi.mocked(teacherApi.deleteActivity).mockResolvedValue(undefined)
    vi.mocked(teacherApi.deleteMethodology).mockResolvedValue(undefined)
    contentWithoutSession()
    await user.click(await screen.findByRole('button', { name: 'Editar el tema Pruebas' }, { timeout: 5000 }))
    const form = await screen.findByRole('form', { name: 'Editar tema' })
    // Solo las actividades habilitadas, cada una con sus metodologías.
    expect(within(form).getAllByRole('region').map((item) => item.getAttribute('aria-label'))).toEqual(['Actividad 1', 'Actividad 2'])
    const first = within(form).getByRole('region', { name: 'Actividad 1' })
    expect(within(first).getByRole('textbox', { name: 'Metodología 2 de la actividad 1' })).toHaveValue('Exposición')

    const name = within(first).getByRole('textbox', { name: /^Actividad/ })
    await user.clear(name)
    await user.type(name, 'Diseñar casos de prueba')
    await user.click(within(first).getByRole('button', { name: 'Quitar la metodología 2 de la actividad 1' }))
    expect(within(form).getByText(/Exposición/)).toHaveClass('line-through')
    // Quitar y deshacer: la actividad vuelve sin cambios.
    await user.click(within(form).getByRole('button', { name: 'Quitar la actividad 2' }))
    await user.click(within(form).getAllByRole('button', { name: 'Deshacer' }).at(-1) as HTMLElement)
    expect(within(form).getByRole('region', { name: 'Actividad 2' })).toBeInTheDocument()
    await user.click(within(form).getByRole('button', { name: 'Quitar la actividad 2' }))
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(teacherApi.deleteActivity).toHaveBeenCalledWith(40, 90, 94))
    expect(teacherApi.updateActivity).toHaveBeenCalledWith(40, 90, 91, { name: 'Diseñar casos de prueba', duration: '30 minutos' })
    expect(teacherApi.deleteMethodology).toHaveBeenCalledWith(40, 90, 91, 93)
    expect(teacherApi.deactivateActivity).not.toHaveBeenCalled()
    expect(teacherApi.updateMethodology).not.toHaveBeenCalled()
    expect(teacherApi.createActivity).not.toHaveBeenCalled()
  })

  it('agrega actividades y metodologías desde el tema desplegado, sin salir de la sesión', async () => {
    const user = userEvent.setup()
    let topics = [topic]
    vi.mocked(teacherApi.allTopics).mockImplementation(async () => topics)
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
    contentWithoutSession()
    const section = await expandTopic(user, 'Pruebas')
    expect(within(section).getByText('Este tema aún no tiene actividades.')).toBeInTheDocument()
    await user.click(within(section).getByRole('button', { name: 'Agregar actividad' }))
    await user.type(screen.getByLabelText(/^Nombre/), 'Diseñar casos')
    expect(screen.queryByRole('button', { name: '30m' })).not.toBeInTheDocument()
    await user.click(within(screen.getByRole('form', { name: 'Registrar actividad' })).getByRole('button', { name: 'Registrar actividad' }))
    await waitFor(() => expect(teacherApi.createActivity).toHaveBeenCalledWith(40, 90, { name: 'Diseñar casos', duration: '30 minutos' }))

    // El tema sigue desplegado con la actividad nueva.
    const activityGroup = await within(section).findByRole('group', { name: 'Actividad Diseñar casos' })
    await user.click(within(activityGroup).getByRole('button', { name: 'Agregar metodología' }))
    await user.type(screen.getByLabelText(/^Descripción/), 'Trabajo colaborativo')
    await user.click(within(screen.getByRole('form', { name: 'Registrar metodología' })).getByRole('button', { name: 'Registrar metodología' }))
    expect(await within(section).findByText('Trabajo colaborativo')).toBeInTheDocument()
    expect(teacherApi.createMethodology).toHaveBeenCalledWith(40, 90, 91, { description: 'Trabajo colaborativo' })
    expect(screen.getByRole('heading', { name: 'Temas sin sesión' })).toBeInTheDocument()
  })

  it('muestra bajo el nombre el error del servidor y lo quita al cerrar el formulario', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.createTopic).mockRejectedValue(new ApiError(422, { message: 'Ya existe un tema con ese nombre.', errors: { name: ['Ya existe un tema con ese nombre.'] } }))
    contentWithoutSession()
    await user.click(await screen.findByRole('button', { name: 'Registrar tema' }))
    const form = screen.getByRole('form', { name: 'Registrar tema' })
    const name = within(form).getByLabelText(/^Nombre/)
    await user.type(name, 'Pruebas')
    await user.click(within(form).getByRole('button', { name: 'Registrar tema' }))
    const message = await within(form).findByText('Ya existe un tema con ese nombre.')
    expect(message.closest('[data-slot="field"]')).toContainElement(name)
    expect(within(form).getAllByText('Ya existe un tema con ese nombre.')).toHaveLength(1)
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(within(form).queryByText(/podrán descargarlos/)).not.toBeInTheDocument()

    await user.click(within(form).getByRole('button', { name: 'Cancelar' }))
    await user.click(await screen.findByRole('button', { name: 'Sí, descartar y salir' }))
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Registrar tema' })).not.toBeInTheDocument())
    expect(screen.queryByText('Ya existe un tema con ese nombre.')).not.toBeInTheDocument()
    await expandTopic(user, 'Pruebas')
    expect(screen.queryByText('Ya existe un tema con ese nombre.')).not.toBeInTheDocument()
  })

  it('nombra cada metodología, la duración por horas y minutos, y confirma con un texto propio de cada contenido', async () => {
    const user = userEvent.setup()
    const success = vi.spyOn(sonnerToast, 'success')
    const method = { id: 92, activity_id: 91, description: 'Trabajo colaborativo', is_active: true }
    const activity = { id: 91, topic_id: 90, name: 'Diseñar casos', duration: '30 minutos', is_active: true, methodologies: [method] }
    vi.mocked(teacherApi.allTopics).mockResolvedValue([{ ...topic, activities: [activity] }])
    vi.mocked(teacherApi.updateActivity).mockResolvedValue(activity)
    vi.mocked(teacherApi.deactivateMethodology).mockResolvedValue({ ...method, is_active: false })
    // Un enlace antiguo a un tema abre su sesión con el tema ya desplegado.
    show(<TeacherTutoringsPage />, '/panel/teacher-tutorings?tutoring=40&tab=content&topic=90')
    await user.click(await screen.findByRole('button', { name: 'Editar la actividad Diseñar casos' }, { timeout: 5000 }))
    const form = await screen.findByRole('form', { name: 'Editar actividad' })
    expect(within(form).getByRole('combobox', { name: 'Horas' })).toBeInTheDocument()
    await choose(user, within(form).getByRole('combobox', { name: 'Minutos' }), '45 min')
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(success.mock.calls.at(-1)?.[0]).toMatch(/^Actividad guardada\.?$/))

    await user.click(await screen.findByRole('button', { name: 'Editar la metodología «Trabajo colaborativo»' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Editar metodología' })).getByRole('button', { name: 'Deshabilitar metodología' }))
    const confirm = await screen.findByRole('dialog', { name: '¿Deshabilitar metodología?' })
    await user.click(within(confirm).getByRole('button', { name: 'Deshabilitar metodología' }))
    await waitFor(() => expect(teacherApi.deactivateMethodology).toHaveBeenCalledWith(40, 90, 91, 92))
    await waitFor(() => expect(success.mock.calls.at(-1)?.[0]).toMatch(/^Metodología deshabilitada\.?$/))
  })

  it('un enlace antiguo a un tema abre su sesión con el tema desplegado y vuelve a la lista de sesiones', async () => {
    const user = userEvent.setup()
    show(<TeacherTutoringsPage />, '/panel/teacher-tutorings?tutoring=40&tab=content&topic=90')
    expect(await screen.findByRole('heading', { name: 'Temas sin sesión' }, { timeout: 5000 })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Tema Pruebas' })).getByRole('button', { expanded: true })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sesiones' }))
    expect(await screen.findByRole('row', { name: /Temas sin sesión/ })).toBeInTheDocument()
  })

  it('ya no ofrece el informe libre y sigue mostrando como texto los informes libres anteriores', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.reports).mockResolvedValue(paginated([{ id: 110, type: 'Informe de tutorías', author_id: 5, author_name: 'María López', generated_at: '2026-09-29T12:00:00Z', content: 'Estudiantes inscritos: 1', summary: null }]))
    show(<TeacherReportsStandalonePage />, '/panel/teacher-reports')
    await user.click(await screen.findByRole('row', { name: /Calidad de software/ }))
    expect(await screen.findByRole('button', { name: 'Reportes oficiales' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enviar informe' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('row', { name: /María López/ }))
    // El informe se lee en su propia pantalla, no en un modal, y se vuelve a la lista.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Informe de tutorías' })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Contenido del informe' })).toHaveTextContent('Estudiantes inscritos: 1')
    await user.click(screen.getByRole('button', { name: 'Volver a los informes' }))
    expect(await screen.findByRole('row', { name: /María López/ })).toBeInTheDocument()
  })

  it('la tutoría y el informe abiertos van en la URL: «atrás» del navegador vuelve a cada lista', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.reports).mockResolvedValue(paginated([{ id: 110, type: 'Informe de tutorías', author_id: 5, author_name: 'María López', generated_at: '2026-09-29T12:00:00Z', content: 'Estudiantes inscritos: 1', summary: null }]))
    show(<TeacherReportsStandalonePage />, '/panel/teacher-reports')
    await user.click(await screen.findByRole('row', { name: /Calidad de software/ }))
    // La pantalla de la tutoría lleva su título principal, como las demás pantallas de detalle.
    expect(await screen.findByRole('heading', { level: 1, name: 'Calidad de software' })).toBeInTheDocument()
    expect(screen.queryByText(/formato institucional/)).not.toBeInTheDocument()
    await user.click(await screen.findByRole('row', { name: /María López/ }))
    expect(screen.getByRole('heading', { name: 'Informe de tutorías' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Atrás del navegador' }))
    expect(await screen.findByRole('row', { name: /María López/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Atrás del navegador' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Informes' })).toBeInTheDocument()
  })

  it('prepara el reporte de evaluación diagnóstica con el formato oficial y lo envía a coordinación', async () => {
    const user = userEvent.setup()
    const summary: DiagnosticReportSummary = {
      format: 'diagnostic_evaluation', faculty: 'Ciencias Administrativas', career: 'Software', date: today, teacher: 'María López',
      subject: 'Calidad de software', cycle: 2, cycle_name: 'Segundo', academic_period: '2026-2', section: 'A',
      students_listed: 3, students_evaluated: 2, observations: null, coordinator: 'Galuth García',
      groups: [
        { key: 'low', label: 'Bajo', range_label: '0% - 50%', count: 1, percentage: 50, action_plan: ['Semana de adaptación de Conocimientos', 'Tutorías adicionales según el criterio del docente y del coordinador', 'Estudio Autónomo'] },
        { key: 'medium', label: 'Medio', range_label: '51% - 69%', count: 0, percentage: 0, action_plan: ['Semana de adaptación de Conocimientos', 'Tutorías adicionales según el criterio del docente y del coordinador'] },
        { key: 'high', label: 'Alto', range_label: '70% - 100%', count: 1, percentage: 50, action_plan: ['Semana de adaptación de Conocimientos'] },
      ],
      grades: [
        { number: 1, identification: '0201234567', name: 'Ana Pérez', grade: 4.5, group: 'Bajo' },
        { number: 2, identification: '0207654321', name: 'Luis Vera', grade: null, group: null },
        { number: 3, identification: '0209999999', name: 'Sofía Mora', grade: 8.25, group: 'Alto' },
      ],
    }
    const report = { id: 120, type: 'Reporte de la evaluación diagnóstica', author_id: 5, author_name: 'María López', generated_at: '2026-09-29T12:00:00Z', content: 'REPORTE', summary: { ...summary, observations: 'Refuerzo de derivadas.' } }
    vi.mocked(teacherApi.diagnosticReportPreview).mockResolvedValue(summary)
    vi.mocked(teacherApi.sendDiagnosticReport).mockImplementation(async () => { vi.mocked(teacherApi.reports).mockResolvedValue(paginated([report])); return report })

    show(<TeacherReportsStandalonePage />, '/panel/teacher-reports')
    await user.click(await screen.findByRole('row', { name: /Calidad de software/ }))
    await user.click(screen.getByRole('button', { name: 'Reportes oficiales' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Reporte de Evaluación Diagnóstica' }))

    const form = screen.getByRole('form', { name: 'Reporte de la evaluación diagnóstica' })
    const parameters = await within(form).findByRole('table', { name: 'Parámetros de la evaluación al estudiante' })
    expect(within(parameters).getByRole('rowheader', { name: 'Bajo (0% - 50%)' })).toBeInTheDocument()
    expect(within(parameters).getByText('Estudio Autónomo', { exact: false })).toBeInTheDocument()
    const grades = within(form).getByRole('table', { name: 'Calificaciones de la evaluación diagnóstica' })
    expect(within(grades).getByText('No asiste')).toBeInTheDocument()
    expect(within(grades).getByText('4,5')).toBeInTheDocument()
    expect(within(form).getByText('Galuth García')).toBeInTheDocument()

    await user.type(within(form).getByLabelText(/Observaciones/), 'Refuerzo de derivadas.')
    expect(within(parameters).getByText('Refuerzo de derivadas.')).toBeInTheDocument()
    await user.click(within(form).getByRole('button', { name: 'Enviar a coordinación' }))

    expect(teacherApi.diagnosticReportPreview).toHaveBeenCalledWith(40, today)
    expect(teacherApi.sendDiagnosticReport).toHaveBeenCalledWith(40, { date: today, observations: 'Refuerzo de derivadas.' })
    await user.click(await screen.findByRole('row', { name: /María López/ }))
    expect(within(screen.getByRole('article', { name: 'Contenido del informe' })).getByRole('table', { name: 'Parámetros de la evaluación al estudiante' })).toHaveTextContent('Refuerzo de derivadas.')
  })

  it('no permite enviar el reporte diagnóstico sin calificaciones registradas', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.diagnosticReportPreview).mockResolvedValue({
      format: 'diagnostic_evaluation', faculty: null, career: 'Software', date: today, teacher: 'María López', subject: 'Calidad de software',
      cycle: 2, cycle_name: 'Segundo', academic_period: '2026-2', section: 'A', students_listed: 1, students_evaluated: 0, observations: null,
      coordinator: null, groups: [], grades: [{ number: 1, identification: '0201234567', name: 'Ana Pérez', grade: null, group: null }],
    })

    show(<TeacherReportsStandalonePage />, '/panel/teacher-reports')
    await user.click(await screen.findByRole('row', { name: /Calidad de software/ }))
    await user.click(screen.getByRole('button', { name: 'Reportes oficiales' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Reporte de Evaluación Diagnóstica' }))

    expect(await screen.findByText(/Aún no hay calificaciones diagnósticas registradas/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar a coordinación' })).toBeDisabled()
  })

  it('ofrece los cuatro formatos oficiales y envía las calificaciones diagnósticas a coordinación', async () => {
    const user = userEvent.setup()
    const summary = {
      format: 'diagnostic_grades' as const, faculty: 'Ciencias Administrativas', career: 'Software', subject: 'Calidad de software',
      cycle: 2, cycle_name: 'Segundo', academic_period: '2026-2', section: 'A', teacher: 'María López', students_listed: 2, students_evaluated: 1,
      grades: [
        { number: 1, identification: '0201234567', name: 'Ana Pérez', grade: 5.75 },
        { number: 2, identification: '0207654321', name: 'Luis Vera', grade: null },
      ],
    }
    const report = { id: 121, type: 'Calificaciones de la evaluación diagnóstica', author_id: 5, author_name: 'María López', generated_at: '2026-09-29T12:00:00Z', content: 'CALIFICACIONES', summary }
    vi.mocked(teacherApi.diagnosticGradesPreview).mockResolvedValue(summary)
    vi.mocked(teacherApi.sendDiagnosticGrades).mockImplementation(async () => { vi.mocked(teacherApi.reports).mockResolvedValue(paginated([report])); return report })

    show(<TeacherReportsStandalonePage />, '/panel/teacher-reports')
    await user.click(await screen.findByRole('row', { name: /Calidad de software/ }))
    await user.click(screen.getByRole('button', { name: 'Reportes oficiales' }))
    expect((await screen.findAllByRole('menuitem')).map((item) => item.textContent)).toEqual([
      'Reporte de Evaluación Diagnóstica', 'Calificaciones Diagnósticas', 'Seguimiento de Tutorías', 'Informe Final PAO',
    ])
    await user.click(screen.getByRole('menuitem', { name: 'Calificaciones Diagnósticas' }))

    const form = screen.getByRole('form', { name: 'Calificaciones diagnósticas' })
    const grades = await within(form).findByRole('table', { name: 'Calificaciones de la evaluación diagnóstica' })
    expect(within(grades).getByText('5,75')).toBeInTheDocument()
    expect(within(grades).getByText('No asiste')).toBeInTheDocument()
    await user.click(within(form).getByRole('button', { name: 'Enviar a coordinación' }))

    expect(teacherApi.sendDiagnosticGrades).toHaveBeenCalledWith(40)
    await user.click(await screen.findByRole('row', { name: /María López/ }))
    expect(within(screen.getByRole('article', { name: 'Contenido del informe' })).getByRole('table', { name: 'Calificaciones de la evaluación diagnóstica' })).toHaveTextContent('Luis Vera')
  })

  it('prepara el reporte de seguimiento de un parcial con el formato oficial y lo envía a coordinación', async () => {
    const user = userEvent.setup()
    const summary: FollowUpReportSummary = {
      format: 'tutoring_follow_up', faculty: 'Ciencias Administrativas', career: 'Software', subject: 'Calidad de software',
      academic_period: '2026-2', section: 'A', coordinator: 'Galuth García', teacher: 'María López', date: today,
      partial: 1, partial_label: 'primer parcial', partial_title: 'Primer Parcial', from: '2026-01-01', to: today,
      background: 'Tras la evaluación diagnóstica inicial, se implementaron tutorías individuales y grupales en la CARRERA DE SOFTWARE como apoyo pedagógico.',
      session_count: 1,
      activities: [
        { date: '2026-03-19', topic: 'Regla del Trapecio', activity: 'Resolución de ejercicios', methodology: 'Aprendizaje basado en problemas (ABP)' },
        { date: '2026-03-19', topic: 'Integración de Romberg', activity: null, methodology: null },
      ],
      attendance: { at_risk_total: 10, at_risk_attending: 9, not_at_risk_attending: 2, unclassified_attending: 1 },
      improved: [{ number: 1, name: 'Ana Pérez', diagnostic: 3, partial: 6 }],
      observations: null,
    }
    const report = { id: 130, type: 'Reporte de seguimiento de tutorías (primer parcial)', author_id: 5, author_name: 'María López', generated_at: '2026-09-29T12:00:00Z', content: 'REPORTE', summary: { ...summary, observations: 'Temas elegidos por los estudiantes.' } }
    vi.mocked(teacherApi.followUpReportPreview).mockResolvedValue(summary)
    vi.mocked(teacherApi.sendFollowUpReport).mockImplementation(async () => { vi.mocked(teacherApi.reports).mockResolvedValue(paginated([report])); return report })

    show(<TeacherReportsStandalonePage />, '/panel/teacher-reports')
    await user.click(await screen.findByRole('row', { name: /Calidad de software/ }))
    await user.click(screen.getByRole('button', { name: 'Reportes oficiales' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Seguimiento de Tutorías' }))

    const form = screen.getByRole('form', { name: 'Reporte de seguimiento a las tutorías' })
    // Paso 1: el período del reporte (todo obligatorio); el documento se revisa en el paso 2.
    expect(within(form).queryByRole('navigation', { name: /Pasos de/ })).not.toBeInTheDocument()
    for (const field of ['Parcial', 'Tutorías desde', 'Tutorías hasta', 'Fecha de presentación']) {
      expect(within(within(form).getByText(field).closest('label') as HTMLElement).getByText('(obligatorio)')).toBeInTheDocument()
    }
    expect(within(form).queryByRole('table', { name: 'Actividades programadas' })).not.toBeInTheDocument()
    expect(within(form).queryByRole('button', { name: 'Enviar a coordinación' })).not.toBeInTheDocument()
    await user.click(within(form).getByRole('button', { name: 'Siguiente' }))
    const activities = await within(form).findByRole('table', { name: 'Actividades programadas' })
    expect(within(activities).getAllByText('2026/03/19')).toHaveLength(2)
    expect(within(activities).getByText('Aprendizaje basado en problemas (ABP)')).toBeInTheDocument()
    const attendanceTable = within(form).getByRole('table', { name: 'Número de estudiantes que asisten a tutorías' })
    expect(within(attendanceTable).getAllByRole('cell').map((node) => node.textContent)).toEqual(['10', '9', '2'])
    expect(within(form).getByText(/Además asistieron 1 estudiante sin evaluación diagnóstica/)).toBeInTheDocument()
    const improved = within(form).getByRole('table', { name: 'Estudiantes que mejoraron su rendimiento' })
    expect(within(improved).getByRole('columnheader', { name: 'Evaluación Primer Parcial' })).toBeInTheDocument()
    expect(within(improved).getByText('3,00')).toBeInTheDocument()
    expect(within(improved).getByText('6,00')).toBeInTheDocument()

    await user.click(within(form).getByRole('button', { name: 'Atrás' }))
    await choose(user, within(form).getByLabelText(/^Parcial/), 'Segundo parcial')
    await waitFor(() => expect(teacherApi.followUpReportPreview).toHaveBeenLastCalledWith(40, { partial: 2, from: '2026-01-01', to: today, date: today }))
    await user.click(within(form).getByRole('button', { name: 'Siguiente' }))
    await user.type(within(form).getByLabelText(/Observación/), 'Temas elegidos por los estudiantes.')
    await user.click(within(form).getByRole('button', { name: 'Enviar a coordinación' }))

    expect(teacherApi.sendFollowUpReport).toHaveBeenCalledWith(40, { partial: 2, from: '2026-01-01', to: today, date: today, observations: 'Temas elegidos por los estudiantes.' })
    await user.click(await screen.findByRole('row', { name: /María López/ }))
    expect(within(screen.getByRole('article', { name: 'Contenido del informe' })).getByRole('table', { name: 'Actividades programadas' })).toHaveTextContent('Regla del Trapecio')
  })

  it('prepara el informe final PAO con la matriz oficial y lo envía a coordinación', async () => {
    const user = userEvent.setup()
    const row = { tutoring_id: 40, subject: 'Calidad de software', cycle: 2, cycle_name: 'Segundo', section: 'A', weekly_hours: 3, hours_done: 4.5, enrolled: 4, at_risk: 3, at_risk_attending: 2, at_risk_attending_passed: 1, at_risk_improved: 2, effectiveness: 50, observation: null }
    const summary: FinalPaoReportSummary = {
      format: 'final_pao', faculty: 'Ciencias Administrativas', career: 'Software', academic_period: '2026-2', date: today, report_number: '01-TA-2026',
      teacher: { name: 'María López', email: 'maria.lopez@ueb.edu.ec', extension: null, position: 'Docente' },
      coordinator: { name: 'Galuth García', email: 'galuth@ueb.edu.ec', extension: null, position: 'Coordinador/a de Carrera' },
      subject_line: 'Informe de ejecución de tutorías académicas PAO 2026-2',
      objective: 'Presentar los resultados de las tutorías académicas ejecutadas en las asignaturas de Calidad de software de la carrera de Software en el periodo académico 2026-2.',
      background: 'Basado en la normativa vigente, la tutoría académica se consolida como un mecanismo estratégico.',
      schedule: [{ subject: 'Calidad de software', section: 'A', day: 'miercoles', start: '14:00', end: '15:00', room: null }],
      matrix: [row], conclusions: null, recommendations: null,
      improved: [{ subject: 'Calidad de software', section: 'A', students: [{ number: 1, name: 'Ana Pérez', first: 6, second: 8 }] }],
      register: [{ subject: 'Calidad de software', section: 'A', sessions: [{ date: '2026-09-21', topics: ['Pruebas unitarias'], present: 3, total: 4 }] }],
      passing_grade: 7,
      available_tutorings: [{ id: 40, subject: 'Calidad de software', cycle: 2, section: 'A' }, { id: 41, subject: 'Métodos Numéricos', cycle: 2, section: 'A' }],
    }
    const report = { id: 140, type: 'Informe final de tutorías PAO 2026-2', author_id: 5, author_name: 'María López', generated_at: '2026-09-29T12:00:00Z', content: 'INFORME', summary: { ...summary, matrix: [{ ...row, observation: 'Asistencia constante.' }], available_tutorings: undefined } }
    vi.mocked(teacherApi.finalPaoReportPreview).mockResolvedValue(summary)
    vi.mocked(teacherApi.sendFinalPaoReport).mockImplementation(async () => { vi.mocked(teacherApi.reports).mockResolvedValue(paginated([report])); return report })

    show(<TeacherReportsStandalonePage />, '/panel/teacher-reports')
    await user.click(await screen.findByRole('row', { name: /Calidad de software/ }))
    await user.click(screen.getByRole('button', { name: 'Reportes oficiales' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Informe Final PAO' }))

    const form = screen.getByRole('form', { name: 'Informe final PAO' })
    // Paso 1: datos del informe y asignaturas incluidas; el documento se revisa en el paso 2.
    expect(within(within(form).getByText('Fecha de informe').closest('label') as HTMLElement).getByText('(obligatorio)')).toBeInTheDocument()
    expect(within(form).queryByRole('table', { name: 'Matriz de operacionalización de tutorías' })).not.toBeInTheDocument()
    expect(await within(form).findByLabelText('Calidad de software · Paralelo A', { selector: 'button' })).toBeDisabled()
    await user.click(within(form).getByLabelText('Métodos Numéricos · Paralelo A', { selector: 'button' }))
    await waitFor(() => expect(teacherApi.finalPaoReportPreview).toHaveBeenLastCalledWith(40, { date: today, tutoring_ids: [40, 41] }))
    await user.click(within(form).getByRole('button', { name: 'Siguiente' }))

    const matrix = await within(form).findByRole('table', { name: 'Matriz de operacionalización de tutorías' })
    expect(within(matrix).getByRole('columnheader', { name: '% Efectividad de las tutorías' })).toBeInTheDocument()
    expect(within(matrix).getByText('50%')).toBeInTheDocument()
    expect(within(matrix).getByText('4,5')).toBeInTheDocument()
    expect(within(form).getByRole('table', { name: 'Horario de tutorías' })).toHaveTextContent('Miércoles')
    expect(within(form).getByRole('table', { name: 'Estudiantes que mejoraron su rendimiento en Calidad de software' })).toHaveTextContent('8,00')
    await user.type(within(form).getByLabelText(/Calidad de software · Paralelo A/, { selector: 'input' }), 'Asistencia constante.')
    expect(within(matrix).getByText('Asistencia constante.')).toBeInTheDocument()
    await user.type(within(form).getByLabelText(/Conclusiones/), 'Se redujo el riesgo.')
    await user.click(within(form).getByRole('button', { name: 'Enviar a coordinación' }))

    expect(teacherApi.sendFinalPaoReport).toHaveBeenCalledWith(40, {
      date: today, report_number: '01-TA-2026', tutoring_ids: [40], observations: { 40: 'Asistencia constante.' }, conclusions: 'Se redujo el riesgo.', recommendations: '',
    })
    await user.click(await screen.findByRole('row', { name: /María López/ }))
    expect(within(screen.getByRole('article', { name: 'Contenido del informe' })).getByRole('table', { name: 'Matriz de operacionalización de tutorías' })).toHaveTextContent('Asistencia constante.')
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
          attendance_required: false,
        },
        {
          id: 2,
          enrollment_id: 71,
          student_id: 81,
          student_name: 'Carlos Ausente',
          student_identification: '0209998877',
          student_email: 'carlos@ueb.edu.ec',
          present: false,
          attendance_required: false,
        },
      ],
    }
    vi.mocked(teacherApi.sessions).mockResolvedValue(paginated([session]))
    show(<TeacherReportsStandalonePage />, '/panel/teacher-reports')
    await user.click(await screen.findByRole('row', { name: /Calidad de software/ }))

    // Cambiar a la pestaña de Revisión de actividades
    await user.click(screen.getByRole('tab', { name: /Revisión de actividades/i }))
    expect(await screen.findByText('Fechas de tutorías con asistencia registrada')).toBeInTheDocument()

    // Comprobar que aparece la sesión con su día y resumen
    expect(screen.getByText('Sábado')).toBeInTheDocument()
    expect(screen.getByText(/1 de 2 presentes/i)).toBeInTheDocument()
    expect(screen.getByText(/1 actividad/i)).toBeInTheDocument()

    // Abrir la sesión para revisar
    await user.click(screen.getByRole('row', { name: /Sábado/ }))

    // Comprobar detalle de actividades realizadas
    expect(await screen.findByText('Diseño de microservicios')).toBeInTheDocument()
    expect(screen.getByText(/Tema: Arquitectura/)).toBeInTheDocument()
    expect(screen.getByText('45 minutos')).toBeInTheDocument()
    expect(screen.getByText('Exposición dialogada')).toBeInTheDocument()

    // Comprobar que solo los estudiantes presentes se listan como asistentes
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('0201112233 · ana.perez@ueb.edu.ec')).toBeInTheDocument()
    expect(screen.queryByText('Carlos Ausente')).not.toBeInTheDocument()

    // Volver a la lista, también con «atrás» del navegador
    await user.click(screen.getByRole('button', { name: /Volver a las fechas de tutoría/i }))
    expect(await screen.findByText('Fechas de tutorías con asistencia registrada')).toBeInTheDocument()
    await user.click(screen.getByRole('row', { name: /Sábado/ }))
    expect(await screen.findByText('Diseño de microservicios')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Atrás del navegador' }))
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
    // Mismos textos que en Seguimiento: «Participación» y «Docente tutor».
    expect(screen.getByRole('columnheader', { name: 'Participación' })).toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: /Calidad en APIs/ })).getByText('Docente tutor')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Filtrar por Participación'))
    expect(await screen.findByRole('option', { name: 'Docente tutor' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await choose(user, screen.getByLabelText('Filtrar por Participación'), 'Par académico')
    await waitFor(() => expect(teacherApi.degreeAssignments).toHaveBeenLastCalledWith({ page: 1, search: '', role: 'par_academico' }))
    await user.click(screen.getByText('Calidad en APIs'))
    expect(await screen.findByText('Investigación de calidad.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Aprobar|Rechazar/ })).not.toBeInTheDocument()
  })

  const mockTrackingTopic = {
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

  it('permite al docente consultar el seguimiento de sus temas y ver el detalle sin pestañas ni cédula en el encabezado', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.degreeTracking).mockResolvedValue(paginated([mockTrackingTopic]))
    vi.mocked(teacherApi.degreeTrackingTopic).mockResolvedValue(mockTrackingTopic)

    show(<TeacherDegreeTrackingPage />, '/panel/teacher-degree-tracking')

    // Debe mostrar el tema en la tabla
    expect(await screen.findByText('Desarrollo de Software Seguro')).toBeInTheDocument()
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Participación' })).toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: /Desarrollo de Software Seguro/ })).getByText('Docente tutor')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Filtrar por Participación'))
    expect(await screen.findByRole('option', { name: 'Docente tutor' })).toBeInTheDocument()
    await user.keyboard('{Escape}')

    // Al abrir el detalle ya no hay pestañas en pantalla (se navegan desde el sidebar)
    await user.click(screen.getByText('Desarrollo de Software Seguro'))
    expect(await screen.findByText('Estado de la Ficha de Seguimiento')).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.getByText('Desarrollo de Software Seguro')).toBeInTheDocument()
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('Docente tutor')).toBeInTheDocument()
    // El estado de la ficha es un estado: badge con texto legible, no el valor crudo.
    const status = screen.getByText('En progreso', { selector: '[data-slot="badge"]' })
    expect(status).toBeInTheDocument()
    expect(screen.queryByText(/en_progreso/i)).not.toBeInTheDocument()
    // La cédula ya no se muestra en el encabezado del tema
    expect(screen.queryByText(/0201234567/)).not.toBeInTheDocument()

    // Volver a la lista
    await user.click(screen.getByRole('button', { name: /Volver a mis temas/i }))
    expect(await screen.findByText('50%')).toBeInTheDocument()
  })

  it('redondea el avance del tema en la lista y en la ficha', async () => {
    const user = userEvent.setup()
    const partial = { ...mockTrackingTopic, tracking: { ...mockTrackingTopic.tracking, progress_percentage: 66.6667 } }
    vi.mocked(teacherApi.degreeTracking).mockResolvedValue(paginated([partial]))
    vi.mocked(teacherApi.degreeTrackingTopic).mockResolvedValue(partial)
    show(<TeacherDegreeTrackingPage />, '/panel/teacher-degree-tracking')
    expect(await screen.findByText('67%')).toBeInTheDocument()
    await user.click(screen.getByText('Desarrollo de Software Seguro'))
    expect(await screen.findByRole('progressbar', { name: 'Progreso general' })).toHaveAttribute('aria-valuenow', '67')
    expect(screen.queryByText(/66\.6/)).not.toBeInTheDocument()
  })

  it('muestra el equipo de titulación de un tema enlazado directamente por URL', async () => {
    vi.mocked(teacherApi.degreeTrackingTopic).mockResolvedValue(mockTrackingTopic)

    show(<TeacherDegreeTrackingPage />, '/panel/teacher-degree-tracking?topic=130&tab=equipo-titulacion')

    expect(await screen.findByText('Carlos Par')).toBeInTheDocument()
    expect(screen.getByText('María López')).toBeInTheDocument()
    // Aquí sí se conserva la cédula, dentro de la tarjeta del equipo
    expect(screen.getByText(/0201234567/)).toBeInTheDocument()
  })

  it('permite marcar con un checkbox la tarea propia y registrar una nueva', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.degreeTrackingTopic).mockResolvedValue(mockTrackingTopic)

    show(<TeacherDegreeTrackingPage />, '/panel/teacher-degree-tracking?topic=130&tab=tareas')

    expect(await screen.findByText(/Redactar introducción y objetivos/)).toBeInTheDocument()
    expect(screen.getByText(/Revisión por par académico/)).toBeInTheDocument()
    // «(Tú)» es texto simple, no un enlace aparente; los roles con los mismos textos que en Titulación.
    expect(screen.getByText('(Tú)')).not.toHaveClass('text-primary')
    expect(screen.getAllByText('Docente tutor').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Par académico').length).toBeGreaterThan(0)

    // Para la tarea propia (201) hay un checkbox real para marcarla como completada
    vi.mocked(teacherApi.toggleDegreeTrackingActivity).mockResolvedValue({
      data: { id: 201, is_completed: true, progress_percentage: 75 },
      message: 'Actualizado',
    })
    const ownCheckbox = screen.getByRole('checkbox', { name: 'Marcar como completada' })
    await user.click(ownCheckbox)
    expect(teacherApi.toggleDegreeTrackingActivity).toHaveBeenCalledWith(130, 201, true)

    // La tarea del par académico no es propia: se muestra como insignia, sin control interactivo
    // (solo existe un checkbox: el de la tarea propia)
    expect(screen.getAllByRole('checkbox', { name: /Marcar como/ })).toHaveLength(1)

    // Registrar nueva tarea
    await user.click(screen.getByRole('button', { name: /Asignar tarea/i }))
    expect(screen.getByText('Asignar nueva tarea de seguimiento')).toBeInTheDocument()
    const input = screen.getByLabelText(/Descripción de la tarea o entrega/i)
    await user.type(input, 'Entregar marco teórico')

    vi.mocked(teacherApi.addDegreeTrackingActivity).mockResolvedValue({
      id: 203,
      description: 'Entregar marco teórico',
      is_completed: false,
      registered_at: '2026-10-03',
    })

    const success = vi.spyOn(sonnerToast, 'success')
    await user.click(screen.getByRole('button', { name: 'Registrar tarea' }))
    await waitFor(() => {
      expect(teacherApi.addDegreeTrackingActivity).toHaveBeenCalledWith(130, {
        descripcion: 'Entregar marco teórico',
      })
    })
    await waitFor(() => expect(success.mock.calls.at(-1)?.[0]).toMatch(/^Tarea de seguimiento registrada\.?$/))
  })

  it('reordena las tareas: pendientes arriba, completadas abajo, al marcar una como completada', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.degreeTrackingTopic).mockResolvedValueOnce(mockTrackingTopic)

    show(<TeacherDegreeTrackingPage />, '/panel/teacher-degree-tracking?topic=130&tab=tareas')

    // Al llegar, ambas tareas están pendientes: la propia (201) va antes que la del par (202)
    expect(await screen.findByText(/Redactar introducción y objetivos/)).toBeInTheDocument()
    const rowIndexOf = (text: string) => screen.getAllByRole('row').findIndex((row) => row.textContent?.includes(text))
    expect(rowIndexOf('Redactar introducción y objetivos')).toBeLessThan(rowIndexOf('Revisión por par académico'))

    // Al completar la propia, debe pasar debajo de la pendiente del par académico
    vi.mocked(teacherApi.toggleDegreeTrackingActivity).mockResolvedValue({
      data: { id: 201, is_completed: true, progress_percentage: 75 },
      message: 'Actualizado',
    })
    vi.mocked(teacherApi.degreeTrackingTopic).mockResolvedValueOnce({
      ...mockTrackingTopic,
      tracking: {
        ...mockTrackingTopic.tracking,
        activities: mockTrackingTopic.tracking.activities.map((act) => (act.id === 201 ? { ...act, is_completed: true } : act)),
      },
    })

    await user.click(screen.getByRole('checkbox', { name: 'Marcar como completada' }))

    await waitFor(() => {
      expect(rowIndexOf('Revisión por par académico')).toBeLessThan(rowIndexOf('Redactar introducción y objetivos'))
    })
  })

  describe('carga completa de cada pantalla (S10)', () => {
    // Mientras llega la primera respuesta no se ve el encabezado real ni sus botones o filtros:
    // toda la pantalla es un esqueleto con un solo aviso «Cargando…».
    function expectOneLoading(name: string) {
      const statuses = screen.getAllByRole('status')
      expect(statuses).toHaveLength(1)
      expect(statuses[0]).toHaveAccessibleName(name)
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    }

    it.each([
      { page: 'Mis tutorías', render: () => show(<TeacherTutoringsPage />, '/panel/teacher-tutorings'), api: 'tutorings' as const, value: paginated([tutoring]), loading: 'Cargando tutorías', column: 'Período y ciclo' },
      { page: 'Mis asignaciones de titulación', render: () => show(<TeacherDegreeAssignmentsPage />, '/panel/teacher-degree-assignments'), api: 'degreeAssignments' as const, value: paginated([]), loading: 'Cargando asignaciones', column: 'Participación' },
      { page: 'Seguimiento de Titulación', render: () => show(<TeacherDegreeTrackingPage />, '/panel/teacher-degree-tracking'), api: 'degreeTracking' as const, value: paginated([]), loading: 'Cargando temas', column: 'Avance' },
      { page: 'Informes', render: () => show(<TeacherReportsStandalonePage />, '/panel/teacher-reports'), api: 'allTutorings' as const, value: [tutoring], loading: 'Cargando tutorías', column: 'Ciclo y paralelo' },
    ])('$page: muestra la pantalla entera como esqueleto hasta que llegan los datos', async ({ page, render: open, api, value, loading, column }) => {
      let resolve: (data: unknown) => void = () => undefined
      vi.mocked(teacherApi[api]).mockReturnValue(new Promise((done) => { resolve = done as (data: unknown) => void }) as never)
      open()
      await screen.findByRole('status', { name: loading })
      expectOneLoading(loading)
      expect(screen.getByRole('columnheader', { name: column })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: page })).not.toBeInTheDocument()
      await act(async () => resolve(value))
      expect(await screen.findByRole('heading', { name: page })).toBeInTheDocument()
      expect(screen.queryByRole('status', { name: loading })).not.toBeInTheDocument()
    })

    it.each([
      { tab: 'students', api: 'students' as const, value: paginated([student]), loading: 'Cargando estudiantes', action: 'Registrar estudiante' },
      { tab: 'attendance', api: 'sessions' as const, value: paginated([]), loading: 'Cargando sesiones', action: 'Registrar asistencia' },
    ])('pestaña $tab: el cuerpo completo es un esqueleto mientras carga', async ({ tab, api, value, loading, action }) => {
      let resolve: (data: unknown) => void = () => undefined
      vi.mocked(teacherApi[api]).mockReturnValue(new Promise((done) => { resolve = done as (data: unknown) => void }) as never)
      workspace(tab)
      await screen.findByRole('status', { name: loading })
      expectOneLoading(loading)
      expect(screen.getByRole('heading', { level: 1, name: 'Calidad de software' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: action })).not.toBeInTheDocument()
      await act(async () => resolve(value))
      expect(await screen.findByRole('button', { name: action })).toBeInTheDocument()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('pestaña content: la lista de sesiones es un esqueleto mientras cargan los temas', async () => {
      let resolve: (data: unknown) => void = () => undefined
      vi.mocked(teacherApi.allTopics).mockReturnValue(new Promise((done) => { resolve = done as (data: unknown) => void }) as never)
      workspace('content')
      await screen.findByRole('status', { name: 'Cargando sesiones' })
      expectOneLoading('Cargando sesiones')
      expect(screen.getByRole('heading', { level: 1, name: 'Calidad de software' })).toBeInTheDocument()
      expect(screen.queryByRole('row', { name: /Temas sin sesión/ })).not.toBeInTheDocument()
      await act(async () => resolve([topic]))
      expect(await screen.findByRole('row', { name: /Temas sin sesión/ })).toBeInTheDocument()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('al cambiar de página conserva la pantalla y solo carga las filas', async () => {
      const user = userEvent.setup()
      vi.mocked(teacherApi.tutorings).mockResolvedValueOnce(paginated([tutoring], 1, 2)).mockReturnValue(new Promise(() => {}))
      show(<TeacherTutoringsPage />, '/panel/teacher-tutorings')
      await screen.findByText('Calidad de software')
      await user.click(screen.getByRole('button', { name: 'Página siguiente' }))
      expect(await screen.findByRole('status', { name: 'Cargando' })).toBeInTheDocument()
      expect(screen.getAllByRole('status')).toHaveLength(1)
      expect(screen.getByRole('heading', { name: 'Mis tutorías' })).toBeInTheDocument()
      expect(screen.getByRole('searchbox')).toBeInTheDocument()
    })
  })
})
