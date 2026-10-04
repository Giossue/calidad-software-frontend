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
})
afterEach(cleanup)

describe('Edición de carreras', () => {
  it('permite aumentar la cantidad de ciclos pero no quitar los que ya existen', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AcademicPage /></MemoryRouter>)
    await user.click(await screen.findByTitle('Editar carrera'))
    const form = (await screen.findByLabelText('Cantidad de ciclos')).closest('form') as HTMLFormElement
    const select = within(form).getByLabelText('Cantidad de ciclos')
    expect(select).toHaveValue('4')
    expect(within(form).queryByRole('option', { name: '3 ciclos' })).not.toBeInTheDocument()
    await user.selectOptions(select, '6')
    await user.click(within(form).getByRole('button', { name: 'Guardar Cambios' }))
    await waitFor(() => expect(api.updateCareer).toHaveBeenCalledWith(10, expect.objectContaining({ name: 'Software', cycles_count: 6 })))
  })

  it('no envía la cantidad de ciclos si no se modificó', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AcademicPage /></MemoryRouter>)
    await user.click(await screen.findByTitle('Editar carrera'))
    const form = (await screen.findByLabelText('Cantidad de ciclos')).closest('form') as HTMLFormElement
    const name = within(form).getByLabelText('Nombre de la carrera')
    await user.type(name, ' II')
    await user.click(within(form).getByRole('button', { name: 'Guardar Cambios' }))
    await waitFor(() => expect(api.updateCareer).toHaveBeenCalled())
    expect(vi.mocked(api.updateCareer).mock.calls[0][1]).not.toHaveProperty('cycles_count')
  })

  it('muestra "Seleccionar" como valor por defecto de modalidad y valida nombre de carrera duplicado', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AcademicPage /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: 'Nueva carrera' }))

    const dialog = await screen.findByRole('dialog')
    const modalitySelect = within(dialog).getByLabelText('Modalidad')
    expect(within(modalitySelect).getByRole('option', { name: 'Seleccionar' })).toBeInTheDocument()

    // Intentar registrar una carrera con un nombre ya existente ("Software")
    await user.selectOptions(within(dialog).getByLabelText('Facultad Perteneciente'), '1')
    await user.type(within(dialog).getByLabelText('Nombre de la carrera'), 'Software')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar Carrera' }))

    const alertDialog = await screen.findByRole('alertdialog')
    expect(within(alertDialog).getByText('Carrera ya registrada')).toBeInTheDocument()
  })
})

describe('Gestión de ciclos', () => {
  it('no muestra el campo número al registrar o editar un ciclo', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'listCycles').mockResolvedValue({
      data: [{ id: 1, career_id: 10, name: 'Primer Ciclo', number: 1, status: true, paralelo_id: null, paralelo_name: null }],
      meta,
    })
    vi.spyOn(api, 'listSections').mockResolvedValue({ data: [], meta })

    render(<MemoryRouter><AcademicPage /></MemoryRouter>)
    await user.click(await screen.findByTitle('Ver ciclos de esta carrera'))

    await user.click(await screen.findByRole('button', { name: 'Nuevo ciclo' }))
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByLabelText('Nombre del ciclo')).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Número')).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Paralelo')).not.toBeInTheDocument()
  })
})
