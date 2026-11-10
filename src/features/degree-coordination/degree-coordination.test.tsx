import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { dashboardSection } from '@/features/tutoring/tutoring-navigation'
import { ApiError } from '@/lib/api'
import { degreeCoordinationApi, type DegreeTeacher, type DegreeTopic } from '@/lib/degree-coordination-api'
import { canCoordinateDegrees } from './degree-navigation'
import { DegreeReportsPage } from './degree-reports-page'
import { DegreeSectionsPage } from './degree-sections-page'
import { DegreeTrackingPage } from './degree-tracking-page'
import { DegreeStudentsPage } from './degree-students-page'
import { DegreeTeachersPage } from './degree-teachers-page'
import { DegreeTopicDetail } from './degree-topic-detail'
import { DegreeTopicsPage } from './degree-topics-page'

vi.mock('@/lib/degree-coordination-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/degree-coordination-api')>()
  return { ...actual, degreeCoordinationApi: Object.fromEntries(Object.keys(actual.degreeCoordinationApi).map((key) => [key, vi.fn()])) }
})

const period = { id: 10, name: '2026-2', start_date: '2026-09-01', end_date: '2027-02-01', is_active: true }
const sections = [{ id: 20, name: 'A', is_active: true }]
const teachers: readonly DegreeTeacher[] = [
  { id: 1, name: 'Ana Torres', email: 'ana@ueb.edu.ec', identification: '0201234567', phone: '0999999999', is_active: true, active_tutorships_count: 2, active_peer_reviews_count: 1 },
  { id: 2, name: 'Luis Pérez', email: 'luis@ueb.edu.ec', identification: '0207654321', phone: '0988888888', is_active: true, active_tutorships_count: 1, active_peer_reviews_count: 2 },
  { id: 3, name: 'María Rojas', email: 'maria@ueb.edu.ec', identification: '0202345678', phone: '0977777777', is_active: true, active_tutorships_count: 0, active_peer_reviews_count: 0 },
]
const topic: DegreeTopic = {
  id: 30, title: 'Plataforma de seguimiento', description: 'Sistema de seguimiento de proyectos.', status: 'pendiente', proposed_at: '2026-09-27', reviewed_at: null,
  student: { id: 5, name: 'Carlos Salas', identification: '0201111111', email: 'carlos@ueb.edu.ec', phone: '0966666666' },
  section: sections[0], academic_period: period, reviewer: null, assignments: [], observations: [],
}
const approved: DegreeTopic = { ...topic, status: 'aprobado', reviewed_at: '2026-09-28', reviewer: { id: 8, name: 'Coordinadora', email: 'coord@ueb.edu.ec' }, assignments: [
  { id: 40, role: 'tutor', assigned_at: '2026-09-28', teacher: teachers[0], is_active: true },
  { id: 41, role: 'par_academico', assigned_at: '2026-09-28', teacher: teachers[1], is_active: true },
] }

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
  vi.mocked(degreeCoordinationApi.currentPeriod).mockResolvedValue(period)
  vi.mocked(degreeCoordinationApi.sections).mockResolvedValue(sections)
  vi.mocked(degreeCoordinationApi.teachers).mockResolvedValue(teachers)
  vi.mocked(degreeCoordinationApi.topics).mockResolvedValue({ data: [topic], meta: { academic_period: period, filter_section_id: null } })
  vi.mocked(degreeCoordinationApi.topic).mockResolvedValue(topic)
})

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('Coordinación de titulación', () => {
  it('asigna un inicio propio a cada rol sin conceder acceso a módulos ajenos', () => {
    expect(dashboardSection('coordinador_titulacion')).toBe('degree-students')
    expect(dashboardSection('coordinador_titulacion', 'users')).toBe('degree-students')
    expect(dashboardSection('coordinador_titulacion', 'degree-tracking')).toBe('degree-tracking')
    expect(dashboardSection('coordinador_titulacion', 'degree-reports')).toBe('degree-reports')
    expect(dashboardSection('administrador', 'degree-topics')).toBe('users')
    expect(dashboardSection('coordinador_carrera', 'degree-topics')).toBe('tutorings')
    expect(dashboardSection('estudiante', 'degree-topics')).toBe('student-tutorings')
    expect(dashboardSection('docente', 'degree-topics')).toBe('teacher-tutorings')
    expect(canCoordinateDegrees('administrador')).toBe(false)
    expect(canCoordinateDegrees('docente')).toBe(false)
    expect(canCoordinateDegrees('coordinador_carrera')).toBe(false)
  })

  it('explica la ausencia de período vigente y bloquea el registro de paralelos', async () => {
    vi.mocked(degreeCoordinationApi.currentPeriod).mockRejectedValue(new ApiError(404, { message: 'No existe un período académico vigente actualmente.' }))
    render(<DegreeSectionsPage />)
    expect(await screen.findByText(/Administración debe configurar y activar un período/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar paralelo' })).toBeDisabled()
    expect(degreeCoordinationApi.registerSection).not.toHaveBeenCalled()
  })

  it('envía filtros de estado, paralelo y búsqueda a la API y permite consultar aprobados', async () => {
    const user = userEvent.setup()
    vi.mocked(degreeCoordinationApi.topics).mockResolvedValue({ data: [approved], meta: { academic_period: period, filter_section_id: null } })
    routed(<DegreeTopicsPage />)
    await screen.findByText('Plataforma de seguimiento')
    expect(within(screen.getByRole('table')).getByText('Aprobada')).toBeInTheDocument()
    // Pie de lista con el mismo formato que el resto del sistema.
    expect(screen.getByText('Mostrando 1 de 1 propuesta')).toBeInTheDocument()
    await pick(user, screen.getByLabelText('Filtrar por Estado'), 'aprobado', 'Aprobada')
    await pick(user, screen.getByLabelText('Filtrar por Paralelo'), '20', 'A')
    await user.type(screen.getByLabelText('Buscar propuesta'), 'Carlos')
    await waitFor(() => expect(degreeCoordinationApi.topics).toHaveBeenLastCalledWith({ status: 'aprobado', section_id: 20, search: 'Carlos' }))
  })

  it('limpia los filtros', async () => {
    const user = userEvent.setup()
    const secondStudent = { id: 6, name: 'Lucía Vera', identification: '0202222222', email: 'lucia@ueb.edu.ec', phone: null }
    const secondTopic: DegreeTopic = { ...topic, id: 31, title: 'Sistema de biblioteca', student: secondStudent, status: 'aprobado' }
    vi.mocked(degreeCoordinationApi.topics).mockResolvedValue({ data: [topic, secondTopic], meta: { academic_period: period, filter_section_id: null } })
    routed(<DegreeTopicsPage />)
    await screen.findByText('Plataforma de seguimiento')

    expect(screen.queryByText('Estudiantes únicos')).not.toBeInTheDocument()

    expect(screen.queryByRole('button', { name: 'Limpiar' })).not.toBeInTheDocument()
    await pick(user, screen.getByLabelText('Filtrar por Estado'), 'aprobado', 'Aprobada')
    await user.click(await screen.findByRole('button', { name: 'Limpiar' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Limpiar' })).not.toBeInTheDocument())
  })

  it('evita duplicar la consulta a la API cuando no hay filtros activos', async () => {
    const user = userEvent.setup()
    routed(<DegreeTopicsPage />)
    await screen.findByText('Plataforma de seguimiento')

    // Sin filtros, la tabla reutiliza la respuesta del período completo:
    // una sola llamada a la API, no una por las estadísticas y otra por la tabla.
    expect(degreeCoordinationApi.topics).toHaveBeenCalledTimes(1)
    expect(degreeCoordinationApi.topics).toHaveBeenCalledWith({})

    await user.type(screen.getByLabelText('Buscar propuesta'), 'Carlos')
    await waitFor(() => expect(degreeCoordinationApi.topics).toHaveBeenCalledTimes(2))
    expect(degreeCoordinationApi.topics).toHaveBeenLastCalledWith({ status: undefined, section_id: undefined, search: 'Carlos' })

    await user.clear(screen.getByLabelText('Buscar propuesta'))
    await new Promise((resolve) => { setTimeout(resolve, 400) })
    expect(degreeCoordinationApi.topics).toHaveBeenCalledTimes(2)
  })

  it('bloquea la aprobación cuando no hay docentes suficientes', async () => {
    vi.mocked(degreeCoordinationApi.teachers).mockResolvedValue([teachers[0]])
    render(<DegreeTopicDetail topicId={30} onBack={vi.fn()} />)
    expect(await screen.findByText(/Se necesitan al menos dos docentes activos/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aprobar propuesta' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Rechazar propuesta' })).toBeEnabled()
  })

  it('impide combinar tutor y par y refleja la aprobación confirmada por el servidor', async () => {
    const user = userEvent.setup()
    const next: DegreeTopic = { ...approved, assignments: [
      { id: 40, role: 'tutor', teacher: teachers[1], assigned_at: '2026-09-28' },
      { id: 41, role: 'par_academico', teacher: teachers[2], assigned_at: '2026-09-28' },
    ] }
    vi.mocked(degreeCoordinationApi.topic).mockResolvedValueOnce(topic).mockResolvedValue(next)
    vi.mocked(degreeCoordinationApi.approve).mockResolvedValue(next)
    render(<DegreeTopicDetail topicId={30} onBack={vi.fn()} />)
    const approveButton = await screen.findByRole('button', { name: 'Aprobar propuesta' })
    await waitFor(() => expect(approveButton).toBeEnabled())
    await user.click(approveButton)
    const form = screen.getByRole('form', { name: 'Aprobar propuesta' })
    // Formulario por pasos: primero el tutor (obligatorio), luego los pares.
    expectRequired(within(form).getByLabelText(/^Docente tutor/))
    const nextStep = within(form).getByRole('button', { name: 'Siguiente' })
    expect(nextStep).toBeDisabled()
    // El motivo del bloqueo se lee en el tooltip del botón, no en el modal.
    const nextButton = within(form).getByRole('button', { name: 'Siguiente' })
    await user.hover(nextButton.parentElement as HTMLElement)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Selecciona el docente tutor.')
    await user.unhover(nextButton.parentElement as HTMLElement)
    await chooseTutor(user, 'Ana Torres')
    await user.click(nextStep)
    expect(screen.queryByRole('checkbox', { name: /Ana Torres/ })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('checkbox', { name: /Luis Pérez/ }))
    await user.click(within(form).getByRole('button', { name: 'Atrás' }))
    await chooseTutor(user, 'Luis Pérez')
    await user.click(within(form).getByRole('button', { name: 'Siguiente' }))
    const submit = within(form).getByRole('button', { name: 'Aprobar propuesta' })
    expect(submit).toBeDisabled()
    expect(screen.queryByRole('checkbox', { name: /Luis Pérez/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /María Rojas/ }))
    await user.click(submit)
    await waitFor(() => expect(degreeCoordinationApi.approve).toHaveBeenCalledWith(30, { tutor_id: 2, peer_ids: [3] }))
    expect(await screen.findByText('Aprobada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprobar propuesta' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gestionar pares académicos' })).toBeInTheDocument()
  })

  it('deja el título con todo su ancho: las acciones de revisión van en su propia fila bajo el encabezado', async () => {
    render(<DegreeTopicDetail topicId={30} onBack={vi.fn()} />)
    const heading = await screen.findByRole('heading', { level: 1, name: 'Plataforma de seguimiento' })
    const header = heading.closest('[data-tour="page-header"]') as HTMLElement
    expect(within(header).getByText('Pendiente')).toBeInTheDocument()
    for (const name of ['Rechazar propuesta', 'Aprobar propuesta', 'Registrar observación']) {
      const button = screen.getByRole('button', { name })
      expect(header).not.toContainElement(button)
    }
  })

  it('describe la carga de cada docente en singular o plural, sin ayudas redundantes, y no reordena los pares al marcarlos', async () => {
    const user = userEvent.setup()
    render(<DegreeTopicDetail topicId={30} onBack={vi.fn()} />)
    const approveButton = await screen.findByRole('button', { name: 'Aprobar propuesta' })
    await waitFor(() => expect(approveButton).toBeEnabled())
    await user.click(approveButton)
    expect(screen.queryByText('Incluye docentes de todas las carreras y facultades.')).not.toBeInTheDocument()
    await user.click(screen.getByLabelText(/^Docente tutor/))
    expect(await screen.findByRole('option', { name: /Luis Pérez/ })).toHaveTextContent('1 tutoría asignada')
    expect(screen.getByRole('option', { name: /Ana Torres/ })).toHaveTextContent('2 tutorías asignadas')
    await user.click(screen.getByRole('option', { name: /María Rojas/ }))
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText('1 revisión asignada')).toBeInTheDocument()
    expect(screen.getByText('2 revisiones asignadas')).toBeInTheDocument()
    expect(screen.queryByText(/Selecciona al menos un docente diferente del tutor/)).not.toBeInTheDocument()
    const order = () => screen.getAllByRole('checkbox').map((box) => box.id)
    expect(order()).toEqual(['degree-peer-1', 'degree-peer-2'])
    await user.click(screen.getByRole('checkbox', { name: /Luis Pérez/ }))
    expect(order()).toEqual(['degree-peer-1', 'degree-peer-2'])
    await user.click(screen.getByRole('checkbox', { name: /Ana Torres/ }))
    await user.click(screen.getByRole('checkbox', { name: /Luis Pérez/ }))
    expect(order()).toEqual(['degree-peer-1', 'degree-peer-2'])
  })

  it('busca docentes de todas las facultades en tiempo real para tutor y pares', async () => {
    const user = userEvent.setup()
    const health: DegreeTeacher = { ...teachers[2], careers: [{ id: 9, name: 'Enfermería', faculty_id: 4, faculty_name: 'Ciencias de la Salud' }] }
    vi.mocked(degreeCoordinationApi.teachers).mockImplementation(async (search = '') =>
      search === '' ? [...teachers.slice(0, 2), health] : search === 'salud' ? [health] : [])
    render(<DegreeTopicDetail topicId={30} onBack={vi.fn()} />)
    const approveButton = await screen.findByRole('button', { name: 'Aprobar propuesta' })
    await waitFor(() => expect(approveButton).toBeEnabled())
    await user.click(approveButton)

    // Al escribir se consulta al servidor sin pulsar ningún botón.
    await user.type(screen.getByLabelText(/^Docente tutor/), 'salud')
    await waitFor(() => expect(degreeCoordinationApi.teachers).toHaveBeenCalledWith('salud'))
    const option = await screen.findByRole('option', { name: /María Rojas/ })
    expect(option).toHaveTextContent('Enfermería · Ciencias de la Salud')
    await user.click(option)
    expect(screen.getByLabelText(/^Docente tutor/)).toHaveValue('María Rojas')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))

    // El par elegido sigue visible aunque la búsqueda cambie.
    await user.click(await screen.findByRole('checkbox', { name: /Ana Torres/ }))
    await user.type(screen.getByLabelText(/^Pares académicos/), 'zzz')
    await waitFor(() => expect(degreeCoordinationApi.teachers).toHaveBeenCalledWith('zzz'))
    expect(screen.getByRole('checkbox', { name: /Ana Torres/ })).toBeChecked()
    expect(screen.queryByRole('checkbox', { name: /Luis Pérez/ })).not.toBeInTheDocument()
    expect(within(screen.getByRole('form', { name: 'Aprobar propuesta' })).getByRole('button', { name: 'Aprobar propuesta' })).toBeEnabled()
  })

  it('registra el rechazo con la observación destinada al estudiante', async () => {
    const user = userEvent.setup()
    vi.mocked(degreeCoordinationApi.topic).mockResolvedValueOnce(topic).mockResolvedValue({ ...topic, status: 'rechazado' })
    vi.mocked(degreeCoordinationApi.reject).mockResolvedValue({ ...topic, status: 'rechazado' })
    render(<DegreeTopicDetail topicId={30} onBack={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'Rechazar propuesta' }))
    await user.type(screen.getByLabelText(/Motivo de rechazo/), '  Delimitar el alcance del proyecto.  ')
    expect(degreeCoordinationApi.reject).not.toHaveBeenCalled()
    await user.click(within(screen.getByRole('form', { name: 'Rechazar propuesta' })).getByRole('button', { name: 'Rechazar propuesta' }))
    await waitFor(() => expect(degreeCoordinationApi.reject).toHaveBeenCalledWith(30, 'Delimitar el alcance del proyecto.'))
    expect(await screen.findByText('Rechazada')).toBeInTheDocument()
  })

  it('conserva la observación si la API la rechaza y evita duplicar el envío pendiente', async () => {
    const user = userEvent.setup()
    let reject: (error: unknown) => void = () => undefined
    vi.mocked(degreeCoordinationApi.observe).mockImplementationOnce(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise }))
    render(<DegreeTopicDetail topicId={30} onBack={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'Registrar observación' }))
    expectRequired(screen.getByLabelText(/^Observación/))
    await user.type(screen.getByLabelText(/^Observación/), 'Revisar las referencias bibliográficas.')
    const form = screen.getByRole('form', { name: 'Registrar observación' })
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(degreeCoordinationApi.observe).toHaveBeenCalledTimes(1)
    expect(within(form).getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    await act(async () => reject(new ApiError(422, { message: 'No se pudo guardar.', errors: { observation: ['La observación no pudo registrarse.'] } })))
    expect(await screen.findByText('La observación no pudo registrarse.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Observación/)).toHaveValue('Revisar las referencias bibliográficas.')
    expect(within(form).getByRole('button', { name: 'Registrar observación' })).toBeEnabled()
  })

  it('recupera un tema aprobado y permite reemplazar sus pares después de abrirlo desde el listado', async () => {
    const user = userEvent.setup()
    vi.mocked(degreeCoordinationApi.topics).mockResolvedValue({ data: [approved], meta: { academic_period: period, filter_section_id: null } })
    vi.mocked(degreeCoordinationApi.topic).mockResolvedValue(approved)
    vi.mocked(degreeCoordinationApi.updatePeers).mockResolvedValue([])
    routed(<DegreeTopicsPage />)
    await user.click(await screen.findByTitle('Revisar Plataforma de seguimiento'))
    await user.click(await screen.findByRole('button', { name: 'Gestionar pares académicos' }))
    const form = screen.getByRole('form', { name: 'Gestionar pares académicos' })
    expect(within(form).getByRole('checkbox', { name: /Luis Pérez/ })).toBeChecked()
    expect(within(form).queryByRole('checkbox', { name: /Ana Torres/ })).not.toBeInTheDocument()
    await user.click(within(form).getByRole('checkbox', { name: /Luis Pérez/ }))
    expect(within(form).getByRole('button', { name: 'Guardar pares académicos' })).toBeDisabled()
    await user.click(within(form).getByRole('checkbox', { name: /María Rojas/ }))
    await user.click(within(form).getByRole('button', { name: 'Guardar pares académicos' }))
    await waitFor(() => expect(degreeCoordinationApi.updatePeers).toHaveBeenCalledWith(30, [3]))
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Gestionar pares académicos' })).not.toBeInTheDocument())
  })

  it('registra un paralelo en el período vigente y actualiza la lista', async () => {
    const user = userEvent.setup()
    vi.mocked(degreeCoordinationApi.sections).mockResolvedValueOnce(sections).mockResolvedValue([...sections, { id: 21, name: 'B', is_active: true }])
    vi.mocked(degreeCoordinationApi.registerSection).mockResolvedValue({ id: 21, name: 'B', status: true, academic_period: period })
    render(<DegreeSectionsPage />)
    const registerButton = await screen.findByRole('button', { name: 'Registrar paralelo' })
    await waitFor(() => expect(registerButton).toBeEnabled())
    await user.click(registerButton)
    await user.type(screen.getByLabelText(/^Nombre del paralelo/), ' B ')
    await user.click(within(screen.getByRole('form', { name: 'Registrar paralelo' })).getByRole('button', { name: 'Registrar paralelo' }))
    await waitFor(() => expect(degreeCoordinationApi.registerSection).toHaveBeenCalledWith('B'))
    expect(await screen.findByText('B')).toBeInTheDocument()
  })

  it('mantiene bloqueado el registro de paralelo hasta completar el nombre', async () => {
    const user = userEvent.setup()
    render(<DegreeSectionsPage />)
    const registerButton = await screen.findByRole('button', { name: 'Registrar paralelo' })
    await waitFor(() => expect(registerButton).toBeEnabled())
    await user.click(registerButton)
    const submit = within(screen.getByRole('form', { name: 'Registrar paralelo' })).getByRole('button', { name: 'Registrar paralelo' })
    expect(submit).toBeDisabled()
    expectRequired(screen.getByLabelText(/^Nombre del paralelo/))
    await user.type(screen.getByLabelText(/^Nombre del paralelo/), 'C')
    expect(submit).toBeEnabled()
  })

  it('abre la evolución de un tema desde la fila y bloquea registrar actividad sin descripción', async () => {
    const user = userEvent.setup()
    vi.mocked(degreeCoordinationApi.topics).mockResolvedValue({ data: [approved], meta: { academic_period: period, filter_section_id: null } })
    vi.mocked(degreeCoordinationApi.addActivity).mockResolvedValue({ data: { id: 1, description: 'Capítulo 1', is_completed: false, registered_at: '2026-09-29', completed_at: null, teacher: null }, message: 'ok' })
    routed(<DegreeTrackingPage />)
    await user.click(await screen.findByTitle('Ver evolución de Plataforma de seguimiento'))
    await user.click(await screen.findByRole('button', { name: 'Nueva actividad' }))
    const form = screen.getByRole('form', { name: 'Registrar actividad de avance' })
    const submit = within(form).getByRole('button', { name: 'Registrar actividad' })
    expect(submit).toBeDisabled()
    expectRequired(within(form).getByLabelText(/^Descripción de la actividad/))
    await user.type(within(form).getByLabelText(/^Descripción de la actividad/), 'Capítulo 1')
    expect(submit).toBeEnabled()
    await user.click(submit)
    await waitFor(() => expect(degreeCoordinationApi.addActivity).toHaveBeenCalledWith(30, { descripcion: 'Capítulo 1' }))
    // El éxito se avisa con un toast, no con un recuadro dentro de la pantalla.
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Registrar actividad de avance' })).not.toBeInTheDocument())
    expect(screen.queryByText(/registrada exitosamente/)).not.toBeInTheDocument()
  })

  it('muestra el estado de la ficha con su nombre, el avance redondeado y las acciones bajo el encabezado', async () => {
    const tracked: DegreeTopic = { ...approved, tracking: { id: 70, opened_at: '2026-09-28', progress_percentage: 66.67, status: 'en_progreso', activities: [] } }
    vi.mocked(degreeCoordinationApi.topics).mockResolvedValue({ data: [tracked], meta: { academic_period: period, filter_section_id: null } })
    vi.mocked(degreeCoordinationApi.topic).mockResolvedValue(tracked)
    const user = userEvent.setup()
    routed(<DegreeTrackingPage />)
    expect(await screen.findByText('Mostrando 1 de 1 tema')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('67%')).toBeInTheDocument()
    await user.click(screen.getByTitle('Ver evolución de Plataforma de seguimiento'))
    const heading = await screen.findByRole('heading', { level: 1, name: 'Plataforma de seguimiento' })
    const header = heading.closest('[data-tour="page-header"]') as HTMLElement
    for (const name of ['Generar informe', 'Nueva actividad']) expect(header).not.toContainElement(screen.getByRole('button', { name }))
    expect(screen.getByText('En progreso')).toBeInTheDocument()
    expect(screen.queryByText(/en_progreso/i)).not.toBeInTheDocument()
    expect(screen.getByText('67%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Avance del tema' })).toHaveAttribute('aria-valuenow', '67')
  })

  it('marca una actividad como completada una sola vez mientras se guarda', async () => {
    const user = userEvent.setup()
    const withActivity: DegreeTopic = { ...approved, tracking: { id: 70, opened_at: '2026-09-28', progress_percentage: 0, status: 'abierta', activities: [
      { id: 1, description: 'Capítulo 1', is_completed: false, registered_at: '2026-09-29', teacher: null },
    ] } }
    vi.mocked(degreeCoordinationApi.topics).mockResolvedValue({ data: [withActivity], meta: { academic_period: period, filter_section_id: null } })
    vi.mocked(degreeCoordinationApi.topic).mockResolvedValue(withActivity)
    let resolve: (value: Awaited<ReturnType<typeof degreeCoordinationApi.toggleActivity>>) => void = () => undefined
    vi.mocked(degreeCoordinationApi.toggleActivity).mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    routed(<DegreeTrackingPage />, '/panel/degree-tracking?topic=30')
    const checkbox = await screen.findByRole('checkbox', { name: 'Completada: Capítulo 1' })
    await user.click(checkbox)
    await user.click(checkbox)
    expect(degreeCoordinationApi.toggleActivity).toHaveBeenCalledTimes(1)
    expect(degreeCoordinationApi.toggleActivity).toHaveBeenCalledWith(30, 1, true)
    expect(screen.getByRole('status', { name: 'Guardando actividad' })).toBeInTheDocument()
    await act(async () => resolve({ data: { id: 1, is_completed: true, progress_percentage: 100 }, message: 'ok' }))
    await waitFor(() => expect(degreeCoordinationApi.topic).toHaveBeenCalledTimes(2))
  })

  it('abre la propuesta desde la fila con sus secciones en pestañas y vuelve al listado', async () => {
    const user = userEvent.setup()
    routed(<DegreeTopicsPage />)
    await user.click(await screen.findByTitle('Revisar Plataforma de seguimiento'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Plataforma de seguimiento' })).toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: 'Secciones de la propuesta' })).toBeInTheDocument()
    expect(screen.getByText('Sistema de seguimiento de proyectos.')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Docentes' }))
    expect(await screen.findByText('Sin tutor asignado')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Observaciones/ }))
    expect(await screen.findByText('Aún no hay observaciones registradas.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver a propuestas' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Propuestas de titulación' })).toBeInTheDocument()
  })

  it('abre la propuesta indicada en la dirección para que el botón atrás del navegador funcione', async () => {
    const user = userEvent.setup()
    routed(<DegreeTopicsPage />, '/panel/degree-topics?topic=30')
    expect(await screen.findByRole('heading', { level: 1, name: 'Plataforma de seguimiento' })).toBeInTheDocument()
    expect(degreeCoordinationApi.topic).toHaveBeenCalledWith(30)
    await user.click(screen.getByRole('button', { name: 'Volver a propuestas' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Propuestas de titulación' })).toBeInTheDocument()
  })

  it('mientras carga la propuesta muestra la forma de su ficha (volver, encabezado, acciones, pestañas y datos)', async () => {
    const pending = deferred<DegreeTopic>()
    vi.mocked(degreeCoordinationApi.topic).mockReturnValue(pending.promise)
    routed(<DegreeTopicsPage />, '/panel/degree-topics?topic=30')
    const loading = await screen.findByRole('status', { name: 'Cargando propuesta' })
    expectSingleLoading()
    expect(loading.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(10)
    expect(screen.queryByRole('button', { name: 'Volver a propuestas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar observación' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    await act(async () => pending.resolve(topic))
    expect(await screen.findByRole('heading', { level: 1, name: 'Plataforma de seguimiento' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Volver a propuestas' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('abre un informe desde la fila y explica la lista vacía según la búsqueda', async () => {
    const user = userEvent.setup()
    const report = { id: 80, topic_id: 30, topic_title: 'Plataforma de seguimiento', student_name: 'Carlos Salas', student_identification: '0201111111', coordinator_name: 'Coordinadora', generated_at: '2026-10-01', final_observations: 'Cumple con los objetivos planteados.', progress_percentage: 100, period_name: '2026-2' }
    const meta = { current_page: 1, last_page: 1, total: 1, per_page: 15, from: 1, to: 1, active_count: 0, inactive_count: 0 }
    vi.mocked(degreeCoordinationApi.reports).mockImplementation(async (params) => params?.search ? { data: [], meta: { ...meta, total: 0 } } : { data: [report], meta })
    render(<DegreeReportsPage />)
    await user.click(await screen.findByTitle('Ver informe de Carlos Salas'))
    const dialog = await screen.findByRole('dialog', { name: 'Informe de titulación' })
    expect(within(dialog).getByText('Cumple con los objetivos planteados.')).toBeInTheDocument()
    // Todas las celdas con el mismo tamaño y color de texto.
    expect(document.querySelector('table')!.querySelectorAll('tbody .text-xs, tbody .text-muted-foreground')).toHaveLength(0)
    await user.click(within(dialog).getAllByRole('button', { name: 'Cerrar' }).at(-1)!)
    await user.type(screen.getByLabelText('Buscar reporte'), 'zzz')
    expect(await screen.findByText('No hay informes con esta búsqueda.')).toBeInTheDocument()
  })

  it('sanea los caracteres no válidos del nombre del paralelo', async () => {
    const user = userEvent.setup()
    vi.mocked(degreeCoordinationApi.sections).mockResolvedValue(sections)
    render(<DegreeSectionsPage />)
    const registerButton = await screen.findByRole('button', { name: 'Registrar paralelo' })
    await waitFor(() => expect(registerButton).toBeEnabled())
    await user.click(registerButton)
    const name = screen.getByLabelText(/^Nombre del paralelo/)
    await user.type(name, 'B2!')
    expect(name).toHaveValue('B')
  })

  it('permite al coordinador de titulación listar estudiantes y matricular a un estudiante', async () => {
    const user = userEvent.setup()
    const degreeStudent = {
      id: 50,
      student_id: 50,
      identification: '0209999999',
      name: 'Estudiante Titulación',
      email: 'estudiante.tit@ueb.edu.ec',
      phone: '0991112233',
      is_degree_enrolled: false,
      degree_enrollment_id: null,
      enrolled_at: null,
      period_id: 10,
      period_name: '2026-2',
    }
    vi.mocked(degreeCoordinationApi.degreeStudents).mockResolvedValue({
      data: [degreeStudent],
      meta: {
        current_page: 1,
        last_page: 1,
        total: 1,
        per_page: 15,
        from: 1,
        to: 1,
        active_count: 1,
        inactive_count: 0,
        current_period: period,
      },
    })
    vi.mocked(degreeCoordinationApi.enrollDegreeStudent).mockResolvedValue({
      data: { ...degreeStudent, is_degree_enrolled: true },
      message: 'Estudiante matriculado en titulación exitosamente.',
    })

    render(<DegreeStudentsPage />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Matrícula en titulación' })).toBeInTheDocument()
    expect(screen.getByText(/período 2026-2/)).toBeInTheDocument()
    expect(screen.getByText('Estudiante Titulación')).toBeInTheDocument()
    expect(screen.getByText('0209999999')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent('#')
    expect(screen.getByText('No matriculado')).toBeInTheDocument()

    // Sin columna de acciones: la fila abre la confirmación según el estado del estudiante.
    expect(screen.queryByRole('columnheader', { name: 'Matrícula' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Matricular a|Dar de baja a/ })).not.toBeInTheDocument()
    expect(screen.queryByTitle('Dar de baja a Estudiante Titulación')).not.toBeInTheDocument()
    await user.click(screen.getByTitle('Matricular a Estudiante Titulación'))

    expect(screen.getByRole('heading', { level: 2, name: /¿Matricular a Estudiante Titulación en Titulación\?/i })).toBeInTheDocument()
    const confirmBtn = screen.getByRole('button', { name: 'Confirmar matrícula' })
    await user.click(confirmBtn)

    await waitFor(() => expect(degreeCoordinationApi.enrollDegreeStudent).toHaveBeenCalledWith(50))
  })
})

describe('Carga completa de las pantallas de titulación', () => {
  const reportMeta = { current_page: 1, last_page: 2, total: 16, per_page: 15, from: 1, to: 15, active_count: 0, inactive_count: 0 }
  const report = { id: 80, topic_id: 30, topic_title: 'Plataforma de seguimiento', student_name: 'Carlos Salas', student_identification: '0201111111', coordinator_name: 'Coordinadora', generated_at: '2026-10-01', final_observations: 'Cumple.', progress_percentage: 100, period_name: '2026-2' }

  it('matrícula: todo el encabezado, el filtro y la tabla cargan como un solo esqueleto', async () => {
    const pending = deferred<Awaited<ReturnType<typeof degreeCoordinationApi.degreeStudents>>>()
    vi.mocked(degreeCoordinationApi.degreeStudents).mockReturnValue(pending.promise)
    render(<DegreeStudentsPage />)
    expectSingleLoading('Cargando estudiantes de titulación')
    expect(screen.queryByRole('heading', { level: 1, name: 'Matrícula en titulación' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Buscar estudiante')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /Paginación/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['#', 'Estudiante', 'Cédula', 'Teléfono', 'Ciclo', 'Estado', 'Fecha de matrícula'])
    await act(async () => pending.resolve({ data: [], meta: { ...reportMeta, last_page: 1, total: 0, current_period: period } }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Matrícula en titulación' })).toBeInTheDocument()
    expect(screen.getByText(/período 2026-2/)).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('paralelos: no muestra botones reales junto a una tabla que carga', async () => {
    const pending = deferred<typeof period>()
    vi.mocked(degreeCoordinationApi.currentPeriod).mockReturnValue(pending.promise)
    render(<DegreeSectionsPage />)
    expectSingleLoading('Cargando paralelos')
    expect(screen.queryByRole('heading', { level: 1, name: 'Período y paralelos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar paralelo' })).not.toBeInTheDocument()
    await act(async () => pending.resolve(period))
    expect(await screen.findByRole('heading', { level: 1, name: 'Período y paralelos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar paralelo' })).toBeEnabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('docentes: el buscador y el encabezado esperan a la primera carga', async () => {
    const pending = deferred<readonly DegreeTeacher[]>()
    vi.mocked(degreeCoordinationApi.teachers).mockReturnValue(pending.promise)
    render(<DegreeTeachersPage />)
    expectSingleLoading('Cargando docentes')
    expect(screen.queryByRole('heading', { level: 1, name: 'Docentes de titulación' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Buscar docente')).not.toBeInTheDocument()
    await act(async () => pending.resolve(teachers))
    expect(await screen.findByText('Ana Torres')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Docentes de titulación' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('propuestas: sin botón de actualizar ni filtros reales mientras carga; al filtrar solo cargan las filas', async () => {
    const user = userEvent.setup()
    const pending = deferred<Awaited<ReturnType<typeof degreeCoordinationApi.topics>>>()
    vi.mocked(degreeCoordinationApi.topics).mockReturnValueOnce(pending.promise).mockReturnValue(new Promise(() => {}))
    routed(<DegreeTopicsPage />)
    expectSingleLoading('Cargando propuestas')
    expect(screen.queryByRole('heading', { level: 1, name: 'Propuestas de titulación' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Actualizar' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Buscar propuesta')).not.toBeInTheDocument()
    await act(async () => pending.resolve({ data: [topic], meta: { academic_period: period, filter_section_id: null } }))
    expect(await screen.findByText('Plataforma de seguimiento')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Buscar propuesta'), 'Carlos')
    await waitFor(() => expect(degreeCoordinationApi.topics).toHaveBeenCalledTimes(2))
    expectSingleLoading()
    expect(screen.getByRole('heading', { level: 1, name: 'Propuestas de titulación' })).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar propuesta')).toHaveValue('Carlos')
  })

  it('seguimiento: la lista y la ficha cargan con su forma completa', async () => {
    const list = deferred<Awaited<ReturnType<typeof degreeCoordinationApi.topics>>>()
    vi.mocked(degreeCoordinationApi.topics).mockReturnValue(list.promise)
    routed(<DegreeTrackingPage />)
    expectSingleLoading('Cargando seguimiento')
    expect(screen.queryByRole('heading', { level: 1, name: 'Seguimiento de titulación' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Buscar tema o estudiante')).not.toBeInTheDocument()
    await act(async () => list.resolve({ data: [approved], meta: { academic_period: period, filter_section_id: null } }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Seguimiento de titulación' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    cleanup()

    const detail = deferred<DegreeTopic>()
    vi.mocked(degreeCoordinationApi.topic).mockReturnValue(detail.promise)
    routed(<DegreeTrackingPage />, '/panel/degree-tracking?topic=30')
    expectSingleLoading('Cargando ficha de seguimiento')
    expect(screen.queryByRole('button', { name: 'Volver a seguimiento' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nueva actividad' })).not.toBeInTheDocument()
    await act(async () => detail.resolve(approved))
    expect(await screen.findByRole('button', { name: 'Nueva actividad' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Volver a seguimiento' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('reportes: esqueleto completo al entrar; al cambiar de página se conserva la pantalla', async () => {
    const user = userEvent.setup()
    const first = deferred<Awaited<ReturnType<typeof degreeCoordinationApi.reports>>>()
    vi.mocked(degreeCoordinationApi.reports).mockReturnValueOnce(first.promise).mockReturnValue(new Promise(() => {}))
    render(<DegreeReportsPage />)
    expectSingleLoading('Cargando reportes')
    expect(screen.queryByRole('heading', { level: 1, name: 'Reportes de titulación' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Paginación de reportes' })).not.toBeInTheDocument()
    await act(async () => first.resolve({ data: [report], meta: reportMeta }))
    expect(await screen.findByTitle('Ver informe de Carlos Salas')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }))
    expectSingleLoading()
    expect(screen.getByRole('heading', { level: 1, name: 'Reportes de titulación' })).toBeInTheDocument()
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument()
  })
})

/** Un solo anuncio de carga en la pantalla, cuyo nombre empieza por "Cargando". */
function expectSingleLoading(name?: string) {
  const statuses = screen.getAllByRole('status')
  expect(statuses).toHaveLength(1)
  expect(statuses[0]).toHaveAccessibleName(name ?? /^Cargando/)
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

// Un campo obligatorio lleva asterisco y "(obligatorio)" en su etiqueta.
function expectRequired(field: HTMLElement) {
  expect((field as HTMLInputElement).labels?.[0]).toHaveTextContent('(obligatorio)')
}

function routed(ui: ReactElement, path = '/panel/degree') {
  return render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>)
}

async function chooseTutor(user: ReturnType<typeof userEvent.setup>, name: string) {
  const input = screen.getByLabelText(/^Docente tutor/)
  await user.clear(input)
  await user.click(input)
  await user.click(await screen.findByRole('option', { name: new RegExp(name) }))
}

// El filtro puede ser un <select> nativo o un select de shadcn (Radix): se elige la opción en ambos casos.
async function pick(user: ReturnType<typeof userEvent.setup>, control: HTMLElement, value: string, label: string) {
  if (control instanceof HTMLSelectElement) {
    await user.selectOptions(control, value)
    return
  }
  await user.click(control)
  await user.click(await screen.findByRole('option', { name: label }))
}
