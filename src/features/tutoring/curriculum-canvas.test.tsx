import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { tutoringApi, type Subject } from '@/lib/tutoring-api'
import { TutoringCurriculumPage } from './curriculum-page'
import { laneHeight, laneStart, navigationPadding, subjectHeight, subjectOffset, subjectStep, subjectWidth } from './curriculum-canvas/layout'

vi.mock('@/lib/tutoring-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tutoring-api')>()
  return { ...actual, tutoringApi: Object.fromEntries(Object.keys(actual.tutoringApi).map((key) => [key, vi.fn()])) }
})

// React Flow mide con DOMMatrix al conectar; jsdom no lo trae.
class DOMMatrixReadOnlyShim {
  m22: number
  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([\d.]+)\)/)?.[1]
    this.m22 = scale === undefined ? 1 : Number(scale)
  }
}

const career = { id: 10, faculty_id: 1, modality_id: 1, name: 'Software', code: 'SW', status: true, cycles_count: 3, active_cycles_count: 3, cycle_levels: 3 }
const cycles = [
  { id: 19, career_id: 10, name: 'Primero', number: 1, paralelo_id: 1, paralelo_name: 'A', status: true },
  { id: 20, career_id: 10, name: 'Segundo', number: 2, paralelo_id: 1, paralelo_name: 'A', status: true },
  { id: 21, career_id: 10, name: 'Tercero', number: 3, paralelo_id: 1, paralelo_name: 'A', status: true },
]
const algebra: Subject = { id: 29, career_id: 10, career_name: 'Software', code: 'ALG', name: 'Álgebra', is_active: true, cycle_ids: [19], next_subjects: [{ id: 30, code: 'MAT', name: 'Matemática' }], previous_subjects: [] }
const math: Subject = { id: 30, career_id: 10, career_name: 'Software', code: 'MAT', name: 'Matemática', is_active: true, cycle_ids: [20], next_subjects: [], previous_subjects: [{ id: 29, code: 'ALG', name: 'Álgebra' }] }
const physics: Subject = { id: 31, career_id: 10, career_name: 'Software', code: 'FIS', name: 'Física', is_active: true, cycle_ids: [21], next_subjects: [], previous_subjects: [] }

function paginated<T>(data: readonly T[]) {
  return { data, meta: { current_page: 1, last_page: 1, from: 1, to: data.length, total: data.length, per_page: 100, active_count: data.length, inactive_count: 0 } }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('DOMMatrixReadOnly', DOMMatrixReadOnlyShim)
  localStorage.clear()
  vi.mocked(tutoringApi.careers).mockResolvedValue([career])
  vi.mocked(tutoringApi.cycles).mockResolvedValue(cycles)
  vi.mocked(tutoringApi.periods).mockResolvedValue([{ id: 50, name: '2026-2', start_date: '2026-09-01', end_date: '2027-02-01', is_active: true }])
  vi.mocked(tutoringApi.modalities).mockResolvedValue([])
  vi.mocked(tutoringApi.sections).mockResolvedValue([{ id: 1, name: 'A', is_active: true }])
  vi.mocked(tutoringApi.subjects).mockResolvedValue(paginated([algebra, math, physics]))
})

const originalElementFromPoint = document.elementFromPoint
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.elementFromPoint = originalElementFromPoint
})

function renderCurriculum() {
  return render(<MemoryRouter><TutoringCurriculumPage /></MemoryRouter>)
}

async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  renderCurriculum()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Editar malla' })).toBeEnabled())
  await user.click(screen.getByRole('button', { name: 'Editar malla' }))
  return screen.findByRole('region', { name: 'Editor interactivo de la malla' })
}

/** Posición del nodo en el lienzo (React Flow lo ubica con `translate(x, y)`). */
function nodePosition(id: number) {
  const wrapper = document.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement
  const match = wrapper.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
  return { x: Number(match?.[1]), y: Number(match?.[2]) }
}

