import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { degreeCoordinationApi, type DegreeTopic } from '@/lib/degree-coordination-api'
import { studentApi, type StudentAttendance, type StudentContent, type StudentGrades, type StudentTutoring } from '@/lib/student-api'
import { dashboardSection } from '@/features/tutoring/tutoring-navigation'
import { StudentDegreeTopicsPage } from '@/features/student-degree-topics/student-degree-topics-page'
import { StudentDegreeAssignmentsPage } from './student-degree-assignments-page'
import { StudentTutoringsPage } from './student-tutorings-page'

vi.mock('@/lib/student-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/student-api')>()
  return { ...actual, studentApi: Object.fromEntries(Object.keys(actual.studentApi).map((key) => [key, vi.fn()])) }
})
vi.mock('@/lib/degree-coordination-api', () => ({ degreeCoordinationApi: { studentTopics: vi.fn() } }))

const summary = { id: 40, name: 'Calidad de software', is_active: true, academic_period: { id: 1, name: '2026-2' }, section: { id: 1, name: 'A' }, cycle: { id: 2, name: 'Segundo' }, teacher: { id: 5, name: 'María López', email: 'maria@ueb.edu.ec' } }
const tutoring: StudentTutoring = { id: 1, enrolled_at: '2026-09-01', is_active: true, subject: { ...summary, academic_period: { id: 1, name: '2026-2', is_active: true }, modality: { id: 1, name: 'Presencial' }, cycle: { id: 2, name: 'Segundo', number: 2 }, teacher: { ...summary.teacher, phone: '0991234567' }, schedules: [{ id: 1, day_of_week: 'lunes', start_time: '08:00:00', end_time: '10:00:00', room: 'Laboratorio 1', is_active: true }] } }
const grades: StudentGrades = { enrollment_id: 1, enrolled_at: '2026-09-01', is_active: true, tutoring: summary, grades: { diagnostic: { id: 1, value: 4, formatted_value: '4.00', registered_at: '2026-09-05' }, partial: null, second_partial: null }, knowledge_metric: { id: 1, group: 'Medio', group_key: 'medium', min_score: 4, max_score: 6.99 }, scale_settings: { minimum: 0, maximum: 10 } }
const attendance: StudentAttendance = { enrollment_id: 1, enrolled_at: '2026-09-01', is_active: true, tutoring: summary, summary: { total_sessions: 2, present_count: 1, absent_count: 1, attendance_percentage: 50 }, records: [{ id: 1, date: '2026-09-10', present: true, status: 'presente', topics_covered: true, topics: [{ id: 1, name: 'Pruebas unitarias' }] }, { id: 2, date: '2026-09-17', present: false, status: 'ausente', topics_covered: false, topics: [] }] }
const content: StudentContent = { tutoring: summary, progress: { total_topics: 2, covered_topics: 1, pending_topics: 1, progress_percentage: 50 }, topics: [{ id: 1, tutoring_id: 40, name: 'Pruebas unitarias', description: 'Introducción', is_active: true, is_covered: true, activities_count: 1, activities: [{ id: 1, topic_id: 1, name: 'Taller', duration: '2 horas', is_active: true, methodologies: [{ id: 1, activity_id: 1, description: 'Trabajo en parejas', is_active: true }] }] }, { id: 2, tutoring_id: 40, name: 'Integración', description: null, is_active: true, is_covered: false, activities_count: 0, activities: [] }] }
const topic: DegreeTopic = { id: 9, title: 'Seguimiento académico', description: null, status: 'pendiente', proposed_at: '2026-09-01', reviewed_at: null, student: null, section: null, academic_period: { id: 1, name: '2026-2', is_active: true }, reviewer: null, assignments: [], observations: [] }

function workspace(tab: string) {
  return show(<StudentTutoringsPage />, `/panel/student-tutorings?tutoring=40&tab=${tab}`)
}

function show(component: React.ReactNode, path = '/panel/student-tutorings') {
  return render(<MemoryRouter initialEntries={[path]}>{component}</MemoryRouter>)
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(studentApi.absenceNotices).mockResolvedValue([])
})
afterEach(cleanup)

beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }) })
afterEach(() => { vi.unstubAllGlobals() })

