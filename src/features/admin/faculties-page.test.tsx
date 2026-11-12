import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, type Career, type Faculty } from '@/lib/api'
import { FacultiesPage } from './faculties-page'

const faculty: Faculty = { id: 3, name: 'Facultad de Ingeniería', status: true, is_active: true, careers_count: 2, active_careers_count: 1 }
const career: Career = { id: 10, faculty_id: 3, faculty_name: 'Facultad de Ingeniería', modality_id: 1, modality_name: 'Presencial', name: 'Software', code: null, status: true, cycles_count: 8, active_cycles_count: 8, cycle_levels: 8 }
const meta = { current_page: 1, last_page: 1, per_page: 15, total: 1, from: 1, to: 1, active_count: 1, inactive_count: 0 }

function CurrentLocation() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname}{location.search}</p>
}

beforeEach(() => {
  vi.spyOn(api, 'listFaculties').mockResolvedValue({ data: [faculty], meta })
  vi.spyOn(api, 'listActiveFaculties').mockResolvedValue([faculty])
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

  it('muestra la modalidad de cada carrera, y «—» si una carrera antigua no la tiene', async () => {
    const user = userEvent.setup()
    vi.mocked(api.listCareers).mockResolvedValue({ data: [career, { ...career, id: 11, name: 'Redes', modality_id: null, modality_name: undefined }], meta })
    render(<MemoryRouter><FacultiesPage /></MemoryRouter>)
    await user.click(await screen.findByRole('row', { name: /Facultad de Ingeniería/ }))
    expect(within(await screen.findByRole('row', { name: /Software/ })).getByText('Presencial')).toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: /Redes/ })).getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('Sin modalidad')).not.toBeInTheDocument()
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

  it('abre la facultad en la URL (?facultad=<id>) y la carga al recargar la página', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/panel/faculties']}>
        <FacultiesPage />
        <CurrentLocation />
      </MemoryRouter>,
    )
    await user.click(await screen.findByRole('row', { name: /Facultad de Ingeniería/ }))
    expect(screen.getByTestId('location')).toHaveTextContent('/panel/faculties?facultad=3')
    cleanup()

    // Enlace directo: muestra el esqueleto y luego la facultad.
    render(<MemoryRouter initialEntries={['/panel/faculties?facultad=3']}><FacultiesPage /></MemoryRouter>)
    expect(screen.getByRole('status', { name: 'Cargando facultad' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1, name: 'Facultad de Ingeniería' })).toBeInTheDocument()
  })

  it('avisa si la facultad de la URL no existe y ofrece volver', async () => {
    const user = userEvent.setup()
    vi.mocked(api.listFaculties).mockResolvedValue({ data: [], meta: { ...meta, total: 0 } })
    render(
      <MemoryRouter initialEntries={['/panel/faculties?facultad=99']}>
        <FacultiesPage />
        <CurrentLocation />
      </MemoryRouter>,
    )
    expect(await screen.findByText('No encontramos esta facultad.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver a facultades' }))
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/panel\/faculties$/)
  })

  it('conserva comas y puntos del nombre oficial al editar', async () => {
    const user = userEvent.setup()
    const official = 'Facultad de Ciencias Administrativas, Gestión Empresarial e Informática (FCA).'
    vi.spyOn(api, 'updateFaculty').mockResolvedValue({ ...faculty, name: official })
    render(<MemoryRouter><FacultiesPage /></MemoryRouter>)
    await user.click(await screen.findByRole('row', { name: /Facultad de Ingeniería/ }))
    await user.click(await screen.findByRole('button', { name: 'Editar facultad' }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar facultad' })
    const name = within(dialog).getByLabelText(/^Nombre de la facultad/)
    await user.clear(name)
    await user.type(name, official)
    expect(name).toHaveValue(official)
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(api.updateFaculty).toHaveBeenCalledWith(3, { name: official }))
  })

  it('muestra el error del nombre bajo el campo al salir de él', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><FacultiesPage /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: 'Nueva facultad' }))
    const dialog = await screen.findByRole('dialog', { name: 'Registrar facultad' })
    expect(within(dialog).queryByText('El nombre de la facultad es obligatorio.')).not.toBeInTheDocument()
    await user.click(within(dialog).getByLabelText(/^Nombre de la facultad/))
    await user.tab()
    expect(await within(dialog).findByText('El nombre de la facultad es obligatorio.')).toBeInTheDocument()
    // Sin descripción que repita el campo.
    expect(within(dialog).queryByText('Escribe el nombre con el que aparecerá en el sistema.')).not.toBeInTheDocument()
  })

  it('la fila de una carrera abre la pantalla de esa carrera', async () => {
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
    await user.click(await screen.findByRole('row', { name: /Software/ }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/panel/careers?carrera=10')
  })
})

describe('Carga de las pantallas de facultades', () => {
  it('muestra un solo esqueleto de la lista completa mientras llega la primera página', async () => {
    let resolve: (value: Awaited<ReturnType<typeof api.listFaculties>>) => void = () => {}
    vi.mocked(api.listFaculties).mockReturnValue(new Promise((done) => { resolve = done }))
    render(<MemoryRouter><FacultiesPage /></MemoryRouter>)

    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status', { name: 'Cargando facultades' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Facultades' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nueva facultad' })).not.toBeInTheDocument()

    resolve({ data: [faculty], meta })
    expect(await screen.findByRole('heading', { name: 'Facultades' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nueva facultad' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: /^Cargando/ })).not.toBeInTheDocument()
  })

  it('la facultad sigue en esqueleto (sin encabezado real) hasta que llegan sus carreras', async () => {
    let resolve: (value: Awaited<ReturnType<typeof api.listCareers>>) => void = () => {}
    vi.mocked(api.listCareers).mockReturnValue(new Promise((done) => { resolve = done }))
    render(<MemoryRouter initialEntries={['/panel/faculties?facultad=3']}><FacultiesPage /></MemoryRouter>)

    await waitFor(() => expect(api.listCareers).toHaveBeenCalled())
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status', { name: 'Cargando facultad' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Facultad de Ingeniería' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Administrar carreras' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar facultad' })).not.toBeInTheDocument()

    resolve({ data: [career], meta })
    expect(await screen.findByRole('heading', { level: 1, name: 'Facultad de Ingeniería' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Administrar carreras' })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Software/ })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: /^Cargando/ })).not.toBeInTheDocument()
  })
})
