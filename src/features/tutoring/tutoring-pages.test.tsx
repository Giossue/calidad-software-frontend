import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { tutoringApi, type Subject, type Tutoring } from '@/lib/tutoring-api'
import { TutoringSubjectsPage } from './subjects-page'
import { TutoringCurriculumPage } from './curriculum-page'
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

const initialCurriculum = { id: 1, name: 'Malla inicial', is_initial: true, from_period_id: null, from_period_name: null, up_to_cycle: null, previous_name: null, in_force: true, subjects_count: 2 }

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
  vi.mocked(tutoringApi.sessions).mockResolvedValue(paginated([]))
  vi.mocked(tutoringApi.reports).mockResolvedValue(paginated([]))
  vi.mocked(tutoringApi.allReports).mockResolvedValue(paginated([]))
  vi.mocked(tutoringApi.degreeStudents).mockResolvedValue(paginated([]))
  vi.mocked(tutoringApi.curricula).mockResolvedValue({ data: [initialCurriculum], periods: [{ id: 50, name: '2026-2', start_date: '2026-09-01' }, { id: 51, name: '2027-1', start_date: '2027-03-01' }] })
})

afterEach(cleanup)

// Los selects de shadcn (Radix) se abren con clic y la opción se elige por su nombre.
async function choose(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, option: string | RegExp) {
  await user.click(trigger)
  await user.click(await screen.findByRole('option', { name: option }))
}

/** Opciones del desplegable de ciclo (lo abre y lo vuelve a cerrar). */
async function readCycleOptions(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('combobox', { name: 'Ciclo' }))
  const names = (await screen.findAllByRole('option')).map((option) => option.textContent)
  await user.keyboard('{Escape}')
  return names
}

async function chooseCycle(user: ReturnType<typeof userEvent.setup>, option: string | RegExp) {
  await choose(user, await screen.findByRole('combobox', { name: 'Ciclo' }), option)
}

/** Asignaturas guarda la asignatura abierta en la URL: se monta dentro de un router. */
function renderSubjects() {
  return render(<MemoryRouter><TutoringSubjectsPage /></MemoryRouter>)
}

// Con una sola carrera el módulo entra directo a ella.
async function openSubjects() {
  renderSubjects()
  await screen.findByRole('button', { name: 'Registrar asignatura' })
}

/** Docentes guarda el docente abierto en la URL: se monta dentro de un router. */
function renderTeachers() {
  return render(<MemoryRouter><TutoringTeachersPage /></MemoryRouter>)
}

/** Abre «Registrar asignatura», escribe el nombre (y el código) y pasa al paso de ciclo y paralelos. */
async function fillSubjectData(user: ReturnType<typeof userEvent.setup>, name: string, code?: string) {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar asignatura' })).toBeEnabled())
  await user.click(screen.getByRole('button', { name: 'Registrar asignatura' }))
  const form = screen.getByRole('form', { name: 'Registrar asignatura' })
  if (code) await user.type(within(form).getByLabelText(/^Código/), code)
  await user.type(within(form).getByLabelText(/^Nombre/), name)
  await user.click(within(form).getByRole('button', { name: 'Siguiente' }))
  return form
}


/** Abre la tutoría desde su fila y luego su modal de edición. */
async function openTutoringEdit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByTitle('Abrir la tutoría de Matemática'))
  await user.click(await screen.findByRole('button', { name: 'Editar tutoría' }))
}

