import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { tutoringApi, type Subject, type Tutoring } from '@/lib/tutoring-api'
import { TutoringCurriculumPage } from './curriculum-page'
import { TutoringTeachersPage } from './teachers-page'
import { TutoringDetail } from './tutoring-detail'
import { TutoringReportsPage } from './reports-page'
import { TutoringStudentsPage } from './students-page'
import { canCoordinateTutorings, dashboardSection, sectionRedirectPath } from './tutoring-navigation'
import { TutoringsPage } from './tutorings-page'

vi.mock('@/lib/tutoring-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tutoring-api')>()
  return { ...actual, tutoringApi: Object.fromEntries(Object.keys(actual.tutoringApi).map((key) => [key, vi.fn()])) }
})

const career = { id: 10, faculty_id: 1, modality_id: 1, name: 'Software', code: 'SW', status: true, cycles_count: 2, active_cycles_count: 2, cycle_levels: 2 }
const cycle = { id: 20, career_id: 10, name: 'Segundo', number: 2, paralelo_id: 1, paralelo_name: 'A', status: true }
const subject: Subject = { id: 30, career_id: 10, career_name: 'Software', code: 'MAT', name: 'Matemática', is_active: true, cycle_number: 2 }
const tutoring: Tutoring = { id: 40, subject_id: 30, subject_name: 'Matemática', cycle_id: 20, cycle_name: 'Segundo', career_id: 10, period_id: 50, period_name: '2026-2', modality_id: 60, modality_name: 'Presencial', section_id: 1, section_name: 'A', teacher_id: null, teacher_name: null, teacher_is_active: null, is_active: true }

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

/** La malla guarda la asignatura abierta en la URL: se monta dentro de un router. */
function renderCurriculum(initialEntries?: string[]) {
  return render(<MemoryRouter initialEntries={initialEntries}><TutoringCurriculumPage /></MemoryRouter>)
}

// Con una sola carrera el módulo entra directo a ella.
async function openCurriculum() {
  renderCurriculum()
  await screen.findByRole('button', { name: 'Editar malla' })
}

/** Docentes guarda el docente abierto en la URL: se monta dentro de un router. */
function renderTeachers() {
  return render(<MemoryRouter><TutoringTeachersPage /></MemoryRouter>)
}

/** Las asignaturas nuevas se agregan desde «Editar malla», en el carril de su ciclo. */
async function openNewSubjectForm(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Editar malla' })).toBeEnabled())
  await user.click(screen.getByRole('button', { name: 'Editar malla' }))
  await user.click((await screen.findAllByRole('button', { name: /^Agregar asignatura al/ }))[0])
}

