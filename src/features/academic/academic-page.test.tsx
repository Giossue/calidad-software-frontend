import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, type Career } from '@/lib/api'
import { AcademicPage } from './academic-page'

const career: Career = { id: 10, faculty_id: 1, faculty_name: 'Ingeniería', modality_id: 1, modality_name: 'Presencial', name: 'Software', code: 'SW-2020', status: true, cycles_count: 4, active_cycles_count: 4, cycle_levels: 4 }
const meta = { current_page: 1, last_page: 1, per_page: 15, total: 1, from: 1, to: 1, active_count: 1, inactive_count: 0 }

function CurrentLocation() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname}{location.search}</p>
}

beforeEach(() => {
  vi.spyOn(api, 'listCareers').mockResolvedValue({ data: [career], meta })
  vi.spyOn(api, 'listActiveCareers').mockResolvedValue([career])
  vi.spyOn(api, 'listActiveFaculties').mockResolvedValue([{ id: 1, name: 'Ingeniería', status: true, is_active: true, careers_count: 1, active_careers_count: 1 }])
  vi.spyOn(api, 'listModalities').mockResolvedValue({ data: [{ id: 1, name: 'Presencial', is_active: true }, { id: 2, name: 'Virtual', is_active: true }], meta })
  vi.spyOn(api, 'updateCareer').mockResolvedValue(career)
  vi.spyOn(api, 'listCycles').mockResolvedValue({
    data: [{ id: 1, career_id: 10, name: 'Primer Ciclo', number: 1, status: true, paralelo_id: null, paralelo_name: null }],
    meta,
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// La fila de la carrera abre su pantalla; "Editar carrera" abre el modal.
async function openCareerEdit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('row', { name: /Software/ }))
  await user.click(await screen.findByRole('button', { name: 'Editar carrera' }))
  return screen.findByRole('dialog', { name: 'Editar carrera' })
}

// Los selects son de shadcn (Radix): se abren y se elige la opción por su texto.
async function choose(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, option: string) {
  await user.click(trigger)
  await user.click(await screen.findByRole('option', { name: option }))
}

describe('Edición de carreras', () => {
  it('permite aumentar la cantidad de ciclos pero no quitar los que ya existen', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AcademicPage /></MemoryRouter>)
    const form = await openCareerEdit(user)
    const select = within(form).getByLabelText('Cantidad de ciclos')
    expect(select).toHaveTextContent('4 ciclos')
    await user.click(select)
    expect(await screen.findByRole('option', { name: '4 ciclos' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '3 ciclos' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: '6 ciclos' }))
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(api.updateCareer).toHaveBeenCalledWith(10, expect.objectContaining({ name: 'Software', cycles_count: 6 })))
  })

  it('no envía la cantidad de ciclos si no se modificó', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AcademicPage /></MemoryRouter>)
    const form = await openCareerEdit(user)
    const name = within(form).getByLabelText(/^Nombre de la carrera/)
    await user.type(name, ' II')
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(api.updateCareer).toHaveBeenCalled())
    expect(vi.mocked(api.updateCareer).mock.calls[0][1]).not.toHaveProperty('cycles_count')
  })

  it('exige la modalidad, sin opción «Sin modalidad», y valida código de carrera duplicado', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AcademicPage /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: 'Nueva carrera' }))

    const dialog = await screen.findByRole('dialog', { name: 'Registrar carrera' })
    const modalitySelect = within(dialog).getByRole('combobox', { name: 'Modalidad(obligatorio)' })
    expect(modalitySelect).toHaveTextContent('Selecciona la modalidad')
    // Sin ayudas que repitan los campos.
    expect(within(dialog).queryByText('Se crean automáticamente los ciclos de la carrera.')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Asigna la nueva carrera a una facultad activa.')).not.toBeInTheDocument()

    // Primero el nombre y luego el código; nombre, código y facultad son obligatorios.
    const labels = dialog.querySelectorAll('label')
    expect(labels[0]).toHaveTextContent(/^Nombre de la carrera/)
    expect(labels[1]).toHaveTextContent(/^Código de carrera/)
    expect(within(dialog).getByRole('textbox', { name: 'Nombre de la carrera(obligatorio)' })).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: 'Código de carrera(obligatorio)' })).toBeInTheDocument()
    expect(within(dialog).getByRole('combobox', { name: 'Facultad(obligatorio)' })).toBeInTheDocument()

    // Intentar registrar una carrera con un código ya existente ("SW-2020")
    await user.type(within(dialog).getByLabelText(/^Nombre de la carrera/), 'Software')
    await user.type(within(dialog).getByLabelText(/^Código de carrera/), 'sw-2020')
    await choose(user, within(dialog).getByLabelText(/^Facultad/), 'Ingeniería')
    expect(within(dialog).getByRole('button', { name: 'Registrar carrera' })).toBeDisabled()
    await user.click(modalitySelect)
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['Presencial', 'Virtual'])
    await user.click(screen.getByRole('option', { name: 'Presencial' }))
    await user.click(within(dialog).getByRole('button', { name: 'Registrar carrera' }))

    // El error se muestra una sola vez, en línea bajo el código (sin otro recuadro ni modal encima).
    const messages = await within(dialog).findAllByText('Ya existe una carrera con este código.')
    expect(messages).toHaveLength(1)
    expect(messages[0].closest('[data-slot="field"]')).toContainElement(within(dialog).getByLabelText(/^Código de carrera/))
    expect(within(dialog).queryByText('Carrera ya registrada')).not.toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('registra otra malla de la carrera con el mismo nombre y otro código', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'createCareer').mockResolvedValue({ ...career, id: 11, code: 'SW-2024' })
    render(<MemoryRouter><AcademicPage /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: 'Nueva carrera' }))
    const dialog = await screen.findByRole('dialog', { name: 'Registrar carrera' })

    await user.type(within(dialog).getByLabelText(/^Nombre de la carrera/), 'Software')
    await choose(user, within(dialog).getByLabelText(/^Facultad/), 'Ingeniería')
    expect(within(dialog).getByRole('button', { name: 'Registrar carrera' })).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/^Código de carrera/), ' SW-2024 ')
    await choose(user, within(dialog).getByLabelText(/^Modalidad/), 'Virtual')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar carrera' }))

    await waitFor(() => expect(api.createCareer).toHaveBeenCalledWith(expect.objectContaining({ name: 'Software', code: 'SW-2024', faculty_id: 1, modality_id: 2 })))
  })

  it('una carrera antigua sin modalidad muestra «—» y exige elegirla al editarla', async () => {
    const user = userEvent.setup()
    const legacy = { ...career, modality_id: null, modality_name: undefined }
    vi.mocked(api.listCareers).mockResolvedValue({ data: [legacy], meta })
    vi.mocked(api.listActiveCareers).mockResolvedValue([legacy])
    render(<MemoryRouter><AcademicPage /></MemoryRouter>)
    const row = await screen.findByRole('row', { name: /Software/ })
    expect(within(row).getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('Sin modalidad')).not.toBeInTheDocument()
    const form = await openCareerEdit(user)
    await user.type(within(form).getByLabelText(/^Nombre de la carrera/), ' II')
    expect(within(form).getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    await user.click(within(form).getByLabelText(/^Modalidad/))
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['Presencial', 'Virtual'])
    await user.click(screen.getByRole('option', { name: 'Presencial' }))
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(api.updateCareer).toHaveBeenCalledWith(10, expect.objectContaining({ name: 'Software II', modality_id: 1 })))
  })

  it('exige el código al editar una carrera que aún no lo tiene', async () => {
    const user = userEvent.setup()
    const legacy = { ...career, code: null }
    vi.mocked(api.listCareers).mockResolvedValue({ data: [legacy], meta })
    vi.mocked(api.listActiveCareers).mockResolvedValue([legacy])
    render(<MemoryRouter><AcademicPage /></MemoryRouter>)
    expect(within(await screen.findByRole('row', { name: /Software/ })).getByText('Sin código')).toBeInTheDocument()
    const form = await openCareerEdit(user)
    await user.type(within(form).getByLabelText(/^Nombre de la carrera/), ' II')
    expect(within(form).getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    await user.type(within(form).getByLabelText(/^Código de carrera/), 'SW-2019')
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(api.updateCareer).toHaveBeenCalledWith(10, expect.objectContaining({ name: 'Software II', code: 'SW-2019' })))
  })

  it('muestra el código en la lista y en los datos de la carrera', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AcademicPage /></MemoryRouter>)
    const row = await screen.findByRole('row', { name: /Software/ })
    expect(screen.getByRole('columnheader', { name: 'Código' })).toBeInTheDocument()
    expect(within(row).getByText('SW-2020')).toBeInTheDocument()
    await user.click(row)
    await user.click(await screen.findByRole('tab', { name: 'Datos' }))
    expect(screen.getByText('Código de carrera').nextElementSibling).toHaveTextContent('SW-2020')
  })

  it('conserva comas, puntos, guiones y paréntesis en el nombre de la carrera y del ciclo', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AcademicPage /></MemoryRouter>)
    const form = await openCareerEdit(user)
    const name = within(form).getByLabelText(/^Nombre de la carrera/)
    await user.clear(name)
    await user.type(name, 'Pedagogía de la Lengua, Literatura (Inglés) - Rediseño.')
    expect(name).toHaveValue('Pedagogía de la Lengua, Literatura (Inglés) - Rediseño.')
    await user.click(within(form).getByRole('button', { name: 'Cancelar' }))
    const discard = screen.queryByRole('button', { name: /Descartar/ })
    if (discard) await user.click(discard)

    await user.click(await screen.findByRole('button', { name: 'Nuevo ciclo' }))
    const dialog = await screen.findByRole('dialog', { name: 'Registrar ciclo' })
    const cycleName = within(dialog).getByLabelText(/^Nombre del ciclo/)
    await user.type(cycleName, 'Ciclo de nivelación, A-B.')
    expect(cycleName).toHaveValue('Ciclo de nivelación, A-B.')
  })

  it('muestra el error del nombre bajo el campo al salir de él', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AcademicPage /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: 'Nueva carrera' }))
    const dialog = await screen.findByRole('dialog', { name: 'Registrar carrera' })
    expect(within(dialog).queryByText('El nombre de la carrera es obligatorio.')).not.toBeInTheDocument()
    await user.click(within(dialog).getByLabelText(/^Nombre de la carrera/))
    await user.tab()
    expect(await within(dialog).findByText('El nombre de la carrera es obligatorio.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Registrar carrera' }).querySelector('.lucide-plus')).toBeNull()
  })
})