describe('Coordinación de tutorías', () => {
  it('restringe la navegación según el rol y elige la portada correspondiente', () => {
    expect(dashboardSection('coordinador_carrera', 'users')).toBe('tutorings')
    expect(dashboardSection('coordinador_carrera', 'tutoring-subjects')).toBe('tutoring-subjects')
    expect(dashboardSection('coordinador_carrera', 'tutoring-curriculum')).toBe('tutoring-curriculum')
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
    renderSubjects()
    expect(await screen.findByText(/Solicita al administrador que asigne una carrera activa/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar asignatura' })).not.toBeInTheDocument()
  })

  it('conserva el formulario ante un rechazo y evita crear dos veces mientras guarda', async () => {
    const user = userEvent.setup()
    const toastError = vi.spyOn(toast, 'error')
    let reject: (error: unknown) => void = () => undefined
    vi.mocked(tutoringApi.createSubject).mockImplementationOnce(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise }))
    await openSubjects()
    const form = await fillSubjectData(user, 'Programación', 'PROG')
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(tutoringApi.createSubject).toHaveBeenCalledTimes(1)
    // Toma el ciclo de la pestaña abierta.
    expect(tutoringApi.createSubject).toHaveBeenCalledWith({ career_id: 10, code: 'PROG', name: 'PROGRAMACIÓN', cycle_id: 20, period_id: 50 })
    expect(within(form).getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    await act(async () => reject(new ApiError(422, { message: 'No se pudo guardar.', errors: { code: ['El código ya existe.'] } })))
    // El error es del código (paso 1): el formulario vuelve a ese paso, con el error dentro y sin toast.
    expect(await within(form).findByText('El código ya existe.')).toBeInTheDocument()
    expect(within(form).getByLabelText(/^Nombre/)).toHaveValue('PROGRAMACIÓN')
    expect(within(form).getByRole('button', { name: 'Siguiente' })).toBeEnabled()
    expect(toastError).not.toHaveBeenCalled()
    await user.click(within(form).getByRole('button', { name: 'Siguiente' }))
    expect(within(form).getByRole('button', { name: 'Registrar asignatura' })).toBeEnabled()
  })

  it('con dos paralelos en el ciclo de la pestaña, el ciclo del paso 2 no queda vacío', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.cycles).mockResolvedValue([cycle, { ...cycle, id: 22, paralelo_id: 2, paralelo_name: 'B' }, { ...cycle, id: 21, name: 'Tercero', number: 3 }])
    await openSubjects()
    const form = await fillSubjectData(user, 'Programación')
    expect(within(form).getByLabelText(/^Ciclo/)).toHaveTextContent('2° ciclo')
  })

  it('Asignaturas: título del módulo con la carrera en la descripción, toast en participio y error del servidor bajo el campo', async () => {
    const user = userEvent.setup()
    const success = vi.spyOn(toast, 'success')
    await openSubjects()
    expect(screen.getByRole('heading', { level: 1, name: 'Asignaturas' })).toBeInTheDocument()
    expect(screen.getByText(/de Software/)).toBeInTheDocument()
    vi.mocked(tutoringApi.createSubject)
      .mockRejectedValueOnce(new ApiError(422, { message: 'El nombre ya está registrado.', errors: { name: ['El nombre ya está registrado.'] } }))
      .mockResolvedValueOnce(subject)
    const form = await fillSubjectData(user, 'Programación')
    await user.click(within(form).getByRole('button', { name: 'Registrar asignatura' }))
    const name = await within(form).findByLabelText(/^Nombre/)
    await waitFor(() => expect(name).toHaveAttribute('aria-invalid', 'true'))
    expect(name.closest('[data-slot="field"]')).toHaveTextContent('El nombre ya está registrado.')
    await user.click(within(form).getByRole('button', { name: 'Siguiente' }))
    await user.click(within(form).getByRole('button', { name: 'Registrar asignatura' }))
    await waitFor(() => expect(success).toHaveBeenCalledWith('Asignatura registrada', undefined))
  })

  it('propone el ciclo de la pestaña abierta al registrar una asignatura y permite cambiarlo, con código opcional', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.createSubject).mockResolvedValue(subject)
    await openSubjects()
    // Código es opcional: se envía solo con nombre y ciclo
    const form = await fillSubjectData(user, 'Programación')
    expect(within(form).queryByLabelText('Carrera')).not.toBeInTheDocument()
    expect(within(form).getByLabelText(/^Ciclo/)).toHaveTextContent('2° ciclo')
    await choose(user, within(form).getByLabelText(/^Ciclo/), '3° ciclo')
    await user.click(within(form).getByRole('button', { name: 'Registrar asignatura' }))
    await waitFor(() => expect(tutoringApi.createSubject).toHaveBeenCalledWith({ career_id: 10, name: 'PROGRAMACIÓN', cycle_id: 21, period_id: 50 }))
  })

  it('muestra el período académico actual sobre los demás campos de solo lectura y lo asocia automáticamente al registrar una asignatura', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.createSubject).mockResolvedValue(subject)
    await openSubjects()
    const form = await fillSubjectData(user, 'Estructura de Datos')

    // El período académico debe estar sobre los demás campos y ser solo lectura (no permite escoger)
    const periodInput = within(form).getByLabelText('Período académico')
    expect(periodInput).toBeDisabled()
    expect(periodInput).toHaveValue('2026-2')
    expect(within(form).getByText('PAO actual')).toBeInTheDocument()

    await choose(user, within(form).getByLabelText(/^Ciclo/), '2° ciclo')
    await user.click(within(form).getByRole('button', { name: 'Atrás' }))
    await choose(user, within(form).getByLabelText(/^Modalidad/), 'Presencial')
    await user.click(within(form).getByRole('button', { name: 'Siguiente' }))
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
    // Code (optional) & Name, first
    const form = await fillSubjectData(user, 'Estructuras de Datos', 'SW-201')

    // Select cycle
    await choose(user, within(form).getByLabelText(/^Ciclo/), '2° ciclo')

    // Select existing parallel A
    await user.click(within(form).getByLabelText(/Paralelo A/))

    // Create a new parallel B with button
    await user.click(within(form).getByRole('button', { name: /Crear nuevo paralelo/ }))
    const parallelInput = within(form).getByPlaceholderText('Ej. B')
    await user.type(parallelInput, 'B')
    await user.click(within(form).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(tutoringApi.createSection).toHaveBeenCalledWith('B'))

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

    const code = within(form).getByLabelText(/^Código/)
    await user.type(code, 'sw b1#001!')
    expect(code).toHaveValue('swb1001')

    const name = within(form).getByLabelText(/^Nombre/)
    await user.type(name, 'Cálculo 3 (avanzado)')
    expect(name).toHaveValue('CÁLCULO  AVANZADO')
  })

  it('consulta la página siguiente de asignaturas en el servidor', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.subjects).mockImplementation(async (params) => paginated([{ ...subject, name: params?.page === 2 ? 'Física' : 'Matemática' }], params?.page, 2))
    await openSubjects()
    await screen.findByText('Matemática')
    const next = screen.getByRole('button', { name: 'Página siguiente' })
    await waitFor(() => expect(next).toBeEnabled())
    await user.click(next)
    expect(await screen.findByText('Física', {}, { timeout: 10000 })).toBeInTheDocument()
    expect(tutoringApi.subjects).toHaveBeenLastCalledWith({ page: 2, search: '', career_id: career.id, cycle_number: 2, status: undefined })
  })

  it('elige el ciclo de las asignaturas en un desplegable y empieza en el primero', async () => {
    const user = userEvent.setup()
    await openSubjects()
    await screen.findByText('Matemática')
    expect(screen.queryByRole('tablist', { name: 'Ciclos de la carrera' })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Ciclo' })).toHaveTextContent('2° ciclo')
    expect(await readCycleOptions(user)).toEqual(['2° ciclo', '3° ciclo · Titulación'])
    expect(screen.queryByLabelText('Filtrar por Ciclo')).not.toBeInTheDocument()
    expect(screen.queryByText(/Asignaturas de 2° ciclo/)).not.toBeInTheDocument()
    expect(tutoringApi.subjects).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: career.id, cycle_number: 2, status: undefined })

    await chooseCycle(user, '3° ciclo · Titulación')
    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: career.id, cycle_number: 3, status: undefined }))
    // Dentro de un ciclo la columna «Ciclo» sobra.
    expect(screen.queryByRole('columnheader', { name: 'Ciclo' })).not.toBeInTheDocument()
  })

  it('define en qué asignatura continúa la malla al editar una asignatura y lo muestra en la tabla', async () => {
    const user = userEvent.setup()
    const physics = { ...subject, id: 31, code: 'FIS', name: 'Física', cycle_ids: [21] }
    vi.mocked(tutoringApi.subjects).mockImplementation(async (params) => params?.per_page === 100
      ? paginated([subject, physics])
      : paginated([{ ...subject, next_subjects: [], previous_subjects: [{ id: 5, code: 'AL', name: 'ALGEBRA' }] }]))
    vi.mocked(tutoringApi.updateSubject).mockResolvedValue({ ...subject, next_subjects: [{ id: 31, code: 'FIS', name: 'FISICA' }] })
    await openSubjects()
    expect(screen.getByRole('columnheader', { name: 'Continúa en' })).toBeInTheDocument()
    await user.click(await screen.findByText('Matemática'))
    // La secuencia se ve en la pestaña «Malla» de la asignatura y se edita desde ahí.
    await user.click(await screen.findByRole('tab', { name: 'Malla' }))
    expect(screen.getByText('ALGEBRA')).toBeInTheDocument()
    expect(screen.getByText('Ninguna: aquí termina la secuencia.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Editar secuencia' }))
    const form = await screen.findByRole('form', { name: 'Secuencia en la malla' })
    expect(within(form).getByText('Viene de: ALGEBRA')).toBeInTheDocument()
    // Solo ofrece asignaturas de ciclos posteriores (Física es del 3.°; Matemática, del 2.°).
    const options = await within(form).findByRole('group', { name: 'Asignaturas que continúan' })
    expect(within(options).getAllByRole('checkbox')).toHaveLength(1)
    expect(within(form).getByText('Sin asignatura siguiente: aquí termina la secuencia.')).toBeInTheDocument()
    await user.click(within(options).getByRole('checkbox', { name: /Física/ }))
    await user.click(within(form).getByRole('button', { name: 'Guardar secuencia' }))
    await waitFor(() => expect(tutoringApi.updateSubject).toHaveBeenCalledWith(30, { code: 'MAT', name: 'Matemática', next_subject_ids: [31] }))
    expect(tutoringApi.subjects).toHaveBeenCalledWith({ career_id: 10, per_page: 100 })
    // La pantalla muestra la secuencia guardada.
    expect(await screen.findByText('FISICA')).toBeInTheDocument()
  })

  it('muestra la malla curricular por ciclo y resalta de dónde viene y en qué continúa la asignatura elegida', async () => {
    const user = userEvent.setup()
    const math = { ...subject, name: 'MATEMATICA', next_subjects: [{ id: 31, code: 'FIS', name: 'FISICA' }], previous_subjects: [] }
    const physics = { ...subject, id: 31, code: 'FIS', name: 'FISICA', cycle_ids: [21], next_subjects: [], previous_subjects: [{ id: 30, code: 'MAT', name: 'MATEMATICA' }] }
    vi.mocked(tutoringApi.subjects).mockResolvedValue(paginated([math, physics]))
    render(<TutoringCurriculumPage />)

    const second = await screen.findByRole('region', { name: '2° ciclo' })
    expect(tutoringApi.subjects).toHaveBeenCalledWith({ career_id: 10, curriculum_id: 1, status: 'active', page: 1, per_page: 100 })
    expect(screen.getByRole('heading', { name: '3° ciclo · Titulación' })).toBeInTheDocument()
    expect(screen.getByText('2 asignaturas · 1 continúan en otra. Elige una para ver su secuencia.')).toBeInTheDocument()
    const third = screen.getByRole('region', { name: '3° ciclo' })
    expect(within(third).getByText('Fin de secuencia')).toBeInTheDocument()

    await user.click(within(second).getByRole('button', { name: /MATEMATICA/ }))
    expect(within(second).getByRole('button', { name: /MATEMATICA/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/ninguna \(inicia una secuencia\)/)).toBeInTheDocument()
    expect(within(third).getByText('Continúa')).toBeInTheDocument()

    await user.click(within(third).getByRole('button', { name: /FISICA/ }))
    expect(within(second).getByText('Previa')).toBeInTheDocument()
    expect(screen.getByText(/ninguna \(aquí termina la secuencia\)/)).toBeInTheDocument()
  })

  it('Malla: título del módulo, códigos en fuente normal, esqueleto de tarjetas y motivo del bloqueo de «Revisar malla» en su tooltip', async () => {
    const user = userEvent.setup()
    let resolveCareers: (value: typeof career[]) => void = () => undefined
    vi.mocked(tutoringApi.careers).mockReturnValue(new Promise((resolve) => { resolveCareers = resolve }))
    render(<TutoringCurriculumPage />)
    // Mientras cargan las carreras ya se ve la forma de la malla (tarjetas, no una tabla).
    expect(screen.getByRole('status', { name: 'Cargando malla curricular' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument()
    await act(async () => resolveCareers([career]))
    expect(await screen.findByRole('heading', { level: 1, name: 'Malla curricular' })).toBeInTheDocument()
    expect(screen.getByText(/malla de Software/)).toBeInTheDocument()
    expect(await screen.findByText('MAT')).not.toHaveClass('font-mono')

    await user.click(screen.getByRole('button', { name: 'Subir nueva malla curricular' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByText(/Ponle nombre, elige desde qué PAO/)).not.toBeInTheDocument()
    const review = within(dialog).getByRole('button', { name: 'Revisar malla' })
    expect(review).toBeDisabled()
    await user.hover(review.parentElement as HTMLElement)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Escribe el nombre de la malla.')
  })

  it('sube una nueva malla: lee el archivo, permite corregirla y la crea para el PAO y los ciclos elegidos', async () => {
    const user = userEvent.setup()
    const created = { id: 2, name: 'Malla 2027-1', is_initial: false, from_period_id: 51, from_period_name: '2027-1', up_to_cycle: 2, previous_name: 'Malla inicial', in_force: false, subjects_count: 2 }
    vi.mocked(tutoringApi.previewCurriculum).mockResolvedValue([
      { code: 'N-1', name: 'ALGORITMOS', cycle: 1, previous: [], errors: [] },
      { code: 'N-2', name: '', cycle: 2, previous: ['N-1'], errors: ['Falta el nombre de la asignatura.'] },
    ])
    vi.mocked(tutoringApi.createCurriculum).mockResolvedValue({ id: 2, name: 'Malla 2027-1', subjects_count: 2 })
    render(<TutoringCurriculumPage />)

    await user.click(await screen.findByRole('button', { name: 'Subir nueva malla curricular' }))
    const dialog = await screen.findByRole('dialog')
    // Primero lo que identifica a la malla; los datos obligatorios llevan asterisco.
    const labels = [...dialog.querySelectorAll('label[for]')].map((label) => label.textContent ?? '')
    expect(labels[0]).toMatch(/^Nombre de la malla/)
    expect(labels.filter((label) => label.includes('(obligatorio)'))).toHaveLength(3)
    await user.upload(within(dialog).getByLabelText('Archivo de la malla'), new File(['codigo;nombre'], 'malla.csv', { type: 'text/csv' }))
    await choose(user, within(dialog).getByLabelText(/^¿Desde qué PAO rige\?/), '2027-1')
    expect(within(dialog).getByLabelText(/^Nombre de la malla/)).toHaveValue('Malla 2027-1')
    await choose(user, within(dialog).getByLabelText(/^¿A qué ciclos se aplica esta nueva malla\?/), 'De 1.º a 2.º ciclo')
    expect(within(dialog).getByText(/Los de 3\.º ciclo en adelante seguirán con/)).toHaveTextContent('Malla inicial')
    await user.click(within(dialog).getByRole('button', { name: 'Revisar malla' }))

    expect(await within(dialog).findByText('Falta el nombre de la asignatura.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Crear malla con 2 asignaturas' })).toBeDisabled()
    await user.type(within(dialog).getByLabelText('Nombre de N-2'), 'Programación I')
    expect(within(dialog).queryByText('Falta el nombre de la asignatura.')).not.toBeInTheDocument()

    vi.mocked(tutoringApi.curricula).mockResolvedValue({ data: [created, initialCurriculum], periods: [] })
    await user.click(within(dialog).getByRole('button', { name: 'Crear malla con 2 asignaturas' }))
    await waitFor(() => expect(tutoringApi.createCurriculum).toHaveBeenCalledWith({
      career_id: 10, name: 'Malla 2027-1', period_id: 51, up_to_cycle: 2,
      subjects: [{ code: 'N-1', name: 'ALGORITMOS', cycle: 1, previous: [] }, { code: 'N-2', name: 'Programación I', cycle: 2, previous: ['N-1'] }],
    }))
    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenLastCalledWith({ career_id: 10, curriculum_id: 2, status: 'active', page: 1, per_page: 100 }))
    expect(await screen.findByText(/Rige desde 2027-1 para quienes estaban de 1\.º a 2\.º ciclo/)).toBeInTheDocument()
  })

  it('mientras cargan las carreras muestra un esqueleto y no el buscador de carreras', async () => {
    let resolveCareers: (value: typeof career[]) => void = () => undefined
    vi.mocked(tutoringApi.careers).mockReturnValue(new Promise((resolve) => { resolveCareers = resolve }))
    renderSubjects()
    // Es el mismo esqueleto de Asignaturas (encabezado, filtros y su tabla), no uno de carreras.
    expect(screen.getByRole('status', { name: 'Cargando asignaturas' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(2)
    expect(screen.queryByLabelText('Buscar carrera')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Busca por nombre de carrera…')).not.toBeInTheDocument()
    await act(async () => resolveCareers([career]))
    expect(await screen.findByRole('button', { name: 'Registrar asignatura' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Buscar carrera')).not.toBeInTheDocument()
  })

  it('al abrir un docente desde la URL, mientras carga muestra la forma de su ficha y no la lista', async () => {
    vi.mocked(tutoringApi.teachers).mockReturnValue(new Promise(() => {}))
    render(<MemoryRouter initialEntries={['/?docente=5']}><TutoringTeachersPage /></MemoryRouter>)
    const loading = await screen.findByRole('status', { name: 'Cargando docente' })
    expect(loading.parentElement?.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(5)
    expect(screen.queryByText('Cargando docente…')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar docente nuevo' })).not.toBeInTheDocument()
  })

  it('con varias carreras lista primero las carreras con búsqueda y entra a la elegida; con una sola entra directo', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.careers).mockResolvedValue([career, { ...career, id: 11, name: 'Comunicación' }])
    vi.mocked(tutoringApi.cycles).mockResolvedValue([cycle, { ...cycle, id: 21, name: 'Tercero', number: 3 }, { ...cycle, id: 22, career_id: 11, name: 'Primero', number: 1 }])
    renderSubjects()
    expect(await screen.findByTitle('Ver asignaturas de Software')).toBeInTheDocument()
    expect(screen.getByTitle('Ver asignaturas de Comunicación')).toBeInTheDocument()
    expect(screen.getByText(/de/, { selector: 'p' })).toHaveTextContent('Mostrando 2 de 2 carreras')
    expect(screen.queryByRole('button', { name: 'Registrar asignatura' })).not.toBeInTheDocument()
    expect(tutoringApi.subjects).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Buscar carrera'), 'comu')
    expect(screen.queryByTitle('Ver asignaturas de Software')).not.toBeInTheDocument()
    await user.click(screen.getByTitle('Ver asignaturas de Comunicación'))
    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: 11, cycle_number: 1, status: undefined }))
    await user.click(screen.getByRole('button', { name: 'Asignaturas' }))
    expect(await screen.findByLabelText('Buscar carrera')).toBeInTheDocument()
  })

  it('aplica el filtro de estado y permite limpiarlo', async () => {
    const user = userEvent.setup()
    await openSubjects()
    await screen.findByText('Matemática')
    await choose(user, screen.getByLabelText('Filtrar por Estado'), 'Activas')
    await user.click(screen.getByRole('button', { name: 'Limpiar' }))
    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: career.id, cycle_number: 2, status: undefined }))
  })

  it('permite asignar y desasignar paralelos desde la pantalla de la asignatura', async () => {
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
    // Sin columna de acciones: los paralelos se gestionan en la pantalla de la asignatura.
    expect(screen.queryByRole('button', { name: 'Acciones para Matemática' })).not.toBeInTheDocument()
    await user.click(await screen.findByText('Matemática'))
    expect(await screen.findByRole('tab', { name: 'Paralelos', selected: true })).toBeInTheDocument()
    const dialog = screen.getByRole('tabpanel', { name: 'Paralelos' })
    expect(within(dialog).getByText('Paralelo A')).toBeInTheDocument()

    await choose(user, within(dialog).getByLabelText('Agregar un paralelo'), 'Paralelo B')
    await user.click(within(dialog).getByRole('button', { name: 'Agregar paralelo' }))
    await waitFor(() => expect(tutoringApi.assignSubjectParallel).toHaveBeenCalledWith(30, {
      parallel_id: 2,
      cycle_id: 20,
      new_parallel_name: undefined,
    }))
    expect(await within(dialog).findByText('Paralelo B')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Quitar Paralelo A' }))
    await waitFor(() => expect(tutoringApi.unassignSubjectParallel).toHaveBeenCalledWith(30, 1))
    expect(within(dialog).queryByRole('button', { name: 'Quitar Paralelo A' })).not.toBeInTheDocument()
  })

  it('muestra los paralelos de cada asignatura directamente en la tabla', async () => {
    vi.mocked(tutoringApi.cycles).mockResolvedValue([cycle, { ...cycle, id: 21, paralelo_id: 2, paralelo_name: 'B' }])
    vi.mocked(tutoringApi.subjects).mockResolvedValue(paginated([{ ...subject, cycle_ids: [20, 21] }]))
    await openSubjects()
    const row = (await screen.findByText('Matemática')).closest('tr') as HTMLElement
    // Los paralelos van como texto simple (solo los estados llevan badge).
    expect(within(row).getByText('A, B')).toBeInTheDocument()
    expect([...row.querySelectorAll('[data-slot="badge"]')].map((badge) => badge.textContent)).toEqual(['Activa'])
    expect(screen.queryByRole('button', { name: /Ver paralelos de/i })).not.toBeInTheDocument()
  })

  it('respeta la restricción de edición de cuentas docentes compartidas', async () => {
    vi.mocked(tutoringApi.teachers).mockResolvedValue(paginated([{ id: 1, name: 'Ana Torres', identification: '0201234567', email: 'ana@ueb.edu.ec', phone: '0999999999', is_active: true, career_ids: [10], can_manage: false }]))
    renderTeachers()
    const user = userEvent.setup()
    await user.click(await screen.findByText('Ana Torres'))
    // Su pantalla es de solo consulta: sin editar, desactivar ni quitar de la carrera.
    expect(await screen.findByRole('heading', { level: 1, name: 'Ana Torres' })).toBeInTheDocument()
    expect(screen.getByText(/Solo consulta: los cambios de este docente están a cargo de administración/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar docente' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desactivar docente' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Carreras' }))
    expect(screen.getByText('Software')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Quitar de/ })).not.toBeInTheDocument()
  })

  it('vincula un docente existente a una carrera sin crearlo de nuevo', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.availableTeachers).mockResolvedValue([{ id: 70, name: 'Ana Torres', email: 'ana@ueb.edu.ec', is_active: true }])
    vi.mocked(tutoringApi.linkTeacherToCareer).mockResolvedValue({ id: 70, name: 'Ana Torres', identification: '0201234567', email: 'ana@ueb.edu.ec', phone: null, is_active: true, career_ids: [career.id], can_manage: true })
    renderTeachers()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Vincular docente existente' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Vincular docente existente' }))
    const form = await screen.findByRole('form', { name: 'Vincular docente existente' })
    // Con una sola carrera queda elegida de antemano.
    expect(within(form).getByLabelText(/^Carrera/)).toHaveTextContent(career.name)
    await user.type(within(form).getByLabelText(/^Docente/), 'ana')
    await user.click(await screen.findByRole('option', { name: /Ana Torres/ }))
    await user.click(within(form).getByRole('button', { name: 'Vincular docente' }))
    await waitFor(() => expect(tutoringApi.linkTeacherToCareer).toHaveBeenCalledWith(70, career.id))
  })

  it('muestra en Docentes las asignaturas que dicta cada docente en lugar de sus carreras', async () => {
    const teacher = { id: 1, name: 'Ana Torres', identification: '0201234567', email: 'ana@ueb.edu.ec', phone: '0999999999', is_active: true, career_ids: [career.id], can_manage: true,
      tutorings: [{ id: 40, subject_name: 'ALGEBRA LINEAL', cycle_name: 'Primero', cycle_number: 1, section_name: 'A' }, { id: 41, subject_name: 'PROGRAMACION WEB I', cycle_name: 'Tercero', cycle_number: 3, section_name: 'Paralelo B' }] }
    const idle = { ...teacher, id: 2, name: 'Luis Mora', tutorings: [] }
    vi.mocked(tutoringApi.teachers).mockResolvedValue(paginated([teacher, idle]))
    renderTeachers()
    await screen.findByText('Ana Torres')
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Docente', 'Contacto', 'Asignatura', 'Ciclo', 'Paralelo', 'Estado'])
    expect(screen.queryByRole('columnheader', { name: 'Carreras' })).not.toBeInTheDocument()
    // Una fila por asignatura; el docente abarca sus dos filas.
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByRole('cell', { name: /Ana Torres/ })).toHaveAttribute('rowspan', '2')
    expect(within(rows[0]).getAllByRole('cell').slice(2, 5).map((cell) => cell.textContent)).toEqual(['ALGEBRA LINEAL', '1', 'A'])
    expect(within(rows[1]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['PROGRAMACION WEB I', '3', 'B'])
    expect(within(rows[2]).getAllByRole('cell').slice(2, 5).map((cell) => cell.textContent)).toEqual(['Sin tutorías', '—', '—'])
    expect(screen.getByText('Sin tutorías')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ver carreras de/ })).not.toBeInTheDocument()
  })

  it('quita a un docente de una de sus carreras tras confirmar', async () => {
    const user = userEvent.setup()
    const teacher = { id: 1, name: 'Ana Torres', identification: '0201234567', email: 'ana@ueb.edu.ec', phone: '0999999999', is_active: true, career_ids: [career.id, 99], can_manage: true }
    vi.mocked(tutoringApi.teachers).mockResolvedValue(paginated([teacher]))
    vi.mocked(tutoringApi.unlinkTeacherFromCareer).mockResolvedValue({ ...teacher, career_ids: [99] })
    renderTeachers()
    expect(await screen.findByText('Ana Torres')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Acciones para Ana Torres' })).not.toBeInTheDocument()
    await user.click(screen.getByText('Ana Torres'))
    await user.click(await screen.findByRole('tab', { name: 'Carreras' }))
    await user.click(screen.getByRole('button', { name: `Quitar de ${career.name}` }))
    expect(tutoringApi.unlinkTeacherFromCareer).not.toHaveBeenCalled()
    await user.click(await screen.findByRole('button', { name: 'Quitar de la carrera' }))
    await waitFor(() => expect(tutoringApi.unlinkTeacherFromCareer).toHaveBeenCalledWith(1, career.id))
  })

  it('sanea los caracteres del formulario de docentes y valida la cédula en vivo', async () => {
    const user = userEvent.setup()
    renderTeachers()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar docente nuevo' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Registrar docente nuevo' }))
    const form = screen.getByRole('form', { name: 'Registrar docente' })
    // Primero el nombre; los cuatro datos son obligatorios.
    const labels = [...form.querySelectorAll('label')].map((label) => label.textContent ?? '')
    expect(labels[0]).toMatch(/^Nombre completo/)
    expect(labels.filter((label) => label.includes('(obligatorio)'))).toHaveLength(4)

    const identification = within(form).getByLabelText(/^Cédula o pasaporte/)
    await user.type(identification, '17-1003 4065.')
    expect(identification).toHaveValue('1710034065')
    expect(within(form).getByLabelText('Identificación válida')).toBeInTheDocument()

    const name = within(form).getByLabelText(/^Nombre completo/)
    await user.type(name, 'Ana123 Torres')
    expect(name).toHaveValue('Ana Torres')

    const phone = within(form).getByLabelText(/^Teléfono/)
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

  it('edita y desactiva un docente gestionable desde su pantalla, que se abre con el clic de fila', async () => {
    const user = userEvent.setup()
    const teacher = { id: 1, name: 'Ana Torres', identification: '0201234567', email: 'ana@ueb.edu.ec', phone: '0999999999', is_active: true, career_ids: [10], can_manage: true }
    vi.mocked(tutoringApi.teachers).mockResolvedValue(paginated([teacher]))
    vi.mocked(tutoringApi.updateTeacher).mockResolvedValue({ ...teacher, name: 'Ana María Torres' })
    vi.mocked(tutoringApi.deactivateTeacher).mockResolvedValue({ ...teacher, is_active: false })
    renderTeachers()

    await user.click(await screen.findByTitle('Abrir a Ana Torres'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Ana Torres' })).toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: 'Secciones del docente' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Editar docente' }))
    const form = screen.getByRole('form', { name: 'Editar docente' })
    await user.clear(within(form).getByLabelText(/^Nombre completo/))
    await user.type(within(form).getByLabelText(/^Nombre completo/), 'Ana María Torres')
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(tutoringApi.updateTeacher).toHaveBeenCalledWith(1, { identification: '0201234567', name: 'Ana María Torres', email: 'ana@ueb.edu.ec', phone: '0999999999' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Ana María Torres' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Desactivar docente' }))
    await user.click(within(await screen.findByRole('dialog', { name: '¿Desactivar docente?' })).getByRole('button', { name: 'Desactivar docente' }))
    await waitFor(() => expect(tutoringApi.deactivateTeacher).toHaveBeenCalledWith(1))
  })

  it('filtra docentes por estado', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.teachers).mockResolvedValue(paginated([{ id: 1, name: 'Ana Torres', identification: '0201234567', email: 'ana@ueb.edu.ec', phone: '0999999999', is_active: true, career_ids: [10], can_manage: true }]))
    renderTeachers()
    await screen.findByText('Ana Torres')
    await choose(user, screen.getByLabelText('Filtrar por Estado'), 'Inactivos')
    await waitFor(() => expect(tutoringApi.teachers).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: undefined, status: 'inactive' }))
    expect(screen.getByRole('button', { name: 'Limpiar' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Limpiar' }))
    await waitFor(() => expect(tutoringApi.teachers).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: undefined, status: undefined }))
  })

  it('si la asignatura no tiene paralelos, permite crear uno desde el formulario de la tutoría y lo deja elegido', async () => {
    const user = userEvent.setup()
    // El ciclo existe pero sin paralelo asignado.
    vi.mocked(tutoringApi.cycles).mockResolvedValue([{ ...cycle, paralelo_id: null, paralelo_name: null }])
    vi.mocked(tutoringApi.availableTeachers).mockResolvedValue([])
    vi.mocked(tutoringApi.assignSubjectParallel).mockResolvedValue({ ...subject, parallel_ids: [9] })
    vi.mocked(tutoringApi.sections).mockResolvedValue([{ id: 1, name: 'A', is_active: true }, { id: 9, name: 'B', is_active: true }])

    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)
    await screen.findByText('Matemática')
    await user.click(screen.getByRole('button', { name: 'Crear tutoría' }))
    await choose(user, screen.getByLabelText(/^Ciclo/), '2° ciclo')
    await choose(user, screen.getByLabelText(/^Asignatura/), 'Matemática')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    const form = await screen.findByRole('form', { name: 'Crear tutoría' })

    // La materia y el ciclo elegidos van en la descripción del modal, sin carrera ni período.
    expect(screen.getByText('Matemática · 2° ciclo')).toBeInTheDocument()
    expect(within(form).queryByText('Software')).not.toBeInTheDocument()
    expect(within(form).queryByText('2026-2')).not.toBeInTheDocument()

    expect(within(form).getByText('Esta asignatura aún no tiene paralelos. Crea uno para continuar.')).toBeInTheDocument()
    const createButton = within(form).getByRole('button', { name: 'Crear paralelo' })
    expect(createButton).toBeDisabled()
    await user.type(within(form).getByLabelText('Nombre del nuevo paralelo'), 'b')
    await user.click(createButton)

    await waitFor(() => expect(tutoringApi.assignSubjectParallel).toHaveBeenCalledWith(30, { new_parallel_name: 'B', cycle_id: 20 }))
    expect(await within(form).findByRole('radio', { name: 'Paralelo B' })).toBeChecked()
    expect(tutoringApi.availableTeachers).toHaveBeenCalledTimes(1)
  })

  it('crea una tutoría con un solo botón: elige ciclo y asignatura y luego asigna docente y horario', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.availableTeachers).mockResolvedValue([{ id: 70, name: 'Ana Torres', email: 'ana@ueb.edu.ec', is_active: true }])
    vi.mocked(tutoringApi.createTutoring).mockResolvedValue({ ...tutoring, teacher_id: 70, teacher_name: 'Ana Torres' })

    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)
    await screen.findByText('Matemática')

    // Ya no hay botones de crear por fila: existe uno solo, arriba
    expect(screen.queryByRole('button', { name: 'Crear tutoría para Matemática' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Crear tutoría' }))
    // Ciclo y asignatura son obligatorios (asterisco).
    expect(screen.getByLabelText(/^Ciclo/).closest('[data-slot="field"]')?.textContent).toContain('(obligatorio)')
    expect(screen.getByLabelText(/^Asignatura/).closest('[data-slot="field"]')?.textContent).toContain('(obligatorio)')
    await choose(user, screen.getByLabelText(/^Ciclo/), '2° ciclo')
    await choose(user, screen.getByLabelText(/^Asignatura/), 'Matemática')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    const form = await screen.findByRole('form', { name: 'Crear tutoría' })

    // La materia ya está seleccionada y visible en la descripción del modal
    expect(screen.getByText(/^Matemática · /)).toBeInTheDocument()

    // Asignar docente recuperado de docentes de la carrera específica (solo nombre, sin buscador ni correo)
    await waitFor(() => expect(tutoringApi.availableTeachers).toHaveBeenCalledWith('', undefined, 10))
    await waitFor(() => expect(within(form).getByLabelText(/^Docente/)).toBeEnabled())
    expect(within(form).getAllByText('(obligatorio)')).toHaveLength(3)
    // Con el docente sin elegir, el formulario queda bloqueado
    expect(within(form).getByRole('button', { name: 'Crear tutoría' })).toBeDisabled()
    await user.click(within(form).getByLabelText(/^Docente/))
    expect(await screen.findByRole('option', { name: 'Ana Torres' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /ana@ueb.edu.ec/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'Ana Torres' }))

    // Asignar horario según el día (por ejemplo lunes 14:00-16:00 y miércoles 16:00-18:00, sin aula)
    expect(within(form).queryByLabelText(/Aula/)).not.toBeInTheDocument()
    expect(within(form).getByLabelText('Lunes')).toBeChecked()
    await user.click(within(form).getByLabelText('Miércoles'))

    await choose(user, within(form).getByLabelText('Hora de inicio (Lunes)'), '14:00')
    await choose(user, within(form).getByLabelText('Hora de fin (Lunes)'), '16:00')
    await choose(user, within(form).getByLabelText('Hora de inicio (Miércoles)'), '16:00')
    await choose(user, within(form).getByLabelText('Hora de fin (Miércoles)'), '18:00')

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

    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)
    await screen.findByText('Matemática')
    await user.click(screen.getByRole('button', { name: 'Crear tutoría' }))
    await choose(user, screen.getByLabelText(/^Ciclo/), '2° ciclo')
    await choose(user, screen.getByLabelText(/^Asignatura/), 'Matemática')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    const form = await screen.findByRole('form', { name: 'Crear tutoría' })
    await waitFor(() => expect(within(form).getByLabelText(/^Docente/)).toBeEnabled())
    await choose(user, within(form).getByLabelText(/^Docente/), 'Ana Torres')

    // Lunes 08:00-10:00 se cruza con Física (09:00-11:00).
    expect(within(form).getByRole('alert')).toHaveTextContent('Física (Lunes de 09:00 a 11:00)')
    expect(within(form).getByRole('button', { name: 'Crear tutoría' })).toBeDisabled()

    // Una franja contigua sí se permite.
    await choose(user, within(form).getByLabelText('Hora de inicio'), '11:00')
    await choose(user, within(form).getByLabelText('Hora de fin'), '12:00')
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

    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)

    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' })))
    expect(await screen.findByText(/Aún no hay tutorías/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crear tutoría' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Crear tutoría' }))
    await choose(user, screen.getByLabelText(/^Ciclo/), '2° ciclo')
    await user.click(screen.getByLabelText(/^Asignatura/))
    expect(await screen.findByRole('option', { name: 'Matemática' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Álgebra Lineal' })).not.toBeInTheDocument()
  })

  it('muestra los paralelos de cada tutoría como texto en la tabla', async () => {
    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)
    const row = (await screen.findByText('Matemática')).closest('tr') as HTMLElement
    expect(within(row).getByText('A')).toBeInTheDocument()
    expect(within(row).queryByTitle('Paralelo A')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ver paralelos de/i })).not.toBeInTheDocument()
  })

  it('muestra en cada fila solo el paralelo de esa tutoría', async () => {
    vi.mocked(tutoringApi.cycles).mockResolvedValue([cycle, { ...cycle, id: 22, paralelo_id: 2, paralelo_name: 'B' }])
    vi.mocked(tutoringApi.subjects).mockResolvedValue(paginated([{ ...subject, cycle_ids: [20, 22] }]))
    vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([tutoring, { ...tutoring, id: 41, cycle_id: 22, section_id: 2, section_name: 'B' }]))
    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)
    await screen.findAllByText('Matemática')
    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenCalled())
    const rows = screen.getAllByTitle('Abrir la tutoría de Matemática')
    expect(rows.map((row) => within(row).getAllByRole('cell')[2].textContent)).toEqual(['A', 'B'])
  })

  it('abre la tutoría en la URL: «Atrás» vuelve a la lista y, si no existe, lo dice con un camino de vuelta', async () => {
    const user = userEvent.setup()
    const view = render(<MemoryRouter initialEntries={['/?tutoria=40']}><TutoringsPage /></MemoryRouter>)
    expect(await screen.findByRole('heading', { level: 1, name: 'Matemática' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver a tutorías' }))
    expect(await screen.findByTitle('Abrir la tutoría de Matemática')).toBeInTheDocument()
    view.unmount()

    render(<MemoryRouter initialEntries={['/?tutoria=999']}><TutoringsPage /></MemoryRouter>)
    expect(await screen.findByText('No encontramos esta tutoría en la carrera.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver a tutorías' }))
    expect(await screen.findByTitle('Abrir la tutoría de Matemática')).toBeInTheDocument()
  })

  it('al editar avisa del cruce con otra asignatura del docente, como al crear; la misma asignatura a la misma hora es clase conjunta', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([{ ...tutoring, teacher_id: 70, teacher_name: 'Ana Torres', schedules: [{ id: 101, tutoring_id: 40, day: 'lunes', start_time: '08:00', end_time: '10:00', room: 'Aula 1', is_active: true }] }]))
    vi.mocked(tutoringApi.schedules).mockResolvedValue([{ id: 101, tutoring_id: 40, day: 'lunes', start_time: '08:00', end_time: '10:00', room: 'Aula 1', is_active: true }])
    vi.mocked(tutoringApi.availableTeachers).mockResolvedValue([
      { id: 70, name: 'Ana Torres', email: 'ana@ueb.edu.ec', is_active: true },
      { id: 71, name: 'Carlos Mendoza', email: 'carlos@ueb.edu.ec', is_active: true, busy_schedules: [{ tutoring_id: 98, tutoring_name: 'Matemática', day: 'lunes', start_time: '08:00', end_time: '10:00' }] },
      { id: 72, name: 'Luis Paz', email: 'luis@ueb.edu.ec', is_active: true, busy_schedules: [{ tutoring_id: 99, tutoring_name: 'Física', day: 'lunes', start_time: '09:00', end_time: '11:00' }] },
    ])
    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)
    await openTutoringEdit(user)
    const form = await screen.findByRole('form', { name: 'Editar tutoría' })
    await waitFor(() => expect(tutoringApi.availableTeachers).toHaveBeenCalledWith('', undefined, 10))
    await choose(user, within(form).getByLabelText(/^Docente/), 'Luis Paz')
    expect(within(form).getByRole('alert')).toHaveTextContent('Física (Lunes de 09:00 a 11:00)')
    expect(within(form).getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    await choose(user, within(form).getByLabelText(/^Docente/), 'Carlos Mendoza')
    expect(within(form).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
  })

  it('crear tutoría: «Siguiente» y «Atrás» entre fases, sin descripción redundante, toast en participio y error del servidor bajo el docente', async () => {
    const user = userEvent.setup()
    const success = vi.spyOn(toast, 'success')
    vi.mocked(tutoringApi.availableTeachers).mockResolvedValue([{ id: 70, name: 'Ana Torres', email: 'ana@ueb.edu.ec', is_active: true }])
    vi.mocked(tutoringApi.createTutoring)
      .mockRejectedValueOnce(new ApiError(422, { message: 'El docente ya tiene asignado un horario.', errors: { teacher_id: ['El docente ya tiene asignado un horario.'] } }))
      .mockResolvedValueOnce(tutoring)
    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)
    await screen.findByText('Matemática')
    await user.click(screen.getByRole('button', { name: 'Crear tutoría' }))
    expect(screen.queryByText('Elige el ciclo y la asignatura de la tutoría.')).not.toBeInTheDocument()
    await choose(user, screen.getByLabelText(/^Ciclo/), '2° ciclo')
    await choose(user, screen.getByLabelText(/^Asignatura/), 'Matemática')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    const form = await screen.findByRole('form', { name: 'Crear tutoría' })
    await user.click(within(form).getByRole('button', { name: 'Atrás' }))
    expect(within(form).getByLabelText(/^Asignatura/)).toHaveTextContent('Matemática')
    await user.click(within(form).getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(within(form).getByLabelText(/^Docente/)).toBeEnabled())
    await choose(user, within(form).getByLabelText(/^Docente/), 'Ana Torres')
    await user.click(within(form).getByRole('button', { name: 'Crear tutoría' }))
    const teacher = within(form).getByLabelText(/^Docente/)
    await waitFor(() => expect(teacher).toHaveAttribute('aria-invalid', 'true'))
    expect(teacher.closest('[data-slot="field"]')).toHaveTextContent('El docente ya tiene asignado un horario.')
    await user.click(within(form).getByRole('button', { name: 'Crear tutoría' }))
    await waitFor(() => expect(tutoringApi.createTutoring).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(success).toHaveBeenCalledWith('Tutoría creada', undefined))
  })

  it('al hacer clic en la fila abre la pantalla de la tutoría con su horario en Resumen y sin columna de acciones', async () => {
    const user = userEvent.setup()
    const scheduled = {
      ...tutoring,
      schedules: [
        { id: 101, tutoring_id: 40, day: 'lunes', start_time: '08:00:00', end_time: '10:00:00', room: 'Aula 101', is_active: true },
      ],
    }
    vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([scheduled]))

    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)
    await screen.findByText('Matemática')

    // Sin botones sueltos por fila: la fila entera abre la tutoría
    expect(screen.queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver horario de Matemática' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Supervisar Matemática' })).not.toBeInTheDocument()
    await user.click(screen.getByTitle('Abrir la tutoría de Matemática'))

    expect(await screen.findByRole('button', { name: 'Volver a tutorías' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Resumen' })).toHaveAttribute('aria-selected', 'true')
    const schedules = screen.getByRole('list', { name: 'Lista de horarios' })
    expect(within(schedules).getByText('Lunes')).toBeInTheDocument()
    expect(within(schedules).getByText(/08:00 – 10:00/)).toBeInTheDocument()
    expect(within(schedules).getByText(/Aula 101/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Volver a tutorías' }))
    expect(await screen.findByTitle('Abrir la tutoría de Matemática')).toBeInTheDocument()
  })

  it('desde la pantalla de la tutoría se edita en un modal: una tutoría creada no se desactiva', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)
    await screen.findByText('Matemática')
    expect(screen.queryByRole('button', { name: 'Más acciones para Matemática' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Editar Matemática/ })).not.toBeInTheDocument()
    await openTutoringEdit(user)
    const form = await screen.findByRole('form', { name: 'Editar tutoría' })
    expect(within(form).getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Desactivar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Activar tutoría' })).not.toBeInTheDocument()
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

    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)
    await screen.findByText('Matemática')
    await openTutoringEdit(user)

    const form = await screen.findByRole('form', { name: 'Editar tutoría' })

    // Contiene la misma información de la creación: materia, docente, horario y paralelos
    expect(screen.getByText(/^Matemática · /)).toBeInTheDocument()
    expect(within(form).getByLabelText(/^Docente/)).toHaveTextContent('Ana Torres')
    expect(within(form).getByLabelText('Lunes')).toBeChecked()
    expect(within(form).getByLabelText('Hora de inicio')).toHaveTextContent('08:00')
    expect(within(form).getByLabelText('Hora de fin')).toHaveTextContent('10:00')
    expect(within(form).getByLabelText(/Paralelo A/)).toBeChecked()

    // Cambiar docente y guardar cambios
    await choose(user, within(form).getByLabelText(/^Docente/), 'Carlos Mendoza')
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(tutoringApi.configureTutoring).toHaveBeenCalledWith(40, {
      teacher_id: 71,
      schedules: [{ day: 'lunes', start_time: '08:00', end_time: '10:00', room: 'Aula 1' }],
    }))
    expect(tutoringApi.assignTeacher).not.toHaveBeenCalled()
  })

  it('filtra tutorías por ciclo y estado, y abre la tutoría al pulsar su fila', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)
    await screen.findByText('Matemática')
    expect(tutoringApi.tutorings).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: career.id, cycle_number: undefined, status: undefined })
    expect(screen.queryByLabelText('Carrera')).not.toBeInTheDocument()
    await choose(user, screen.getByLabelText('Filtrar por Ciclo'), '2° ciclo')
    await waitFor(() => expect(tutoringApi.tutorings).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: career.id, cycle_number: 2, status: undefined }))
    await choose(user, screen.getByLabelText('Filtrar por Estado'), 'Inactivas')
    await waitFor(() => expect(tutoringApi.tutorings).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: career.id, cycle_number: 2, status: 'inactive' }))
    await user.click(screen.getByRole('button', { name: 'Limpiar' }))
    await waitFor(() => expect(tutoringApi.tutorings).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: career.id, cycle_number: undefined, status: undefined }))

    await user.click(screen.getByTitle('Abrir la tutoría de Matemática'))
    expect(await screen.findByRole('button', { name: 'Volver a tutorías' })).toBeInTheDocument()
    expect(screen.getByText('Docente')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Supervisión' }))
    expect(screen.getByText('Supervisión de asistencias')).toBeInTheDocument()
    expect(screen.queryByText('Horarios de la tutoría')).not.toBeInTheDocument()
    expect(screen.queryByText('Informes de tutoría')).not.toBeInTheDocument()
  })

  it('reactiva una tutoría inactiva desde el modal de edición', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([{ ...tutoring, is_active: false }]))
    vi.mocked(tutoringApi.activateTutoring).mockResolvedValue(tutoring)
    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)
    await openTutoringEdit(user)
    const form = await screen.findByRole('form', { name: 'Editar tutoría' })
    expect(within(form).getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Activar tutoría' }))
    await waitFor(() => expect(tutoringApi.activateTutoring).toHaveBeenCalledWith(40))
    expect(screen.queryByRole('button', { name: 'Asignar docente a Matemática' })).not.toBeInTheDocument()
  })

  it('no muestra los botones de asignar docente ni asignar horario una vez creada la tutoría', async () => {
    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)
    await screen.findByText('Matemática')

    // No debe haber botones individuales de "Asignar docente" ni "Asignar horario"
    expect(screen.queryByRole('button', { name: 'Asignar docente a Matemática' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Asignar horario a Matemática' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cambiar docente' })).not.toBeInTheDocument()
  })

  it('muestra una sola tabla con el ciclo de cada tutoría y el contador, sin acordeones por ciclo', async () => {
    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)
    await screen.findByText('Matemática')
    expect(screen.getByRole('heading', { level: 1, name: 'Tutorías' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3, name: 'Segundo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Expandir todos/ })).not.toBeInTheDocument()
    expect(screen.getByText('2°')).toBeInTheDocument()
    expect(screen.getByText('Mostrando 1 de 1 tutoría')).toBeInTheDocument()
  })

  it('describe Tutorías en una línea y usa «1° ciclo» en el filtro de ciclo', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)
    await screen.findByText('Matemática')
    expect(screen.getByText(/tutorías de Software/)).toBeInTheDocument()
    await user.click(screen.getByLabelText('Filtrar por Ciclo'))
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['Todos los ciclos', '2° ciclo', '3° ciclo'])
  })

  it('mientras cargan los catálogos muestra el mismo esqueleto de la pantalla, sin el contador', async () => {
    let resolveCareers: (value: typeof career[]) => void = () => undefined
    vi.mocked(tutoringApi.careers).mockReturnValue(new Promise((resolve) => { resolveCareers = resolve }))
    let resolveList: (value: ReturnType<typeof paginated<Tutoring>>) => void = () => undefined
    vi.mocked(tutoringApi.tutorings).mockReturnValue(new Promise((resolve) => { resolveList = resolve }))
    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)
    const first = screen.getByRole('status', { name: 'Cargando tutorías' })
    const headers = () => screen.getAllByRole('columnheader').map((header) => header.textContent)
    const before = headers()
    expect(first.parentElement?.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(5)
    await act(async () => resolveCareers([career]))
    expect(screen.getByRole('status', { name: 'Cargando tutorías' })).toBeInTheDocument()
    expect(headers()).toEqual(before)
    expect(screen.queryByText(/^Mostrando/)).not.toBeInTheDocument()
    await act(async () => resolveList(paginated([tutoring])))
    expect(await screen.findByText('Mostrando 1 de 1 tutoría')).toBeInTheDocument()
  })

  it('con varias carreras de tutorías pide elegir la carrera antes de ver las tutorías', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.careers).mockResolvedValue([career, { ...career, id: 11, name: 'Comunicación' }])
    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)
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

    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)
    await screen.findByText('Matemática')
    await openTutoringEdit(user)

    const form = await screen.findByRole('form', { name: 'Editar tutoría' })
    // Agregar Miércoles
    await user.click(within(form).getByLabelText('Miércoles'))
    await choose(user, within(form).getByLabelText('Hora de inicio (Miércoles)'), '14:00')
    await choose(user, within(form).getByLabelText('Hora de fin (Miércoles)'), '16:00')

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

  it('al pulsar la fila abre la pantalla de la asignatura (en la URL), sin columna de acciones, y edita en un modal con el nombre primero', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.updateSubject).mockResolvedValue({ ...subject, name: 'MATEMATICA I' })
    await openSubjects()
    await screen.findByText('Matemática')
    expect(screen.queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument()

    await user.click(screen.getByTitle('Abrir Matemática'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Matemática' })).toBeInTheDocument()
    expect(screen.getByText('MAT · 2° ciclo')).toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: 'Secciones de la asignatura' })).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Editar asignatura' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Editar asignatura' }))
    const form = screen.getByRole('form', { name: 'Editar asignatura' })
    const labels = [...form.querySelectorAll('label')].map((label) => label.textContent ?? '')
    expect(labels[0]).toMatch(/^Nombre/)
    const nameLabel = labels[0]
    expect(nameLabel).toContain('(obligatorio)')
    await user.clear(within(form).getByLabelText(/^Nombre/))
    await user.type(within(form).getByLabelText(/^Nombre/), 'Matemática I')
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(tutoringApi.updateSubject).toHaveBeenCalledWith(30, { code: 'MAT', name: 'MATEMÁTICA I', next_subject_ids: [] }))
    expect(await screen.findByRole('heading', { level: 1, name: 'MATEMATICA I' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Volver a asignaturas' }))
    expect(await screen.findByRole('button', { name: 'Registrar asignatura' })).toBeInTheDocument()
  })

  it('pide confirmación antes de desactivar una asignatura', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.deactivateSubject).mockResolvedValue({ ...subject, is_active: false })
    await openSubjects()
    await user.click(await screen.findByText('Matemática'))
    await user.click(await screen.findByRole('button', { name: 'Desactivar asignatura' }))
    const confirm = await screen.findByRole('dialog', { name: '¿Desactivar asignatura?' })
    expect(tutoringApi.deactivateSubject).not.toHaveBeenCalled()
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar' }))
    expect(tutoringApi.deactivateSubject).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Desactivar asignatura' }))
    await user.click(within(await screen.findByRole('dialog', { name: '¿Desactivar asignatura?' })).getByRole('button', { name: 'Desactivar asignatura' }))
    await waitFor(() => expect(tutoringApi.deactivateSubject).toHaveBeenCalledWith(30))
  })

  it('la supervisión separa la asistencia por sesión y abre la lista de cada una', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.sessions).mockResolvedValue(paginated([
      { id: 2, number: 2, date: '2026-05-11', topics_covered: true, topics: [{ id: 1, name: 'Derivadas' }, { id: 2, name: 'Integrales' }, { id: 3, name: 'Límites' }], present_count: 1, absent_count: 1, attendance: [
        { id: 21, student_id: 7, student_name: 'Ana Pérez', student_identification: '0201112233', present: true },
        { id: 22, student_id: 8, student_name: 'Luis Mora', student_identification: '0201112244', present: false },
      ] },
      { id: 1, number: 1, date: '2026-05-04', topics_covered: false, topics: [], present_count: 2, absent_count: 0, attendance: [] },
    ]))
    render(<TutoringDetail tutoring={tutoring} onBack={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'Supervisión' }))

    expect(await screen.findByText('Sesión 2')).toBeInTheDocument()
    expect(screen.getByText('Sesión 1')).toBeInTheDocument()
    expect(screen.getByText('1 de 2 presentes')).toBeInTheDocument()
    expect(screen.getByText('Derivadas +2 más')).toBeInTheDocument()
    expect(screen.getByText('Sin temas vistos')).toBeInTheDocument()
    expect(tutoringApi.sessions).toHaveBeenCalledWith(40, 1)

    await user.click(screen.getByTitle(/Abrir la sesión 2/))
    const detail = screen.getByRole('region', { name: 'Sesión 2' })
    expect(within(detail).getByText('Luis Mora')).toBeInTheDocument()
    expect(within(detail).getByText('Ausente')).toBeInTheDocument()
    expect(within(detail).getByText(/1 presentes · 1 ausentes · Derivadas, Integrales, Límites/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver a las sesiones' }))
    expect(screen.getByText('Sesión 1')).toBeInTheDocument()
  })

  it('al supervisar una tutoría no muestra la sección de horarios, informes ni el botón de cambiar docente', async () => {
    const user = userEvent.setup()
    render(<TutoringDetail tutoring={tutoring} onBack={vi.fn()} />)
    expect(screen.getByText('Docente')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Supervisión' }))
    expect(screen.getByText('Supervisión de asistencias')).toBeInTheDocument()
    expect(screen.queryByText('Horarios de la tutoría')).not.toBeInTheDocument()
    expect(screen.queryByText('Informes de tutoría')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar horario' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cambiar docente' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Asignar docente' })).not.toBeInTheDocument()
  })

  it('en el panel de estudiantes de la tutoría la fila abre el modal con deshabilitar como icono y guarda solo con cambios', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.students).mockResolvedValue(paginated([
      { id: 5, tutoring_id: 40, student_id: 9, identification: '0201234567', name: 'Luis Pérez', email: 'luis@ueb.edu.ec', phone: null, is_active: true, student_is_active: true, can_edit_profile: true, enrolled_at: '2026-09-01' },
    ]))
    vi.mocked(tutoringApi.updateStudent).mockResolvedValue({} as never)
    render(<TutoringDetail tutoring={tutoring} onBack={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'Estudiantes' }))
    await screen.findByText('Luis Pérez')
    expect(screen.queryByRole('button', { name: /Editar datos de Luis Pérez/ })).not.toBeInTheDocument()

    await user.click(screen.getByTitle('Ver o editar a Luis Pérez'))
    const form = await screen.findByRole('form', { name: 'Editar estudiante' })
    expect(within(form).getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Deshabilitar inscripción' })).toBeInTheDocument()

    await user.type(within(form).getByLabelText(/^Teléfono/), '0991234567')
    expect(within(form).getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(tutoringApi.updateStudent).toHaveBeenCalledWith(40, 5, { name: 'Luis Pérez', phone: '0991234567' }))
  })

  it('en el panel de estudiantes de la tutoría elige con una opción si el estudiante ya está registrado o es nuevo', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.students).mockResolvedValue(paginated([]))
    vi.mocked(tutoringApi.availableStudents).mockResolvedValue({ data: [] } as never)
    render(<TutoringDetail tutoring={tutoring} onBack={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'Estudiantes' }))
    await user.click(await screen.findByRole('button', { name: 'Registrar estudiante' }))
    const form = await screen.findByRole('form', { name: 'Registrar estudiante' })
    expect(within(form).queryByRole('tab')).not.toBeInTheDocument()
    expect(within(form).getByRole('radio', { name: 'Ya registrado' })).toBeChecked()
    expect(within(form).queryByLabelText(/Cédula o pasaporte/)).not.toBeInTheDocument()
    await user.click(within(form).getByRole('radio', { name: 'Estudiante nuevo' }))
    expect(within(form).getByLabelText(/Cédula o pasaporte/)).toBeInTheDocument()
    // El nombre va primero y los datos obligatorios llevan asterisco.
    const labels = [...form.querySelectorAll('label[for]')].map((label) => label.textContent ?? '')
    expect(labels[0]).toMatch(/^Nombre completo/)
    expect(labels.filter((label) => label.includes('(obligatorio)'))).toHaveLength(3)
    expect(within(form).getByRole('button', { name: 'Crear e inscribir' })).toBeInTheDocument()
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
    expect(await screen.findByRole('heading', { level: 1, name: 'Informes' })).toBeInTheDocument()
    expect(screen.queryByText('Asistencias registradas')).not.toBeInTheDocument()
    expect(await screen.findByText('Mostrando 2 de 2 informes')).toBeInTheDocument()
    expect(tutoringApi.allReports).toHaveBeenLastCalledWith({ page: 1, search: '', career_id: career.id, cycle_number: undefined })

    expect(screen.getAllByText('Matemática')).toHaveLength(2)
    expect(screen.getByText('Avance')).toBeInTheDocument()
    expect(screen.getByText('Sin contenido adjunto')).toBeInTheDocument()

    // La fila abre el informe: sin columna de acciones ni botón duplicado.
    expect(screen.queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Leer informe' })).not.toBeInTheDocument()
    await user.click(screen.getByTitle('Leer informe Avance'))

    const reader = screen.getByRole('article', { name: 'Contenido del informe' })
    expect(within(reader).getByText('Se reforzaron conceptos de álgebra y límites.')).toBeVisible()
    expect(within(reader).getByText('Ana Torres')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Cerrar informe' }))
    expect(screen.queryByRole('article', { name: 'Contenido del informe' })).not.toBeInTheDocument()
  })

  it('en informes muestra el formato oficial que envió el docente', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.allReports).mockResolvedValue(paginated([{
      id: 3, tutoring_id: 40, subject_name: 'Matemática', career_name: 'Software', cycle_name: 'Segundo', section_name: 'A',
      type: 'Reporte de la evaluación diagnóstica', author_id: 2, author_name: 'Ana Torres', generated_at: '2026-09-27T12:00:00Z', content: 'REPORTE EN TEXTO',
      summary: {
        format: 'diagnostic_evaluation', faculty: 'Ciencias Administrativas', career: 'Software', date: '2026-09-27', teacher: 'Ana Torres',
        subject: 'Matemática', cycle: 2, cycle_name: 'Segundo', academic_period: '2026-2', section: 'A', students_listed: 1, students_evaluated: 1, observations: null, coordinator: null,
        groups: [{ key: 'high', label: 'Alto', range_label: '70% - 100%', count: 1, percentage: 100, action_plan: ['Semana de adaptación de Conocimientos'] }],
        grades: [{ number: 1, identification: '0200000001', name: 'Estudiante Uno', grade: 9, group: 'Alto' }],
      },
    }]))

    render(<TutoringReportsPage />)
    await user.click(await screen.findByTitle('Leer informe Reporte de la evaluación diagnóstica'))

    const reader = screen.getByRole('article', { name: 'Contenido del informe' })
    expect(within(reader).queryByText('REPORTE EN TEXTO')).not.toBeInTheDocument()
    expect(within(reader).getAllByText('Estudiante Uno').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Imprimir o guardar PDF' })).toBeInTheDocument()
  })

  it('permite al coordinador listar estudiantes y abrir el formulario de registro', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.cycles).mockResolvedValue([cycle, { ...cycle, id: 21, name: 'Sexto', number: 6 }])
    vi.mocked(tutoringApi.allStudents).mockResolvedValue(paginated([
      {
        id: 101,
        identification: '0201999999',
        name: 'Carlos Estudiante',
        email: 'carlos@ueb.edu.ec',
        phone: '0981112233',
        is_active: true,
        pending_subjects: [{ id: 6, code: 'TI-B2-006', name: 'PROGRAMACIÓN I' }],
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

    render(<MemoryRouter><TutoringStudentsPage /></MemoryRouter>)

    expect(await screen.findByRole('heading', { level: 1, name: 'Estudiantes' })).toBeInTheDocument()
    // Una sola descripción fija: no cambia con el ciclo elegido.
    const description = screen.getByText(/Registra a los estudiantes de Software/)
    // Un desplegable con cada ciclo; el último es titulación. Se abre el primero y la lista se pide por ciclo.
    expect(await screen.findByRole('combobox', { name: 'Ciclo' })).toHaveTextContent('2° ciclo')
    expect(await readCycleOptions(userEvent.setup())).toEqual(['2° ciclo', '6° ciclo · Titulación', 'Sin ciclo'])
    await waitFor(() => expect(tutoringApi.allStudents).toHaveBeenCalledWith(expect.objectContaining({ career_id: 10, cycle_number: 2, without_cycle: false })))
    expect(await screen.findByText('Carlos Estudiante')).toBeInTheDocument()
    await chooseCycle(userEvent.setup(), 'Sin ciclo')
    expect(screen.getByText(/Registra a los estudiantes de Software/)).toBe(description)
    await chooseCycle(userEvent.setup(), '2° ciclo')
    expect(await screen.findByText('Carlos Estudiante')).toBeInTheDocument()
    expect(screen.getByText('0201999999')).toBeInTheDocument()
    expect(screen.getByText('carlos@ueb.edu.ec')).toBeInTheDocument()
    expect(screen.getByText('Mostrando 1 de 1 estudiante')).toBeInTheDocument()
    // Numeración de filas, cantidad de tutorías y estado en texto plano; sin columna de acciones: la fila abre al estudiante.
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['#', 'Estudiante', 'Cédula / Teléfono', 'Tutorías', 'Estado'])
    const row = screen.getByText('Carlos Estudiante').closest('tr')!
    expect(within(row).getAllByRole('cell')[0]).toHaveTextContent('1')
    expect(within(row).queryByRole('button')).not.toBeInTheDocument()
    expect(within(row).getByText('1 tutoría')).toBeInTheDocument()
    // El estado siempre va en badge (solo los estados llevan badge).
    expect(within(row).getByText('Activo').closest('[data-slot="badge"]')).not.toBeNull()
    expect(within(row).getByText('Arrastra: PROGRAMACIÓN I')).toBeInTheDocument()

    // La fila abre la pantalla del estudiante con sus tutorías y sus datos en pestañas.
    vi.mocked(tutoringApi.availableTutoringsForStudent).mockResolvedValue({ data: [] } as never)
    await user.click(screen.getByTitle('Abrir a Carlos Estudiante'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Carlos Estudiante' })).toBeInTheDocument()
    expect(screen.queryByText('Mostrando 1 de 1 estudiante')).not.toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: 'Secciones del estudiante' })).toBeInTheDocument()
    // Sin ciclo registrado, la acción de arriba es asignárselo.
    expect(screen.getByRole('button', { name: 'Asignar ciclo' })).toBeInTheDocument()
    expect(await screen.findByText('No hay más tutorías disponibles para inscribir a este estudiante.')).toBeInTheDocument()
    const enrolled = screen.getByText('Matemática').closest('tr')!
    expect(within(enrolled).getByRole('button', { name: 'Acciones para Matemática' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Datos' }))
    expect(screen.getByText('0981112233')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver a estudiantes' }))
    expect(await screen.findByText('Mostrando 1 de 1 estudiante')).toBeInTheDocument()

    expect(screen.queryByRole('button', { name: 'Nuevo estudiante' })).not.toBeInTheDocument()
    const newBtn = screen.getByRole('button', { name: 'Registrar estudiante' })
    await user.click(newBtn)

    // Por pasos: primero sus datos (el nombre arriba; obligatorios con asterisco), después ciclo y tutoría.
    const form = screen.getByRole('form', { name: 'Registrar estudiante' })
    const labels = [...form.querySelectorAll('label')].map((label) => label.textContent ?? '')
    expect(labels[0]).toMatch(/^Nombres y apellidos/)
    expect(labels.filter((label) => label.includes('(obligatorio)'))).toHaveLength(3)
    expect(within(form).queryByLabelText(/^Ciclo/)).not.toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    await user.type(within(form).getByLabelText(/Nombres y Apellidos/i), 'Ana Nueva')
    await user.type(within(form).getByLabelText(/Cédula o pasaporte/i), '0926687856')
    await user.type(within(form).getByLabelText(/Correo Institucional/i), 'ana@ueb.edu.ec')
    expect(within(form).getByLabelText(/Teléfono/i)).toBeInTheDocument()
    await user.click(within(form).getByRole('button', { name: 'Siguiente' }))

    // El ciclo de la pestaña queda elegido y solo se ofrecen sus tutorías, sin ayudas que repiten lo evidente.
    expect(within(form).queryByText(/es de titulación; los anteriores/)).not.toBeInTheDocument()
    expect(within(form).queryByText(/Selecciona primero un ciclo/)).not.toBeInTheDocument()
    const cycleSelect = within(form).getByLabelText(/Ciclo/i)
    expect(cycleSelect).toHaveTextContent('2° ciclo · Paralelo A')
    await user.click(cycleSelect)
    const cycleOptions = await screen.findAllByRole('option')
    expect(cycleOptions).toHaveLength(1)
    await user.click(cycleOptions[0])
    const tutoringSelect = within(form).getByLabelText(/Tutoría/i)
    await waitFor(() => expect(tutoringSelect).toBeEnabled())
    await user.click(tutoringSelect)
    expect(await screen.findByRole('option', { name: /Matemática/i })).toBeInTheDocument()
  })

  it('marca como titulación solo el último ciclo de la carrera, no uno fijo como el 6.º', async () => {
    // Carrera con ciclos hasta el 8.º: el 6.º y 7.º ya no son titulación, solo el 8.º.
    vi.mocked(tutoringApi.cycles).mockResolvedValue([
      cycle,
      { ...cycle, id: 21, name: 'Sexto', number: 6 },
      { ...cycle, id: 22, name: 'Octavo', number: 8 },
    ])
    vi.mocked(tutoringApi.allStudents).mockResolvedValue(paginated([]))
    vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([tutoring]))

    render(<MemoryRouter><TutoringStudentsPage /></MemoryRouter>)

    expect(await screen.findByRole('combobox', { name: 'Ciclo' })).toHaveTextContent('2° ciclo')
    expect(await readCycleOptions(userEvent.setup())).toEqual(['2° ciclo', '6° ciclo', '8° ciclo · Titulación', 'Sin ciclo'])
  })

  it('exige el ciclo al registrar un estudiante y no ofrece tutorías en el ciclo de titulación', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.cycles).mockResolvedValue([cycle, { ...cycle, id: 21, name: 'Sexto', number: 6 }])
    vi.mocked(tutoringApi.allStudents).mockResolvedValue(paginated([]))
    vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([tutoring]))
    vi.mocked(tutoringApi.createCoordinatorStudent).mockResolvedValue({ data: { id: 1, identification: '0926687856', name: 'Ana Nueva', email: 'ana@ueb.edu.ec', is_active: true, tutoring_count: 0, tutorings: [] } })

    render(<MemoryRouter><TutoringStudentsPage /></MemoryRouter>)
    // En «Sin ciclo» hay que elegir el ciclo.
    await chooseCycle(user, 'Sin ciclo')
    await user.click(await screen.findByRole('button', { name: 'Registrar estudiante' }))
    const form = screen.getByRole('form', { name: 'Registrar estudiante' })
    await user.type(within(form).getByLabelText(/Cédula o pasaporte/i), '0926687856')
    await user.type(within(form).getByLabelText(/Nombres y Apellidos/i), 'Ana Nueva')
    await user.type(within(form).getByLabelText(/Correo Institucional/i), 'ana@ueb.edu.ec')
    await user.click(within(form).getByRole('button', { name: 'Siguiente' }))

    // Sin ciclo no se puede registrar.
    const submit = within(form).getByRole('button', { name: 'Registrar estudiante' })
    expect(submit).toBeDisabled()

    // El 6.º es el último ciclo de esta carrera de prueba, así que es titulación: sin tutorías.
    await user.click(within(form).getByLabelText(/Ciclo/i))
    expect(await screen.findByRole('option', { name: /6° ciclo · Paralelo A · Titulación/ })).toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: /6° ciclo · Paralelo A · Titulación/ }))
    expect(within(form).getByLabelText(/Tutoría/i)).toBeDisabled()

    await user.click(submit)
    await waitFor(() => expect(tutoringApi.createCoordinatorStudent).toHaveBeenCalledWith({
      identification: '0926687856', name: 'Ana Nueva', email: 'ana@ueb.edu.ec', phone: null, cycle_id: 21, tutoring_id: undefined, career_id: 10,
    }))
  })

  it('no permite matricular en titulación a un estudiante de un ciclo anterior al último', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.cycles).mockResolvedValue([cycle, { ...cycle, id: 21, name: 'Sexto', number: 6 }])
    const student = {
      id: 102, student_id: 102, identification: '0201777777', name: 'Pedro Quinto', email: 'pedro@ueb.edu.ec', phone: null,
      cycle_number: 5, academic_stage: 'tutorias' as const,
      is_degree_enrolled: false, degree_enrollment_id: null, enrolled_at: null, period_id: 50, period_name: '2026-2',
    }
    vi.mocked(tutoringApi.allStudents).mockResolvedValue(paginated([]))
    vi.mocked(tutoringApi.degreeStudents).mockResolvedValue({ data: [student], meta: { ...paginated([student]).meta, current_period: { id: 50, name: '2026-2' } } })

    render(<MemoryRouter><TutoringStudentsPage /></MemoryRouter>)
    await chooseCycle(user, /Titulación/i)

    expect(await screen.findByText('5° ciclo')).toBeInTheDocument()
    await user.click(screen.getByTitle('Abrir a Pedro Quinto'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Pedro Quinto' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Matricular en titulación' })).toBeDisabled()
  })

  it('registra al estudiante en el ciclo de la pestaña y permite cambiarlo de ciclo', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.cycles).mockResolvedValue([cycle, { ...cycle, id: 21, name: 'Sexto', number: 6 }])
    const student = { id: 103, identification: '0201888888', name: 'Lucía Ciclo', email: 'lucia@ueb.edu.ec', phone: null, is_active: true, cycle_id: 20, cycle_number: 2, section_name: 'A', tutoring_count: 0, tutorings: [] }
    vi.mocked(tutoringApi.allStudents).mockResolvedValue(paginated([student]))
    vi.mocked(tutoringApi.degreeStudents).mockResolvedValue({ data: [], meta: { ...paginated([]).meta, current_period: { id: 50, name: '2026-2' } } })
    vi.mocked(tutoringApi.updateStudentCycle).mockResolvedValue({ data: { ...student, cycle_id: 21, cycle_number: 6 } })

    render(<MemoryRouter><TutoringStudentsPage /></MemoryRouter>)
    vi.mocked(tutoringApi.availableTutoringsForStudent).mockResolvedValue({ data: [] } as never)
    await user.click(await screen.findByTitle('Abrir a Lucía Ciclo'))
    await user.click(await screen.findByRole('button', { name: 'Cambiar ciclo' }))
    const form = screen.getByRole('form', { name: 'Cambiar ciclo' })
    expect(within(form).getByLabelText(/Ciclo que cursa/i)).toHaveTextContent('2° ciclo')
    await choose(user, within(form).getByLabelText(/Ciclo que cursa/i), /6° ciclo/)
    await user.click(within(form).getByRole('button', { name: 'Guardar ciclo' }))

    await waitFor(() => expect(tutoringApi.updateStudentCycle).toHaveBeenCalledWith(103, 21))
    expect(tutoringApi.updateStudentCycle).toHaveBeenCalledTimes(1)
  })

  it('permite al coordinador de carrera cambiar a la pestaña de titulación y matricular a un estudiante', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.cycles).mockResolvedValue([cycle, { ...cycle, id: 21, name: 'Sexto', number: 6 }])
    const degreeStudent = {
      id: 101,
      student_id: 101,
      identification: '0201888888',
      name: 'María Estudiante',
      email: 'maria@ueb.edu.ec',
      phone: '0991234567',
      is_active: true,
      cycle_id: 21,
      cycle_number: 6,
      academic_stage: 'titulacion' as const,
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

    render(<MemoryRouter><TutoringStudentsPage /></MemoryRouter>)

    // Elegir el ciclo de titulación
    await chooseCycle(user, /Titulación/i)

    expect(await screen.findByText('María Estudiante')).toBeInTheDocument()
    // Sin encabezado extra ni columna de acciones: la fila abre al estudiante.
    expect(screen.queryByRole('heading', { level: 2, name: 'Matrícula en Titulación' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Acciones para María Estudiante' })).not.toBeInTheDocument()
    expect(screen.getByText('0201888888')).toBeInTheDocument()
    expect(screen.getByText('No matriculado')).toBeInTheDocument()
    expect(screen.queryByText(/Período actual/)).not.toBeInTheDocument()

    await user.click(screen.getByTitle('Abrir a María Estudiante'))
    expect(await screen.findByRole('heading', { level: 1, name: 'María Estudiante' })).toBeInTheDocument()
    // Cambiar ciclo como ícono con tooltip; la matrícula, como acción con texto.
    expect(screen.getByRole('button', { name: 'Cambiar ciclo' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Matricular en titulación' }))

    // Confirm modal opens
    const confirmTitle = await screen.findByRole('heading', { level: 2, name: /¿Matricular a María Estudiante en titulación\?/i })
    const confirmBtn = within(confirmTitle.closest('[role="dialog"], [role="alertdialog"]') as HTMLElement).getByRole('button', { name: 'Matricular en titulación' })
    await user.click(confirmBtn)

    await waitFor(() => expect(tutoringApi.enrollDegreeStudent).toHaveBeenCalledWith(101))
  })

  it('abre al estudiante en la URL: «Atrás» vuelve a la lista y, si no existe, lo dice con un camino de vuelta', async () => {
    const user = userEvent.setup()
    const student = { id: 103, identification: '0201888888', name: 'Lucía Ciclo', email: 'lucia@ueb.edu.ec', phone: null, is_active: true, cycle_id: 20, cycle_number: 2, section_name: 'A', tutoring_count: 0, tutorings: [] }
    vi.mocked(tutoringApi.allStudents).mockResolvedValue(paginated([student]))
    vi.mocked(tutoringApi.availableTutoringsForStudent).mockResolvedValue({ data: [] } as never)
    const view = render(<MemoryRouter initialEntries={['/?estudiante=103']}><TutoringStudentsPage /></MemoryRouter>)
    expect(await screen.findByRole('heading', { level: 1, name: 'Lucía Ciclo' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver a estudiantes' }))
    expect(await screen.findByTitle('Abrir a Lucía Ciclo')).toBeInTheDocument()
    view.unmount()

    render(<MemoryRouter initialEntries={['/?estudiante=999']}><TutoringStudentsPage /></MemoryRouter>)
    expect(await screen.findByText('No encontramos este estudiante en la carrera.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver a estudiantes' }))
    expect(await screen.findByTitle('Abrir a Lucía Ciclo')).toBeInTheDocument()
  })

  it('muestra bajo su campo el error del servidor al registrar un estudiante', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.allStudents).mockResolvedValue(paginated([]))
    vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([]))
    vi.mocked(tutoringApi.createCoordinatorStudent).mockRejectedValue(new ApiError(422, { message: 'El correo ya está registrado.', errors: { email: ['El correo ya está registrado.'] } }))
    render(<MemoryRouter><TutoringStudentsPage /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: 'Registrar estudiante' }))
    const form = screen.getByRole('form', { name: 'Registrar estudiante' })
    await user.type(within(form).getByLabelText(/Nombres y Apellidos/i), 'Ana Nueva')
    await user.type(within(form).getByLabelText(/Cédula o pasaporte/i), '0926687856')
    await user.type(within(form).getByLabelText(/Correo Institucional/i), 'ana@ueb.edu.ec')
    await user.click(within(form).getByRole('button', { name: 'Siguiente' }))
    await user.click(within(form).getByRole('button', { name: 'Registrar estudiante' }))
    // El correo es del paso 1: vuelve a ese paso con el error bajo el campo.
    const email = await within(form).findByLabelText(/Correo Institucional/i)
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'))
    expect(email.closest('[data-slot="field"]')).toHaveTextContent('El correo ya está registrado.')
  })
})

