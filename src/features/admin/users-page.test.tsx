import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { UsersPage } from '@/features/admin/users-page'
import { api, type Career, type Faculty, type User } from '@/lib/api'

const mockUsers: readonly User[] = [
  {
    id: 1,
    identification: '1710034065',
    name: 'Carlos Docente',
    email: 'carlos@ueb.edu.ec',
    phone: '0991234567',
    role: 'docente',
    is_active: true,
    email_verified_at: '2026-09-01T00:00:00Z',
    has_two_factor: false,
    career_id: 10,
    career_name: 'Ingeniería de Software',
    faculty_id: 1,
    faculty_name: 'Facultad de Ingeniería',
  },
  {
    id: 2,
    identification: '0926687856',
    name: 'Admin Principal',
    email: 'admin@ueb.edu.ec',
    phone: '0997654321',
    role: 'administrador',
    is_active: true,
    email_verified_at: '2026-09-01T00:00:00Z',
    has_two_factor: false,
  },
]

const mockFaculties: readonly Faculty[] = [
  {
    id: 1,
    name: 'Facultad de Ingeniería',
    status: true,
    is_active: true,
    careers_count: 2,
    active_careers_count: 2,
  },
  {
    id: 2,
    name: 'Facultad de Ciencias de la Salud',
    status: true,
    is_active: true,
    careers_count: 1,
    active_careers_count: 1,
  },
]