describe('Pantalla de la carrera', () => {
  it('la fila abre la pantalla de la carrera, sin columna de acciones, con sus ciclos y datos en pestañas', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AcademicPage /></MemoryRouter>)
    await screen.findByRole('row', { name: /Software/ })
    expect(screen.queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Acciones para Software' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('row', { name: /Software/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Software' })).toBeInTheDocument()
    expect(within(screen.getByRole('tablist', { name: 'Secciones de la carrera' })).getByRole('tab', { name: 'Ciclos' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('row', { name: /Primer Ciclo/ })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Datos' }))
    expect(within(screen.getByRole('tabpanel', { name: 'Datos' })).getByText('Ingeniería')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Volver a carreras' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Carreras' })).toBeInTheDocument()
  })

  it('desactiva la carrera desde su pantalla', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'deactivateCareer').mockResolvedValue({ ...career, status: false })
    render(<MemoryRouter><AcademicPage /></MemoryRouter>)
    await user.click(await screen.findByRole('row', { name: /Software/ }))
    await user.click(await screen.findByRole('button', { name: 'Desactivar carrera' }))

    const confirm = await screen.findByRole('dialog', { name: '¿Desactivar carrera?' })
    await user.click(within(confirm).getByRole('button', { name: 'Desactivar carrera' }))
    await waitFor(() => expect(api.deactivateCareer).toHaveBeenCalledWith(10))
    expect(await screen.findByRole('button', { name: 'Habilitar carrera' })).toBeInTheDocument()
  })
})

