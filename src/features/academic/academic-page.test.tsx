import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, type Career } from '@/lib/api'
import { AcademicPage } from './academic-page'

const career: Career = { id: 10, faculty_id: 1, faculty_name: 'Ingeniería', modality_id: null, name: 'Software', status: true, cycles_count: 4, active_cycles_count: 4, cycle_levels: 4 }
const meta = { current_page: 1, last_page: 1, per_page: 15, total: 1, from: 1, to: 1, active_count: 1, inactive_count: 0 }

beforeEach(() => {
  vi.spyOn(api, 'listCareers').mockResolvedValue({ data: [career], meta })
  vi.spyOn(api, 'listActiveFaculties').mockResolvedValue([{ id: 1, name: 'Ingeniería', status: true, is_active: true, careers_count: 1, active_careers_count: 1 }])
  vi.spyOn(api, 'listModalities').mockResolvedValue({ data: [], meta })
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

  it('muestra "Seleccionar" como valor por defecto de modalidad y valida nombre de carrera duplicado', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AcademicPage /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: 'Nueva carrera' }))

    const dialog = await screen.findByRole('dialog', { name: 'Registrar carrera' })
    const modalitySelect = within(dialog).getByLabelText(/^Modalidad/)
    expect(modalitySelect).toHaveTextContent('Seleccionar')

    // Primero el nombre; nombre y facultad son obligatorios.
    expect(dialog.querySelector('label')).toHaveTextContent(/^Nombre de la carrera/)
    expect(within(dialog).getByRole('textbox', { name: 'Nombre de la carrera(obligatorio)' })).toBeInTheDocument()
    expect(within(dialog).getByRole('combobox', { name: 'Facultad(obligatorio)' })).toBeInTheDocument()

    // Intentar registrar una carrera con un nombre ya existente ("Software")
    await user.type(within(dialog).getByLabelText(/^Nombre de la carrera/), 'Software')
    await choose(user, within(dialog).getByLabelText(/^Facultad/), 'Ingeniería')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar carrera' }))

    // El error se muestra una sola vez, en línea dentro del modal (sin otro modal encima).
    expect(await within(dialog).findByText('Carrera ya registrada')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
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
