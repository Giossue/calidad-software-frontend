import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { tutoringApi, type CoordinatorStudent, type Subject, type Tutoring } from '@/lib/tutoring-api'
import { TutoringCurriculumPage } from './curriculum-page'
import { TutoringStudentsPage } from './students-page'
import { TutoringsPage } from './tutorings-page'

vi.mock('@/lib/tutoring-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tutoring-api')>()
  return { ...actual, tutoringApi: Object.fromEntries(Object.keys(actual.tutoringApi).map((key) => [key, vi.fn()])) }
})

// React Flow (la malla) mide con DOMMatrix; jsdom no lo trae.
class DOMMatrixReadOnlyShim {
  m22 = 1
}

const career = { id: 10, faculty_id: 1, modality_id: 60, name: 'Software', code: 'SW', status: true, cycles_count: 3, active_cycles_count: 3, cycle_levels: 3 }
const cycleA = { id: 20, career_id: 10, name: 'Segundo', number: 2, paralelo_id: 1, paralelo_name: 'A', status: true }
const cycleB = { id: 22, career_id: 10, name: 'Segundo', number: 2, paralelo_id: 2, paralelo_name: 'B', status: true }
const third = { id: 21, career_id: 10, name: 'Tercero', number: 3, paralelo_id: 1, paralelo_name: 'A', status: true }
const active = { id: 50, name: 'PAO II 2026', start_date: '2026-09-01', end_date: '2027-02-01', is_active: true }
const past = { id: 49, name: 'PAO I 2026', start_date: '2026-03-01', end_date: '2026-08-01', is_active: false }
// La asignatura ya no trae `cycle_ids` útiles: su ciclo es solo el número.
const subject: Subject = { id: 30, career_id: 10, career_name: 'Software', code: 'MAT', name: 'Matemática', is_active: true, cycle_number: 2 }
const tutoring: Tutoring = { id: 40, subject_id: 30, subject_name: 'Matemática', cycle_id: 20, cycle_name: 'Segundo', career_id: 10, period_id: 50, period_name: 'PAO II 2026', modality_id: 60, modality_name: 'Presencial', section_id: 1, section_name: 'A', teacher_id: null, teacher_name: null, teacher_is_active: null, is_active: true }

type ListPeriod = { id: number; name: string; is_active: boolean } | null

