import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { degreeCoordinationApi, type DegreeTopic } from '@/lib/degree-coordination-api'
import { studentApi, type StudentAttendance, type StudentContent, type StudentGrades, type StudentTutoring } from '@/lib/student-api'
import { dashboardSection } from '@/features/tutoring/tutoring-navigation'
import { StudentDegreeTopicsPage } from '@/features/student-degree-topics/student-degree-topics-page'
import { StudentAttendancePage } from './student-attendance-page'
import { StudentContentPage } from './student-content-page'
import { StudentDegreeAssignmentsPage } from './student-degree-assignments-page'
import { StudentGradesPage } from './student-grades-page'
import { StudentTutoringsPage } from './student-tutorings-page'

vi.mock('@/lib/student-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/student-api')>()
  return { ...actual, studentApi: Object.fromEntries(Object.keys(actual.studentApi).map((key) => [key, vi.fn()])) }
})
vi.mock('@/lib/degree-coordination-api', () => ({ degreeCoordinationApi: { studentTopics: vi.fn() } }))

const summary = { id: 40, name: 'Calidad de software', is_active: true, academic_period: { id: 1, name: '2026-2' }, section: { id: 1, name: 'A' }, cycle: { id: 2, name: 'Segundo' }, teacher: { id: 5, name: 'María López', email: 'maria@ueb.edu.ec' } }
const tutoring: StudentTutoring = { id: 1, enrolled_at: '2026-09-01', is_active: true, subject: { ...summary, academic_period: { id: 1, name: '2026-2', is_active: true }, modality: { id: 1, name: 'Presencial' }, cycle: { id: 2, name: 'Segundo', number: 2 }, teacher: { ...summary.teacher, phone: '0991234567' }, schedules: [{ id: 1, day_of_week: 'lunes', start_time: '08:00:00', end_time: '10:00:00', is_active: true }] } }
const grades: StudentGrades = { enrollment_id: 1, enrolled_at: '2026-09-01', is_active: true, tutoring: summary, grades: { diagnostic: { id: 1, value: 4, formatted_value: '4.00', registered_at: '2026-09-05' }, partial: null, history: [{ id: 1, type: 'diagnostic', value: 4, formatted_value: '4.00', registered_at: '2026-09-05' }] }, knowledge_metric: { id: 1, group: 'Medio', group_key: 'medium', min_score: 4, max_score: 6.99 }, scale_settings: { minimum: 0, maximum: 10 } }
const attendance: StudentAttendance = { enrollment_id: 1, enrolled_at: '2026-09-01', is_active: true, tutoring: summary, summary: { total_sessions: 2, present_count: 1, absent_count: 1, attendance_percentage: 50 }, records: [{ id: 1, date: '2026-09-10', present: true, status: 'presente', topics_covered: true, topics: [{ id: 1, name: 'Pruebas unitarias' }] }, { id: 2, date: '2026-09-17', present: false, status: 'ausente', topics_covered: false, topics: [] }] }
const content: StudentContent = { tutoring: summary, progress: { total_topics: 2, covered_topics: 1, pending_topics: 1, progress_percentage: 50 }, topics: [{ id: 1, tutoring_id: 40, name: 'Pruebas unitarias', description: 'Introducción', is_active: true, is_covered: true, activities_count: 1, activities: [{ id: 1, topic_id: 1, name: 'Taller', duration: '2 horas', is_active: true, methodologies: [{ id: 1, activity_id: 1, description: 'Trabajo en parejas', is_active: true }] }] }, { id: 2, tutoring_id: 40, name: 'Integración', description: null, is_active: true, is_covered: false, activities_count: 0, activities: [] }] }
const topic: DegreeTopic = { id: 9, title: 'Seguimiento académico', description: null, status: 'pendiente', proposed_at: '2026-09-01', reviewed_at: null, student: null, section: null, academic_period: { id: 1, name: '2026-2', is_active: true }, reviewer: null, assignments: [], observations: [] }

function show(component: React.ReactNode, path = '/panel/student-content') {
  return render(<MemoryRouter initialEntries={[path]}>{component}</MemoryRouter>)
}

beforeEach(() => { vi.resetAllMocks() })
afterEach(cleanup)

beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }) })
afterEach(() => { vi.unstubAllGlobals() })

describe('Módulo Estudiante', () => {
  it('abre la vista de tutorías y restringe las demás secciones', () => {
    expect(dashboardSection('estudiante', 'users')).toBe('student-tutorings')
    expect(dashboardSection('estudiante', 'student-grades')).toBe('student-grades')
    expect(dashboardSection('docente', 'student-grades')).toBe('teacher-tutorings')
  })

  it('muestra docente y horarios de la tutoría', async () => {
    vi.mocked(studentApi.tutorings).mockResolvedValue([tutoring])
    show(<StudentTutoringsPage />)
    expect(await screen.findByText('Calidad de software')).toBeInTheDocument()
    expect(screen.getByText('María López')).toBeInTheDocument()
    expect(screen.getByText('Lunes · 08:00 – 10:00')).toBeInTheDocument()
  })

  it('muestra estado vacío y permite reintentar tras un error', async () => {
    const user = userEvent.setup()
    vi.mocked(studentApi.tutorings).mockRejectedValueOnce(new ApiError(500, { message: 'Error del servidor' })).mockResolvedValueOnce([])
    show(<StudentTutoringsPage />)
    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Aún no estás inscrito en ninguna tutoría')).toBeInTheDocument()
  })

  it('presenta calificaciones y grupo de conocimiento', async () => {
    vi.mocked(studentApi.grades).mockResolvedValue([grades])
    show(<StudentGradesPage />)
    expect(await screen.findByText('Grupo de conocimiento: Medio')).toBeInTheDocument()
    expect(screen.getAllByText('4.00').length).toBeGreaterThan(0)
    expect(screen.getByText('Aún sin registrar')).toBeInTheDocument()
  })

  it('presenta el récord y el porcentaje de asistencia', async () => {
    vi.mocked(studentApi.attendance).mockResolvedValue([attendance])
    show(<StudentAttendancePage />)
    expect(await screen.findByText('de asistencia')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Porcentaje de asistencia' })).toHaveAttribute('aria-valuenow', '50')
    expect(screen.getByText('Pruebas unitarias')).toBeInTheDocument()
    expect(screen.getByText('Ausente')).toBeInTheDocument()
  })

  it('muestra el plan didáctico de la tutoría seleccionada', async () => {
    vi.mocked(studentApi.tutorings).mockResolvedValue([tutoring])
    vi.mocked(studentApi.content).mockResolvedValue(content)
    show(<StudentContentPage />)
    const user = userEvent.setup()
    expect(await screen.findByText('1 de 2 temas completados')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Avance de temas' })).toHaveAttribute('aria-valuenow', '50')
    expect(studentApi.content).toHaveBeenCalledWith(40)
    await user.click(screen.getByRole('button', { name: 'Ver detalle de Pruebas unitarias' }))
    expect(screen.getByText('Taller')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pendientes (1)' }))
    expect(screen.queryByText('Pruebas unitarias')).not.toBeInTheDocument()
    expect(screen.getByText('Integración')).toBeInTheDocument()
    await user.type(screen.getByRole('searchbox', { name: 'Buscar temas' }), 'zzz')
    expect(screen.getByText('Ningún tema coincide con tu búsqueda.')).toBeInTheDocument()
  })

  it('avisa cuando la tutoría seleccionada está inactiva', async () => {
    const inactive: StudentTutoring = { ...tutoring, subject: tutoring.subject && { ...tutoring.subject, is_active: false } }
    vi.mocked(studentApi.tutorings).mockResolvedValue([inactive])
    vi.mocked(studentApi.content).mockResolvedValue(content)
    show(<StudentContentPage />)
    expect(await screen.findByText(/Esta tutoría ya finalizó/)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /\(finalizada\)/ })).toBeInTheDocument()
  })

  it('pagina los temas del plan didáctico cuando hay más de cinco', async () => {
    const user = userEvent.setup()
    const many = Array.from({ length: 7 }, (_, index) => ({ ...content.topics[1], id: 100 + index, name: `Tema ${index + 1}` }))
    vi.mocked(studentApi.tutorings).mockResolvedValue([tutoring])
    vi.mocked(studentApi.content).mockResolvedValue({ ...content, topics: many })
    show(<StudentContentPage />)
    expect(await screen.findByText('Mostrando 1 a 5 de 7 temas')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Siguiente/ }))
    expect(screen.getByText('Mostrando 6 a 7 de 7 temas')).toBeInTheDocument()
  })

  it('consulta tutor y pares solo de los temas aprobados', async () => {
    vi.mocked(degreeCoordinationApi.studentTopics).mockResolvedValue([topic, { ...topic, id: 10, status: 'aprobado', title: 'Tema aprobado' }])
    vi.mocked(studentApi.degreeAssignments).mockResolvedValue({ topic: { id: 10, title: 'Tema aprobado', description: null, status: 'aprobado', proposed_at: null, approved_at: '2026-09-10', academic_period: null, section: null, coordinator: null }, tutor: { assignment_id: 1, id: 30, name: 'Tutora asignada', email: 'tutora@ueb.edu.ec', assigned_at: null }, peers: [{ assignment_id: 2, id: 31, name: 'Par asignado', email: 'par@ueb.edu.ec', assigned_at: null }], total_teachers_assigned: 2 })
    show(<StudentDegreeAssignmentsPage />)
    expect(await screen.findByText('Tutora asignada')).toBeInTheDocument()
    expect(screen.getByText('Par asignado')).toBeInTheDocument()
    expect(studentApi.degreeAssignments).toHaveBeenCalledTimes(1)
    expect(studentApi.degreeAssignments).toHaveBeenCalledWith(10)
  })

  it('registra una propuesta nueva sin permitir doble envío', async () => {
    const user = userEvent.setup()
    vi.mocked(degreeCoordinationApi.studentTopics).mockResolvedValue([])
    let finish: (value: DegreeTopic) => void = () => undefined
    vi.mocked(studentApi.createTopic).mockReturnValue(new Promise((resolve) => { finish = resolve }))
    show(<StudentDegreeTopicsPage />)
    await user.click(await screen.findByRole('button', { name: /Nueva propuesta/ }))
    const dialog = await screen.findByRole('form', { name: 'Nueva propuesta de titulación' })
    const submit = within(dialog).getByRole('button', { name: 'Enviar propuesta' })
    expect(submit).toBeDisabled()
    expect(within(dialog).getByLabelText('Título del tema')).toHaveAttribute('placeholder', expect.stringContaining('Ej.:'))
    expect(within(dialog).getByLabelText('Descripción')).toHaveAttribute('placeholder')
    await user.type(within(dialog).getByLabelText('Título del tema'), 'Tema de prueba')
    await user.click(submit)
    expect(await within(dialog).findByRole('button', { name: /Guardando/ })).toBeDisabled()
    expect(studentApi.createTopic).toHaveBeenCalledTimes(1)
    expect(studentApi.createTopic).toHaveBeenCalledWith({ title: 'Tema de prueba', description: null })
    finish(topic)
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Nueva propuesta de titulación' })).not.toBeInTheDocument())
  })

  it('con una propuesta pendiente ofrece cambiarla o reemplazarla', async () => {
    const user = userEvent.setup()
    vi.mocked(degreeCoordinationApi.studentTopics).mockResolvedValue([topic])
    vi.mocked(studentApi.updateTopic).mockResolvedValue(topic)
    show(<StudentDegreeTopicsPage />)
    expect(await screen.findByRole('button', { name: /Proponer alternativa/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nueva propuesta/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Cambiar propuesta/ }))
    const dialog = await screen.findByRole('form', { name: 'Cambiar propuesta' })
    const title = within(dialog).getByLabelText('Título del tema')
    await user.clear(title)
    await user.type(title, 'Título corregido')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(studentApi.updateTopic).toHaveBeenCalledWith(9, { title: 'Título corregido', description: null }))
  })

  it('oculta el registro cuando ya existe un tema aprobado en el período vigente', async () => {
    vi.mocked(degreeCoordinationApi.studentTopics).mockResolvedValue([{ ...topic, status: 'aprobado' }])
    show(<StudentDegreeTopicsPage />)
    expect(await screen.findByText('Seguimiento académico')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nueva propuesta|Proponer alternativa/ })).not.toBeInTheDocument()
  })
})
