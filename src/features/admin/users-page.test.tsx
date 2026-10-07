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
      career_coordinator_count: 3,
      degree_coordinator_count: 2,
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

  it('muestra los selectores de facultad y carrera al elegir rol estudiante, pero no para administrador ni docente', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)

    await screen.findByText('Carlos Docente')
    await user.click(screen.getByRole('button', { name: 'Nuevo usuario' }))

    // Al inicio no hay rol seleccionado: no se muestra facultad ni carrera
    expect(screen.queryByLabelText('Facultad')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Carrera')).not.toBeInTheDocument()

    // Si se selecciona docente: tampoco se muestra facultad ni carrera
    const roleSelect = screen.getByLabelText('Rol en el sistema')
    await user.selectOptions(roleSelect, 'docente')
    expect(screen.queryByLabelText('Facultad')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Carrera')).not.toBeInTheDocument()

    // Si se cambia a administrador: tampoco se muestran los selectores
    await user.selectOptions(roleSelect, 'administrador')
    expect(screen.queryByLabelText('Facultad')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Carrera')).not.toBeInTheDocument()

    // Si se selecciona estudiante: se muestran facultad y carrera
    await user.selectOptions(roleSelect, 'estudiante')
    expect(await screen.findByLabelText('Facultad')).toBeInTheDocument()
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

    await user.type(screen.getByLabelText('Cédula o pasaporte'), '1710034065')
    await user.type(screen.getByLabelText('Nombre completo'), 'Estudiante Nuevo')
    await user.type(screen.getByLabelText('Correo electrónico institucional'), 'estudiante@ueb.edu.ec')
    await user.type(screen.getByLabelText('Teléfono'), '0987654321')
    await user.selectOptions(screen.getByLabelText('Rol en el sistema'), 'estudiante')

    await user.selectOptions(await screen.findByLabelText('Facultad'), '1')
    await user.selectOptions(screen.getByLabelText('Carrera'), '10')

    // El ciclo es obligatorio para estudiantes; el último de la carrera es titulación.
    const cycleSelect = screen.getByLabelText('Ciclo')
    expect(screen.getByRole('option', { name: 'Ciclo 8 · Titulación' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Ciclo 7 · Tutorías' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Ciclo 9/ })).not.toBeInTheDocument()
    await user.selectOptions(cycleSelect, '8')

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
          cycle_number: 8,
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
    await user.selectOptions(screen.getByLabelText('Facultad'), '1')
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

  it('permite mostrar y ocultar la nueva contraseña al editar un usuario', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)
    await screen.findByText('Carlos Docente')

    await user.click(screen.getAllByTitle('Editar usuario')[0])
    expect(await screen.findByText('Editar Usuario')).toBeInTheDocument()

    const password = screen.getByLabelText('Nueva Contraseña (Opcional)')
    const confirmation = screen.getByLabelText('Confirmar nueva contraseña')
    await user.type(password, 'Clave$egura1')
    expect(password).toHaveAttribute('type', 'password')

    const [showPassword, showConfirmation] = screen.getAllByRole('button', { name: 'Mostrar contraseña' })
    await user.click(showPassword)
    expect(password).toHaveAttribute('type', 'text')
    expect(password).toHaveValue('Clave$egura1')
    expect(confirmation).toHaveAttribute('type', 'password')

    await user.click(showConfirmation)
    expect(confirmation).toHaveAttribute('type', 'text')

    await user.click(screen.getAllByRole('button', { name: 'Ocultar contraseña' })[0])
    expect(password).toHaveAttribute('type', 'password')
  })

  it('registra un docente sin requerir ni enviar facultad ni carrera', async () => {
    const user = userEvent.setup()
    const createSpy = vi.spyOn(api, 'createUser').mockResolvedValue({
      id: 4,
      identification: '1710034065',
      name: 'Docente Nuevo',
      email: 'docente_nuevo@ueb.edu.ec',
      phone: '0987654321',
      role: 'docente',
      is_active: true,
      email_verified_at: null,
      has_two_factor: false,
    })

    render(<UsersPage />)
    await screen.findByText('Carlos Docente')

    await user.click(screen.getByRole('button', { name: 'Nuevo usuario' }))
    expect(await screen.findByText('Registrar Nuevo Usuario')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Cédula o pasaporte'), '1710034065')
    await user.type(screen.getByLabelText('Nombre completo'), 'Docente Nuevo')
    await user.type(screen.getByLabelText('Correo electrónico institucional'), 'docente_nuevo@ueb.edu.ec')
    await user.type(screen.getByLabelText('Teléfono'), '0987654321')
    await user.selectOptions(screen.getByLabelText('Rol en el sistema'), 'docente')

    expect(screen.queryByLabelText('Facultad')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Carrera')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Registrar Usuario' }))

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({
        identification: '1710034065',
        name: 'Docente Nuevo',
        email: 'docente_nuevo@ueb.edu.ec',
        phone: '0987654321',
        role: 'docente',
        faculty_id: null,
        career_id: null,
      })
    })
  })

  it('muestra tarjetas estadísticas para coordinadores de carrera y titulación', async () => {
    render(<UsersPage />)

    const coordCarreraLabel = await screen.findByText('Coord. Carrera')
    expect(coordCarreraLabel).toBeInTheDocument()
    expect(coordCarreraLabel.closest('div')?.querySelector('.text-2xl')?.textContent).toBe('3')

    const coordTitulacionLabel = screen.getByText('Coord. Titulación')
    expect(coordTitulacionLabel).toBeInTheDocument()
    expect(coordTitulacionLabel.closest('div')?.querySelector('.text-2xl')?.textContent).toBe('2')
  })

  it('permite editar a un usuario con teléfono vacío manteniendo el teléfono anterior', async () => {
    const user = userEvent.setup()
    const updateSpy = vi.spyOn(api, 'updateUser').mockResolvedValue(mockUsers[0])

    render(<UsersPage />)
    await screen.findByText('Carlos Docente')

    const editButtons = screen.getAllByTitle('Editar usuario')
    await user.click(editButtons[0])

    expect(await screen.findByText('Editar Usuario')).toBeInTheDocument()

    // Vaciar el campo teléfono
    const phoneInput = screen.getByLabelText(/Teléfono/i)
    await user.clear(phoneInput)
    expect(phoneInput).not.toBeRequired()

    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          // Mantiene el teléfono anterior ('0991234567') porque se dejó vacío
          phone: '0991234567',
        })
      )
    })
  }, 15000)
})

