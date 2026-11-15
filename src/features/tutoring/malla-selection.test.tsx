import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { tutoringApi, type CoordinatorStudent, type Malla, type Subject, type Tutoring } from '@/lib/tutoring-api'
import { TutoringCurriculumPage } from './curriculum-page'
import { TutoringReportsPage } from './reports-page'
import { TutoringStudentsPage } from './students-page'
import { TutoringsPage } from './tutorings-page'

vi.mock('@/lib/tutoring-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tutoring-api')>()
  return { ...actual, tutoringApi: Object.fromEntries(Object.keys(actual.tutoringApi).map((key) => [key, vi.fn()])) }
})

// Software tiene dos mallas: la vigente (2025) y la anterior (2019), que sigue con estudiantes.
const career = {
  id: 10, faculty_id: 1, modality_id: 60, name: 'Software', code: 'SW', status: true, cycles_count: 2, active_cycles_count: 2, cycle_levels: 2,
  mallas: [{ id: 81, name: 'Malla 2025', is_current: true }, { id: 80, name: 'Malla 2019', is_current: false }],
}
const otherCareer = { ...career, id: 11, name: 'Comunicación', code: 'CO', mallas: [{ id: 90, name: 'Malla única', is_current: true }] }
const mallas: Malla[] = [
  { id: 81, career_id: 10, name: 'Malla 2025', is_current: true, subjects_count: 1, students_count: 4, tutorings_count: 1 },
  { id: 80, career_id: 10, name: 'Malla 2019', is_current: false, subjects_count: 0, students_count: 0, tutorings_count: 0 },
]
const cycle = { id: 20, career_id: 10, name: 'Segundo', number: 2, paralelo_id: 1, paralelo_name: 'A', status: true }
const subject: Subject = { id: 30, career_id: 10, career_name: 'Software', malla_id: 81, malla_name: 'Malla 2025', code: 'MAT', name: 'Matemática', modality_id: 60, modality_name: 'Presencial', is_active: true, cycle_number: 2 }
const oldSubject: Subject = { ...subject, id: 31, malla_id: 80, malla_name: 'Malla 2019', code: 'CAL', name: 'Cálculo antiguo' }
const tutoring: Tutoring = { id: 40, subject_id: 30, subject_name: 'Matemática', cycle_id: 20, cycle_name: 'Segundo', career_id: 10, malla_id: 81, malla_name: 'Malla 2025', period_id: 50, period_name: '2026-2', modality_id: 60, modality_name: 'Presencial', section_id: 1, section_name: 'A', teacher_id: null, teacher_name: null, teacher_is_active: null, is_active: true }
const student: CoordinatorStudent = { id: 5, identification: '0201999999', name: 'Luis Pérez', email: 'luis@ueb.edu.ec', phone: null, is_active: true, malla_id: 81, malla_name: 'Malla 2025', cycle_id: 20, cycle_number: 2, cycle_name: 'Segundo', tutoring_count: 0, tutorings: [] }

function paginated<T>(data: readonly T[]) {
  return { data, meta: { current_page: 1, last_page: 1, from: 1, to: data.length, total: data.length, per_page: 15, active_count: data.length, inactive_count: 0, enrollment_count: 0, present_count: 0, absent_count: 0 } }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(tutoringApi.careers).mockResolvedValue([career])
  vi.mocked(tutoringApi.cycles).mockResolvedValue([cycle, { ...cycle, id: 21, name: 'Tercero', number: 3 }, { ...cycle, id: 22, career_id: 11, name: 'Primero', number: 1 }])
  vi.mocked(tutoringApi.periods).mockResolvedValue([{ id: 50, name: '2026-2', start_date: '2026-09-01', end_date: '2027-02-01', is_active: true }])
  vi.mocked(tutoringApi.modalities).mockResolvedValue([{ id: 60, name: 'Presencial', is_active: true }])
  vi.mocked(tutoringApi.sections).mockResolvedValue([{ id: 1, name: 'A', is_active: true }])
  vi.mocked(tutoringApi.mallas).mockResolvedValue(mallas)
  vi.mocked(tutoringApi.subjects).mockResolvedValue(paginated([subject]))
  vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([tutoring]))
  vi.mocked(tutoringApi.allStudents).mockResolvedValue(paginated([student]))
  vi.mocked(tutoringApi.degreeStudents).mockResolvedValue(paginated([]))
  vi.mocked(tutoringApi.allReports).mockResolvedValue(paginated([]))
  vi.mocked(tutoringApi.availableTeachers).mockResolvedValue([])
})

