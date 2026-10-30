import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAuth } from '@/features/auth/auth-context'
import { CompleteProfileModal } from '@/features/auth/complete-profile-modal'
import { api, ApiError, type User } from '@/lib/api'

vi.mock('@/features/auth/auth-context', () => ({ useAuth: vi.fn() }))

const imported: User = {
  id: 9, identification: null, name: 'Ana Torres', email: 'ana.torres@ueb.edu.ec', phone: null,
  role: 'estudiante', is_active: true, email_verified_at: '2026-10-07T00:00:00Z', has_two_factor: false, must_complete_profile: true,
}

const options = [{
  id: 1, name: 'Ciencias Administrativas', careers: [
    { id: 3, name: 'Software', cycles: [{ id: 7, number: 2, name: 'Segundo', section_name: 'A' }, { id: 8, number: 6, name: 'Sexto', section_name: 'B' }] },
  ],
}]

// Los selects son de shadcn (Radix): se abren y se elige la opción por su texto.
async function choose(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, option: string) {
  await user.click(trigger)
  await user.click(await screen.findByRole('option', { name: option }))
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('CompleteProfileModal', () => {
  it('no puede cerrarse: no muestra botón de cerrar', () => {
    vi.mocked(useAuth).mockReturnValue({ user: imported, status: 'authenticated', login: vi.fn(), completeTwoFactor: vi.fn(), logout: vi.fn(), replaceUser: vi.fn() })

    render(<CompleteProfileModal />)
    expect(screen.queryByLabelText('Cerrar modal')).not.toBeInTheDocument()
  })

  it('marca como titulación solo el último ciclo de la carrera, no uno fijo como el 6.º', async () => {
    const user = userEvent.setup()
    vi.mocked(useAuth).mockReturnValue({ user: imported, status: 'authenticated', login: vi.fn(), completeTwoFactor: vi.fn(), logout: vi.fn(), replaceUser: vi.fn() })
    const optionsWithEighthCycle = [{
      id: 1, name: 'Ciencias Administrativas', careers: [
        {
          id: 3, name: 'Software', cycles: [
            { id: 7, number: 2, name: 'Segundo', section_name: 'A' },
            { id: 8, number: 6, name: 'Sexto', section_name: 'B' },
            { id: 9, number: 8, name: 'Octavo', section_name: 'A' },
          ],
        },
      ],
    }]
    vi.spyOn(api, 'academicOptions').mockResolvedValue(optionsWithEighthCycle)

    render(<CompleteProfileModal />)
    await user.type(screen.getByLabelText('Cédula o pasaporte'), 'ab-1234567')
    await user.type(screen.getByLabelText('Teléfono celular'), '0991234567')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))

    await waitFor(() => expect(screen.getByLabelText('Facultad')).toBeEnabled())
    await choose(user, screen.getByLabelText('Facultad'), 'Ciencias Administrativas')
    await choose(user, screen.getByLabelText('Carrera'), 'Software')

    await user.click(screen.getByLabelText('Ciclo'))
    expect(await screen.findByRole('option', { name: '6.º ciclo · Sexto · Paralelo B' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '8.º ciclo · Octavo · Paralelo A · Titulación' })).toBeInTheDocument()
  })

  it('separa el formulario en pasos: datos, datos académicos y contraseña', async () => {
    const user = userEvent.setup()
    const replaceUser = vi.fn()
    vi.mocked(useAuth).mockReturnValue({ user: imported, status: 'authenticated', login: vi.fn(), completeTwoFactor: vi.fn(), logout: vi.fn(), replaceUser })
    const completed = { ...imported, identification: 'AB1234567', phone: '0991234567', must_complete_profile: false }
    vi.spyOn(api, 'academicOptions').mockResolvedValue(options)
    vi.spyOn(api, 'completeProfile').mockResolvedValue(completed)

    render(<CompleteProfileModal />)
    expect(screen.getByLabelText('Nombre completo')).toHaveValue('Ana Torres')
    // El paso de contraseña todavía no está visible: solo se ve el paso actual.
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument()
    const next = screen.getByRole('button', { name: 'Siguiente' })
    expect(next).toBeDisabled()

    await user.type(screen.getByLabelText('Cédula o pasaporte'), 'ab-1234567')
    await user.type(screen.getByLabelText('Teléfono celular'), '0991234567')
    await user.click(next)

    // Paso de datos académicos: sin facultad, carrera y ciclo no puede continuar.
    expect(screen.queryByLabelText('Cédula o pasaporte')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Facultad')).toBeEnabled())
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    expect(screen.getByLabelText('Carrera')).toBeDisabled()

    await choose(user, screen.getByLabelText('Facultad'), 'Ciencias Administrativas')
    await choose(user, screen.getByLabelText('Carrera'), 'Software')
    await user.click(screen.getByLabelText('Ciclo'))
    expect(await screen.findByRole('option', { name: '6.º ciclo · Sexto · Paralelo B · Titulación' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await choose(user, screen.getByLabelText('Ciclo'), '2.º ciclo · Segundo · Paralelo A')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))

    // Último paso: contraseña nueva.
    expect(screen.queryByLabelText('Facultad')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Nueva contraseña'), 'Nueva-Clave-2026')
    await user.type(screen.getByLabelText('Confirma la contraseña'), 'Nueva-Clave-2026')
    await user.click(screen.getByRole('button', { name: 'Guardar y continuar' }))

    await waitFor(() => expect(api.completeProfile).toHaveBeenCalledWith({
      identification: 'AB1234567', name: 'Ana Torres', phone: '0991234567',
      faculty_id: 1, career_id: 3, cycle_id: 7,
      password: 'Nueva-Clave-2026', password_confirmation: 'Nueva-Clave-2026',
    }))
    expect(replaceUser).toHaveBeenCalledWith(completed)
  })

  it('permite retroceder a un paso anterior y corregirlo antes de continuar', async () => {
    const user = userEvent.setup()
    const student = { ...imported, must_change_password: false }
    vi.mocked(useAuth).mockReturnValue({ user: student, status: 'authenticated', login: vi.fn(), completeTwoFactor: vi.fn(), logout: vi.fn(), replaceUser: vi.fn() })
    vi.spyOn(api, 'academicOptions').mockResolvedValue(options)
    vi.spyOn(api, 'completeProfile').mockResolvedValue({ ...student, must_complete_profile: false })

    render(<CompleteProfileModal />)
    await user.type(screen.getByLabelText('Cédula o pasaporte'), '0926687856')
    await user.type(screen.getByLabelText('Teléfono celular'), '0991234567')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))

    await waitFor(() => expect(screen.getByLabelText('Facultad')).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Atrás' }))

    // Al volver, el paso anterior conserva lo ya digitado.
    expect(screen.getByLabelText('Teléfono celular')).toHaveValue('0991234567')
    await user.clear(screen.getByLabelText('Teléfono celular'))
    await user.type(screen.getByLabelText('Teléfono celular'), '0987654321')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))

    await choose(user, screen.getByLabelText('Facultad'), 'Ciencias Administrativas')
    await choose(user, screen.getByLabelText('Carrera'), 'Software')
    await choose(user, screen.getByLabelText('Ciclo'), '2.º ciclo · Segundo · Paralelo A')
    await user.click(screen.getByRole('button', { name: 'Guardar y continuar' }))

    await waitFor(() => expect(api.completeProfile).toHaveBeenCalledWith(expect.objectContaining({ phone: '0987654321' })))
  })

  it('al llegar a un paso ya visitado, también puede volver haciendo clic en su indicador', async () => {
    const user = userEvent.setup()
    const student = { ...imported, must_change_password: false }
    vi.mocked(useAuth).mockReturnValue({ user: student, status: 'authenticated', login: vi.fn(), completeTwoFactor: vi.fn(), logout: vi.fn(), replaceUser: vi.fn() })
    vi.spyOn(api, 'academicOptions').mockResolvedValue(options)

    render(<CompleteProfileModal />)
    await user.type(screen.getByLabelText('Cédula o pasaporte'), '0926687856')
    await user.type(screen.getByLabelText('Teléfono celular'), '0991234567')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(screen.getByLabelText('Facultad')).toBeEnabled())

    // El indicador del paso 1 ("Tus datos") ya fue visitado, así que puede usarse para volver.
    await user.click(screen.getByRole('button', { name: /Tus datos/ }))
    expect(screen.getByLabelText('Cédula o pasaporte')).toHaveValue('0926687856')

    // El paso "Datos académicos" todavía no se visita de nuevo pero sigue habilitado por haber sido alcanzado.
    await user.click(screen.getByRole('button', { name: /Datos académicos/ }))
    expect(screen.getByLabelText('Facultad')).toBeInTheDocument()
  })

  it('a una cuenta sin cédula solo le pide sus datos, sin cambiar la contraseña', async () => {
    const user = userEvent.setup()
    const account = { ...imported, role: 'docente', phone: '0991234567', must_change_password: false }
    vi.mocked(useAuth).mockReturnValue({ user: account, status: 'authenticated', login: vi.fn(), completeTwoFactor: vi.fn(), logout: vi.fn(), replaceUser: vi.fn() })
    vi.spyOn(api, 'completeProfile').mockResolvedValue({ ...account, identification: '0926687856', must_complete_profile: false })

    render(<CompleteProfileModal />)
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Cédula o pasaporte'), '0926687856')
    await user.click(screen.getByRole('button', { name: 'Guardar y continuar' }))

    await waitFor(() => expect(api.completeProfile).toHaveBeenCalledWith({ identification: '0926687856', name: 'Ana Torres', phone: '0991234567' }))
  })

  it('muestra los errores de validación del servidor', async () => {
    const user = userEvent.setup()
    vi.mocked(useAuth).mockReturnValue({ user: { ...imported, role: 'docente', identification: '0926687856', phone: '0991234567' }, status: 'authenticated', login: vi.fn(), completeTwoFactor: vi.fn(), logout: vi.fn(), replaceUser: vi.fn() })
    vi.spyOn(api, 'completeProfile').mockRejectedValue(new ApiError(422, { errors: { password: ['La nueva contraseña debe ser distinta de la contraseña provisional.'] } }))

    render(<CompleteProfileModal />)
    // Datos ya válidos (precargados): el único paso previo a la contraseña se salta de inmediato.
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))

    await user.type(screen.getByLabelText('Nueva contraseña'), 'Provisional1!')
    await user.type(screen.getByLabelText('Confirma la contraseña'), 'Otra')
    await user.click(screen.getByRole('button', { name: 'Guardar y continuar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Las contraseñas no coinciden.')

    await user.clear(screen.getByLabelText('Confirma la contraseña'))
    await user.type(screen.getByLabelText('Confirma la contraseña'), 'Provisional1!')
    await user.click(screen.getByRole('button', { name: 'Guardar y continuar' }))
    expect(await screen.findByText('La nueva contraseña debe ser distinta de la contraseña provisional.')).toBeInTheDocument()
  })

  it('precarga la carrera y el ciclo registrados del estudiante, que puede reemplazar', async () => {
    const user = userEvent.setup()
    const student = { ...imported, identification: '0926687856', phone: '0991234567', must_change_password: false, faculty_id: 1, career_id: 3, cycle_id: 8 }
    vi.mocked(useAuth).mockReturnValue({ user: student, status: 'authenticated', login: vi.fn(), completeTwoFactor: vi.fn(), logout: vi.fn(), replaceUser: vi.fn() })
    vi.spyOn(api, 'academicOptions').mockResolvedValue(options)
    vi.spyOn(api, 'completeProfile').mockResolvedValue({ ...student, must_complete_profile: false })

    render(<CompleteProfileModal />)
    // Datos ya válidos (precargados): pasa directo al paso académico.
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(screen.getByLabelText('Ciclo')).toHaveTextContent('6.º ciclo · Sexto'))
    await choose(user, screen.getByLabelText('Ciclo'), '2.º ciclo · Segundo · Paralelo A')
    await user.click(screen.getByRole('button', { name: 'Guardar y continuar' }))

    await waitFor(() => expect(api.completeProfile).toHaveBeenCalledWith({
      identification: '0926687856', name: 'Ana Torres', phone: '0991234567', faculty_id: 1, career_id: 3, cycle_id: 7,
    }))
  })
})
