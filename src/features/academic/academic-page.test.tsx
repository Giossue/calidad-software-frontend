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
})