afterEach(cleanup)

async function choose(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, option: string | RegExp) {
  await user.click(trigger)
  await user.click(await screen.findByRole('option', { name: option }))
}

function renderCurriculum() {
  return render(<MemoryRouter><TutoringCurriculumPage /></MemoryRouter>)
}

describe('Varias mallas por carrera: selector de malla', () => {
  it('parte de la malla vigente, marcada «Vigente», y al cambiarla carga las asignaturas de esa malla', async () => {
    const user = userEvent.setup()
    renderCurriculum()
    const picker = await screen.findByRole('combobox', { name: 'Malla' })
    expect(picker).toHaveTextContent('Malla 2025 · Vigente')
    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenCalledWith(expect.objectContaining({ malla_id: 81, page: 1 })))

    await user.click(picker)
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['Malla 2025 · Vigente', 'Malla 2019'])
    await user.click(screen.getByRole('option', { name: 'Malla 2019' }))
    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenLastCalledWith(expect.objectContaining({ malla_id: 80, page: 1 })))
    expect(screen.getByRole('combobox', { name: 'Malla' })).toHaveTextContent('Malla 2019')
  })

  it('al cambiar de carrera vuelve a la malla vigente; con una sola malla la muestra como texto', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.careers).mockResolvedValue([career, otherCareer])
    vi.mocked(tutoringApi.mallas).mockImplementation(async (careerId) => careerId === 10 ? mallas : [{ id: 90, career_id: 11, name: 'Malla única', is_current: true, subjects_count: 0, students_count: 0, tutorings_count: 0 }])
    renderCurriculum()
    await user.click(await screen.findByTitle('Ver malla de Software'))
    await choose(user, await screen.findByRole('combobox', { name: 'Malla' }), 'Malla 2019')
    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenLastCalledWith(expect.objectContaining({ malla_id: 80 })))

    await user.click(screen.getByRole('button', { name: 'Malla curricular' }))
    await user.click(await screen.findByTitle('Ver malla de Comunicación'))
    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenLastCalledWith(expect.objectContaining({ malla_id: 90 })))
    // Una sola malla: no hay nada que elegir.
    expect(await screen.findByText('Malla única')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Malla' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Malla curricular' }))
    await user.click(await screen.findByTitle('Ver malla de Software'))
    expect(await screen.findByRole('combobox', { name: 'Malla' })).toHaveTextContent('Malla 2025 · Vigente')
    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenLastCalledWith(expect.objectContaining({ malla_id: 81 })))
  })
})