function paginated<T>(data: readonly T[], period?: ListPeriod) {
  return { data, meta: { current_page: 1, last_page: 1, from: 1, to: data.length, total: data.length, per_page: 15, active_count: data.length, inactive_count: 0, ...(period === undefined ? {} : { period }) } }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('DOMMatrixReadOnly', DOMMatrixReadOnlyShim)
  localStorage.clear()
  vi.mocked(tutoringApi.careers).mockResolvedValue([career])
  vi.mocked(tutoringApi.cycles).mockResolvedValue([cycleA, cycleB, third])
  vi.mocked(tutoringApi.periods).mockResolvedValue([active, past])
  vi.mocked(tutoringApi.modalities).mockResolvedValue([{ id: 60, name: 'Presencial', is_active: true }])
  vi.mocked(tutoringApi.sections).mockResolvedValue([{ id: 1, name: 'A', is_active: true }, { id: 2, name: 'B', is_active: true }])
  vi.mocked(tutoringApi.subjects).mockResolvedValue(paginated([subject]))
  vi.mocked(tutoringApi.tutorings).mockImplementation(async (params) => (
    params?.period_id === past.id
      ? paginated([{ ...tutoring, id: 41, period_id: past.id, period_name: past.name }], { id: past.id, name: past.name, is_active: false })
      : paginated([tutoring], { id: active.id, name: active.name, is_active: true })
  ))
  vi.mocked(tutoringApi.schedules).mockResolvedValue([])
  vi.mocked(tutoringApi.sessions).mockResolvedValue(paginated([]))
  vi.mocked(tutoringApi.students).mockResolvedValue(paginated([]))
  vi.mocked(tutoringApi.degreeStudents).mockResolvedValue(paginated([]))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function choose(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, option: string | RegExp) {
  await user.click(trigger)
  await user.click(await screen.findByRole('option', { name: option }))
}

function renderTutorings(entry = '/') {
  return render(<MemoryRouter initialEntries={[entry]}><TutoringsPage /></MemoryRouter>)
}

describe('Tutorías por período académico', () => {
  it('el título lleva el nombre del período mostrado', async () => {
    renderTutorings()
    expect(await screen.findByRole('heading', { level: 1, name: 'Tutorías - Período PAO II 2026' })).toBeInTheDocument()
  })

  it('el desplegable «Período» va después del buscador, parte del período vigente y lista los pasados', async () => {
    const user = userEvent.setup()
    renderTutorings()
    await screen.findByText('Matemática')
    expect(tutoringApi.tutorings).toHaveBeenLastCalledWith(expect.objectContaining({ period_id: undefined }))
    const filters = screen.getByLabelText('Buscar').closest('[data-tour="page-filters"]') as HTMLElement
    const period = within(filters).getByRole('combobox', { name: 'Período' })
    expect(within(filters).getAllByRole('combobox')[0]).toBe(period)
    expect(period).toHaveTextContent('PAO II 2026')
    await user.click(period)
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['PAO II 2026', 'PAO I 2026'])
  })

  it('un período pasado es solo de consulta: sin crear, cargar listado, editar ni inscribir', async () => {
    const user = userEvent.setup()
    renderTutorings()
    await screen.findByText('Matemática')
    expect(screen.getByRole('button', { name: 'Crear tutoría' })).toBeInTheDocument()
    expect(screen.queryByText('Período pasado: solo consulta.')).not.toBeInTheDocument()

    await choose(user, screen.getByRole('combobox', { name: 'Período' }), 'PAO I 2026')
    await waitFor(() => expect(tutoringApi.tutorings).toHaveBeenLastCalledWith(expect.objectContaining({ period_id: past.id })))
    expect(await screen.findByRole('heading', { level: 1, name: 'Tutorías - Período PAO I 2026' })).toBeInTheDocument()
    expect(screen.getByText('Período pasado: solo consulta.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Crear tutoría' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cargar listado PDF' })).not.toBeInTheDocument()

    await user.click(await screen.findByTitle('Abrir la tutoría de Matemática'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Matemática' })).toBeInTheDocument()
    expect(screen.getByText('Período pasado: solo consulta.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar tutoría' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Estudiantes' }))
    await waitFor(() => expect(tutoringApi.students).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Registrar estudiante' })).not.toBeInTheDocument()
  })

  it('el período elegido se guarda en la URL', async () => {
    renderTutorings('/?periodo=49')
    expect(await screen.findByRole('heading', { level: 1, name: 'Tutorías - Período PAO I 2026' })).toBeInTheDocument()
    expect(tutoringApi.tutorings).toHaveBeenCalledWith(expect.objectContaining({ period_id: past.id }))
  })

  it('sin período vigente pide al administrador activar uno', async () => {
    vi.mocked(tutoringApi.periods).mockResolvedValue([past])
    vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([], null))
    renderTutorings()
    expect(await screen.findByText('No hay un período académico activo. Pide al administrador que active uno.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Crear tutoría' })).not.toBeInTheDocument()
    expect(screen.queryAllByRole('status')).toHaveLength(0)
  })

  it('al crear una tutoría ofrece los paralelos del ciclo de la asignatura y envía ese ciclo', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.availableTeachers).mockResolvedValue([{ id: 70, name: 'Ana Torres', email: 'ana@ueb.edu.ec', is_active: true }])
    vi.mocked(tutoringApi.createTutoring).mockResolvedValue(tutoring)
    renderTutorings()
    await screen.findByText('Matemática')
    await user.click(screen.getByRole('button', { name: 'Crear tutoría' }))
    await choose(user, screen.getByLabelText(/^Asignatura/), 'Matemática · 2° ciclo')
    const form = await screen.findByRole('form', { name: 'Crear tutoría' })
    await waitFor(() => expect(within(form).getByLabelText(/^Docente/)).toBeEnabled())
    await choose(user, within(form).getByLabelText(/^Docente/), 'Ana Torres')
    await user.click(within(form).getByRole('button', { name: 'Siguiente' }))
    const parallels = within(form).getByRole('radiogroup', { name: 'Paralelo' })
    expect(within(parallels).getAllByRole('radio').map((radio) => radio.closest('label')?.textContent)).toEqual(['Paralelo A', 'Paralelo B'])
    await user.click(within(parallels).getByRole('radio', { name: 'Paralelo B' }))
    await user.click(within(form).getByRole('button', { name: 'Crear tutoría' }))
    await waitFor(() => expect(tutoringApi.createTutoring).toHaveBeenCalledWith({
      subject_id: 30,
      cycle_id: 22,
      period_id: 50,
      modality_id: 60,
      teacher_id: 70,
      schedules: [],
    }))
  })

  // Fila base del 2.º ciclo: sin paralelo, como la crea el administrador.
  const baseSecond = { id: 25, career_id: 10, name: 'Segundo', number: 2, paralelo_id: null, paralelo_name: null, status: true }

  async function openParallelStep(user: ReturnType<typeof userEvent.setup>) {
    vi.mocked(tutoringApi.availableTeachers).mockResolvedValue([{ id: 70, name: 'Ana Torres', email: 'ana@ueb.edu.ec', is_active: true }])
    vi.mocked(tutoringApi.createTutoring).mockResolvedValue(tutoring)
    renderTutorings()
    await screen.findByText('Matemática')
    await user.click(screen.getByRole('button', { name: 'Crear tutoría' }))
    await choose(user, screen.getByLabelText(/^Asignatura/), 'Matemática · 2° ciclo')
    const form = await screen.findByRole('form', { name: 'Crear tutoría' })
    // El docente se elige junto con la asignatura, en el primer paso.
    await waitFor(() => expect(within(form).getByLabelText(/^Docente/)).toBeEnabled())
    await choose(user, within(form).getByLabelText(/^Docente/), 'Ana Torres')
    await user.click(within(form).getByRole('button', { name: 'Siguiente' }))
    return form
  }

  async function submitWithTeacher(user: ReturnType<typeof userEvent.setup>, form: HTMLElement) {
    await user.click(within(form).getByRole('button', { name: 'Crear tutoría' }))
  }

  const expectedBase = { subject_id: 30, period_id: 50, modality_id: 60, teacher_id: 70, schedules: [] }

  it('sin paralelos en el ciclo ofrece los del catálogo y envía el ciclo base con `parallel_id`', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.cycles).mockResolvedValue([baseSecond, third])
    const form = await openParallelStep(user)
    expect(within(form).queryByText('Este ciclo aún no tiene paralelos registrados en la carrera.')).not.toBeInTheDocument()
    const parallels = within(form).getByRole('radiogroup', { name: 'Paralelo' })
    expect(within(parallels).getAllByRole('radio').map((radio) => radio.closest('label')?.textContent)).toEqual(['Paralelo A', 'Paralelo B'])
    await user.click(within(parallels).getByRole('radio', { name: 'Paralelo B' }))
    await submitWithTeacher(user, form)
    await waitFor(() => expect(tutoringApi.createTutoring).toHaveBeenCalledWith({ ...expectedBase, cycle_id: 25, parallel_id: 2 }))
  })

  it('mezcla paralelos usados (envía su ciclo) con los demás del catálogo', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.cycles).mockResolvedValue([cycleA, baseSecond, third])
    const form = await openParallelStep(user)
    const parallels = within(form).getByRole('radiogroup', { name: 'Paralelo' })
    expect(within(parallels).getAllByRole('radio').map((radio) => radio.closest('label')?.textContent)).toEqual(['Paralelo A', 'Paralelo B'])
    await user.click(within(parallels).getByRole('radio', { name: 'Paralelo A' }))
    await submitWithTeacher(user, form)
    await waitFor(() => expect(tutoringApi.createTutoring).toHaveBeenCalledWith({ ...expectedBase, cycle_id: 20 }))
  })

  it('permite crear un paralelo nuevo y lo envía con el ciclo base', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.cycles).mockResolvedValue([baseSecond, third])
    vi.mocked(tutoringApi.sections).mockResolvedValue([])
    vi.mocked(tutoringApi.createSection).mockResolvedValue({ id: 3, name: 'C', is_active: true })
    const form = await openParallelStep(user)
    await user.click(within(form).getByRole('button', { name: 'Crear paralelo' }))
    await user.type(within(form).getByLabelText('Nombre del nuevo paralelo'), 'c')
    await user.click(within(form).getByRole('button', { name: 'Guardar paralelo' }))
    await waitFor(() => expect(tutoringApi.createSection).toHaveBeenCalledWith('C'))
    const parallels = await within(form).findByRole('radiogroup', { name: 'Paralelo' })
    expect(within(parallels).getByRole('radio', { name: 'Paralelo C' })).toBeChecked()
    await submitWithTeacher(user, form)
    await waitFor(() => expect(tutoringApi.createTutoring).toHaveBeenCalledWith({ ...expectedBase, cycle_id: 25, parallel_id: 3 }))
  })

  it('un error del servidor en `cycle_id` o `parallel_id` se queda en el paso del paralelo, bajo el campo', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.cycles).mockResolvedValue([baseSecond, third])
    const form = await openParallelStep(user)
    vi.mocked(tutoringApi.createTutoring).mockRejectedValue(new ApiError(422, { message: 'El ciclo necesita un paralelo activo.', errors: { cycle_id: ['El ciclo necesita un paralelo activo.'] } }))
    await user.click(within(within(form).getByRole('radiogroup', { name: 'Paralelo' })).getByRole('radio', { name: 'Paralelo A' }))
    await submitWithTeacher(user, form)
    expect(await within(form).findByText('El ciclo necesita un paralelo activo.')).toBeInTheDocument()
    expect(within(form).getAllByText('El ciclo necesita un paralelo activo.')).toHaveLength(1)
    expect(within(form).getByRole('radiogroup', { name: 'Paralelo' })).toBeInTheDocument()
  })
})

