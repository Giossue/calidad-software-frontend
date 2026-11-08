import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { tutoringApi, type RosterImport } from '@/lib/tutoring-api'
import { RosterImportButton } from './roster-import-dialog'

vi.mock('@/lib/tutoring-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tutoring-api')>()
  return { ...actual, tutoringApi: { ...actual.tutoringApi, importRoster: vi.fn() } }
})

const preview: RosterImport = {
  applied: false,
  career_name: 'GRUPO COMUN',
  subject_name: 'CÁLCULO I',
  section_name: 'A',
  teacher_name: 'PEREZ MORA LUIS',
  subject: { id: 7, code: 'TI-B1-001', name: 'CÁLCULO I' },
  cycle_number: 1,
  period_name: 'PAO 2026-2',
  teacher: { id: 3, name: 'Perez Mora Luis', assign: true },
  tutoring: { id: null, exists: false },
  errors: [],
  notes: ['El listado es de la carrera «TI»; se cargará en Software.'],
  students: [
    { number: 1, name: 'Andrade Vera Ana', email: 'ana@ueb.edu.ec', phone: null, status: 'new', message: null },
    { number: 2, name: 'Benitez Cruz Bruno', email: 'bruno@ueb.edu.ec', phone: null, status: 'enroll', message: null },
    { number: 3, name: 'Cando Rios Carla', email: 'carla@ueb.edu.ec', phone: null, status: 'blocked', message: 'Arrastra «Matemática básica», previa de esta asignatura.' },
  ],
}

describe('Cargar listado PDF', () => {
  beforeEach(() => vi.mocked(tutoringApi.importRoster).mockReset())
  afterEach(cleanup)

  it('muestra la vista previa y al confirmar carga el listado', async () => {
    const user = userEvent.setup()
    const onFinished = vi.fn()
    vi.mocked(tutoringApi.importRoster)
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce({ ...preview, applied: true, tutoring: { id: 90, exists: true } })
    render(<RosterImportButton careerId={10} onFinished={onFinished} />)

    await user.click(screen.getByRole('button', { name: 'Cargar listado PDF' }))
    const pdf = new File(['%PDF'], 'LISTADO.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText('Listado en PDF'), pdf)
    await user.click(screen.getByRole('button', { name: 'Revisar listado' }))

    expect(tutoringApi.importRoster).toHaveBeenLastCalledWith(10, pdf, false)
    expect(await screen.findByText('Perez Mora Luis (se asigna)')).toBeInTheDocument()
    expect(screen.getByText('Se crea al confirmar')).toBeInTheDocument()
    expect(screen.getByText('El listado es de la carrera «TI»; se cargará en Software.')).toBeInTheDocument()
    const rows = within(screen.getByRole('table', { name: 'Estudiantes del listado' })).getAllByRole('row').slice(1)
    expect(rows.map((row) => within(row).getAllByRole('cell')[2].textContent)).toEqual([
      'Se registra e inscribe',
      'Se inscribe',
      'No se inscribeArrastra «Matemática básica», previa de esta asignatura.',
    ])

    await user.click(screen.getByRole('button', { name: 'Cargar 2 estudiantes' }))
    expect(tutoringApi.importRoster).toHaveBeenLastCalledWith(10, pdf, true)
    expect(await screen.findByText('Listado cargado: 1 registrados, 1 inscritos, 0 ya estaban y 1 sin inscribir.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onFinished).toHaveBeenCalled()
  })

  it('no permite cargar cuando falta la asignatura', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.importRoster).mockResolvedValue({ ...preview, subject: null, errors: ['La asignatura «CÁLCULO I» no está registrada en Software. Regístrala en Asignaturas.'] })
    render(<RosterImportButton careerId={10} />)

    await user.click(screen.getByRole('button', { name: 'Cargar listado PDF' }))
    await user.upload(screen.getByLabelText('Listado en PDF'), new File(['%PDF'], 'LISTADO.pdf', { type: 'application/pdf' }))
    await user.click(screen.getByRole('button', { name: 'Revisar listado' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La asignatura «CÁLCULO I» no está registrada en Software.')
    expect(screen.getByRole('button', { name: 'Cargar 2 estudiantes' })).toBeDisabled()
  })
})