describe('Varias mallas por carrera: Malla curricular', () => {
  it('importa el archivo de la malla en la malla elegida', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.previewCurriculum).mockResolvedValue([{ code: 'N-1', name: 'ALGORITMOS', cycle: 1, previous: [], errors: [] }])
    vi.mocked(tutoringApi.importCurriculum).mockResolvedValue({ created: 1 })
    renderCurriculum()
    await choose(user, await screen.findByRole('combobox', { name: 'Malla' }), 'Malla 2019')
    await user.click(screen.getByRole('button', { name: 'Importar malla' }))
    const dialog = await screen.findByRole('dialog', { name: 'Importar malla' })
    await user.upload(within(dialog).getByLabelText('Archivo de la malla'), new File(['codigo;nombre'], 'malla.csv', { type: 'text/csv' }))
    await user.click(within(dialog).getByRole('button', { name: 'Revisar malla' }))
    expect(tutoringApi.previewCurriculum).toHaveBeenCalledWith(10, expect.any(File), 80)
    await user.click(await within(dialog).findByRole('button', { name: 'Importar' }))
    await waitFor(() => expect(tutoringApi.importCurriculum).toHaveBeenCalledWith({
      career_id: 10,
      malla_id: 80,
      subjects: [{ code: 'N-1', name: 'ALGORITMOS', cycle: 1, previous: [] }],
    }))
  })

  it('crea una malla (nombre y «Marcar como vigente») y queda elegida; el error del servidor se ve en el formulario', async () => {
    const user = userEvent.setup()
    const created: Malla = { id: 82, career_id: 10, name: 'Malla 2026', is_current: true, subjects_count: 0, students_count: 0, tutorings_count: 0 }
    vi.mocked(tutoringApi.createMalla)
      .mockRejectedValueOnce(new ApiError(422, { message: 'Ya existe una malla con ese nombre en la carrera.', errors: { name: ['Ya existe una malla con ese nombre en la carrera.'] } }))
      .mockResolvedValueOnce(created)
    renderCurriculum()
    await screen.findByRole('combobox', { name: 'Malla' })
    await user.click(screen.getByRole('button', { name: 'Nueva malla' }))
    const form = await screen.findByRole('form', { name: 'Nueva malla' })
    await user.type(within(form).getByLabelText(/^Nombre/), 'Malla 2026')
    await user.click(within(form).getByRole('checkbox', { name: 'Marcar como vigente' }))
    await user.click(within(form).getByRole('button', { name: 'Crear malla' }))
    expect(await within(form).findByText('Ya existe una malla con ese nombre en la carrera.')).toBeInTheDocument()

    vi.mocked(tutoringApi.mallas).mockResolvedValue([{ ...mallas[0], is_current: false }, mallas[1], created])
    await user.click(within(form).getByRole('button', { name: 'Crear malla' }))
    expect(tutoringApi.createMalla).toHaveBeenLastCalledWith({ career_id: 10, name: 'Malla 2026', is_current: true })
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Nueva malla' })).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Malla' })).toHaveTextContent('Malla 2026 · Vigente'))
    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenLastCalledWith(expect.objectContaining({ malla_id: 82 })))
  })

  it('renombra la malla elegida', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.updateMalla).mockResolvedValue({ ...mallas[0], name: 'Malla 2025 rediseño' })
    renderCurriculum()
    await screen.findByRole('combobox', { name: 'Malla' })
    await user.click(screen.getByRole('button', { name: 'Renombrar malla' }))
    const form = await screen.findByRole('form', { name: 'Renombrar malla' })
    const name = within(form).getByLabelText(/^Nombre/)
    expect(name).toHaveValue('Malla 2025')
    await user.clear(name)
    await user.type(name, 'Malla 2025 rediseño')
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(tutoringApi.updateMalla).toHaveBeenCalledWith(81, { name: 'Malla 2025 rediseño' }))
  })

  it('marca como vigente otra malla tras confirmar; la vigente no lo ofrece', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.updateMalla).mockResolvedValue({ ...mallas[1], is_current: true })
    renderCurriculum()
    await screen.findByRole('combobox', { name: 'Malla' })
    expect(screen.queryByRole('button', { name: 'Marcar como vigente' })).not.toBeInTheDocument()
    await choose(user, screen.getByRole('combobox', { name: 'Malla' }), 'Malla 2019')
    await user.click(await screen.findByRole('button', { name: 'Marcar como vigente' }))
    const confirm = await screen.findByRole('dialog', { name: '¿Marcar «Malla 2019» como vigente?' })
    await user.click(within(confirm).getByRole('button', { name: 'Marcar como vigente' }))
    await waitFor(() => expect(tutoringApi.updateMalla).toHaveBeenCalledWith(80, { is_current: true }))
  })

  it('solo ofrece eliminar una malla vacía que no sea la vigente, y muestra el rechazo del servidor', async () => {
    const user = userEvent.setup()
    const toastError = vi.spyOn(toast, 'error')
    vi.mocked(tutoringApi.deleteMalla)
      .mockRejectedValueOnce(new ApiError(422, { message: 'La malla tiene asignaturas, estudiantes o tutorías.' }))
      .mockResolvedValueOnce(undefined)
    vi.mocked(tutoringApi.careers).mockResolvedValue([{ ...career, mallas: [...career.mallas, { id: 79, name: 'Malla 2015', is_current: false }] }])
    vi.mocked(tutoringApi.mallas).mockResolvedValue([...mallas, { id: 79, career_id: 10, name: 'Malla 2015', is_current: false, subjects_count: 2, students_count: 0, tutorings_count: 0 }])
    renderCurriculum()
    const picker = await screen.findByRole('combobox', { name: 'Malla' })
    // La vigente no se elimina.
    await waitFor(() => expect(tutoringApi.mallas).toHaveBeenCalledWith(10))
    expect(screen.queryByRole('button', { name: 'Eliminar malla' })).not.toBeInTheDocument()
    // Una malla con asignaturas tampoco.
    await choose(user, picker, 'Malla 2015')
    expect(screen.queryByRole('button', { name: 'Eliminar malla' })).not.toBeInTheDocument()
    // La malla vacía sí.
    await choose(user, picker, 'Malla 2019')
    await user.click(await screen.findByRole('button', { name: 'Eliminar malla' }))
    const confirm = await screen.findByRole('dialog', { name: '¿Eliminar «Malla 2019»?' })
    await user.click(within(confirm).getByRole('button', { name: 'Eliminar malla' }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(expect.anything(), { description: expect.stringContaining('La malla tiene asignaturas, estudiantes o tutorías') }))
    await user.click(within(confirm).getByRole('button', { name: 'Eliminar malla' }))
    await waitFor(() => expect(tutoringApi.deleteMalla).toHaveBeenCalledTimes(2))
    expect(tutoringApi.deleteMalla).toHaveBeenLastCalledWith(80)
    // Tras eliminarla vuelve a la vigente.
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Malla' })).toHaveTextContent('Malla 2025 · Vigente'))
  })
})