const mockCareers: readonly Career[] = [
  {
    id: 10,
    faculty_id: 1,
    faculty_name: 'Facultad de Ingeniería',
    name: 'Ingeniería de Software',
    modality_id: 1,
    status: true,
    cycles_count: 8,
    active_cycles_count: 8,
    cycle_levels: 8,
  },
  {
    id: 11,
    faculty_id: 1,
    faculty_name: 'Facultad de Ingeniería',
    name: 'Ingeniería Civil',
    modality_id: 1,
    status: true,
    cycles_count: 9,
    active_cycles_count: 9,
    cycle_levels: 9,
  },
  {
    id: 20,
    faculty_id: 2,
    faculty_name: 'Facultad de Ciencias de la Salud',
    name: 'Enfermería',
    modality_id: 1,
    status: true,
    cycles_count: 8,
    active_cycles_count: 8,
    cycle_levels: 8,
  },
]

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  })

  vi.spyOn(api, 'listUsers').mockResolvedValue({
    data: mockUsers,
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: 15,
      total: 2,
      from: 1,
      to: 2,
      active_count: 2,
      inactive_count: 0,
      admin_count: 1,
      teacher_count: 1,
      student_count: 0,
    },
  })

  vi.spyOn(api, 'listActiveFaculties').mockResolvedValue(mockFaculties)
  vi.spyOn(api, 'listActiveCareers').mockResolvedValue(mockCareers)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Gestión de Usuarios - Selección de Facultad y Carrera', () => {
  it('muestra la carrera en el listado para los usuarios que la tienen asignada', async () => {
    render(<UsersPage />)

    expect(await screen.findByText('Carlos Docente')).toBeInTheDocument()
    expect(screen.getByText('Ingeniería de Software')).toBeInTheDocument()
  })

  it('muestra los selectores de facultad y carrera al elegir rol estudiante o docente, pero no para administrador', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)

    await screen.findByText('Carlos Docente')
    await user.click(screen.getByRole('button', { name: 'Nuevo usuario' }))

    // Al inicio no hay rol seleccionado: no se muestra facultad ni carrera
    expect(screen.queryByLabelText('Facultad')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Carrera')).not.toBeInTheDocument()

    // Si se selecciona un rol no-admin (ej. docente): aparecen los selectores
    const roleSelect = screen.getByLabelText('Rol en el sistema')
    await user.selectOptions(roleSelect, 'docente')

    expect(await screen.findByLabelText('Facultad')).toBeInTheDocument()
    expect(screen.getByLabelText('Carrera')).toBeInTheDocument()

    // Si se cambia a administrador: se ocultan los selectores
    await user.selectOptions(roleSelect, 'administrador')
    expect(screen.queryByLabelText('Facultad')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Carrera')).not.toBeInTheDocument()

    // Si se vuelve a seleccionar estudiante: se vuelven a mostrar
    await user.selectOptions(roleSelect, 'estudiante')
    expect(screen.getByLabelText('Facultad')).toBeInTheDocument()
    expect(screen.getByLabelText('Carrera')).toBeInTheDocument()
  })

  it('filtra las carreras según la facultad seleccionada', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)

    await screen.findByText('Carlos Docente')
    await user.click(screen.getByRole('button', { name: 'Nuevo usuario' }))

    await user.selectOptions(screen.getByLabelText('Rol en el sistema'), 'coordinador_carrera')

    const facultySelect = await screen.findByLabelText('Facultad')
    const careerSelect = screen.getByLabelText('Carrera')

    // Antes de elegir facultad, la carrera no tiene opciones de carrera
    expect(careerSelect).toBeDisabled()

    // Al elegir Facultad de Ingeniería (id 1)
    await user.selectOptions(facultySelect, '1')
    expect(careerSelect).not.toBeDisabled()

    // Debe contener Software y Civil, pero no Enfermería
    expect(screen.getByRole('option', { name: 'Ingeniería de Software' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Ingeniería Civil' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Enfermería' })).not.toBeInTheDocument()

    // Al cambiar a Ciencias de la Salud (id 2)
    await user.selectOptions(facultySelect, '2')
    expect(screen.getByRole('option', { name: 'Enfermería' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Ingeniería de Software' })).not.toBeInTheDocument()
  })

  it('envía faculty_id y career_id al registrar un nuevo usuario con rol académico', async () => {
    const user = userEvent.setup()
    const createSpy = vi.spyOn(api, 'createUser').mockResolvedValue({
      id: 3,
      identification: '1710034065',
      name: 'Estudiante Nuevo',
      email: 'estudiante@ueb.edu.ec',
      phone: '0987654321',
      role: 'estudiante',
      is_active: true,
      email_verified_at: null,
      has_two_factor: false,
      career_id: 10,
      faculty_id: 1,
    })

    render(<UsersPage />)
    await screen.findByText('Carlos Docente')

    await user.click(screen.getByRole('button', { name: 'Nuevo usuario' }))

    await user.type(screen.getByLabelText('Cédula'), '1710034065')
    await user.type(screen.getByLabelText('Nombre completo'), 'Estudiante Nuevo')
    await user.type(screen.getByLabelText('Correo electrónico institucional'), 'estudiante@ueb.edu.ec')
    await user.type(screen.getByLabelText('Teléfono'), '0987654321')
    await user.selectOptions(screen.getByLabelText('Rol en el sistema'), 'estudiante')

    await user.selectOptions(await screen.findByLabelText('Facultad'), '1')
    await user.selectOptions(screen.getByLabelText('Carrera'), '10')

    await user.click(screen.getByRole('button', { name: 'Registrar Usuario' }))

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          identification: '1710034065',
          name: 'Estudiante Nuevo',
          email: 'estudiante@ueb.edu.ec',
          phone: '0987654321',
          role: 'estudiante',
          faculty_id: 1,
          career_id: 10,
        })
      )
    })
  }, 15000)

  it('permite editar a un usuario y actualizar su rol y carrera', async () => {
    const user = userEvent.setup()
    const updateSpy = vi.spyOn(api, 'updateUser').mockResolvedValue({
      ...mockUsers[0],
      role: 'coordinador_carrera',
      career_id: 11,
      faculty_id: 1,
    })

    render(<UsersPage />)
    await screen.findByText('Carlos Docente')

    // Clic en editar el primer usuario
    const editButtons = screen.getAllByTitle('Editar usuario')
    await user.click(editButtons[0])

    expect(await screen.findByText('Editar Usuario')).toBeInTheDocument()

    // Cambiar a Coordinador de carrera y seleccionar otra carrera
    await user.selectOptions(screen.getByLabelText('Rol en el sistema'), 'coordinador_carrera')
    await user.selectOptions(screen.getByLabelText('Carrera'), '11')

    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          role: 'coordinador_carrera',
          faculty_id: 1,
          career_id: 11,
        })
      )
    })
  }, 15000)
})

