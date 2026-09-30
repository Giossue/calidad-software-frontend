import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { teacherApi, type Enrollment, type TeacherTutoring, type TutoringTopic } from '@/lib/teacher-api'
import { dashboardSection } from '@/features/tutoring/tutoring-navigation'
import { TeacherStudentsPage } from './teacher-students-page'
import { TeacherGradesPage } from './teacher-grades-page'
import { TeacherAttendancePage } from './teacher-attendance-page'
import { TeacherContentPage } from './teacher-content-page'
import { TeacherReportsPage } from './teacher-reports-page'
import { TeacherDegreeAssignmentsPage } from './teacher-degree-assignments-page'
import { TeacherTutoringsPage } from './teacher-tutorings-page'

vi.mock('@/lib/teacher-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/teacher-api')>()
  return { ...actual, teacherApi: Object.fromEntries(Object.keys(actual.teacherApi).map((key) => [key, vi.fn()])) }
})

const tutoring: TeacherTutoring = { id: 40, subject_id: 30, subject_name: 'Calidad de software', cycle_id: 20, cycle_name: 'Segundo', career_id: 10, career_name: 'Software', period_id: 50, period_name: '2026-2', period_start_date: '2026-01-01', period_end_date: '2026-12-31', modality_id: 60, modality_name: 'Presencial', section_id: 1, section_name: 'A', teacher_id: 5, teacher_name: 'María López', teacher_is_active: true, is_active: true, can_manage: true, active_enrollment_count: 1, schedules: [] }
const student: Enrollment = { id: 70, tutoring_id: 40, student_id: 80, identification: '0201234567', name: 'Ana Pérez', email: 'ana.perez@ueb.edu.ec', phone: '0991234567', enrolled_at: '2026-09-29', is_active: true, student_is_active: true, can_edit_profile: true, diagnostic_grade: null, partial_grade: null, knowledge_group: null, knowledge_group_key: null, grade_history: [] }
const topic: TutoringTopic = { id: 90, tutoring_id: 40, name: 'Pruebas', description: 'Casos de prueba', is_active: true, is_covered: false, activities: [] }
function paginated<T>(data: readonly T[], page = 1, last = 1) {
  return { data, meta: { current_page: page, last_page: last, per_page: 15, total: data.length, from: data.length ? 1 : null, to: data.length || null, active_count: data.length, inactive_count: 0 } }
}
function show(component: React.ReactNode, path = '/panel/teacher-students?tutoring=40') {
  return render(<MemoryRouter initialEntries={[path]}>{component}</MemoryRouter>)
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
    expect(dashboardSection('docente', 'teacher-grades')).toBe('teacher-grades')
    expect(dashboardSection('coordinador_carrera', 'teacher-grades')).toBe('tutorings')
    expect(dashboardSection('estudiante', 'teacher-grades')).toBe('student-degree-topics')
  })

  it('consulta tutorías con paginación y muestra sus horarios en un diálogo', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.tutorings).mockResolvedValue(paginated([tutoring], 1, 2))
    show(<TeacherTutoringsPage />)
    await screen.findByText('Calidad de software')
    await user.click(screen.getByRole('button', { name: 'Ver horarios de Calidad de software' }))
    expect(await screen.findByText('Esta tutoría aún no tiene horarios registrados.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(teacherApi.tutorings).toHaveBeenLastCalledWith({ page: 2, search: '', status: undefined }))
  })

  it('no consulta estudiantes cuando el docente no tiene asignaciones', async () => {
    vi.mocked(teacherApi.allTutorings).mockResolvedValue([])
    show(<TeacherStudentsPage />)
    expect(await screen.findByText('Aún no tienes tutorías asignadas')).toBeInTheDocument()
    expect(teacherApi.students).not.toHaveBeenCalled()
  })

  it('cambia la tutoría sin reutilizar los estudiantes de la anterior', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.allTutorings).mockResolvedValue([tutoring, { ...tutoring, id: 41, subject_name: 'Redes' }])
    vi.mocked(teacherApi.students).mockImplementation(async (id) => paginated([{ ...student, name: id === 41 ? 'Pedro Torres' : student.name }]))
    show(<TeacherStudentsPage />)
    await screen.findByText('Ana Pérez')
    await user.selectOptions(screen.getByLabelText('Tutoría'), '41')
    expect(await screen.findByText('Pedro Torres')).toBeInTheDocument()
    expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument()
    expect(teacherApi.students).toHaveBeenLastCalledWith(41, { page: 1, search: '', status: undefined })
  })

  it('evita inscripciones duplicadas y conserva el formulario cuando el servidor rechaza', async () => {
    const user = userEvent.setup()
    let reject: (error: unknown) => void = () => undefined
    vi.mocked(teacherApi.enrollStudent).mockImplementationOnce(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise }))
    show(<TeacherStudentsPage />)
    await screen.findByText('Ana Pérez')
    await user.click(screen.getByRole('button', { name: 'Registrar estudiante' }))
    await waitFor(() => expect(screen.getByRole('option', { name: /Ana Pérez/ })).toBeInTheDocument())
    await user.selectOptions(screen.getByLabelText('Estudiante'), '80')
    const form = screen.getByRole('form', { name: 'Registrar estudiante' })
    fireEvent.submit(form); fireEvent.submit(form)
    expect(teacherApi.enrollStudent).toHaveBeenCalledTimes(1)
    expect(teacherApi.enrollStudent).toHaveBeenCalledWith(40, { student_id: 80 })
    await act(async () => reject(new ApiError(422, { message: 'No se pudo inscribir.', errors: { student_id: ['El estudiante ya está inscrito.'] } })))
    expect(await screen.findByText('El estudiante ya está inscrito.')).toBeInTheDocument()
    expect(screen.getByLabelText('Estudiante')).toHaveValue('80')
    expect(within(form).getByRole('button', { name: 'Inscribir estudiante' })).toBeEnabled()
  })

  it('edita los datos de contacto y conserva cédula y correo como identidad de consulta', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.updateStudent).mockResolvedValue(student)
    show(<TeacherStudentsPage />)
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
    show(<TeacherStudentsPage />)
    await user.click(await screen.findByRole('button', { name: 'Deshabilitar a Ana Pérez' }))
    expect(teacherApi.deactivateStudent).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Deshabilitar inscripción' }))
    await waitFor(() => expect(teacherApi.deactivateStudent).toHaveBeenCalledWith(40, 70))
  })

  it('usa la escala y la clasificación del servidor al registrar diagnóstico', async () => {
    const user = userEvent.setup()
    const updated = { ...student, diagnostic_grade: '8.00', knowledge_group: 'Avanzado institucional' }
    vi.mocked(teacherApi.registerGrade).mockImplementation(async () => { vi.mocked(teacherApi.students).mockResolvedValue(paginated([updated])); return updated })
    show(<TeacherGradesPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar diagnóstico de Ana Pérez' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Registrar diagnóstico de Ana Pérez' }))
    expect(screen.getByLabelText('Calificación')).toHaveAttribute('max', '10')
    await user.type(screen.getByLabelText('Calificación'), '8')
    await user.click(screen.getByRole('button', { name: 'Registrar nota' }))
    expect(await screen.findByText('Avanzado institucional')).toBeInTheDocument()
    expect(teacherApi.registerGrade).toHaveBeenCalledWith(40, 70, 'diagnostic', '8')
  })

  it('mantiene la nota escrita ante un error del servidor', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.registerGrade).mockRejectedValue(new ApiError(422, { message: 'La nota supera la escala.' }))
    show(<TeacherGradesPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar parcial de Ana Pérez' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Registrar parcial de Ana Pérez' }))
    await user.type(screen.getByLabelText('Calificación'), '8')
    await user.click(screen.getByRole('button', { name: 'Registrar nota' }))
    expect(await screen.findByText('La nota supera la escala.')).toBeInTheDocument()
    expect(screen.getByLabelText('Calificación')).toHaveValue(8)
  })

  it('exige marcar asistencia y envía estudiantes y temas de la sesión seleccionada', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.saveSession).mockResolvedValue({ id: 100, tutoring_id: 40, date: '2026-09-29', topics_covered: true, topics: [], attendance: [] })
    show(<TeacherAttendancePage />)
    const save = await screen.findByRole('button', { name: 'Guardar asistencia' })
    expect(save).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Todos presentes' }))
    await user.click(screen.getByRole('checkbox', { name: 'Presente: Ana Pérez' }))
    await user.click(screen.getByRole('checkbox', { name: 'Se abordaron temas en esta sesión' }))
    await user.click(screen.getByRole('checkbox', { name: 'Pruebas' }))
    await user.click(save)
    await waitFor(() => expect(teacherApi.saveSession).toHaveBeenCalledWith(40, { date: expect.any(String), topics_covered: true, topic_ids: [90], attendance: [{ enrollment_id: 70, present: false }] }))
  })

  it('recupera la asistencia previa sin asignar presentes por defecto', async () => {
    vi.mocked(teacherApi.allAttendance).mockResolvedValue([{ id: 100, enrollment_id: 70, student_id: 80, student_name: 'Ana Pérez', date: '2026-09-29', present: false, topics_covered: null }])
    show(<TeacherAttendancePage />)
    expect(await screen.findByRole('checkbox', { name: 'Presente: Ana Pérez' })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Guardar asistencia' })).toBeEnabled()
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
    show(<TeacherContentPage />)
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
    show(<TeacherReportsPage />)
    await user.click(await screen.findByRole('button', { name: 'Enviar informe' }))
    await user.type(screen.getByLabelText('Resultados y observaciones'), 'Avance favorable.')
    await user.click(within(screen.getByRole('form', { name: 'Enviar informe al coordinador' })).getByRole('button', { name: 'Enviar informe' }))
    await user.click(await screen.findByRole('button', { name: 'Leer informe' }))
    expect(screen.getByRole('article', { name: 'Contenido del informe' })).toHaveTextContent('Estudiantes inscritos: 1')
    expect(teacherApi.sendReport).toHaveBeenCalledWith(40, { title: 'Informe de tutorías', observations: 'Avance favorable.' })
  })

  it('mantiene la tutoría inactiva en consulta', async () => {
    vi.mocked(teacherApi.allTutorings).mockResolvedValue([{ ...tutoring, can_manage: false }])
    show(<TeacherStudentsPage />)
    expect(await screen.findByText(/Puedes consultar su historial/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar estudiante' })).toBeDisabled()
  })

  it('consulta titulación con filtro por participación y sin acciones de aprobación', async () => {
    const user = userEvent.setup()
    vi.mocked(teacherApi.degreeAssignments).mockResolvedValue(paginated([{ id: 120, role: 'tutor', assigned_at: '2026-09-29', topic: { id: 130, title: 'Calidad en APIs', description: 'Investigación de calidad.', status: 'aprobado' }, student: { id: 80, name: 'Ana Pérez', email: 'ana.perez@ueb.edu.ec' }, period: { id: 50, name: '2026-2' } }]))
    show(<TeacherDegreeAssignmentsPage />)
    await screen.findByText('Calidad en APIs')
    await user.selectOptions(screen.getByLabelText('Participación'), 'par_academico')
    await waitFor(() => expect(teacherApi.degreeAssignments).toHaveBeenLastCalledWith({ page: 1, search: '', role: 'par_academico' }))
    await user.click(screen.getByRole('button', { name: 'Ver detalle de Calidad en APIs' }))
    expect(await screen.findByText('Investigación de calidad.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Aprobar|Rechazar/ })).not.toBeInTheDocument()
  })
})