describe('Módulo Estudiante', () => {
  it('abre la vista de tutorías y restringe las demás secciones', () => {
    expect(dashboardSection('estudiante', 'users')).toBe('student-tutorings')
    expect(dashboardSection('estudiante', 'student-degree-topics')).toBe('student-degree-topics')
    expect(dashboardSection('estudiante', 'student-grades')).toBe('student-tutorings')
    expect(dashboardSection('docente', 'student-grades')).toBe('teacher-tutorings')
  })

  it('lista las tutorías en una tabla con búsqueda y abre el espacio de la elegida al tocar la fila', async () => {
    const user = userEvent.setup()
    vi.mocked(studentApi.tutorings).mockResolvedValue([tutoring])
    vi.mocked(studentApi.content).mockResolvedValue(content)
    show(<StudentTutoringsPage />)
    expect(await screen.findByText('Mostrando 1 de 1 tutoría')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Buscar tutoría' })).toBeInTheDocument()
    await user.type(screen.getByRole('searchbox', { name: 'Buscar tutoría' }), 'zzz')
    expect(screen.getByText('No hay tutorías que coincidan con tu búsqueda.')).toBeInTheDocument()
    await user.clear(screen.getByRole('searchbox', { name: 'Buscar tutoría' }))
    // Sin búsqueda escrita, el mensaje vacío habla de los filtros.
    await user.click(screen.getByRole('combobox', { name: 'Filtrar por Estado' }))
    await user.click(screen.getByRole('option', { name: 'Finalizadas' }))
    expect(screen.getByText('No hay tutorías con estos filtros.')).toBeInTheDocument()
    expect(screen.queryByText(/tu búsqueda/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Limpiar' }))
    await user.click(await screen.findByTitle('Abrir Calidad de software'))
    expect(await screen.findByRole('heading', { name: /calidad de software/i })).toBeInTheDocument()
    expect(await screen.findByText((_, element) => element?.tagName === 'P' && element.textContent === '50 % · 1 de 2 temas completados')).toBeInTheDocument()
    // Desde la tutoría se vuelve a la lista sin usar el menú.
    await user.click(screen.getByRole('button', { name: 'Volver a mis tutorías' }))
    expect(await screen.findByText('Mostrando 1 de 1 tutoría')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /calidad de software/i })).not.toBeInTheDocument()
  })

  it('muestra estado vacío y permite reintentar tras un error', async () => {
    const user = userEvent.setup()
    vi.mocked(studentApi.tutorings).mockRejectedValueOnce(new ApiError(500, { message: 'Error del servidor' })).mockResolvedValueOnce([])
    show(<StudentTutoringsPage />)
    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Aún no estás inscrito en ninguna tutoría')).toBeInTheDocument()
  })

  it('muestra el plan didáctico de la tutoría abierta, sin volver a elegirla', async () => {
    const user = userEvent.setup()
    vi.mocked(studentApi.tutorings).mockResolvedValue([tutoring])
    vi.mocked(studentApi.content).mockResolvedValue(content)
    workspace('content')
    expect(await screen.findByText((_, element) => element?.tagName === 'P' && element.textContent === '50 % · 1 de 2 temas completados')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Avance de temas' })).toHaveAttribute('aria-valuenow', '50')
    expect(screen.queryByText('Contenido didáctico')).not.toBeInTheDocument()
    expect(studentApi.content).toHaveBeenCalledWith(40)
    // Cerrado, el tema solo resume; la descripción y la metodología aparecen al abrirlo.
    expect(screen.getByText('1 actividad')).toBeInTheDocument()
    expect(screen.queryByText('Introducción')).not.toBeInTheDocument()
    expect(screen.queryByText('Trabajo en parejas')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver detalle de Pruebas unitarias' }))
    expect(screen.getByText('Introducción')).toBeInTheDocument()
    expect(screen.getByText('Taller')).toBeInTheDocument()
    expect(screen.getByText('Trabajo en parejas')).toBeInTheDocument()
    const status = screen.getByRole('combobox', { name: 'Filtrar por estado' })
    expect(status).toHaveTextContent('Todos los temas (2)')
    expect(screen.queryByRole('button', { name: 'Pendientes (1)' })).not.toBeInTheDocument()
    // "Limpiar" solo aparece con un filtro activo, como en las demás listas.
    expect(screen.queryByRole('button', { name: 'Limpiar' })).not.toBeInTheDocument()
    await user.click(status)
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Todos los temas (2)', 'Completados (1)', 'Pendientes (1)'])
    await user.click(screen.getByRole('option', { name: 'Pendientes (1)' }))
    expect(screen.queryByText('Pruebas unitarias')).not.toBeInTheDocument()
    expect(screen.getByText('Integración')).toBeInTheDocument()
    await user.type(screen.getByRole('searchbox', { name: 'Buscar temas' }), 'zzz')
    expect(screen.getByText('Ningún tema coincide con tu búsqueda.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Limpiar' }))
    expect(screen.getByRole('combobox', { name: 'Filtrar por estado' })).toHaveTextContent('Todos los temas (2)')
    expect(screen.getByRole('searchbox', { name: 'Buscar temas' })).toHaveValue('')
    expect(screen.getByText('Pruebas unitarias')).toBeInTheDocument()
  })

  it('descarga los recursos que adjuntó el docente a un tema', async () => {
    const user = userEvent.setup()
    const file = { id: 3, name: 'Guía.pdf', mime_type: 'application/pdf', size: 512 * 1024, uploaded_at: null }
    vi.mocked(studentApi.tutorings).mockResolvedValue([tutoring])
    vi.mocked(studentApi.content).mockResolvedValue({ ...content, topics: [{ ...content.topics[0], files: [file] }, content.topics[1]] })
    vi.mocked(studentApi.downloadTopicFile).mockResolvedValue(undefined)
    workspace('content')
    expect(await screen.findByText('1 recurso')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver detalle de Pruebas unitarias' }))
    await user.click(screen.getByRole('button', { name: 'Descargar Guía.pdf' }))
    expect(studentApi.downloadTopicFile).toHaveBeenCalledWith(40, 1, file)
  })

  it('filtra el contenido por sesión numerada desde un solo desplegable', async () => {
    const user = userEvent.setup()
    const [unit, integration] = content.topics
    vi.mocked(studentApi.tutorings).mockResolvedValue([tutoring])
    vi.mocked(studentApi.content).mockResolvedValue({
      ...content,
      sessions: [
        { id: 12, date: '2026-09-17', topics_covered: true, topics: [integration] },
        { id: 11, date: '2026-09-10', topics_covered: true, topics: [unit] },
      ],
    })
    workspace('content')
    const picker = await screen.findByRole('combobox', { name: 'Filtrar por clase' })
    expect(picker).toHaveTextContent('Todas las clases')
    expect(screen.queryByRole('button', { name: /sept 2026/ })).not.toBeInTheDocument()
    await user.click(picker)
    const options = screen.getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual(['Todas las clases', 'Sesión 2 · 17 sept 2026 · 1 tema', 'Sesión 1 · 10 sept 2026 · 1 tema'])
    await user.click(screen.getByRole('option', { name: /Sesión 1/ }))
    expect(screen.getByText('Pruebas unitarias')).toBeInTheDocument()
    expect(screen.queryByText('Integración')).not.toBeInTheDocument()
    expect(screen.getByText(/Mostrando los temas de la/)).toHaveTextContent('Mostrando los temas de la Sesión 1 · 10 sept 2026')
    await user.click(screen.getByRole('button', { name: 'Ver todas las clases' }))
    expect(screen.getByText('Integración')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Filtrar por clase' })).toHaveTextContent('Todas las clases')
  })

  it('pagina los temas del plan didáctico cuando hay más de cinco', async () => {
    const user = userEvent.setup()
    const many = Array.from({ length: 7 }, (_, index) => ({ ...content.topics[1], id: 100 + index, name: `Tema ${index + 1}` }))
    vi.mocked(studentApi.tutorings).mockResolvedValue([tutoring])
    vi.mocked(studentApi.content).mockResolvedValue({ ...content, topics: many })
    workspace('content')
    expect(await screen.findByText('Mostrando 5 de 7 temas')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Página siguiente|Siguiente/ }))
    expect(screen.getByText('Mostrando 2 de 7 temas')).toBeInTheDocument()
  })

  it('presenta el récord y el porcentaje de asistencia de la tutoría abierta', async () => {
    vi.mocked(studentApi.tutorings).mockResolvedValue([tutoring])
    vi.mocked(studentApi.attendance).mockResolvedValue([attendance, { ...attendance, enrollment_id: 2, tutoring: { ...summary, id: 99, name: 'Otra tutoría' } }])
    vi.mocked(studentApi.absenceNotices).mockResolvedValue([])
    workspace('attendance')
    const summaryText = await screen.findByText((_, element) => element?.tagName === 'P' && element.textContent === '50 % de asistencia · 1 de 2 sesiones')
    expect(screen.getByRole('progressbar', { name: 'Porcentaje de asistencia' })).toHaveAttribute('aria-valuenow', '50')
    // Primero el récord del estudiante; los avisos quedan al final.
    const notices = screen.getByRole('heading', { name: 'Avisos de inasistencia' })
    expect(summaryText.compareDocumentPosition(notices) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('columnheader', { name: 'Temas tratados' })).not.toBeInTheDocument()
    expect(screen.queryByText('Pruebas unitarias')).not.toBeInTheDocument()
    expect(screen.getByText('Ausente')).toBeInTheDocument()
    expect(screen.queryByText('Otra tutoría')).not.toBeInTheDocument()
    const status = screen.getByRole('combobox', { name: 'Filtrar sesiones' })
    expect(status).toHaveTextContent('Todas (2)')
    await userEvent.setup().click(status)
    await userEvent.setup().click(screen.getByRole('option', { name: 'Ausentes (1)' }))
    expect(screen.queryByText('Presente')).not.toBeInTheDocument()
    expect(screen.getByText('Ausente')).toBeInTheDocument()
  })

  it('permite avisar una inasistencia al docente y muestra el estado del aviso', async () => {
    const user = userEvent.setup()
    vi.mocked(studentApi.tutorings).mockResolvedValue([tutoring])
    vi.mocked(studentApi.attendance).mockResolvedValue([attendance])
    vi.mocked(studentApi.absenceNotices).mockResolvedValueOnce([]).mockResolvedValue([{ id: 1, date: '2026-12-01', reason: 'Cita médica programada', created_at: null, status: 'ausente' }])
    vi.mocked(studentApi.createAbsenceNotice).mockResolvedValue({ id: 1, date: '2026-12-01', reason: 'Cita médica programada', created_at: null, status: 'pendiente' })
    vi.mocked(studentApi.absenceDates).mockResolvedValue([
      { date: '2026-11-24', day_of_week: 'martes', start_time: '08:00', end_time: '10:00' },
      { date: '2026-12-01', day_of_week: 'martes', start_time: '08:00', end_time: '10:00' },
    ])
    workspace('attendance')

    await user.click(await screen.findByRole('button', { name: 'Avisar inasistencia' }))
    const dialog = await screen.findByRole('dialog', { name: 'Avisar inasistencia' })
    // La fecha sale de las próximas clases del horario, no de un calendario libre.
    expect(within(dialog).queryByDisplayValue(/\d{4}-\d{2}-\d{2}/)).not.toBeInTheDocument()
    const picker = await within(dialog).findByRole('combobox', { name: 'Clase' })
    expect(picker).toHaveTextContent('Martes 24 nov 2026 · 08:00 – 10:00')
    await user.click(picker)
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Martes 24 nov 2026 · 08:00 – 10:00', 'Martes 1 dic 2026 · 08:00 – 10:00'])
    await user.click(screen.getByRole('option', { name: 'Martes 1 dic 2026 · 08:00 – 10:00' }))
    expect(within(dialog).getByText('Clase').closest('label')).toHaveTextContent('(obligatorio)')
    expect((within(dialog).getByLabelText(/^Motivo/) as HTMLTextAreaElement).labels?.[0]).toHaveTextContent('(obligatorio)')
    // El error del motivo aparece bajo el campo al salir de él, no solo en el tooltip del botón.
    await user.type(within(dialog).getByLabelText(/^Motivo/), 'Cita')
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    await user.tab()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('El motivo debe tener al menos 5 caracteres.')
    expect(within(dialog).getByLabelText(/^Motivo/)).toHaveAttribute('aria-invalid', 'true')
    await user.clear(within(dialog).getByLabelText(/^Motivo/))
    await user.type(within(dialog).getByLabelText(/^Motivo/), 'Cita médica programada')
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Enviar aviso' }))

    await waitFor(() => expect(studentApi.createAbsenceNotice).toHaveBeenCalledWith(tutoring.subject!.id, { date: '2026-12-01', reason: 'Cita médica programada' }))
    expect(await screen.findByText('1 aviso enviado')).toBeInTheDocument()
    expect(screen.queryByText('Registrado: ausente')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver avisos (1)' }))
    const list = await screen.findByRole('dialog', { name: 'Avisos de inasistencia' })
    expect(within(list).getByText('Registrado: ausente')).toBeInTheDocument()
    expect(within(list).getByText('Cita médica programada')).toBeInTheDocument()
  })

  it('mientras cargan, muestra esqueletos con la forma del contenido y no afirma que no hay avisos', async () => {
    vi.mocked(studentApi.tutorings).mockResolvedValue([tutoring])
    vi.mocked(studentApi.attendance).mockReturnValue(new Promise(() => {}))
    vi.mocked(studentApi.absenceNotices).mockReturnValue(new Promise(() => {}))
    workspace('attendance')
    const loading = await screen.findByRole('status', { name: 'Cargando asistencia' })
    // La tabla de carga ya muestra las columnas reales.
    expect(within(loading).getByRole('columnheader', { name: 'Sesión' })).toBeInTheDocument()
    expect(within(loading).getByRole('columnheader', { name: 'Asistencia' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Cargando avisos' })).toBeInTheDocument()
    expect(screen.queryByText('Aún no has enviado avisos.')).not.toBeInTheDocument()
  })

  it('no permite enviar un aviso cuando no quedan clases para avisar', async () => {
    const user = userEvent.setup()
    vi.mocked(studentApi.tutorings).mockResolvedValue([tutoring])
    vi.mocked(studentApi.attendance).mockResolvedValue([attendance])
    vi.mocked(studentApi.absenceNotices).mockResolvedValue([])
    vi.mocked(studentApi.absenceDates).mockResolvedValue([])
    workspace('attendance')

    await user.click(await screen.findByRole('button', { name: 'Avisar inasistencia' }))
    const dialog = await screen.findByRole('dialog', { name: 'Avisar inasistencia' })
    expect(await within(dialog).findByText('No hay próximas clases para avisar en este período.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Enviar aviso' })).toBeDisabled()
    expect(studentApi.createAbsenceNotice).not.toHaveBeenCalled()
  })

  it('presenta las tres notas y el grupo de conocimiento, sin historial', async () => {
    vi.mocked(studentApi.tutorings).mockResolvedValue([tutoring])
    vi.mocked(studentApi.grades).mockResolvedValue([grades])
    workspace('grades')
    const diagnostic = await screen.findByRole('region', { name: 'Diagnóstico' })
    // El grupo de conocimiento sale del diagnóstico: se muestra en su tarjeta.
    expect(within(diagnostic).getByText('Grupo Medio')).toBeInTheDocument()
    expect(within(diagnostic).getByText('4.00')).toBeInTheDocument()
    expect(screen.queryByText(/Tu diagnóstico te ubica/)).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Parcial 1' })).getByText('Aún sin registrar')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Parcial 2' })).getByText('Aún sin registrar')).toBeInTheDocument()
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0)
    expect(screen.queryByText(/Historial/)).not.toBeInTheDocument()
  })

  it('muestra docente y horarios en su pestaña', async () => {
    vi.mocked(studentApi.tutorings).mockResolvedValue([tutoring])
    workspace('schedules')
    const teacherCard = await screen.findByRole('region', { name: 'Docente' })
    expect(within(teacherCard).getByRole('link', { name: 'maria@ueb.edu.ec' })).toHaveAttribute('href', 'mailto:maria@ueb.edu.ec')
    expect(within(teacherCard).getByRole('link', { name: '0991234567' })).toHaveAttribute('href', 'tel:0991234567')
    expect(within(teacherCard).queryByText(/Inscrito el/)).not.toBeInTheDocument()
    expect(screen.getByText(/Inscrito el/)).toBeInTheDocument()
    const row = screen.getByText('Lunes').closest('tr') as HTMLElement
    expect(within(row).getByText('08:00 – 10:00')).toBeInTheDocument()
    expect(within(row).getByText('Laboratorio 1')).toBeInTheDocument()
    // El texto de las celdas va en el color normal, nunca en gris.
    expect(row.querySelectorAll('.text-muted-foreground')).toHaveLength(0)
    expect(row).not.toHaveClass('text-muted-foreground')
    // Modalidad y duración, una sola vez y juntas.
    expect(screen.getByText('Presencial · 2 h por sesión')).toBeInTheDocument()
    expect(screen.getAllByText(/Presencial/)).toHaveLength(1)
    expect(screen.queryByText('Frecuencia de clases')).not.toBeInTheDocument()
    expect(screen.queryByText('Información de contacto de tu tutor.')).not.toBeInTheDocument()
  })

  it('avisa cuando la tutoría abierta ya finalizó', async () => {
    const inactive: StudentTutoring = { ...tutoring, subject: tutoring.subject && { ...tutoring.subject, is_active: false } }
    vi.mocked(studentApi.tutorings).mockResolvedValue([inactive])
    vi.mocked(studentApi.content).mockResolvedValue(content)
    workspace('content')
    expect(await screen.findByText(/Esta tutoría ya finalizó/)).toBeInTheDocument()
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
    // El título identifica la propuesta: va primero y es obligatorio.
    const fields = within(dialog).getAllByRole('textbox')
    expect(fields[0]).toBe(within(dialog).getByLabelText(/^Título del tema/))
    expect((fields[0] as HTMLInputElement).labels?.[0]).toHaveTextContent('(obligatorio)')
    expect(within(dialog).getByLabelText(/^Título del tema/)).toHaveAttribute('placeholder', expect.stringContaining('Ej.:'))
    expect(within(dialog).getByLabelText(/Descripción/)).toHaveAttribute('placeholder')
    await user.type(within(dialog).getByLabelText(/^Título del tema/), 'Tema de prueba')
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
    const title = within(dialog).getByLabelText(/^Título del tema/)
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
