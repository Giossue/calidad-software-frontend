import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, type Faculty } from '@/lib/api'
import { FacultiesPage } from './faculties-page'

const faculty: Faculty = { id: 3, name: 'Facultad de Ingeniería', status: true, is_active: true, careers_count: 2, active_careers_count: 1 }
const meta = { current_page: 1, last_page: 1, per_page: 15, total: 1, from: 1, to: 1, active_count: 1, inactive_count: 0 }

function CurrentLocation() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname}{location.search}</p>
}

beforeEach(() => {
  vi.spyOn(api, 'listFaculties').mockResolvedValue({ data: [faculty], meta })
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

  it('abre la edición al pulsar la fila', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><FacultiesPage /></MemoryRouter>)
    await user.click(await screen.findByRole('row', { name: /Facultad de Ingeniería/ }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre de la facultad')).toHaveValue('Facultad de Ingeniería')
  })

  it('lleva a las carreras de la facultad desde el menú de la fila', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/panel/faculties']}>
        <Routes>
          <Route path="/panel/faculties" element={<FacultiesPage />} />
          <Route path="/panel/careers" element={<CurrentLocation />} />
        </Routes>
      </MemoryRouter>,
    )
    await user.click(await screen.findByRole('button', { name: 'Acciones para Facultad de Ingeniería' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Ver carreras' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/panel/careers?faculty=3')
  })
})