describe('Malla: el ciclo de la asignatura es solo su número', () => {
  async function openEditor(user: ReturnType<typeof userEvent.setup>) {
    render(<MemoryRouter><TutoringCurriculumPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Editar malla' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Editar malla' }))
  }

  it('el formulario solo pide el ciclo (sin paralelos) y envía `cycle_number`', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.createSubject).mockResolvedValue(subject)
    await openEditor(user)
    await user.click(await screen.findByRole('button', { name: 'Agregar asignatura al 3° ciclo' }))
    const form = screen.getByRole('form', { name: 'Registrar asignatura' })
    await user.type(within(form).getByLabelText(/^Nombre/), 'Redes')
    await user.click(within(form).getByRole('button', { name: 'Siguiente' }))
    const cycleField = within(form).getByLabelText(/^Ciclo/)
    expect(cycleField).toHaveTextContent('3° ciclo · Titulación')
    expect(within(form).queryByRole('group', { name: 'Paralelos' })).not.toBeInTheDocument()
    expect(within(form).queryByText(/paralelo/i)).not.toBeInTheDocument()
    expect(within(form).queryByLabelText('Período académico')).not.toBeInTheDocument()
    await user.click(cycleField)
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['Sin ciclo', '1° ciclo', '2° ciclo', '3° ciclo · Titulación'])
    await user.click(screen.getByRole('option', { name: '1° ciclo' }))
    await user.click(within(form).getByRole('button', { name: 'Registrar asignatura' }))
    await waitFor(() => expect(tutoringApi.createSubject).toHaveBeenCalledWith({ career_id: 10, name: 'REDES', cycle_number: 1, modality_id: 60 }))
  })

  it('la malla agrupa por `cycle_number`, no por `cycle_ids`', async () => {
    vi.mocked(tutoringApi.subjects).mockResolvedValue(paginated([
      { ...subject, cycle_number: 3, cycle_ids: [20] },
      { ...subject, id: 31, code: 'ETI', name: 'Ética', cycle_number: null, cycle_ids: [21] },
    ]))
    render(<MemoryRouter><TutoringCurriculumPage /></MemoryRouter>)
    const canvas = await screen.findByRole('region', { name: 'Vista de la malla' })
    // Cada carril cuenta las asignaturas que se dibujan en él.
    expect(within(canvas).getByRole('region', { name: '2° ciclo' })).toHaveTextContent('Asignaturas0')
    expect(within(canvas).getByRole('region', { name: '3° ciclo' })).toHaveTextContent('Asignaturas1')
    expect(within(canvas).getByRole('region', { name: 'Sin ciclo' })).toHaveTextContent('Asignaturas1')
  })
})

