import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { dashboardSection } from '@/features/tutoring/tutoring-navigation'
import { ApiError } from '@/lib/api'
import { degreeCoordinationApi, type DegreeTeacher, type DegreeTopic } from '@/lib/degree-coordination-api'
import { canCoordinateDegrees } from './degree-navigation'
import { DegreeSectionsPage } from './degree-sections-page'
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
    expect(dashboardSection('coordinador_titulacion')).toBe('degree-topics')
    expect(dashboardSection('coordinador_titulacion', 'users')).toBe('degree-topics')
    expect(dashboardSection('coordinador_titulacion', 'degree-sections')).toBe('degree-sections')
    expect(dashboardSection('administrador', 'degree-topics')).toBe('degree-topics')
    expect(dashboardSection('coordinador_carrera', 'degree-topics')).toBe('tutorings')
    expect(dashboardSection('estudiante', 'degree-topics')).toBe('student-degree-topics')
    expect(dashboardSection('docente', 'degree-topics')).toBe('teacher-tutorings')
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
    render(<DegreeTopicsPage />)
    await screen.findByText('Plataforma de seguimiento')
    expect(within(screen.getByRole('table')).getByText('Aprobado')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Estado'), 'aprobado')
    await user.selectOptions(screen.getByLabelText('Paralelo'), '20')
    await user.type(screen.getByLabelText('Buscar propuesta'), 'Carlos')
    await waitFor(() => expect(degreeCoordinationApi.topics).toHaveBeenLastCalledWith({ status: 'aprobado', section_id: 20, search: 'Carlos' }))
  })

  it('calcula las estadísticas del período y limpia los filtros', async () => {
    const user = userEvent.setup()
    const secondStudent = { id: 6, name: 'Lucía Vera', identification: '0202222222', email: 'lucia@ueb.edu.ec', phone: null }
    const secondTopic: DegreeTopic = { ...topic, id: 31, title: 'Sistema de biblioteca', student: secondStudent, status: 'aprobado' }
    vi.mocked(degreeCoordinationApi.topics).mockResolvedValue({ data: [topic, secondTopic], meta: { academic_period: period, filter_section_id: null } })
    render(<DegreeTopicsPage />)
    await screen.findByText('Plataforma de seguimiento')

    await screen.findByText('Propuestas')
    expect(screen.getByText('Propuestas').previousElementSibling).toHaveTextContent('2')
    expect(screen.getByText('Estudiantes únicos').previousElementSibling).toHaveTextContent('2')
    expect(screen.getByText('En revisión').previousElementSibling).toHaveTextContent('1')

    const clearButton = screen.getByRole('button', { name: 'Limpiar filtros' })
    expect(clearButton).toBeDisabled()
    await user.type(screen.getByLabelText('Buscar propuesta'), 'Carlos')
    await waitFor(() => expect(clearButton).toBeEnabled())
    await user.click(clearButton)
    expect(screen.getByLabelText('Buscar propuesta')).toHaveValue('')
    await waitFor(() => expect(clearButton).toBeDisabled())
  })

  it('evita duplicar la consulta a la API cuando no hay filtros activos', async () => {
    const user = userEvent.setup()
    render(<DegreeTopicsPage />)
    await screen.findByText('Plataforma de seguimiento')

    // Sin filtros, la tabla reutiliza la respuesta del período completo:
    // una sola llamada a la API, no una por las estadísticas y otra por la tabla.
    expect(degreeCoordinationApi.topics).toHaveBeenCalledTimes(1)
    expect(degreeCoordinationApi.topics).toHaveBeenCalledWith({})

    await user.type(screen.getByLabelText('Buscar propuesta'), 'Carlos')
    await waitFor(() => expect(degreeCoordinationApi.topics).toHaveBeenCalledTimes(2))
    expect(degreeCoordinationApi.topics).toHaveBeenLastCalledWith({ status: undefined, section_id: undefined, search: 'Carlos' })

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getByLabelText('Buscar propuesta')).toHaveValue('')
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
    const submit = within(form).getByRole('button', { name: 'Aprobar propuesta' })
    expect(submit).toBeDisabled()
    await user.selectOptions(screen.getByLabelText('Docente tutor'), '1')
    expect(screen.queryByRole('checkbox', { name: /Ana Torres/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /Luis Pérez/ }))
    await user.selectOptions(screen.getByLabelText('Docente tutor'), '2')
    expect(submit).toBeDisabled()
    expect(screen.queryByRole('checkbox', { name: /Luis Pérez/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /María Rojas/ }))
    await user.click(submit)
    await waitFor(() => expect(degreeCoordinationApi.approve).toHaveBeenCalledWith(30, { tutor_id: 2, peer_ids: [3] }))
    expect(await screen.findByText('Aprobado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprobar propuesta' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gestionar pares académicos' })).toBeInTheDocument()
  })

  it('registra el rechazo con la observación destinada al estudiante', async () => {
    const user = userEvent.setup()
    vi.mocked(degreeCoordinationApi.topic).mockResolvedValueOnce(topic).mockResolvedValue({ ...topic, status: 'rechazado' })
    vi.mocked(degreeCoordinationApi.reject).mockResolvedValue({ ...topic, status: 'rechazado' })
    render(<DegreeTopicDetail topicId={30} onBack={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'Rechazar propuesta' }))
    await user.type(screen.getByLabelText('Motivo de rechazo (opcional)'), '  Delimitar el alcance del proyecto.  ')
    expect(degreeCoordinationApi.reject).not.toHaveBeenCalled()
    await user.click(within(screen.getByRole('form', { name: 'Rechazar propuesta' })).getByRole('button', { name: 'Rechazar propuesta' }))
    await waitFor(() => expect(degreeCoordinationApi.reject).toHaveBeenCalledWith(30, 'Delimitar el alcance del proyecto.'))
    expect(await screen.findByText('Rechazado')).toBeInTheDocument()
  })

  it('conserva la observación si la API la rechaza y evita duplicar el envío pendiente', async () => {
    const user = userEvent.setup()
    let reject: (error: unknown) => void = () => undefined
    vi.mocked(degreeCoordinationApi.observe).mockImplementationOnce(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise }))
    render(<DegreeTopicDetail topicId={30} onBack={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'Registrar observación' }))
    await user.type(screen.getByLabelText('Observación'), 'Revisar las referencias bibliográficas.')
    const form = screen.getByRole('form', { name: 'Registrar observación' })
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(degreeCoordinationApi.observe).toHaveBeenCalledTimes(1)
    expect(within(form).getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    await act(async () => reject(new ApiError(422, { message: 'No se pudo guardar.', errors: { observation: ['La observación no pudo registrarse.'] } })))
    expect(await screen.findByText('La observación no pudo registrarse.')).toBeInTheDocument()
    expect(screen.getByLabelText('Observación')).toHaveValue('Revisar las referencias bibliográficas.')
    expect(within(form).getByRole('button', { name: 'Registrar observación' })).toBeEnabled()
  })

  it('recupera un tema aprobado y permite reemplazar sus pares después de abrirlo desde el listado', async () => {
    const user = userEvent.setup()
    vi.mocked(degreeCoordinationApi.topics).mockResolvedValue({ data: [approved], meta: { academic_period: period, filter_section_id: null } })
    vi.mocked(degreeCoordinationApi.topic).mockResolvedValue(approved)
    vi.mocked(degreeCoordinationApi.updatePeers).mockResolvedValue([])
    render(<DegreeTopicsPage />)
    await user.click(await screen.findByRole('button', { name: 'Revisar Plataforma de seguimiento' }))
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
    const registerButton = screen.getByRole('button', { name: 'Registrar paralelo' })
    await waitFor(() => expect(registerButton).toBeEnabled())
    await user.click(registerButton)
    await user.type(screen.getByLabelText('Nombre del paralelo'), ' B ')
    await user.click(within(screen.getByRole('form', { name: 'Registrar paralelo' })).getByRole('button', { name: 'Registrar paralelo' }))
    await waitFor(() => expect(degreeCoordinationApi.registerSection).toHaveBeenCalledWith('B'))
    expect(await screen.findByText('B')).toBeInTheDocument()
  })

  it('sanea los caracteres no válidos del nombre del paralelo', async () => {
    const user = userEvent.setup()
    vi.mocked(degreeCoordinationApi.sections).mockResolvedValue(sections)
    render(<DegreeSectionsPage />)
    const registerButton = screen.getByRole('button', { name: 'Registrar paralelo' })
    await waitFor(() => expect(registerButton).toBeEnabled())
    await user.click(registerButton)
    const name = screen.getByLabelText('Nombre del paralelo')
    await user.type(name, 'B2!')
    expect(name).toHaveValue('B')
  })
})
