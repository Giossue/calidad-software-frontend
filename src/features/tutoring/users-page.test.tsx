import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { tutoringApi } from '@/lib/tutoring-api'
import { dashboardSection, sectionRedirectPath } from './tutoring-navigation'
import { TutoringUsersPage } from './users-page'

vi.mock('@/lib/tutoring-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tutoring-api')>()
  return { ...actual, tutoringApi: Object.fromEntries(Object.keys(actual.tutoringApi).map((key) => [key, vi.fn()])) }
})

const career = { id: 10, faculty_id: 1, modality_id: 1, name: 'Software', code: 'SW', status: true, cycles_count: 2, active_cycles_count: 2, cycle_levels: 2 }
const otherCareer = { ...career, id: 11, name: 'Comunicación', code: 'CO' }
const cycle = { id: 20, career_id: 10, name: 'Segundo', number: 2, paralelo_id: 1, paralelo_name: 'A', status: true }
const teacher = { id: 5, identification: '0201234567', name: 'Ana Torres', email: 'ana@ueb.edu.ec', phone: '0991234567', is_active: true, career_ids: [10], can_manage: true, tutorings: [] }
const student = { id: 103, identification: '0201888888', name: 'Lucía Ciclo', email: 'lucia@ueb.edu.ec', phone: null, is_active: true, cycle_id: 20, cycle_number: 2, section_name: 'A', tutoring_count: 0, tutorings: [] }

function paginated<T>(data: readonly T[]) {
  return { data, meta: { current_page: 1, last_page: 1, from: 1, to: data.length, total: data.length, per_page: 15, active_count: data.length, inactive_count: 0 } }
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

/** Muestra la URL actual para comprobar la pestaña y los parámetros. */
function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

function renderUsers(entry = '/panel/tutoring-users') {
  return render(<MemoryRouter initialEntries={[entry]}><TutoringUsersPage /><LocationProbe /></MemoryRouter>)
}

const search = () => new URLSearchParams(screen.getByTestId('location').textContent?.split('?')[1] ?? '')

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(tutoringApi.careers).mockResolvedValue([career])
  vi.mocked(tutoringApi.cycles).mockResolvedValue([cycle, { ...cycle, id: 21, name: 'Tercero', number: 3 }])
  vi.mocked(tutoringApi.periods).mockResolvedValue([])
  vi.mocked(tutoringApi.modalities).mockResolvedValue([])
  vi.mocked(tutoringApi.sections).mockResolvedValue([])
  vi.mocked(tutoringApi.teachers).mockResolvedValue(paginated([teacher]))
  vi.mocked(tutoringApi.allStudents).mockResolvedValue(paginated([student]))
  vi.mocked(tutoringApi.degreeStudents).mockResolvedValue(paginated([]))
  vi.mocked(tutoringApi.tutorings).mockResolvedValue(paginated([]))
  vi.mocked(tutoringApi.availableTutoringsForStudent).mockResolvedValue({ data: [] } as never)
})

afterEach(cleanup)