describe('Estudiante: ciclo automático por período', () => {
  const withCycle: CoordinatorStudent = {
    id: 103, identification: '0201888888', name: 'Lucía Ciclo', email: 'lucia@ueb.edu.ec', phone: null, is_active: true,
    cycle_id: 20, cycle_number: 2, section_name: 'A', tutoring_count: 0, tutorings: [],
    cycle_history: [
      { period_id: 50, period_name: 'PAO II 2026', cycle_number: 2, cycle_name: 'Segundo' },
      { period_id: 49, period_name: 'PAO I 2026', cycle_number: 1, cycle_name: 'Primero' },
    ],
  }
  const withoutCycle: CoordinatorStudent = { ...withCycle, id: 104, name: 'Pedro Nuevo', cycle_id: null, cycle_number: null, section_name: null, cycle_history: [] }

  function renderStudent(id: number) {
    vi.mocked(tutoringApi.allStudents).mockResolvedValue(paginated([withCycle, withoutCycle]))
    return render(<MemoryRouter initialEntries={[`/?estudiante=${id}`]}><TutoringStudentsPage /></MemoryRouter>)
  }

  it('con ciclo no ofrece «Cambiar ciclo»', async () => {
    renderStudent(103)
    expect(await screen.findByRole('heading', { level: 1, name: 'Lucía Ciclo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cambiar ciclo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Asignar ciclo' })).not.toBeInTheDocument()
  })

  it('sin ciclo conserva «Asignar ciclo»', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.updateStudentCycle).mockResolvedValue({ data: { ...withoutCycle, cycle_id: 20, cycle_number: 2 } })
    renderStudent(104)
    await user.click(await screen.findByRole('button', { name: 'Asignar ciclo' }))
    const form = screen.getByRole('form', { name: 'Asignar ciclo' })
    await choose(user, within(form).getByLabelText(/Ciclo que cursa/i), /2° ciclo · Paralelo A/)
    await user.click(within(form).getByRole('button', { name: 'Guardar ciclo' }))
    await waitFor(() => expect(tutoringApi.updateStudentCycle).toHaveBeenCalledWith(104, 20))
  })

  it('«Datos» muestra el ciclo de cada período, del más reciente al más antiguo', async () => {
    const user = userEvent.setup()
    renderStudent(103)
    await user.click(await screen.findByRole('tab', { name: 'Datos' }))
    const history = screen.getByRole('list', { name: 'Ciclo por período' })
    expect(within(history).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['PAO II 2026 · 2° ciclo', 'PAO I 2026 · 1° ciclo'])
  })

  it('«Datos» lo dice cuando aún no hay ciclos por período', async () => {
    const user = userEvent.setup()
    renderStudent(104)
    await user.click(await screen.findByRole('tab', { name: 'Datos' }))
    expect(screen.getByText('Aún no tiene ciclos registrados por período.')).toBeInTheDocument()
  })
})
