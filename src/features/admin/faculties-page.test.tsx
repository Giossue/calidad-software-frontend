import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, type Career, type Faculty } from '@/lib/api'
import { FacultiesPage } from './faculties-page'

const faculty: Faculty = { id: 3, name: 'Facultad de Ingeniería', status: true, is_active: true, careers_count: 2, active_careers_count: 1 }
const career: Career = { id: 10, faculty_id: 3, faculty_name: 'Facultad de Ingeniería', modality_id: 1, modality_name: 'Presencial', name: 'Software', status: true, cycles_count: 8, active_cycles_count: 8, cycle_levels: 8 }
const meta = { current_page: 1, last_page: 1, per_page: 15, total: 1, from: 1, to: 1, active_count: 1, inactive_count: 0 }

function CurrentLocation() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname}{location.search}</p>
}

beforeEach(() => {
  vi.spyOn(api, 'listFaculties').mockResolvedValue({ data: [faculty], meta })
  vi.spyOn(api, 'listCareers').mockResolvedValue({ data: [career], meta })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Facultades', () => {
  it('muestra cuántas carreras activas tiene cada facultad', async () => {
    render(<MemoryRouter><FacultiesPage /></MemoryRouter>)
    expect(await screen.findByText('1 de 2 carreras activa')).toBeInTheDocument()
  })

  it('la fila abre la pantalla de la facultad, sin columna de acciones', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><FacultiesPage /></MemoryRouter>)
    await screen.findByRole('row', { name: /Facultad de Ingeniería/ })
    expect(screen.queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Acciones para Facultad de Ingeniería' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('row', { name: /Facultad de Ingeniería/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Facultad de Ingeniería' })).toBeInTheDocument()
    expect(await screen.findByRole('row', { name: /Software/ })).toBeInTheDocument()
    expect(api.listCareers).toHaveBeenCalledWith(expect.objectContaining({ facultyId: 3 }))
    // Tiene carreras activas: no se puede desactivar
    expect(screen.getByRole('button', { name: 'Desactivar facultad' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Volver a facultades' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Facultades' })).toBeInTheDocument()
  })

  it('edita el nombre desde la pantalla de la facultad', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'updateFaculty').mockResolvedValue({ ...faculty, name: 'Facultad de Ingenierías' })
    render(<MemoryRouter><FacultiesPage /></MemoryRouter>)
    await user.click(await screen.findByRole('row', { name: /Facultad de Ingeniería/ }))
    await user.click(await screen.findByRole('button', { name: 'Editar facultad' }))

    const dialog = await screen.findByRole('dialog', { name: 'Editar facultad' })
    const name = within(dialog).getByLabelText(/^Nombre de la facultad/)
    expect(name).toHaveValue('Facultad de Ingeniería')
    expect(name).toHaveAccessibleName('Nombre de la facultad(obligatorio)')
    await user.type(name, 's')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(api.updateFaculty).toHaveBeenCalledWith(3, { name: 'Facultad de Ingenierías' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Facultad de Ingenierías' })).toBeInTheDocument()
  })

  it('lleva a las carreras de la facultad desde su pantalla', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/panel/faculties']}>
        <Routes>
          <Route path="/panel/faculties" element={<FacultiesPage />} />
          <Route path="/panel/careers" element={<CurrentLocation />} />
        </Routes>
      </MemoryRouter>,
    )
    await user.click(await screen.findByRole('row', { name: /Facultad de Ingeniería/ }))
    await user.click(await screen.findByRole('button', { name: 'Administrar carreras' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/panel/careers?faculty=3')
  })
})