describe('Usuarios (docentes y estudiantes en pestañas)', () => {
  it('abre Docentes por defecto con el título «Usuarios» y sin un segundo título', async () => {
    renderUsers()
    expect(await screen.findByRole('heading', { level: 1, name: 'Usuarios' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('tab', { name: 'Docentes' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Estudiantes' })).toHaveAttribute('aria-selected', 'false')
    expect(await screen.findByTitle('Abrir a Ana Torres')).toBeInTheDocument()
  })

  it('las pestañas cambian el contenido, las acciones del encabezado y la URL', async () => {
    const user = userEvent.setup()
    renderUsers()
    expect(await screen.findByRole('button', { name: 'Registrar docente nuevo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vincular docente existente' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar estudiante' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Estudiantes' }))
    expect(await screen.findByRole('button', { name: 'Registrar estudiante' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar docente nuevo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vincular docente existente' })).not.toBeInTheDocument()
    expect(await screen.findByTitle('Abrir a Lucía Ciclo')).toBeInTheDocument()
    expect(search().get('pestana')).toBe('estudiantes')
    expect(screen.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)

    await user.click(screen.getByRole('tab', { name: 'Docentes' }))
    expect(await screen.findByRole('button', { name: 'Registrar docente nuevo' })).toBeInTheDocument()
    expect(search().get('pestana')).toBe('docentes')
  })

  it('lee la pestaña de la URL', async () => {
    renderUsers('/panel/tutoring-users?pestana=estudiantes')
    expect(await screen.findByRole('button', { name: 'Registrar estudiante' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Estudiantes' })).toHaveAttribute('aria-selected', 'true')
  })

  it('al abrir un docente oculta las pestañas y «Volver» regresa a la pestaña', async () => {
    const user = userEvent.setup()
    renderUsers()
    await user.click(await screen.findByTitle('Abrir a Ana Torres'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Ana Torres' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Estudiantes' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver a docentes' }))
    expect(await screen.findByRole('tab', { name: 'Docentes' })).toHaveAttribute('aria-selected', 'true')
    expect(search().get('docente')).toBeNull()
  })

  it('al abrir un estudiante oculta las pestañas y «Volver» regresa a Estudiantes', async () => {
    const user = userEvent.setup()
    renderUsers('/panel/tutoring-users?pestana=estudiantes&estudiante=103')
    expect(await screen.findByRole('heading', { level: 1, name: 'Lucía Ciclo' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Docentes' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver a estudiantes' }))
    expect(await screen.findByRole('tab', { name: 'Estudiantes' })).toHaveAttribute('aria-selected', 'true')
    expect(search().get('pestana')).toBe('estudiantes')
    expect(search().get('estudiante')).toBeNull()
  })

  it('en la primera carga muestra un solo esqueleto con pestañas y un único aviso «Cargando…»', async () => {
    const careers = deferred<typeof career[]>()
    const teachers = deferred<ReturnType<typeof paginated<typeof teacher>>>()
    vi.mocked(tutoringApi.careers).mockReturnValue(careers.promise)
    vi.mocked(tutoringApi.teachers).mockReturnValue(teachers.promise)
    renderUsers()
    const statuses = () => screen.queryAllByRole('status').filter((status) => (status.getAttribute('aria-label') ?? status.textContent ?? '').startsWith('Cargando'))
    expect(statuses()).toHaveLength(1)
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Usuarios' })).not.toBeInTheDocument()
    expect(document.querySelector('[data-slot="tabs-skeleton"]')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Docente', 'Contacto', 'Asignatura', 'Ciclo', 'Paralelo', 'Estado'])
    await act(async () => careers.resolve([career]))
    expect(statuses()).toHaveLength(1)
    await act(async () => teachers.resolve(paginated([teacher])))
    expect(await screen.findByRole('tab', { name: 'Docentes' })).toBeInTheDocument()
    expect(statuses()).toHaveLength(0)
  })

  it('con varias carreras, la carrera elegida en Estudiantes se conserva al cambiar de pestaña', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.careers).mockResolvedValue([career, otherCareer])
    renderUsers('/panel/tutoring-users?pestana=estudiantes')
    // Estudiantes pide primero la carrera, con las pestañas visibles.
    await user.click(await screen.findByTitle('Ver estudiantes de Software'))
    expect(await screen.findByRole('button', { name: 'Registrar estudiante' })).toBeInTheDocument()
    expect(search().get('carrera')).toBe('10')

    await user.click(screen.getByRole('tab', { name: 'Docentes' }))
    await screen.findByRole('button', { name: 'Registrar docente nuevo' })
    expect(screen.getByRole('combobox', { name: 'Filtrar por Carrera' })).toHaveTextContent('Software')
    await waitFor(() => expect(tutoringApi.teachers).toHaveBeenLastCalledWith(expect.objectContaining({ career_id: 10 })))

    await user.click(screen.getByRole('tab', { name: 'Estudiantes' }))
    // Vuelve directo a la carrera elegida, sin pasar por la lista de carreras.
    expect(await screen.findByRole('button', { name: 'Registrar estudiante' })).toBeInTheDocument()
    expect(screen.queryByTitle('Ver estudiantes de Software')).not.toBeInTheDocument()
  })
})

describe('Secciones antiguas de Docentes y Estudiantes', () => {
  it('llevan a Usuarios con la pestaña correspondiente y conservan los parámetros', () => {
    expect(dashboardSection('coordinador_carrera', 'tutoring-teachers')).toBe('tutoring-users')
    expect(dashboardSection('coordinador_carrera', 'tutoring-students')).toBe('tutoring-users')
    expect(dashboardSection('coordinador_carrera', 'tutoring-users')).toBe('tutoring-users')
    expect(dashboardSection('docente', 'tutoring-users')).toBe('teacher-tutorings')
    expect(sectionRedirectPath('tutoring-teachers', 'tutoring-users', new URLSearchParams('docente=5'))).toBe('/panel/tutoring-users?docente=5&pestana=docentes')
    expect(sectionRedirectPath('tutoring-students', 'tutoring-users', new URLSearchParams('estudiante=103&carrera=10'))).toBe('/panel/tutoring-users?estudiante=103&carrera=10&pestana=estudiantes')
    expect(sectionRedirectPath('tutoring-students', 'tutoring-users', new URLSearchParams())).toBe('/panel/tutoring-users?pestana=estudiantes')
    // Otro rol no arrastra la pestaña a su portada.
    expect(sectionRedirectPath('tutoring-students', 'teacher-tutorings', new URLSearchParams('estudiante=1'))).toBe('/panel/teacher-tutorings')
  })
})
