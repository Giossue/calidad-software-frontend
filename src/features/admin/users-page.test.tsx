import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { toast } from 'sonner'

import { UsersPage } from '@/features/admin/users-page'
import { api, ApiError, type Career, type Faculty, type User } from '@/lib/api'

// Los selects son de shadcn (Radix): se abren y se elige la opción por su texto.
async function choose(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, option: string) {
  await user.click(trigger)
  await user.click(await screen.findByRole('option', { name: option }))
}

// Paso 1 del registro: datos personales (nombres y apellidos van primero).
async function fillPersonalData(user: ReturnType<typeof userEvent.setup>, scope: Pick<typeof screen, 'getByLabelText'> = screen, email = 'nuevo@ueb.edu.ec', firstNames = 'Ana María', lastNames = 'Torres Vera') {
  await user.type(scope.getByLabelText(/^Nombres/), firstNames)
  await user.type(scope.getByLabelText(/^Apellidos/), lastNames)
  await user.type(scope.getByLabelText(/^Cédula o pasaporte/), '1710034065')
  await user.type(scope.getByLabelText(/^Correo electrónico institucional/), email)
  await user.type(scope.getByLabelText(/^Teléfono/), '0987654321')
}

async function next(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Siguiente' }))
}

const mockUsers: readonly User[] = [
  {
    id: 1,
    identification: '1710034065',
    name: 'Docente Ruiz Carlos',
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
    code: 'SW-2020',
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
    code: 'IC-2020',
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
    code: 'ENF-2020',
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

    expect(await screen.findByText('Docente Ruiz Carlos')).toBeInTheDocument()
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

    expect((await rowOf('Docente Ruiz Carlos')).getByText('Activo')).toBeInTheDocument()
    expect((await rowOf('Ana Importada')).getByText('Correo enviado')).toBeInTheDocument()
    expect((await rowOf('Luis Sin Cedula')).getByText('Datos pendientes')).toBeInTheDocument()
    expect((await rowOf('Eva Inactiva')).getByText('Inactivo')).toBeInTheDocument()
  })

  it('muestra los selectores de facultad y carrera al elegir rol estudiante, pero no para administrador ni docente', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)

    await screen.findByText('Docente Ruiz Carlos')
    await user.click(screen.getByRole('button', { name: 'Nuevo usuario' }))
    await fillPersonalData(user)
    await next(user)

    // Al inicio no hay rol seleccionado: no se muestra facultad ni carrera
    expect(screen.queryByLabelText(/^Facultad/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Carrera/)).not.toBeInTheDocument()

    // Si se selecciona docente: tampoco se muestra facultad ni carrera
    const roleSelect = screen.getByLabelText(/^Rol en el sistema/)
    await choose(user, roleSelect, 'Docente')
    expect(screen.queryByLabelText(/^Facultad/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Carrera/)).not.toBeInTheDocument()

    // Si se cambia a administrador: tampoco se muestran los selectores
    await choose(user, roleSelect, 'Administrador')
    expect(screen.queryByLabelText(/^Facultad/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Carrera/)).not.toBeInTheDocument()

    // Si se selecciona estudiante: se muestran facultad y carrera
    await choose(user, roleSelect, 'Estudiante')
    expect(await screen.findByLabelText(/^Facultad/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Carrera/)).toBeInTheDocument()
  })

  it('filtra las carreras según la facultad seleccionada', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)

    await screen.findByText('Docente Ruiz Carlos')
    await user.click(screen.getByRole('button', { name: 'Nuevo usuario' }))
    await fillPersonalData(user)
    await next(user)

    await choose(user, screen.getByLabelText(/^Rol en el sistema/), 'Coordinador de carrera')

    const facultySelect = await screen.findByLabelText(/^Facultad/)
    const careerSelect = screen.getByLabelText(/^Carrera/)

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

  it('distingue por código las carreras que comparten nombre (otra malla)', async () => {
    vi.mocked(api.listActiveCareers).mockResolvedValue([
      ...mockCareers,
      { ...mockCareers[0], id: 12, code: 'SW-2024' },
    ])
    const user = userEvent.setup()
    render(<UsersPage />)

    await screen.findByText('Docente Ruiz Carlos')
    await user.click(screen.getByRole('button', { name: 'Nuevo usuario' }))
    await fillPersonalData(user)
    await next(user)
    await choose(user, screen.getByLabelText(/^Rol en el sistema/), 'Coordinador de carrera')
    await choose(user, await screen.findByLabelText(/^Facultad/), 'Facultad de Ingeniería')

    await user.click(screen.getByLabelText(/^Carrera/))
    expect(await screen.findByRole('option', { name: 'Ingeniería de Software · SW-2020' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Ingeniería de Software · SW-2024' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Ingeniería Civil' })).toBeInTheDocument()
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
    await screen.findByText('Docente Ruiz Carlos')

    await user.click(screen.getByRole('button', { name: 'Nuevo usuario' }))

    await fillPersonalData(user, screen, 'estudiante@ueb.edu.ec', 'Lucía', 'Mora Paz')
    await next(user)
    await choose(user, screen.getByLabelText(/^Rol en el sistema/), 'Estudiante')

    await choose(user, await screen.findByLabelText(/^Facultad/), 'Facultad de Ingeniería')
    await choose(user, screen.getByLabelText(/^Carrera/), 'Ingeniería de Software')

    // El ciclo es obligatorio para estudiantes; el último de la carrera es titulación.
    const cycleSelect = screen.getByLabelText(/^Ciclo/)
    await user.click(cycleSelect)
    expect(await screen.findByRole('option', { name: 'Ciclo 8 · Titulación' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Ciclo 7 · Tutorías' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Ciclo 9/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'Ciclo 8 · Titulación' }))

    await user.click(screen.getByRole('button', { name: 'Registrar usuario' }))

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          identification: '1710034065',
          first_names: 'Lucía',
          last_names: 'Mora Paz',
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
    await screen.findByText('Docente Ruiz Carlos')

    // Clic en la fila: el panel de edición se abre bajo la tabla
    await user.click(screen.getByRole('row', { name: /Docente Ruiz Carlos/ }))

    expect(await screen.findByRole('dialog', { name: 'Editar usuario' })).toBeInTheDocument()
    // Nombres y apellidos precargados desde el nombre guardado (apellidos y nombres).
    expect(screen.getByLabelText(/^Nombres/)).toHaveValue('Carlos')
    expect(screen.getByLabelText(/^Apellidos/)).toHaveValue('Docente Ruiz')
    // Al editar no hay pasos: datos, rol y contraseña se ven juntos.
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Rol en el sistema/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Nueva contraseña/)).toBeInTheDocument()

    // Cambiar a Coordinador de carrera y seleccionar otra carrera
    await choose(user, screen.getByLabelText(/^Rol en el sistema/), 'Coordinador de carrera')
    await choose(user, screen.getByLabelText(/^Facultad/), 'Facultad de Ingeniería')
    await choose(user, screen.getByLabelText(/^Carrera/), 'Ingeniería Civil')

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

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
    // Sin cambiar los nombres precargados, no se envían.
    expect(updateSpy.mock.calls[0][1]).not.toHaveProperty('first_names')
    expect(updateSpy.mock.calls[0][1]).not.toHaveProperty('last_names')
  }, 15000)

  it('al editar, envía nombres y apellidos cuando se cambian', async () => {
    const user = userEvent.setup()
    const updateSpy = vi.spyOn(api, 'updateUser').mockResolvedValue(mockUsers[0])
    render(<UsersPage />)
    await user.click(await screen.findByRole('row', { name: /Docente Ruiz Carlos/ }))
    await screen.findByRole('dialog', { name: 'Editar usuario' })

    const firstNames = screen.getByLabelText(/^Nombres/)
    await user.clear(firstNames)
    await user.type(firstNames, ' Carlos  Andrés ')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(1, expect.objectContaining({ first_names: 'Carlos Andrés', last_names: 'Docente Ruiz' }))
    })
  }, 15000)

  it('al editar, bloquea "Guardar cambios" con un dato inválido y solo lo habilita cuando hay cambios', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)
    await screen.findByText('Docente Ruiz Carlos')

    await user.click(screen.getByRole('row', { name: /Docente Ruiz Carlos/ }))
    await screen.findByRole('dialog', { name: 'Editar usuario' })
    const nextButton = screen.getByRole('button', { name: 'Guardar cambios' })
    // Sin cambios no hay nada que guardar.
    expect(nextButton).toBeDisabled()

    // Con un dato inválido: "Guardar cambios" se bloquea y dice qué falta
    const firstNames = screen.getByLabelText(/^Nombres/)
    await user.clear(firstNames)
    expect(nextButton).toBeDisabled()
    await user.hover(nextButton.parentElement as HTMLElement)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Los nombres son obligatorios.')
    await user.unhover(nextButton.parentElement as HTMLElement)

    // Más de dos nombres tampoco se aceptan
    await user.type(firstNames, 'Carlos Andrés José')
    expect(nextButton).toBeDisabled()
    await user.hover(nextButton.parentElement as HTMLElement)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Ingresa uno o dos nombres.')
    await user.unhover(nextButton.parentElement as HTMLElement)

    // Sin apellidos también se bloquea
    await user.clear(firstNames)
    await user.type(firstNames, 'Carlos Andrés')
    const lastNames = screen.getByLabelText(/^Apellidos/)
    await user.clear(lastNames)
    expect(nextButton).toBeDisabled()
    await user.hover(nextButton.parentElement as HTMLElement)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Los apellidos son obligatorios.')
    await user.unhover(nextButton.parentElement as HTMLElement)

    // Con un cambio válido, "Guardar cambios" se habilita
    await user.type(lastNames, 'Docente Ruiz')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
  })

  it('sin cambios, "Guardar cambios" queda bloqueado en el último paso', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)
    await screen.findByText('Docente Ruiz Carlos')

    await user.click(screen.getByRole('row', { name: /Docente Ruiz Carlos/ }))
    await screen.findByRole('dialog', { name: 'Editar usuario' })
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  })

  it('registra por pasos, con nombres y apellidos primero y los obligatorios marcados', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)
    await screen.findByText('Docente Ruiz Carlos')

    await user.click(screen.getByRole('button', { name: 'Nuevo usuario' }))
    const dialog = await screen.findByRole('dialog', { name: 'Registrar usuario' })

    expect(within(dialog).getByRole('group', { name: 'Datos personales' })).toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/^Nombre completo/)).not.toBeInTheDocument()
    const [firstNames, lastNames] = within(dialog).getAllByRole('textbox')
    expect(firstNames).toHaveAccessibleName('Nombres(obligatorio)')
    expect(lastNames).toHaveAccessibleName('Apellidos(obligatorio)')
    expect(within(dialog).getByRole('textbox', { name: 'Cédula o pasaporte(obligatorio)' })).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: 'Correo electrónico institucional(obligatorio)' })).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: 'Teléfono(obligatorio)' })).toBeInTheDocument()
    // El rol va en el segundo paso
    expect(within(dialog).queryByLabelText(/^Rol en el sistema/)).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Siguiente' })).toBeDisabled()

    await fillPersonalData(user, within(dialog))
    await next(user)
    expect(within(dialog).getByRole('group', { name: 'Rol y carrera' })).toBeInTheDocument()
    expect(within(dialog).getByRole('combobox', { name: 'Rol en el sistema(obligatorio)' })).toBeInTheDocument()
  })

  it('permite mostrar y ocultar la nueva contraseña al editar un usuario', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)
    await screen.findByText('Docente Ruiz Carlos')

    await user.click(screen.getByRole('row', { name: /Docente Ruiz Carlos/ }))
    expect(await screen.findByRole('dialog', { name: 'Editar usuario' })).toBeInTheDocument()

    const password = screen.getByLabelText(/^Nueva contraseña/)
    const confirmation = screen.getByLabelText(/^Confirmar nueva contraseña/)
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
    await screen.findByText('Docente Ruiz Carlos')

    await user.click(screen.getByRole('button', { name: 'Nuevo usuario' }))
    expect(await screen.findByRole('dialog', { name: 'Registrar usuario' })).toBeInTheDocument()

    await fillPersonalData(user, screen, 'docente_nuevo@ueb.edu.ec', ' Ana  María ', 'Torres Vera')
    await next(user)
    await choose(user, screen.getByLabelText(/^Rol en el sistema/), 'Docente')

    expect(screen.queryByLabelText(/^Facultad/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Carrera/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Registrar usuario' }))

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({
        identification: '1710034065',
        first_names: 'Ana María',
        last_names: 'Torres Vera',
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
    await screen.findByText('Docente Ruiz Carlos')

    await user.click(screen.getByRole('row', { name: /Docente Ruiz Carlos/ }))

    expect(await screen.findByRole('dialog', { name: 'Editar usuario' })).toBeInTheDocument()

    // Vaciar el campo teléfono: se puede dejar vacío (se conserva el anterior), así que la cuenta
    // nunca se queda sin teléfono y la etiqueta lo marca como obligatorio.
    const phoneInput = screen.getByLabelText(/Teléfono/i)
    await user.clear(phoneInput)
    expect(phoneInput).not.toBeRequired()
    expect(phoneInput).toHaveAccessibleName('Teléfono(obligatorio)')
    expect(phoneInput).toHaveAttribute('placeholder', 'Anterior: 0991234567')

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          // Mantiene el teléfono anterior ('0991234567') porque se dejó vacío
          phone: '0991234567',
        })
      )
    })
    expect(updateSpy.mock.calls[0][1]).not.toHaveProperty('name')
  }, 15000)

  it('al editar una cuenta cuyo nombre no se puede separar, cambiar solo el teléfono guarda sin enviar nombres', async () => {
    const user = userEvent.setup()
    const updateSpy = vi.spyOn(api, 'updateUser').mockResolvedValue({ ...mockUsers[0], name: 'Carlos Docente' })
    vi.mocked(api.listUsers).mockResolvedValue({
      data: [{ ...mockUsers[0], name: 'Carlos Docente' }],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 1, from: 1, to: 1, active_count: 1, inactive_count: 0, admin_count: 0, career_coordinator_count: 0, degree_coordinator_count: 0, teacher_count: 1, student_count: 0 },
    })
    render(<UsersPage />)
    await user.click(await screen.findByRole('row', { name: /Carlos Docente/ }))
    await screen.findByRole('dialog', { name: 'Editar usuario' })

    // Con dos palabras no se sabe cuál es el nombre y cuál el apellido: quedan vacíos,
    // pero sin tocarlos no bloquean (se conserva el nombre guardado).
    expect(screen.getByLabelText(/^Nombres/)).toHaveValue('')
    expect(screen.getByLabelText(/^Apellidos/)).toHaveValue('')

    const phone = screen.getByLabelText(/^Teléfono/)
    await user.clear(phone)
    await user.type(phone, '0987654321')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith(1, expect.objectContaining({ phone: '0987654321' })))
    expect(updateSpy.mock.calls[0][1]).not.toHaveProperty('first_names')
    expect(updateSpy.mock.calls[0][1]).not.toHaveProperty('last_names')
  }, 15000)

  it('al editar una cuenta cuyo nombre no se puede separar, escribir los nombres exige también los apellidos', async () => {
    const user = userEvent.setup()
    vi.mocked(api.listUsers).mockResolvedValue({
      data: [{ ...mockUsers[0], name: 'Carlos Docente' }],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 1, from: 1, to: 1, active_count: 1, inactive_count: 0, admin_count: 0, career_coordinator_count: 0, degree_coordinator_count: 0, teacher_count: 1, student_count: 0 },
    })
    render(<UsersPage />)
    await user.click(await screen.findByRole('row', { name: /Carlos Docente/ }))
    await screen.findByRole('dialog', { name: 'Editar usuario' })

    await user.type(screen.getByLabelText(/^Nombres/), 'Carlos')
    const nextButton = screen.getByRole('button', { name: 'Guardar cambios' })
    expect(nextButton).toBeDisabled()
    await user.hover(nextButton.parentElement as HTMLElement)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Los apellidos son obligatorios.')
  })

  it('al editar, vaciar los apellidos bloquea guardar con "Los apellidos son obligatorios."', async () => {
    const user = userEvent.setup()
    const updateSpy = vi.spyOn(api, 'updateUser').mockResolvedValue(mockUsers[0])
    render(<UsersPage />)
    await user.click(await screen.findByRole('row', { name: /Docente Ruiz Carlos/ }))
    await screen.findByRole('dialog', { name: 'Editar usuario' })

    await user.clear(screen.getByLabelText(/^Apellidos/))
    const nextButton = screen.getByRole('button', { name: 'Guardar cambios' })
    expect(nextButton).toBeDisabled()
    await user.hover(nextButton.parentElement as HTMLElement)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Los apellidos son obligatorios.')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('muestra el error del servidor en línea dentro del formulario, sin otro modal encima', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'createUser').mockRejectedValue(new ApiError(422, {
      message: 'The email has already been taken.',
      errors: { email: ['The email has already been taken.'] },
    }))

    render(<UsersPage />)
    await screen.findByText('Docente Ruiz Carlos')
    await user.click(screen.getByRole('button', { name: 'Nuevo usuario' }))
    const dialog = await screen.findByRole('dialog')

    await fillPersonalData(user, within(dialog), 'carlos@ueb.edu.ec')
    await next(user)
    await choose(user, within(dialog).getByLabelText(/^Rol en el sistema/), 'Docente')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar usuario' }))

    // El mensaje aparece una sola vez, en línea bajo "Correo" (el formulario vuelve a ese paso).
    const messages = await within(dialog).findAllByText(/ya se encuentra registrado/)
    expect(messages).toHaveLength(1)
    expect(messages[0].closest('[data-slot="field"]')).toContainElement(within(dialog).getByLabelText(/^Correo electrónico institucional/))
    expect(within(dialog).queryByText('Correo ya registrado')).not.toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('muestra el error de cada campo bajo el campo al salir de él, sin cambiar lo que es válido', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)
    await screen.findByText('Docente Ruiz Carlos')
    await user.click(screen.getByRole('button', { name: 'Nuevo usuario' }))
    const dialog = await screen.findByRole('dialog', { name: 'Registrar usuario' })

    await user.type(within(dialog).getByLabelText(/^Cédula o pasaporte/), '1234567890')
    expect(within(dialog).queryByText('La cédula ingresada no es válida.')).not.toBeInTheDocument()
    await user.type(within(dialog).getByLabelText(/^Teléfono/), '09912')
    expect(await within(dialog).findByText('La cédula ingresada no es válida.')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText(/^Correo electrónico institucional/), 'correo-invalido')
    expect(await within(dialog).findByText('El teléfono debe tener 10 dígitos numéricos.')).toBeInTheDocument()
    await user.tab()
    expect(await within(dialog).findByText('Escribe un correo electrónico válido.')).toBeInTheDocument()

    // Al corregir, el error desaparece.
    const phone = within(dialog).getByLabelText(/^Teléfono/)
    await user.clear(phone)
    await user.type(phone, '0987654321')
    expect(within(dialog).queryByText('El teléfono debe tener 10 dígitos numéricos.')).not.toBeInTheDocument()
  })

  it('al editar, la cédula registrada y el teléfono ya guardado siguen marcados como obligatorios', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)
    await user.click(await screen.findByRole('row', { name: /Docente Ruiz Carlos/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar usuario' })

    expect(within(dialog).getByLabelText(/^Cédula o pasaporte/)).toHaveAccessibleName('Cédula o pasaporte(obligatorio)')
    expect(within(dialog).getByLabelText(/^Teléfono/)).toHaveAccessibleName('Teléfono(obligatorio)')
    // La contraseña (opcional) también se ve al editar; los datos personales no tienen opcionales.
    expect(within(within(dialog).getByRole('group', { name: 'Datos personales' })).queryByText('(Opcional)')).not.toBeInTheDocument()
  })

  it('al editar una cuenta sin teléfono, el teléfono es opcional', async () => {
    const user = userEvent.setup()
    vi.mocked(api.listUsers).mockResolvedValue({
      data: [{ ...mockUsers[0], phone: null }],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 1, from: 1, to: 1, active_count: 1, inactive_count: 0, admin_count: 0, career_coordinator_count: 0, degree_coordinator_count: 0, teacher_count: 1, student_count: 0 },
    })
    render(<UsersPage />)
    await user.click(await screen.findByRole('row', { name: /Docente Ruiz Carlos/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar usuario' })
    expect(within(dialog).getByText(/^Teléfono/).closest('label')).toHaveTextContent('(Opcional)')
  })

  it('en el paso de contraseña la ayuda va bajo el campo y la desactivación usa el mismo verbo', async () => {
    const user = userEvent.setup()
    const info = vi.spyOn(toast, 'info')
    vi.spyOn(api, 'deactivateUser').mockResolvedValue({ ...mockUsers[0], is_active: false })
    render(<UsersPage />)
    await user.click(await screen.findByRole('row', { name: /Docente Ruiz Carlos/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar usuario' })
    const help = within(dialog).getByText('Déjala en blanco para conservar la actual.')
    expect(help.closest('[data-slot="field"]')).toContainElement(within(dialog).getByLabelText(/^Nueva contraseña/))

    await user.click(within(dialog).getByRole('button', { name: 'Desactivar cuenta' }))
    const confirm = await screen.findByRole('dialog', { name: '¿Desactivar cuenta de usuario?' })
    await user.click(within(confirm).getByRole('button', { name: 'Desactivar cuenta' }))
    await waitFor(() => expect(info).toHaveBeenCalledWith('Cuenta desactivada', expect.objectContaining({ description: 'Se desactivó la cuenta de Docente Ruiz Carlos' })))
  })
})

describe('Carga de la pantalla de usuarios', () => {
  it('muestra un solo esqueleto de la pantalla completa mientras llega la primera página', async () => {
    let resolve: (value: Awaited<ReturnType<typeof api.listUsers>>) => void = () => {}
    vi.mocked(api.listUsers).mockReturnValue(new Promise((done) => { resolve = done }))
    render(<UsersPage />)

    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status', { name: 'Cargando usuarios' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Usuarios' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo usuario' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Actualizar' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Buscar usuario')).not.toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Usuario' })).toBeInTheDocument()

    resolve({ data: mockUsers, meta: { current_page: 1, last_page: 1, per_page: 15, total: 2, from: 1, to: 2, active_count: 2, inactive_count: 0, admin_count: 1, career_coordinator_count: 0, degree_coordinator_count: 0, teacher_count: 1, student_count: 0 } })
    expect(await screen.findByRole('heading', { name: 'Usuarios' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo usuario' })).toBeInTheDocument()
    expect(screen.getByText('Docente Ruiz Carlos')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: /^Cargando/ })).not.toBeInTheDocument()
  })
})