describe('Gestión de ciclos', () => {
  it('no muestra el campo número al registrar o editar un ciclo', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AcademicPage /></MemoryRouter>)
    await user.click(await screen.findByRole('row', { name: /Software/ }))

    await user.click(await screen.findByRole('button', { name: 'Nuevo ciclo' }))
    const dialog = await screen.findByRole('dialog', { name: 'Registrar ciclo' })

    expect(within(dialog).getByRole('textbox', { name: 'Nombre del ciclo(obligatorio)' })).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Número')).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Paralelo')).not.toBeInTheDocument()
  })
})

describe('URL y datos al día de la carrera', () => {
  it('abre la carrera en la URL (?carrera=<id>) y la carga desde un enlace directo', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/panel/careers']}><AcademicPage /><CurrentLocation /></MemoryRouter>)
    await user.click(await screen.findByRole('row', { name: /Software/ }))
    expect(screen.getByTestId('location')).toHaveTextContent('/panel/careers?carrera=10')
    cleanup()

    render(<MemoryRouter initialEntries={['/panel/careers?carrera=10']}><AcademicPage /></MemoryRouter>)
    expect(screen.getByRole('status', { name: 'Cargando carrera' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1, name: 'Software' })).toBeInTheDocument()
  })

  it('avisa si la carrera de la URL no existe y ofrece volver', async () => {
    const user = userEvent.setup()
    vi.mocked(api.listCareers).mockResolvedValue({ data: [], meta: { ...meta, total: 0 } })
    render(<MemoryRouter initialEntries={['/panel/careers?carrera=99']}><AcademicPage /><CurrentLocation /></MemoryRouter>)
    expect(await screen.findByText('No encontramos esta carrera.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver a carreras' }))
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/panel\/careers$/)
  })

  it('muestra los datos guardados apenas se edita la carrera', async () => {
    const user = userEvent.setup()
    vi.mocked(api.listModalities).mockResolvedValue({ data: [{ id: 2, name: 'Virtual', is_active: true }], meta })
    // Como el servidor: la respuesta de editar no trae la modalidad ni los conteos.
    vi.mocked(api.updateCareer).mockResolvedValue({ ...career, modality_id: 2, cycles_count: 0, active_cycles_count: 0, cycle_levels: 0 })
    render(<MemoryRouter><AcademicPage /></MemoryRouter>)
    const form = await openCareerEdit(user)
    const saved = { ...career, modality_id: 2, modality_name: 'Virtual' }
    vi.mocked(api.listCareers).mockResolvedValue({ data: [saved], meta })
    vi.mocked(api.listActiveCareers).mockResolvedValue([saved])
    await choose(user, within(form).getByLabelText(/^Modalidad/), 'Virtual')
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Ingeniería · Virtual')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Datos' }))
    const data = screen.getByRole('tabpanel', { name: 'Datos' })
    expect(within(data).getByText('Virtual')).toBeInTheDocument()
    expect(within(data).getByText('4 ciclos')).toBeInTheDocument()
  })

  it('la cantidad de ciclos de "Editar carrera" incluye los ciclos recién creados', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'createCycle').mockResolvedValue({ id: 5, career_id: 10, name: 'Quinto ciclo', number: 5, status: true, paralelo_id: null, paralelo_name: null })
    render(<MemoryRouter><AcademicPage /></MemoryRouter>)
    await user.click(await screen.findByRole('row', { name: /Software/ }))
    await user.click(await screen.findByRole('button', { name: 'Nuevo ciclo' }))
    const dialog = await screen.findByRole('dialog', { name: 'Registrar ciclo' })
    const grown = { ...career, cycles_count: 5, active_cycles_count: 5, cycle_levels: 5 }
    vi.mocked(api.listCareers).mockResolvedValue({ data: [grown], meta })
    vi.mocked(api.listActiveCareers).mockResolvedValue([grown])
    await user.type(within(dialog).getByLabelText(/^Nombre del ciclo/), 'Quinto ciclo')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar ciclo' }))
    await waitFor(() => expect(api.createCycle).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Registrar ciclo' })).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Editar carrera' }))
    const form = await screen.findByRole('dialog', { name: 'Editar carrera' })
    await waitFor(() => expect(within(form).getByLabelText('Cantidad de ciclos')).toHaveTextContent('5 ciclos'))
  })
})