// S10: en la primera carga se ve un solo esqueleto con la forma de toda la pantalla (sin el
// encabezado ni los botones reales) y un único aviso «Cargando…»; después, el contenido real.
describe('Carga completa de las pantallas de coordinación de carrera', () => {
  function deferred<T>() {
    let resolve: (value: T) => void = () => undefined
    const promise = new Promise<T>((done) => { resolve = done })
    return { promise, resolve }
  }

  function onlyLoadingStatus(name: string) {
    const statuses = screen.queryAllByRole('status').filter((status) => (status.getAttribute('aria-label') ?? status.textContent ?? '').startsWith('Cargando'))
    expect(statuses).toHaveLength(1)
    expect(statuses[0]).toHaveAccessibleName(name)
    return statuses[0]
  }

  it('Docentes: mientras cargan carreras y docentes no muestra el encabezado ni los botones reales', async () => {
    const careers = deferred<typeof career[]>()
    const teachers = deferred<ReturnType<typeof paginated<never>>>()
    vi.mocked(tutoringApi.careers).mockReturnValue(careers.promise)
    vi.mocked(tutoringApi.teachers).mockReturnValue(teachers.promise)
    renderTeachers()
    const status = onlyLoadingStatus('Cargando docentes')
    expect(status.parentElement?.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(5)
    expect(screen.queryByRole('heading', { name: 'Docentes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar docente nuevo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vincular docente existente' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Docente', 'Contacto', 'Asignatura', 'Ciclo', 'Paralelo', 'Estado'])
    await act(async () => careers.resolve([career]))
    onlyLoadingStatus('Cargando docentes')
    expect(screen.queryByRole('button', { name: 'Registrar docente nuevo' })).not.toBeInTheDocument()
    await act(async () => teachers.resolve(paginated([])))
    expect(await screen.findByRole('button', { name: 'Registrar docente nuevo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Docentes' })).toBeInTheDocument()
    expect(screen.queryAllByRole('status').filter((item) => item.getAttribute('aria-label')?.startsWith('Cargando'))).toHaveLength(0)
  })

  it('Informes: mientras carga la primera página muestra la forma de la pantalla, no su título real', async () => {
    const reports = deferred<ReturnType<typeof paginated<never>>>()
    vi.mocked(tutoringApi.allReports).mockReturnValue(reports.promise)
    render(<TutoringReportsPage />)
    await waitFor(() => onlyLoadingStatus('Cargando informes'))
    await waitFor(() => expect(tutoringApi.allReports).toHaveBeenCalled())
    onlyLoadingStatus('Cargando informes')
    expect(screen.queryByRole('heading', { name: 'Informes' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Buscar')).not.toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Asignatura / Tutoría', 'Tipo de informe', 'Docente', 'Fecha'])
    await act(async () => reports.resolve(paginated([])))
    expect(await screen.findByRole('heading', { level: 1, name: 'Informes' })).toBeInTheDocument()
  })

  it('Malla: mientras cargan las asignaturas de la malla no muestra el encabezado ni «Subir nueva malla»', async () => {
    const subjects = deferred<ReturnType<typeof paginated<Subject>>>()
    vi.mocked(tutoringApi.subjects).mockReturnValue(subjects.promise)
    render(<TutoringCurriculumPage />)
    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenCalled())
    onlyLoadingStatus('Cargando malla curricular')
    expect(screen.queryByRole('heading', { name: 'Malla curricular' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Subir nueva malla curricular' })).not.toBeInTheDocument()
    await act(async () => subjects.resolve(paginated([subject])))
    expect(await screen.findByRole('button', { name: 'Subir nueva malla curricular' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Malla curricular' })).toBeInTheDocument()
  })

  it('Estudiantes de la tutoría: mientras carga la pestaña no muestra el buscador ni «Registrar estudiante»', async () => {
    const user = userEvent.setup()
    const students = deferred<ReturnType<typeof paginated<never>>>()
    vi.mocked(tutoringApi.students).mockReturnValue(students.promise)
    render(<TutoringDetail tutoring={tutoring} onBack={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'Estudiantes' }))
    onlyLoadingStatus('Cargando estudiantes')
    expect(screen.queryByRole('button', { name: 'Registrar estudiante' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Buscar')).not.toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['#', 'Estudiante', 'Contacto', 'Inscripción'])
    await act(async () => students.resolve(paginated([])))
    expect(await screen.findByRole('button', { name: 'Registrar estudiante' })).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar')).toBeInTheDocument()
  })
})