describe('Varias mallas por carrera: Tutorías, Estudiantes e Informes', () => {
  it('Tutorías lista las de la malla elegida y al crear solo ofrece asignaturas de esa malla', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.subjects).mockResolvedValue(paginated([subject, oldSubject]))
    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)
    await waitFor(() => expect(tutoringApi.tutorings).toHaveBeenCalledWith(expect.objectContaining({ career_id: 10, malla_id: 81 })))
    await waitFor(() => expect(tutoringApi.subjects).toHaveBeenCalledWith(expect.objectContaining({ malla_id: 81, status: 'active' })))
    await choose(user, await screen.findByRole('combobox', { name: 'Malla' }), 'Malla 2019')
    await waitFor(() => expect(tutoringApi.tutorings).toHaveBeenLastCalledWith(expect.objectContaining({ malla_id: 80 })))
    await choose(user, screen.getByRole('combobox', { name: 'Malla' }), 'Malla 2025 · Vigente')

    await waitFor(() => expect(screen.getByRole('button', { name: 'Crear tutoría' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Crear tutoría' }))
    await user.click(screen.getByLabelText(/^Asignatura/))
    expect(await screen.findByRole('option', { name: 'Matemática · 2° ciclo' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Cálculo antiguo/ })).not.toBeInTheDocument()
  })

  it('Estudiantes lista los de la malla elegida y muestra la malla del estudiante en sus datos', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><TutoringStudentsPage /></MemoryRouter>)
    await waitFor(() => expect(tutoringApi.allStudents).toHaveBeenCalledWith(expect.objectContaining({ career_id: 10, malla_id: 81 })))
    await choose(user, await screen.findByRole('combobox', { name: 'Malla' }), 'Malla 2019')
    await waitFor(() => expect(tutoringApi.allStudents).toHaveBeenLastCalledWith(expect.objectContaining({ malla_id: 80 })))
    await user.click(await screen.findByTitle('Abrir a Luis Pérez'))
    await user.click(await screen.findByRole('tab', { name: 'Datos' }))
    expect(screen.getByText('Malla').nextSibling).toHaveTextContent('Malla 2025')
  })

  it('«Cambiar de malla» pasa al estudiante a otra malla de su carrera; el rechazo del servidor se ve en el formulario', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.changeStudentMalla)
      .mockRejectedValueOnce(new ApiError(422, { message: 'Retira primero sus tutorías activas de la otra malla.', errors: { malla_id: ['Retira primero sus tutorías activas de la otra malla.'] } }))
      .mockResolvedValueOnce({ data: { ...student, malla_id: 80, malla_name: 'Malla 2019' } })
    render(<MemoryRouter><TutoringStudentsPage /></MemoryRouter>)
    await user.click(await screen.findByTitle('Abrir a Luis Pérez'))
    await user.click(await screen.findByRole('button', { name: 'Cambiar de malla' }))
    const form = await screen.findByRole('form', { name: 'Cambiar de malla' })
    await user.click(within(form).getByLabelText(/^Nueva malla/))
    // Solo las otras mallas de la carrera.
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['Malla 2019'])
    await user.click(screen.getByRole('option', { name: 'Malla 2019' }))
    await user.click(within(form).getByRole('button', { name: 'Cambiar de malla' }))
    expect(await within(form).findByText('Retira primero sus tutorías activas de la otra malla.')).toBeInTheDocument()

    const loads = vi.mocked(tutoringApi.allStudents).mock.calls.length
    await user.click(within(form).getByRole('button', { name: 'Cambiar de malla' }))
    await waitFor(() => expect(tutoringApi.changeStudentMalla).toHaveBeenLastCalledWith(5, 80))
    // Deja la lista de esta malla: se cierra su pantalla y la lista se recarga.
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Cambiar de malla' })).not.toBeInTheDocument())
    await waitFor(() => expect(screen.queryByRole('heading', { level: 1, name: 'Luis Pérez' })).not.toBeInTheDocument())
    expect(vi.mocked(tutoringApi.allStudents).mock.calls.length).toBeGreaterThan(loads)
  })

  it('registrar un estudiante lo deja en la malla elegida', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.createCoordinatorStudent).mockResolvedValue({ data: { ...student, id: 6, malla_id: 80, malla_name: 'Malla 2019' } })
    render(<MemoryRouter><TutoringStudentsPage /></MemoryRouter>)
    await choose(user, await screen.findByRole('combobox', { name: 'Malla' }), 'Malla 2019')
    await user.click(await screen.findByRole('button', { name: 'Registrar estudiante' }))
    const form = screen.getByRole('form', { name: 'Registrar estudiante' })
    await user.type(within(form).getByLabelText(/Cédula o pasaporte/i), '0926687856')
    await user.type(within(form).getByLabelText(/^Nombres/), 'Ana María')
    await user.type(within(form).getByLabelText(/^Apellidos/), 'Torres Vera')
    await user.type(within(form).getByLabelText(/Correo Institucional/i), 'ana@ueb.edu.ec')
    await user.click(within(form).getByRole('button', { name: 'Siguiente' }))
    // El 2.° ciclo tiene un solo paralelo: ya viene elegido.
    await user.click(within(form).getByRole('button', { name: 'Registrar estudiante' }))
    await waitFor(() => expect(tutoringApi.createCoordinatorStudent).toHaveBeenCalledWith(expect.objectContaining({ career_id: 10, malla_id: 80, cycle_id: 20, tutoring_id: undefined })))
  })

  it('la pestaña de titulación lista los estudiantes de la malla elegida', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><TutoringStudentsPage /></MemoryRouter>)
    await waitFor(() => expect(tutoringApi.degreeStudents).toHaveBeenCalledWith(expect.objectContaining({ career_id: 10, malla_id: 81 })))
    await choose(user, await screen.findByRole('combobox', { name: 'Malla' }), 'Malla 2019')
    await waitFor(() => expect(tutoringApi.degreeStudents).toHaveBeenLastCalledWith(expect.objectContaining({ career_id: 10, malla_id: 80 })))
  })

  it('Tutorías carga el listado PDF en la malla elegida', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.importRoster).mockResolvedValue({
      applied: false, career_name: 'Software', subject_name: 'CÁLCULO ANTIGUO', section_name: 'A', teacher_name: null, subject: { id: 31, code: 'CAL', name: 'Cálculo antiguo' },
      cycle_number: 2, period_name: '2026-2', teacher: null, tutoring: { id: null, exists: false }, errors: [], notes: [], students: [],
    })
    render(<MemoryRouter><TutoringsPage /></MemoryRouter>)
    await choose(user, await screen.findByRole('combobox', { name: 'Malla' }), 'Malla 2019')
    await user.click(screen.getByRole('button', { name: 'Cargar listado PDF' }))
    const pdf = new File(['%PDF'], 'LISTADO.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText('Listado en PDF'), pdf)
    await user.click(screen.getByRole('button', { name: 'Revisar listado' }))
    await waitFor(() => expect(tutoringApi.importRoster).toHaveBeenLastCalledWith(10, pdf, false, 80))
  })

  it('Informes pide los de la malla elegida', async () => {
    const user = userEvent.setup()
    render(<TutoringReportsPage />)
    await waitFor(() => expect(tutoringApi.allReports).toHaveBeenCalledWith(expect.objectContaining({ career_id: 10, malla_id: 81 })))
    await choose(user, await screen.findByRole('combobox', { name: 'Malla' }), 'Malla 2019')
    await waitFor(() => expect(tutoringApi.allReports).toHaveBeenLastCalledWith(expect.objectContaining({ malla_id: 80 })))
  })
})