/** Abre una asignatura nueva, escribe el nombre (y el código) y pasa al paso de ciclo y paralelos. */
async function fillSubjectData(user: ReturnType<typeof userEvent.setup>, name: string, code?: string) {
  await openNewSubjectForm(user)
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
    // «Asignaturas» ahora es parte de la malla curricular.
    expect(dashboardSection('coordinador_carrera', 'tutoring-subjects')).toBe('tutoring-curriculum')
    expect(dashboardSection('docente', 'tutoring-subjects')).toBe('teacher-tutorings')
    expect(dashboardSection('coordinador_carrera', 'tutoring-curriculum')).toBe('tutoring-curriculum')
    expect(dashboardSection('coordinador_carrera', 'tutoring-users')).toBe('tutoring-users')
    expect(dashboardSection('coordinador_carrera', 'tutoring-reports')).toBe('tutoring-reports')
    expect(dashboardSection('administrador', 'users')).toBe('users')
    expect(dashboardSection('administrador', 'tutorings')).toBe('users')
    expect(canCoordinateTutorings('administrador')).toBe(false)
    expect(dashboardSection('docente', 'tutorings')).toBe('teacher-tutorings')
    expect(dashboardSection('estudiante', 'users')).toBe('student-tutorings')
  })

  it('redirige los enlaces de la antigua sección de Asignaturas a la malla conservando la asignatura abierta', () => {
    expect(sectionRedirectPath('tutoring-subjects', 'tutoring-curriculum', new URLSearchParams('asignatura=30&carrera=10'))).toBe('/panel/tutoring-curriculum?asignatura=30&carrera=10')
    expect(sectionRedirectPath('tutoring-subjects', 'tutoring-curriculum', new URLSearchParams())).toBe('/panel/tutoring-curriculum')
    // El resto de secciones inválidas se corrige sin arrastrar parámetros.
    expect(sectionRedirectPath('users', 'tutorings', new URLSearchParams('asignatura=30'))).toBe('/panel/tutorings')
  })

  it('explica cómo habilitar la coordinación cuando no hay carreras asignadas', async () => {
    vi.mocked(tutoringApi.careers).mockResolvedValue([])
    renderCurriculum()
    expect(await screen.findByText(/Solicita al administrador que asigne una carrera activa/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nueva asignatura' })).not.toBeInTheDocument()
  })
  it('conserva el formulario ante un rechazo y evita crear dos veces mientras guarda', async () => {
    const user = userEvent.setup()
    const toastError = vi.spyOn(toast, 'error')
    let reject: (error: unknown) => void = () => undefined
    vi.mocked(tutoringApi.createSubject).mockImplementationOnce(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise }))
    await openCurriculum()
    const form = await fillSubjectData(user, 'Programación', 'PROG')
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(tutoringApi.createSubject).toHaveBeenCalledTimes(1)
    expect(tutoringApi.createSubject).toHaveBeenCalledWith({ career_id: 10, code: 'PROG', name: 'PROGRAMACIÓN', cycle_number: 2 })
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

  it('el paso 2 ofrece cada número de ciclo de la carrera una sola vez, aunque tenga varios paralelos', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.cycles).mockResolvedValue([cycle, { ...cycle, id: 22, paralelo_id: 2, paralelo_name: 'B' }, { ...cycle, id: 21, name: 'Tercero', number: 3 }])
    await openCurriculum()
    const form = await fillSubjectData(user, 'Programación')
    await user.click(within(form).getByLabelText(/^Ciclo/))
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['Sin ciclo', '1° ciclo', '2° ciclo', '3° ciclo · Titulación'])
  })
  it('Malla curricular: título del módulo con la carrera en la descripción, toast en participio y error del servidor bajo el campo', async () => {
    const user = userEvent.setup()
    const success = vi.spyOn(toast, 'success')
    await openCurriculum()
    expect(screen.getByRole('heading', { level: 1, name: 'Malla curricular' })).toBeInTheDocument()
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
  it('al registrar una asignatura se elige su ciclo, con código opcional', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.createSubject).mockResolvedValue(subject)
    await openCurriculum()
    // Código es opcional: se envía solo con nombre y ciclo
    const form = await fillSubjectData(user, 'Programación')
    expect(within(form).queryByLabelText('Carrera')).not.toBeInTheDocument()
    await choose(user, within(form).getByLabelText(/^Ciclo/), '3° ciclo · Titulación')
    await user.click(within(form).getByRole('button', { name: 'Registrar asignatura' }))
    await waitFor(() => expect(tutoringApi.createSubject).toHaveBeenCalledWith({ career_id: 10, name: 'PROGRAMACIÓN', cycle_number: 3 }))
  })
  it('la asignatura es de la malla: sin período ni paralelos, con su modalidad y su número de ciclo', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.createSubject).mockResolvedValue(subject)
    await openCurriculum()
    const form = await fillSubjectData(user, 'Estructura de Datos')
    expect(within(form).queryByLabelText('Período académico')).not.toBeInTheDocument()
    expect(within(form).queryByRole('button', { name: /Crear nuevo paralelo/ })).not.toBeInTheDocument()
    await choose(user, within(form).getByLabelText(/^Ciclo/), '2° ciclo')
    await user.click(within(form).getByRole('button', { name: 'Atrás' }))
    await choose(user, within(form).getByLabelText(/^Modalidad/), 'Presencial')
    await user.click(within(form).getByRole('button', { name: 'Siguiente' }))
    await user.click(within(form).getByRole('button', { name: 'Registrar asignatura' }))
    await waitFor(() => expect(tutoringApi.createSubject).toHaveBeenCalledWith({
      career_id: 10,
      name: 'ESTRUCTURA DE DATOS',
      cycle_number: 2,
      modality_id: 60,
    }))
  })

  it('sanea los caracteres del código y el nombre al registrar una asignatura', async () => {
    const user = userEvent.setup()
    await openCurriculum()
    await openNewSubjectForm(user)
    const form = screen.getByRole('form', { name: 'Registrar asignatura' })

    const code = within(form).getByLabelText(/^Código/)
    await user.type(code, 'sw b1#001!')
    expect(code).toHaveValue('swb1001')

    const name = within(form).getByLabelText(/^Nombre/)
    await user.type(name, 'Cálculo 3 (avanzado)')
    expect(name).toHaveValue('CÁLCULO  AVANZADO')
  })

  it('carga todas las asignaturas de la carrera aunque ocupen varias páginas', async () => {
    vi.mocked(tutoringApi.subjects).mockImplementation(async (params) => paginated([params?.page === 2 ? { ...subject, id: 31, code: 'FIS', name: 'Física' } : subject], params?.page, 2))
    await openCurriculum()
    expect(await screen.findByText('Física')).toBeInTheDocument()
    expect(screen.getByText('Matemática')).toBeInTheDocument()
    expect(tutoringApi.subjects).toHaveBeenCalledWith({ career_id: career.id, page: 1, per_page: 100 })
    expect(tutoringApi.subjects).toHaveBeenCalledWith({ career_id: career.id, page: 2, per_page: 100 })
    expect(screen.queryByRole('button', { name: 'Página siguiente' })).not.toBeInTheDocument()
  })
  it('dibuja la malla con un carril por ciclo, sin desplegable de ciclo ni tabla, y filtra por búsqueda y estado', async () => {
    const math = { ...subject, name: 'MATEMATICA', next_subjects: [{ id: 31, code: 'FIS', name: 'FISICA' }], previous_subjects: [] }
    const physics = { ...subject, id: 31, code: 'FIS', name: 'FISICA', cycle_number: 3, next_subjects: [], previous_subjects: [{ id: 30, code: 'MAT', name: 'MATEMATICA' }] }
    vi.mocked(tutoringApi.subjects).mockResolvedValue(paginated([math, physics, { ...subject, id: 32, code: null, name: 'ETICA', cycle_number: null }, { ...subject, id: 33, code: 'OLD', name: 'ANTIGUA', is_active: false }]))
    await openCurriculum()
    const canvas = await screen.findByRole('region', { name: 'Vista de la malla' })
    expect(screen.queryByRole('combobox', { name: 'Ciclo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument()
    expect(within(canvas).getByRole('region', { name: '2° ciclo' })).toBeInTheDocument()
    expect(within(within(canvas).getByRole('region', { name: '3° ciclo' })).getByText('Titulación')).toBeInTheDocument()
    expect(within(canvas).getByRole('region', { name: 'Sin ciclo' })).toBeInTheDocument()
    expect(within(canvas).getByRole('article', { name: 'Sin código: ETICA' })).toBeInTheDocument()
    expect(within(canvas).queryByText('ANTIGUA')).not.toBeInTheDocument()
    // Buscar primero y después el estado; las búsquedas se aplican sobre la malla cargada.
    const filters = screen.getByLabelText('Buscar').closest('[data-tour="page-filters"]') as HTMLElement
    expect(within(filters).getAllByRole('combobox').map((select) => select.getAttribute('aria-label') ?? select.id)).toHaveLength(1)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Buscar'), 'fis')
    expect(screen.queryByRole('button', { name: 'Abrir MATEMATICA' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir FISICA' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Limpiar' }))
    await choose(user, within(filters).getByRole('combobox'), 'Inactivas')
    expect(screen.getByRole('button', { name: 'Abrir ANTIGUA' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Abrir FISICA' })).not.toBeInTheDocument()
  })
  it('define en qué asignatura continúa la malla al editar una asignatura y lo muestra en su pantalla', async () => {
    const user = userEvent.setup()
    const physics = { ...subject, id: 31, code: 'FIS', name: 'Física', cycle_number: 3 }
    vi.mocked(tutoringApi.subjects).mockResolvedValue(paginated([{ ...subject, next_subjects: [], previous_subjects: [{ id: 5, code: 'AL', name: 'ALGEBRA' }] }, physics]))
    vi.mocked(tutoringApi.updateSubject).mockResolvedValue({ ...subject, next_subjects: [{ id: 31, code: 'FIS', name: 'FISICA' }] })
    await openCurriculum()
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
    expect(tutoringApi.subjects).toHaveBeenCalledWith({ career_id: 10, page: 1, per_page: 100 })
    // La pantalla muestra la secuencia guardada.
    expect(await screen.findByText('FISICA')).toBeInTheDocument()
  })
  it('al pulsar una tarjeta de la malla abre la pantalla de la asignatura con su secuencia', async () => {
    const user = userEvent.setup()
    const math = { ...subject, name: 'MATEMATICA', next_subjects: [{ id: 31, code: 'FIS', name: 'FISICA' }], previous_subjects: [] }
    vi.mocked(tutoringApi.subjects).mockResolvedValue(paginated([math]))
    renderCurriculum()
    await user.click(await screen.findByRole('button', { name: 'Abrir MATEMATICA' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'MATEMATICA' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Malla' }))
    expect(screen.getByText('Ninguna: inicia una secuencia.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver a la malla' }))
    expect(await screen.findByRole('region', { name: 'Vista de la malla' })).toBeInTheDocument()
  })

  it('abre la asignatura desde la URL y, si no existe en la carrera, lo dice con un camino de vuelta', async () => {
    const user = userEvent.setup()
    renderCurriculum(['/?asignatura=30'])
    expect(await screen.findByRole('heading', { level: 1, name: 'Matemática' })).toBeInTheDocument()
    cleanup()
    renderCurriculum(['/?asignatura=99'])
    expect(await screen.findByText('No encontramos esta asignatura en la carrera.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver a la malla' }))
    expect(await screen.findByRole('button', { name: 'Editar malla' })).toBeInTheDocument()
  })

  it('una carrera sin asignaturas invita a importar la malla', async () => {
    vi.mocked(tutoringApi.subjects).mockResolvedValue(paginated([]))
    renderCurriculum()
    expect(await screen.findByText(/Esta carrera aún no tiene asignaturas\. Usa «Importar malla»/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importar malla' })).toBeInTheDocument()
  })
  it('Malla: título del módulo, códigos en fuente normal, esqueleto de tarjetas y motivo del bloqueo de «Revisar malla» en su tooltip', async () => {
    const user = userEvent.setup()
    let resolveCareers: (value: typeof career[]) => void = () => undefined
    vi.mocked(tutoringApi.careers).mockReturnValue(new Promise((resolve) => { resolveCareers = resolve }))
    renderCurriculum()
    // Mientras cargan las carreras ya se ve la forma de la malla (tarjetas, no una tabla).
    expect(screen.getByRole('status', { name: 'Cargando malla curricular' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument()
    await act(async () => resolveCareers([career]))
    expect(await screen.findByRole('heading', { level: 1, name: 'Malla curricular' })).toBeInTheDocument()
    expect(screen.getByText(/Asignaturas de Software/)).toBeInTheDocument()
    expect(await screen.findByText('MAT')).not.toHaveClass('font-mono')

    await user.click(screen.getByRole('button', { name: 'Importar malla' }))
    const dialog = await screen.findByRole('dialog')
    // Sin versiones: ni nombre de malla, ni PAO, ni hasta qué ciclo.
    expect(within(dialog).queryByLabelText(/Nombre de la malla/)).not.toBeInTheDocument()
    expect(within(dialog).queryByText(/PAO/)).not.toBeInTheDocument()
    const review = within(dialog).getByRole('button', { name: 'Revisar malla' })
    expect(review).toBeDisabled()
    await user.hover(review.parentElement as HTMLElement)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Sube el archivo de la malla.')
  })
  it('importa la malla: lee el archivo, marca lo que ya existe, permite corregirla y crea las asignaturas', async () => {
    const user = userEvent.setup()
    const success = vi.spyOn(toast, 'success')
    vi.mocked(tutoringApi.previewCurriculum).mockResolvedValue([
      { code: 'N-1', name: 'ALGORITMOS', cycle: 1, previous: [], errors: [] },
      { code: 'N-2', name: '', cycle: 3, previous: ['N-1', 'Matemática'], errors: ['Falta el nombre de la asignatura.'] },
      { code: 'MAT', name: 'CALCULO', cycle: 3, previous: [], errors: ['El código ya existe en la carrera.'] },
    ])
    vi.mocked(tutoringApi.importCurriculum)
      .mockRejectedValueOnce(new ApiError(422, { message: 'Hay 1 asignatura con errores; corrígela antes de importar la malla.', errors: { subjects: ['Hay 1 asignatura con errores; corrígela antes de importar la malla.'] } }))
      .mockResolvedValueOnce({ created: 2 })
    renderCurriculum()

    await user.click(await screen.findByRole('button', { name: 'Importar malla' }))
    const dialog = await screen.findByRole('dialog', { name: 'Importar malla' })
    await user.upload(within(dialog).getByLabelText('Archivo de la malla'), new File(['codigo;nombre'], 'malla.csv', { type: 'text/csv' }))
    await user.click(within(dialog).getByRole('button', { name: 'Revisar malla' }))
    expect(tutoringApi.previewCurriculum).toHaveBeenCalledWith(10, expect.any(File))

    expect(await within(dialog).findByText('Falta el nombre de la asignatura.')).toBeInTheDocument()
    // El código MAT ya es de Matemática; Matemática (2.° ciclo) sí vale como previa.
    expect(within(dialog).getByText('El código ya existe en la carrera.')).toBeInTheDocument()
    expect(within(dialog).queryByText(/La previa «Matemática»/)).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Importar' })).toBeDisabled()
    await user.type(within(dialog).getByLabelText('Nombre de N-2'), 'Programación I')
    await user.click(within(dialog).getByRole('button', { name: 'Quitar CALCULO' }))
    expect(within(dialog).queryByText('Falta el nombre de la asignatura.')).not.toBeInTheDocument()

    const subjectLoads = vi.mocked(tutoringApi.subjects).mock.calls.length
    await user.click(within(dialog).getByRole('button', { name: 'Importar' }))
    // El error del servidor se ve dentro del modal.
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Hay 1 asignatura con errores; corrígela antes de importar la malla.')
    await user.click(within(dialog).getByRole('button', { name: 'Importar' }))
    await waitFor(() => expect(tutoringApi.importCurriculum).toHaveBeenLastCalledWith({
      career_id: 10,
      subjects: [{ code: 'N-1', name: 'ALGORITMOS', cycle: 1, previous: [] }, { code: 'N-2', name: 'Programación I', cycle: 3, previous: ['N-1', 'Matemática'] }],
    }))
    await waitFor(() => expect(success).toHaveBeenCalledWith('2 asignaturas importadas', undefined))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Importar malla' })).not.toBeInTheDocument())
    await waitFor(() => expect(vi.mocked(tutoringApi.subjects).mock.calls.length).toBeGreaterThan(subjectLoads))
  })
  it('mientras cargan las carreras muestra un esqueleto y no el buscador de carreras', async () => {
    let resolveCareers: (value: typeof career[]) => void = () => undefined
    vi.mocked(tutoringApi.careers).mockReturnValue(new Promise((resolve) => { resolveCareers = resolve }))
    renderCurriculum()
    // Es el mismo esqueleto de la malla (encabezado, filtros y tarjetas), no uno de carreras.
    expect(screen.getByRole('status', { name: 'Cargando malla curricular' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Buscar carrera')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Busca por nombre de carrera…')).not.toBeInTheDocument()
    await act(async () => resolveCareers([career]))
    expect(await screen.findByRole('button', { name: 'Editar malla' })).toBeInTheDocument()
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
    renderCurriculum()
    expect(await screen.findByTitle('Ver malla de Software')).toBeInTheDocument()
    expect(screen.getByTitle('Ver malla de Comunicación')).toBeInTheDocument()
    expect(screen.getByText(/de/, { selector: 'p' })).toHaveTextContent('Mostrando 2 de 2 carreras')
    expect(screen.queryByRole('button', { name: 'Nueva asignatura' })).not.toBeInTheDocument()
    expect(tutoringApi.subjects).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Buscar carrera'), 'comu')
    expect(screen.queryByTitle('Ver malla de Software')).not.toBeInTheDocument()
    await user.click(screen.getByTitle('Ver malla de Comunicación'))
    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenLastCalledWith({ career_id: 11, page: 1, per_page: 100 }))
    await user.click(await screen.findByRole('button', { name: 'Malla curricular' }))
    expect(await screen.findByLabelText('Buscar carrera')).toBeInTheDocument()
  })

  it('muestra las asignaturas inactivas solo al elegirlas en el filtro de estado, y permite limpiarlo', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.subjects).mockResolvedValue(paginated([subject, { ...subject, id: 31, code: 'FIS', name: 'Física', is_active: false }]))
    await openCurriculum()
    await screen.findByText('Matemática')
    expect(screen.queryByText('Física')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Filtrar por Estado')).toHaveTextContent('Activas')
    await choose(user, screen.getByLabelText('Filtrar por Estado'), 'Inactivas')
    expect(screen.getByText('Física')).toBeInTheDocument()
    expect(screen.queryByText('Matemática')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Buscar'), 'quimica')
    expect(screen.getByText('No hay asignaturas con estos filtros.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Limpiar' }))
    expect(screen.getByText('Matemática')).toBeInTheDocument()
    expect(screen.queryByText('Física')).not.toBeInTheDocument()
  })
  it('la pantalla de la asignatura muestra su número de ciclo, sin pestaña de paralelos', async () => {
    const user = userEvent.setup()
    await openCurriculum()
    await user.click(await screen.findByText('Matemática'))
    expect(await screen.findByRole('tab', { name: 'Malla', selected: true })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Paralelos' })).not.toBeInTheDocument()
    expect(screen.getByText('MAT · 2° ciclo')).toBeInTheDocument()
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

  it('bloquea el correo y la cédula de un docente que ya completó su perfil; antes, se pueden corregir', async () => {
    const user = userEvent.setup()
    const pending = { id: 1, name: 'Ana Torres', identification: '0201234567', email: 'ana@ueb.edu.ec', phone: '0999999999', is_active: true, career_ids: [10], can_manage: true, profile_completed: false }
    const verified = { ...pending, id: 2, name: 'Luis Mora', identification: '1710034065', email: 'luis@ueb.edu.ec', profile_completed: true }
    vi.mocked(tutoringApi.teachers).mockResolvedValue(paginated([pending, verified]))
    renderTeachers()

    await user.click(await screen.findByTitle('Abrir a Luis Mora'))
    await user.click(await screen.findByRole('button', { name: 'Editar docente' }))
    let form = screen.getByRole('form', { name: 'Editar docente' })
    expect(within(form).getByLabelText(/^Cédula o pasaporte/)).toBeDisabled()
    expect(within(form).getByLabelText(/^Correo institucional/)).toBeDisabled()
    expect(within(form).getByText('El docente ya completó su perfil: su cédula no se puede cambiar.')).toBeInTheDocument()
    expect(within(form).getByText('El docente ya completó su perfil: su correo no se puede cambiar.')).toBeInTheDocument()
    await user.click(within(form).getByRole('button', { name: 'Cancelar' }))
    await user.click(await screen.findByRole('button', { name: 'Volver a docentes' }))

    await user.click(await screen.findByTitle('Abrir a Ana Torres'))
    await user.click(await screen.findByRole('button', { name: 'Editar docente' }))
    form = screen.getByRole('form', { name: 'Editar docente' })
    expect(within(form).getByLabelText(/^Cédula o pasaporte/)).toBeEnabled()
    expect(within(form).getByLabelText(/^Correo institucional/)).toBeEnabled()
  })

  it('Docentes muestra una fila por docente con nombre, correo, teléfono y estado (las asignaturas están en Tutorías)', async () => {
    const teacher = { id: 1, name: 'Ana Torres', identification: '0201234567', email: 'ana@ueb.edu.ec', phone: '0999999999', is_active: true, career_ids: [career.id], can_manage: true,
      tutorings: [{ id: 40, subject_name: 'ALGEBRA LINEAL', cycle_name: 'Primero', cycle_number: 1, section_name: 'A' }, { id: 41, subject_name: 'PROGRAMACION WEB I', cycle_name: 'Tercero', cycle_number: 3, section_name: 'Paralelo B' }] }
    const idle = { ...teacher, id: 2, name: 'Luis Mora', email: 'luis@ueb.edu.ec', phone: '', is_active: false, tutorings: [] }
    vi.mocked(tutoringApi.teachers).mockResolvedValue(paginated([teacher, idle]))
    renderTeachers()
    await screen.findByText('Ana Torres')
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Docente', 'Correo', 'Teléfono', 'Estado'])
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Ana Torres', 'ana@ueb.edu.ec', '0999999999', 'Activo'])
    expect(within(rows[1]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Luis Mora', 'luis@ueb.edu.ec', 'Sin teléfono', 'Inactivo'])
    expect(screen.queryByText('ALGEBRA LINEAL')).not.toBeInTheDocument()
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
    // Sin pestaña «Carreras» ni correo bajo el nombre: quitar va como ícono junto a editar.
    expect(await screen.findByRole('heading', { level: 1, name: 'Ana Torres' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Carreras' })).not.toBeInTheDocument()
    expect(screen.queryByText('ana@ueb.edu.ec')).not.toBeInTheDocument()
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

  it('edita un docente gestionable desde su pantalla, que se abre con el clic de fila, y no ofrece desactivar su cuenta', async () => {
    const user = userEvent.setup()
    const teacher = { id: 1, name: 'Ana Torres', identification: '0201234567', email: 'ana@ueb.edu.ec', phone: '0999999999', is_active: true, career_ids: [10], can_manage: true }
    vi.mocked(tutoringApi.teachers).mockResolvedValue(paginated([teacher]))
    vi.mocked(tutoringApi.updateTeacher).mockResolvedValue({ ...teacher, name: 'Ana María Torres' })
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

    // Desactivar la cuenta es tarea del administrador: el coordinador solo lo quita de su carrera.
    expect(screen.queryByRole('button', { name: 'Desactivar docente' })).not.toBeInTheDocument()
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

  it('si no hay ningún paralelo (ni en el ciclo ni en el catálogo), pide crear uno y no deja crear la tutoría', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.cycles).mockResolvedValue([{ ...cycle, paralelo_id: null, paralelo_name: null }])
    vi.mocked(tutoringApi.sections).mockResolvedValue([])
    vi.mocked(tutoringApi.availableTeachers).mockResolvedValue([{ id: 70, name: 'Ana Torres', email: 'ana@ueb.edu.ec', is_active: true }])

    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)
    await screen.findByText('Matemática')
    await user.click(screen.getByRole('button', { name: 'Crear tutoría' }))
    // Solo se elige la asignatura: su ciclo ya viene de la malla.
    expect(screen.queryByLabelText(/^Ciclo/)).not.toBeInTheDocument()
    await choose(user, screen.getByLabelText(/^Asignatura/), 'Matemática · 2° ciclo')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    const form = await screen.findByRole('form', { name: 'Crear tutoría' })

    // La materia y el ciclo elegidos van en la descripción del modal, sin carrera ni período.
    expect(screen.getByText('Matemática · 2° ciclo')).toBeInTheDocument()
    expect(within(form).queryByText('Software')).not.toBeInTheDocument()

    expect(within(form).getByText('Aún no hay paralelos registrados. Crea uno para continuar.')).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Crear paralelo' })).toBeInTheDocument()
    await waitFor(() => expect(within(form).getByLabelText(/^Docente/)).toBeEnabled())
    await choose(user, within(form).getByLabelText(/^Docente/), 'Ana Torres')
    expect(within(form).getByRole('button', { name: 'Crear tutoría' })).toBeDisabled()
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
    // La asignatura es obligatoria (asterisco); el ciclo no se pide, viene de la malla.
    expect(screen.queryByLabelText(/^Ciclo/)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Asignatura/).closest('[data-slot="field"]')?.textContent).toContain('(obligatorio)')
    await choose(user, screen.getByLabelText(/^Asignatura/), 'Matemática · 2° ciclo')
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
    await choose(user, screen.getByLabelText(/^Asignatura/), 'Matemática · 2° ciclo')
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
      cycle_number: 2,
    }
    vi.mocked(tutoringApi.subjects).mockResolvedValue(paginated([subject, disabledSubject]))
    vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([]))

    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)

    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' })))
    expect(await screen.findByText(/Aún no hay tutorías/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crear tutoría' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Crear tutoría' }))
    await user.click(screen.getByLabelText(/^Asignatura/))
    expect(await screen.findByRole('option', { name: 'Matemática · 2° ciclo' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Álgebra Lineal/ })).not.toBeInTheDocument()
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
    vi.mocked(tutoringApi.subjects).mockResolvedValue(paginated([{ ...subject, cycle_number: 2 }]))
    vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([tutoring, { ...tutoring, id: 41, cycle_id: 22, section_id: 2, section_name: 'B' }]))
    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)
    await screen.findAllByText('Matemática')
    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenCalled())
    const rows = screen.getAllByTitle('Abrir la tutoría de Matemática')
    expect(rows.map((row) => within(row).getAllByRole('cell')[3].textContent)).toEqual(['A', 'B'])
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
    await choose(user, screen.getByLabelText(/^Asignatura/), 'Matemática · 2° ciclo')
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
    expect(screen.getByRole('heading', { level: 1, name: 'Tutorías - Período 2026-2' })).toBeInTheDocument()
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

  it('la lista de tutorías muestra la modalidad en su propia columna', async () => {
    vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([tutoring]))
    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)
    expect(await screen.findByText('Mostrando 1 de 1 tutoría')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Asignatura', 'Modalidad', 'Ciclo', 'Paralelo', 'Docente', 'Estado'])
    const row = screen.getByText('Matemática').closest('tr')!
    expect(within(row).getAllByRole('cell').slice(0, 2).map((cell) => cell.textContent)).toEqual(['Matemática', 'Presencial'])
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

  it('al pulsar la tarjeta abre la pantalla de la asignatura (en la URL), sin columna de acciones, y edita en un modal con el nombre primero', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.updateSubject).mockResolvedValue({ ...subject, name: 'MATEMATICA I' })
    await openCurriculum()
    await screen.findByText('Matemática')
    expect(screen.queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Abrir Matemática' }))
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

    await user.click(screen.getByRole('button', { name: 'Volver a la malla' }))
    expect(await screen.findByRole('button', { name: 'Editar malla' })).toBeInTheDocument()
  })

  it('pide confirmación antes de desactivar una asignatura', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.deactivateSubject).mockResolvedValue({ ...subject, is_active: false })
    await openCurriculum()
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
    // La cédula ya no va en la tabla (está en el detalle): se ve el correo.
    expect(screen.getByText('carlos@ueb.edu.ec')).toBeInTheDocument()
    expect(screen.getByText('Mostrando 1 de 1 estudiante')).toBeInTheDocument()
    // Sin numeración: nombre, correo, teléfono y estado (las tutorías están en Tutorías); sin columna de acciones: la fila abre al estudiante.
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Estudiante', 'Correo', 'Teléfono', 'Estado'])
    const row = screen.getByText('Carlos Estudiante').closest('tr')!
    expect(within(row).getAllByRole('cell')[0]).toHaveTextContent('Carlos Estudiante')
    expect(within(row).queryByRole('button')).not.toBeInTheDocument()
    expect(within(row).queryByText('1 tutoría')).not.toBeInTheDocument()
    // El estado siempre va en badge (solo los estados llevan badge).
    expect(within(row).getByText('Activo').closest('[data-slot="badge"]')).not.toBeNull()
    expect(within(row).getByText('Arrastra: PROGRAMACIÓN I')).toBeInTheDocument()

    // La fila abre la pantalla del estudiante con sus tutorías y sus datos en pestañas.
    vi.mocked(tutoringApi.availableTutoringsForStudent).mockResolvedValue({ data: [] } as never)
    await user.click(screen.getByTitle('Abrir a Carlos Estudiante'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Carlos Estudiante' })).toBeInTheDocument()
    expect(screen.queryByText('Mostrando 1 de 1 estudiante')).not.toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: 'Secciones del estudiante' })).toBeInTheDocument()
    // Bajo el nombre no se repite el ciclo: está en «Datos».
    expect(screen.queryByText('Sin ciclo asignado')).not.toBeInTheDocument()
    // Sin ciclo registrado, la acción de arriba es asignárselo.
    expect(screen.getByRole('button', { name: 'Asignar ciclo' })).toBeInTheDocument()
    // Sus tutorías se ven pero no se modifican aquí: inscribir y desvincular se hace en Tutorías.
    const enrolled = screen.getByText('Matemática').closest('tr')!
    expect(within(enrolled).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Inscribir en una tutoría' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument()
    expect(tutoringApi.availableTutoringsForStudent).not.toHaveBeenCalled()
    await user.click(screen.getByRole('tab', { name: 'Datos' }))
    expect(screen.getByText('0981112233')).toBeInTheDocument()
    expect(screen.getByText('Sin ciclo asignado')).toBeInTheDocument()
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

    expect(await screen.findByTitle('Abrir a Pedro Quinto')).toBeInTheDocument()
    await user.click(screen.getByTitle('Abrir a Pedro Quinto'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Pedro Quinto' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Matricular en titulación' })).toBeDisabled()
  })

  it('un estudiante con ciclo no se cambia de ciclo a mano: su ciclo se ve en «Datos»', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.cycles).mockResolvedValue([cycle, { ...cycle, id: 21, name: 'Sexto', number: 6 }])
    const student = { id: 103, identification: '0201888888', name: 'Lucía Ciclo', email: 'lucia@ueb.edu.ec', phone: null, is_active: true, cycle_id: 20, cycle_number: 2, section_name: 'A', tutoring_count: 0, tutorings: [] }
    vi.mocked(tutoringApi.allStudents).mockResolvedValue(paginated([student]))
    vi.mocked(tutoringApi.degreeStudents).mockResolvedValue({ data: [], meta: { ...paginated([]).meta, current_period: { id: 50, name: '2026-2' } } })

    render(<MemoryRouter><TutoringStudentsPage /></MemoryRouter>)
    await user.click(await screen.findByTitle('Abrir a Lucía Ciclo'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Lucía Ciclo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cambiar ciclo' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Datos' }))
    expect(screen.getByText('2° ciclo · Paralelo A')).toBeInTheDocument()
    expect(tutoringApi.updateStudentCycle).not.toHaveBeenCalled()
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
    expect(screen.queryByText('0201888888')).not.toBeInTheDocument()
    expect(screen.getByText('No matriculado')).toBeInTheDocument()
    expect(screen.queryByText(/Período actual/)).not.toBeInTheDocument()

    await user.click(screen.getByTitle('Abrir a María Estudiante'))
    expect(await screen.findByRole('heading', { level: 1, name: 'María Estudiante' })).toBeInTheDocument()
    // Su ciclo cambia solo con sus tutorías del período: no hay «Cambiar ciclo». La matrícula va con texto.
    expect(screen.queryByRole('button', { name: 'Cambiar ciclo' })).not.toBeInTheDocument()
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
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Docente', 'Correo', 'Teléfono', 'Estado'])
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

  it('Malla: mientras cargan las asignaturas de la malla no muestra el encabezado ni «Importar malla»', async () => {
    const subjects = deferred<ReturnType<typeof paginated<Subject>>>()
    vi.mocked(tutoringApi.subjects).mockReturnValue(subjects.promise)
    render(<MemoryRouter><TutoringCurriculumPage /></MemoryRouter>)
    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenCalled())
    const status = onlyLoadingStatus('Cargando malla curricular')
    expect(status.parentElement?.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(5)
    expect(screen.queryByRole('heading', { name: 'Malla curricular' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Importar malla' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nueva asignatura' })).not.toBeInTheDocument()
    await act(async () => subjects.resolve(paginated([subject])))
    expect(await screen.findByRole('button', { name: 'Importar malla' })).toBeInTheDocument()
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
