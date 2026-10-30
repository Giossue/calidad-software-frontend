import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { UsersPage } from '@/features/admin/users-page'
import { api, type Career, type Faculty, type User } from '@/lib/api'

// Los selects son de shadcn (Radix): se abren y se elige la opción por su texto.
async function choose(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, option: string) {
  await user.click(trigger)
  await user.click(await screen.findByRole('option', { name: option }))
}

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

  it('muestra como pendientes a las cuentas que aún no completan sus datos', async () => {
    const base = mockUsers[0]
    vi.mocked(api.listUsers).mockResolvedValue({
      data: [
        base,
        { ...base, id: 3, name: 'Ana Importada', identification: null, must_complete_profile: true, must_change_password: true },
        { ...base, id: 4, name: 'Luis Sin Cedula', identification: null, must_complete_profile: true, must_change_password: false },
        { ...base, id: 5, name: 'Eva Inactiva', is_active: false },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 4, from: 1, to: 4, active_count: 3, inactive_count: 1, admin_count: 0, career_coordinator_count: 0, degree_coordinator_count: 0, teacher_count: 4, student_count: 0 },
    })

    render(<UsersPage />)
    const rowOf = async (name: string) => within((await screen.findByText(name)).closest('tr') as HTMLElement)

    expect((await rowOf('Carlos Docente')).getByText('Activo')).toBeInTheDocument()
    expect((await rowOf('Ana Importada')).getByText('Correo enviado')).toBeInTheDocument()
    expect((await rowOf('Luis Sin Cedula')).getByText('Datos pendientes')).toBeInTheDocument()
    expect((await rowOf('Eva Inactiva')).getByText('Inactivo')).toBeInTheDocument()
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
    await choose(user, roleSelect, 'Docente')
    expect(screen.queryByLabelText('Facultad')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Carrera')).not.toBeInTheDocument()

    // Si se cambia a administrador: tampoco se muestran los selectores
    await choose(user, roleSelect, 'Administrador')
    expect(screen.queryByLabelText('Facultad')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Carrera')).not.toBeInTheDocument()

    // Si se selecciona estudiante: se muestran facultad y carrera
    await choose(user, roleSelect, 'Estudiante')
    expect(await screen.findByLabelText('Facultad')).toBeInTheDocument()
    expect(screen.getByLabelText('Carrera')).toBeInTheDocument()
  })

  it('filtra las carreras según la facultad seleccionada', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)

    await screen.findByText('Carlos Docente')
    await user.click(screen.getByRole('button', { name: 'Nuevo usuario' }))

    await choose(user, screen.getByLabelText('Rol en el sistema'), 'Coordinador de carrera')

    const facultySelect = await screen.findByLabelText('Facultad')
    const careerSelect = screen.getByLabelText('Carrera')

    // Antes de elegir facultad, la carrera no tiene opciones de carrera
    expect(careerSelect).toBeDisabled()

    // Al elegir Facultad de Ingeniería
    await choose(user, facultySelect, 'Facultad de Ingeniería')
    expect(careerSelect).not.toBeDisabled()

    // Debe contener Software y Civil, pero no Enfermería
    await user.click(careerSelect)
    expect(await screen.findByRole('option', { name: 'Ingeniería de Software' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Ingeniería Civil' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Enfermería' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')

    // Al cambiar a Ciencias de la Salud
    await choose(user, facultySelect, 'Facultad de Ciencias de la Salud')
    await user.click(careerSelect)
    expect(await screen.findByRole('option', { name: 'Enfermería' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Ingeniería de Software' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
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
    await choose(user, screen.getByLabelText('Rol en el sistema'), 'Estudiante')

    await choose(user, await screen.findByLabelText('Facultad'), 'Facultad de Ingeniería')
    await choose(user, screen.getByLabelText('Carrera'), 'Ingeniería de Software')

    // El ciclo es obligatorio para estudiantes; el último de la carrera es titulación.
    const cycleSelect = screen.getByLabelText('Ciclo')
    await user.click(cycleSelect)
    expect(await screen.findByRole('option', { name: 'Ciclo 8 · Titulación' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Ciclo 7 · Tutorías' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Ciclo 9/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'Ciclo 8 · Titulación' }))

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

    // Clic en la fila: el panel de edición se abre bajo la tabla
    await user.click(screen.getByRole('row', { name: /Carlos Docente/ }))

    expect(await screen.findByText('Editar Usuario')).toBeInTheDocument()

    // Cambiar a Coordinador de carrera y seleccionar otra carrera
    await choose(user, screen.getByLabelText('Rol en el sistema'), 'Coordinador de carrera')
    await choose(user, screen.getByLabelText('Facultad'), 'Facultad de Ingeniería')
    await choose(user, screen.getByLabelText('Carrera'), 'Ingeniería Civil')

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

  it('solo habilita "Guardar Cambios" cuando hay cambios y el formulario es válido', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)
    await screen.findByText('Carlos Docente')

    await user.click(screen.getByRole('row', { name: /Carlos Docente/ }))
    const save = await screen.findByRole('button', { name: 'Guardar Cambios' })

    // Sin cambios: deshabilitado
    expect(save).toBeDisabled()

    // Con un cambio válido: habilitado
    const name = screen.getByLabelText('Nombre completo')
    await user.type(name, ' Prueba')
    expect(save).toBeEnabled()

    // Con un dato inválido: deshabilitado otra vez
    await user.clear(name)
    expect(save).toBeDisabled()
  })

  it('permite mostrar y ocultar la nueva contraseña al editar un usuario', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)
    await screen.findByText('Carlos Docente')

    await user.click(screen.getByRole('row', { name: /Carlos Docente/ }))
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
    await choose(user, screen.getByLabelText('Rol en el sistema'), 'Docente')

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

  it('permite editar a un usuario con teléfono vacío manteniendo el teléfono anterior', async () => {
    const user = userEvent.setup()
    const updateSpy = vi.spyOn(api, 'updateUser').mockResolvedValue(mockUsers[0])

    render(<UsersPage />)
    await screen.findByText('Carlos Docente')

    await user.click(screen.getByRole('row', { name: /Carlos Docente/ }))

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