describe('Malla visual (lienzo como en sílabos)', () => {
  it('dibuja un carril por ciclo con las asignaturas (código y nombre) en su ciclo y las previas como flechas', async () => {
    renderCurriculum()
    const canvas = await screen.findByRole('region', { name: 'Vista de la malla' })
    for (const label of ['1° ciclo', '2° ciclo', '3° ciclo']) {
      expect(within(canvas).getByRole('region', { name: label })).toHaveTextContent('Asignaturas1')
    }
    expect(within(canvas).getByRole('article', { name: 'ALG: Álgebra' })).toHaveTextContent('ALG')
    expect(within(canvas).getByRole('article', { name: 'MAT: Matemática' })).toHaveTextContent('Matemática')
    // Cada asignatura está en el carril de su ciclo.
    expect(nodePosition(29).y).toBe(subjectOffset)
    expect(nodePosition(30).y).toBe(1 * laneHeight + subjectOffset)
    expect(nodePosition(31).y).toBe(2 * laneHeight + subjectOffset)
    // La previa se dibuja como flecha (y una sola vez, aunque venga en las dos asignaturas).
    expect(within(canvas).getAllByRole('img', { name: 'Previa: Álgebra → Matemática' })).toHaveLength(1)
    expect(within(canvas).queryByRole('img', { name: /Física/ })).not.toBeInTheDocument()
    // Leyenda y controles de zoom.
    expect(within(canvas).getByRole('group', { name: 'Zoom de la malla' })).toBeInTheDocument()
    await userEvent.setup().click(within(canvas).getByRole('button', { name: 'Ver leyenda de la malla' }))
    const legend = await screen.findByRole('dialog', { name: 'Leyenda de la malla' })
    expect(legend).toHaveTextContent('Previa')
    expect(legend).toHaveTextContent('N° asignaturas3')
    expect(legend).toHaveTextContent('N° previas1')
  })

  it('el zoom pasa por niveles fijos y se recuerda', async () => {
    const user = userEvent.setup()
    renderCurriculum()
    const canvas = await screen.findByRole('region', { name: 'Vista de la malla' })
    const zoomIn = within(canvas).getByRole('button', { name: 'Acercar la malla' })
    // Sin medir el ancho, «Ajustar» queda en 100 %: no se puede acercar más.
    expect(zoomIn).toBeDisabled()
    await user.click(within(canvas).getByRole('button', { name: 'Alejar la malla' }))
    expect(localStorage.getItem('curriculum-zoom')).toBe('0.75')
    expect(within(canvas).getByRole('button', { name: 'Ajustar la malla al ancho disponible' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('al pulsar una asignatura abre su pantalla', async () => {
    const user = userEvent.setup()
    renderCurriculum()
    await user.click(await screen.findByRole('button', { name: 'Abrir Matemática' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Matemática' })).toBeInTheDocument()
  })

  it('«Editar malla» abre la edición a pantalla completa con «Agregar asignatura» en cada ciclo, que registra en ese ciclo', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.createSubject).mockResolvedValue(physics)
    const editor = await openEditor(user)
    expect(screen.getByRole('region', { name: 'Editar malla' })).toHaveClass('fixed', 'inset-0')
    expect(screen.getByRole('heading', { level: 1, name: 'Malla de Software' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Importar malla' })).not.toBeInTheDocument()
    expect(within(editor).getAllByRole('button', { name: /^Agregar asignatura al/ }).map((button) => button.getAttribute('aria-label'))).toEqual(['Agregar asignatura al 1° ciclo', 'Agregar asignatura al 2° ciclo', 'Agregar asignatura al 3° ciclo'])

    await user.click(within(editor).getByRole('button', { name: 'Agregar asignatura al 3° ciclo' }))
    const form = await screen.findByRole('form', { name: 'Registrar asignatura' })
    await user.type(within(form).getByLabelText(/^Nombre/), 'Redes')
    await user.click(within(form).getByRole('button', { name: 'Siguiente' }))
    expect(within(form).getByRole('combobox', { name: /Ciclo/ })).toHaveTextContent('3° ciclo')
    await user.click(within(form).getByRole('button', { name: 'Registrar asignatura' }))
    await waitFor(() => expect(tutoringApi.createSubject).toHaveBeenCalledWith({ career_id: 10, name: 'REDES', cycle_id: 21, period_id: 50 }))

    await user.click(screen.getByRole('button', { name: 'Volver a la vista' }))
    expect(await screen.findByRole('region', { name: 'Vista de la malla' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importar malla' })).toBeInTheDocument()
  })

  it('al editar, pulsar la asignatura abre su formulario', async () => {
    const user = userEvent.setup()
    const editor = await openEditor(user)
    await user.click(within(editor).getByRole('button', { name: 'Editar Matemática' }))
    expect(await screen.findByRole('form', { name: 'Editar asignatura' })).toBeInTheDocument()
  })

  it('conecta una previa desde el menú de la asignatura con la misma petición que el formulario de la secuencia', async () => {
    const user = userEvent.setup()
    const success = vi.spyOn(toast, 'success')
    vi.mocked(tutoringApi.updateSubject).mockResolvedValue({ ...math, next_subjects: [{ id: 31, code: 'FIS', name: 'Física' }] })
    const editor = await openEditor(user)
    await user.click(within(editor).getByRole('button', { name: 'Acciones para Matemática' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Es previa de otra asignatura…' }))
    const form = await screen.findByRole('form', { name: 'Nueva previa' })
    // Solo ofrece las de ciclos posteriores.
    await user.click(within(form).getByRole('combobox', { name: /De qué asignatura es previa/ }))
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['3° ciclo · FIS · Física'])
    await user.click(screen.getByRole('option', { name: '3° ciclo · FIS · Física' }))
    await user.click(within(form).getByRole('button', { name: 'Agregar previa' }))
    await waitFor(() => expect(tutoringApi.updateSubject).toHaveBeenCalledWith(30, { code: 'MAT', name: 'Matemática', next_subject_ids: [31] }))
    await waitFor(() => expect(success).toHaveBeenCalledWith('Previa agregada', undefined))
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Nueva previa' })).not.toBeInTheDocument())
  })

  describe('arrastrando desde una manija', () => {
    /**
     * Arrastra desde la manija de abajo de `source` hasta la de arriba de `target`. jsdom no
     * mide: React Flow ubica las manijas por las medidas declaradas de cada nodo.
     */
    async function dragConnection(source: number, target: number) {
      const handle = document.querySelector(`.react-flow__node[data-id="${source}"] .react-flow__handle.source`) as HTMLElement
      const targetHandle = document.querySelector(`.react-flow__node[data-id="${target}"] .react-flow__handle.target`) as HTMLElement
      const position = nodePosition(target)
      const point = { clientX: position.x + subjectWidth / 2 + navigationPadding, clientY: position.y + navigationPadding }
      const sourcePosition = nodePosition(source)
      document.elementFromPoint = () => targetHandle
      await act(async () => {
        fireEvent.mouseDown(handle, { button: 0, clientX: sourcePosition.x + subjectWidth / 2 + navigationPadding, clientY: sourcePosition.y + subjectHeight + navigationPadding })
        fireEvent.mouseMove(document, point)
        fireEvent.mouseUp(document, point)
      })
    }

    it('crea la previa al soltar en una asignatura de un ciclo posterior', async () => {
      const user = userEvent.setup()
      vi.mocked(tutoringApi.updateSubject).mockResolvedValue(math)
      await openEditor(user)
      await dragConnection(30, 31)
      await waitFor(() => expect(tutoringApi.updateSubject).toHaveBeenCalledWith(30, { code: 'MAT', name: 'Matemática', next_subject_ids: [31] }))
    })

    it('rechaza con un mensaje la previa del mismo ciclo o de uno posterior', async () => {
      const user = userEvent.setup()
      const error = vi.spyOn(toast, 'error')
      await openEditor(user)
      await dragConnection(31, 30)
      await waitFor(() => expect(error).toHaveBeenCalledWith('No se puede conectar', { description: 'Una asignatura solo puede tener como previa otra de un ciclo anterior' }))
      expect(tutoringApi.updateSubject).not.toHaveBeenCalled()
    })
  })

  it('quita una previa al pulsar su flecha, con confirmación', async () => {
    const user = userEvent.setup()
    vi.mocked(tutoringApi.updateSubject).mockResolvedValue({ ...algebra, next_subjects: [] })
    const editor = await openEditor(user)
    fireEvent.click(within(editor).getByRole('group', { name: 'Previa: Álgebra → Matemática' }))
    const dialog = await screen.findByRole('dialog', { name: '¿Quitar previa?' })
    expect(dialog).toHaveTextContent('«Álgebra» dejará de ser previa de «Matemática».')
    await user.click(within(dialog).getByRole('button', { name: 'Quitar previa' }))
    await waitFor(() => expect(tutoringApi.updateSubject).toHaveBeenCalledWith(29, { code: 'ALG', name: 'Álgebra', next_subject_ids: [] }))
  })

  it('mientras carga, toda la pantalla es un solo esqueleto con la forma del lienzo y un único estado', async () => {
    vi.mocked(tutoringApi.subjects).mockReturnValue(new Promise(() => {}))
    renderCurriculum()
    await waitFor(() => expect(screen.getAllByRole('status')).toHaveLength(1))
    expect(screen.getByRole('status', { name: 'Cargando malla curricular' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Vista de la malla' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Importar malla' })).not.toBeInTheDocument()
  })

  it('una carrera sin asignaturas invita a importar la malla o registrar una asignatura', async () => {
    vi.mocked(tutoringApi.subjects).mockResolvedValue(paginated([]))
    renderCurriculum()
    expect(await screen.findByText(/Usa «Importar malla» para crearlas desde el archivo de la malla o «Editar malla»/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Vista de la malla' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importar malla' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nueva asignatura' })).not.toBeInTheDocument()
  })
})

// Las constantes de la geometría son las de sílabos: carriles con sus tarjetas en fila.
it('ubica las asignaturas de un ciclo en fila desde el inicio del carril', async () => {
  vi.mocked(tutoringApi.subjects).mockResolvedValue(paginated([math, { ...physics, cycle_ids: [20], code: 'AAA' }]))
  renderCurriculum()
  await screen.findByRole('region', { name: 'Vista de la malla' })
  expect(nodePosition(31).x).toBe(laneStart)
  expect(nodePosition(30).x).toBe(laneStart + subjectStep)
})