describe('Carga de las pantallas de carreras', () => {
  it('muestra un solo esqueleto de la lista completa mientras llega la primera página', async () => {
    let resolve: (value: Awaited<ReturnType<typeof api.listCareers>>) => void = () => {}
    vi.mocked(api.listCareers).mockReturnValue(new Promise((done) => { resolve = done }))
    render(<MemoryRouter><AcademicPage /></MemoryRouter>)

    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status', { name: 'Cargando carreras' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Carreras' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nueva carrera' })).not.toBeInTheDocument()

    resolve({ data: [career], meta })
    expect(await screen.findByRole('heading', { name: 'Carreras' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nueva carrera' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: /^Cargando/ })).not.toBeInTheDocument()
  })

  it('la pestaña de ciclos muestra su contenido en esqueleto (sin botones reales) mientras cargan', async () => {
    const user = userEvent.setup()
    let resolve: (value: Awaited<ReturnType<typeof api.listCycles>>) => void = () => {}
    vi.mocked(api.listCycles).mockReturnValue(new Promise((done) => { resolve = done }))
    render(<MemoryRouter><AcademicPage /></MemoryRouter>)
    await user.click(await screen.findByRole('row', { name: /Software/ }))

    expect(await screen.findByRole('status', { name: 'Cargando ciclos' })).toBeInTheDocument()
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Nuevo ciclo' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Buscar ciclo')).not.toBeInTheDocument()

    resolve({ data: [{ id: 1, career_id: 10, name: 'Primer Ciclo', number: 1, status: true, paralelo_id: null, paralelo_name: null }], meta })
    expect(await screen.findByRole('button', { name: 'Nuevo ciclo' })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Primer Ciclo/ })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: /^Cargando/ })).not.toBeInTheDocument()
  })
})
