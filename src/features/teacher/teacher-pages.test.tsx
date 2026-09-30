import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { teacherApi, type Enrollment, type TeacherTutoring, type TutoringTopic } from '@/lib/teacher-api'
import { dashboardSection } from '@/features/tutoring/tutoring-navigation'
import { TeacherDegreeAssignmentsPage } from './teacher-degree-assignments-page'
import { TeacherTutoringsPage } from './teacher-tutorings-page'

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
    expect(await screen.findByRole('button', { name: 'Diagnóstico' })).toBeInTheDocument()
    expect(teacherApi.allStudents).toHaveBeenLastCalledWith(40)
    await user.click(screen.getByRole('tab', { name: 'Horarios' }))
    expect(await screen.findByText('Sin horarios registrados')).toBeInTheDocument()
    expect(teacherApi.allTutorings).toHaveBeenCalledTimes(1)
  })

  it('vuelve a la lista de tutorías desde el espacio de trabajo', async () => {
    const user = userEvent.setup()
    workspace('students')
    await user.click(await screen.findByRole('button', { name: 'Volver a mis tutorías' }))
    expect(await screen.findByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
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
    await user.type(within(form).getByLabelText('Cédula'), '0201234567')
    await user.type(within(form).getByLabelText('Nombre completo'), 'Luis Mora')
    await user.type(within(form).getByLabelText('Correo institucional'), 'luis.mora@ueb.edu.ec')
    await user.click(within(form).getByRole('button', { name: 'Crear e inscribir' }))
    await waitFor(() => expect(teacherApi.enrollStudent).toHaveBeenCalledWith(40, { identification: '0201234567', name: 'Luis Mora', email: 'luis.mora@ueb.edu.ec', phone: null }))
  })

  it('edita los datos de contacto y conserva cédula y correo como identidad de consulta', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.updateStudent).mockResolvedValue(student)
    workspace('students')
    await user.click(await screen.findByRole('button', { name: 'Editar datos de Ana Pérez' }))
    expect(screen.getByLabelText('Cédula')).toBeDisabled()
    expect(screen.getByLabelText('Correo institucional')).toBeDisabled()
    await user.clear(screen.getByLabelText('Nombre completo')); await user.type(screen.getByLabelText('Nombre completo'), 'Ana López')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(teacherApi.updateStudent).toHaveBeenCalledWith(40, 70, { name: 'Ana López', phone: '0991234567' }))
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
    await user.click(await screen.findByRole('button', { name: 'Diagnóstico' }))
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

  it('abre en modo consulta sin etapa elegida y deja volver a él', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.allStudents).mockResolvedValue([{ ...student, diagnostic_grade: '8.00' }])
    workspace('grades')
    expect(await screen.findByText('8.00')).toBeInTheDocument()
    expect(screen.getByText(/modo consulta/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Guardar/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Parcial 1' }))
    expect(screen.getByRole('textbox', { name: 'Parcial 1 de Ana Pérez' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Parcial 1' }))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('cancela la carga de una etapa y vuelve a modo consulta, descartando lo no guardado tras confirmar', async () => {
    const user = userEvent.setup()
    workspace('grades')
    await user.click(await screen.findByRole('button', { name: 'Diagnóstico' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText(/modo consulta/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Diagnóstico' }))
    await user.type(screen.getByRole('textbox', { name: 'Diagnóstico de Ana Pérez' }), '7.5')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.click(await screen.findByRole('button', { name: 'Seguir editando' }))
    expect(screen.getByRole('textbox', { name: 'Diagnóstico de Ana Pérez' })).toHaveValue('7.50')
    expect(teacherApi.saveGrades).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.click(await screen.findByRole('button', { name: 'Sí, descartar' }))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Diagnóstico' }))
    expect(screen.getByRole('textbox', { name: 'Diagnóstico de Ana Pérez' })).toHaveValue('')
  })

  it('conserva las notas escritas como borrador si el docente sale de la página', async () => {
    const user = userEvent.setup()
    const view = workspace('grades')
    await user.click(await screen.findByRole('button', { name: 'Diagnóstico' }))
    await user.type(await screen.findByRole('textbox', { name: 'Diagnóstico de Ana Pérez' }), '7.5')
    view.unmount()
    workspace('grades')
    await user.click(await screen.findByRole('button', { name: 'Diagnóstico' }))
    expect(await screen.findByRole('textbox', { name: 'Diagnóstico de Ana Pérez' })).toHaveValue('7.5')
  })

  it('mantiene las notas escritas ante un error del servidor', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.saveGrades).mockRejectedValue(new ApiError(422, { message: 'La nota supera la escala.' }))
    workspace('grades')
    await user.click(await screen.findByRole('button', { name: 'Diagnóstico' }))
    await user.type(await screen.findByRole('textbox', { name: 'Diagnóstico de Ana Pérez' }), '8.5')
    await user.click(screen.getByRole('button', { name: 'Guardar Diagnóstico' }))
    expect(await screen.findByText('La nota supera la escala.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Diagnóstico de Ana Pérez' })).toHaveValue('8.50')
  })

  it('guía el registro en dos pasos, da por ausente a quien no se marca y exige elegir temas antes de guardar', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.saveSession).mockResolvedValue({ id: 100, tutoring_id: 40, date: today, topics_covered: true, topics: [], attendance: [] })
    attendance()
    const next = await screen.findByRole('button', { name: /Continuar/ })
    expect(screen.getByRole('checkbox', { name: 'Presente: Ana Pérez' })).not.toBeChecked()
    await user.click(next)
    const save = screen.getByRole('button', { name: 'Guardar asistencia' })
    expect(save).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Sí, se abordaron temas' }))
    expect(save).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: 'Pruebas' }))
    await user.click(save)
    await waitFor(() => expect(teacherApi.saveSession).toHaveBeenCalledWith(40, { date: today, topics_covered: true, topic_ids: [90], attendance: [{ enrollment_id: 70, present: false }] }))
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

  it('con muchos temas limita la lista con scroll, permite buscar y cuenta los seleccionados', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.allTopics).mockResolvedValue(Array.from({ length: 40 }, (_, index) => ({ ...topic, id: 200 + index, name: `Tema ${index + 1}` })))
    attendance()
    await user.click(await screen.findByRole('button', { name: /Continuar/ }))
    await user.click(screen.getByRole('button', { name: 'Sí, se abordaron temas' }))
    expect(screen.getByRole('checkbox', { name: 'Tema 40' }).closest('ul')).toHaveClass('overflow-y-auto')
    await user.type(screen.getByRole('searchbox', { name: 'Buscar tema' }), 'Tema 3')
    expect(screen.queryByRole('checkbox', { name: 'Tema 4' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Tema 30' }))
    expect(screen.getByText('1 seleccionado')).toBeInTheDocument()
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
    expect(screen.getByText('Pruebas')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Continuar|Guardar|Marcar todos/ })).not.toBeInTheDocument()
  })

  it('permite corregir la sesión de hoy con sus marcas guardadas', async () => {
    const saved = { id: 100, tutoring_id: 40, date: today, topics_covered: false, topics: [], attendance: [{ id: 1, enrollment_id: 70, student_id: 80, student_name: 'Ana Pérez', present: false }] }
    vi.mocked(teacherApi.sessions).mockResolvedValue(paginated([saved]))
    attendance()
    expect(await screen.findByText('Editar asistencia')).toBeInTheDocument()
    expect(screen.getByText(/La lista de hoy ya se tomó/)).toBeInTheDocument()
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
    expect(await screen.findByText('Editar asistencia')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Presente: Ana Pérez' })).toBeChecked()
  })

  it('ofrece registrar la asistencia cuando hoy todavía no se ha tomado lista', async () => {
    workspace('attendance')
    const register = await screen.findByRole('button', { name: 'Registrar asistencia' })
    // El botón se habilita cuando termina de comprobarse si hoy ya hay lista.
    await waitFor(() => expect(register).toBeEnabled())
    expect(screen.queryByText('La lista de hoy ya se tomó')).not.toBeInTheDocument()
  })

  it('permite crear el primer tema durante el registro cuando la tutoría no tiene contenido', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.allTopics).mockResolvedValue([])
    vi.mocked(teacherApi.createTopic).mockResolvedValue({ ...topic, id: 95, name: 'Introducción' })
    vi.mocked(teacherApi.saveSession).mockResolvedValue({ id: 100, tutoring_id: 40, date: today, topics_covered: true, topics: [], attendance: [] })
    attendance()
    await user.click(await screen.findByRole('checkbox', { name: 'Presente: Ana Pérez' }))
    await user.click(screen.getByRole('button', { name: /Continuar/ }))
    await user.click(screen.getByRole('button', { name: 'Sí, se abordaron temas' }))
    expect(screen.getByText(/aún no tiene temas/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Nombre del tema nuevo'), 'Introducción')
    await user.click(screen.getByRole('button', { name: 'Crear y marcar tema' }))
    expect(await screen.findByRole('checkbox', { name: 'Introducción' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Guardar asistencia' }))
    await waitFor(() => expect(teacherApi.createTopic).toHaveBeenCalledWith(40, { name: 'Introducción', description: '' }))
    await waitFor(() => expect(teacherApi.saveSession).toHaveBeenCalledWith(40, { date: today, topics_covered: true, topic_ids: [95], attendance: [{ enrollment_id: 70, present: true }] }))
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
    await user.type(screen.getByLabelText('Nombre'), 'Diseñar casos'); await user.type(screen.getByLabelText('Duración'), '30 minutos')
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
    workspace('reports')
    await user.click(await screen.findByRole('button', { name: 'Enviar informe' }))
    await user.type(screen.getByLabelText('Resultados y observaciones'), 'Avance favorable.')
    await user.click(within(screen.getByRole('form', { name: 'Enviar informe al coordinador' })).getByRole('button', { name: 'Enviar informe' }))
    await user.click(await screen.findByRole('button', { name: 'Leer informe' }))
    expect(screen.getByRole('article', { name: 'Contenido del informe' })).toHaveTextContent('Estudiantes inscritos: 1')
    expect(teacherApi.sendReport).toHaveBeenCalledWith(40, { title: 'Informe de tutorías', observations: 'Avance favorable.' })
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
})
