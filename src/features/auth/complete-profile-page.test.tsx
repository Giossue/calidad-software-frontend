import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAuth } from '@/features/auth/auth-context'
import { CompleteProfilePage } from '@/features/auth/complete-profile-page'
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

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('CompleteProfilePage', () => {
  it('envía los datos, el ciclo del estudiante y la nueva contraseña y actualiza la sesión', async () => {
    const user = userEvent.setup()
    const replaceUser = vi.fn()
    vi.mocked(useAuth).mockReturnValue({ user: imported, status: 'authenticated', login: vi.fn(), completeTwoFactor: vi.fn(), logout: vi.fn(), replaceUser })
    const completed = { ...imported, identification: 'AB1234567', phone: '0991234567', must_complete_profile: false }
    vi.spyOn(api, 'academicOptions').mockResolvedValue(options)
    vi.spyOn(api, 'completeProfile').mockResolvedValue(completed)

    render(<CompleteProfilePage />)
    expect(screen.getByLabelText('Nombre completo')).toHaveValue('Ana Torres')
    const submit = screen.getByRole('button', { name: 'Guardar y continuar' })
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText('Cédula o pasaporte'), 'ab-1234567')
    await user.type(screen.getByLabelText('Teléfono celular'), '0991234567')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'Nueva-Clave-2026')
    await user.type(screen.getByLabelText('Confirma la contraseña'), 'Nueva-Clave-2026')
    // Sin facultad, carrera y ciclo el estudiante no puede continuar.
    expect(submit).toBeDisabled()
    expect(screen.getByLabelText('Carrera')).toBeDisabled()

    await waitFor(() => expect(screen.getByLabelText('Facultad')).toBeEnabled())
    await user.selectOptions(screen.getByLabelText('Facultad'), 'Ciencias Administrativas')
    await user.selectOptions(screen.getByLabelText('Carrera'), 'Software')
    expect(screen.getByRole('option', { name: '6.º ciclo · Sexto · Paralelo B · Titulación' })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Ciclo'), '2.º ciclo · Segundo · Paralelo A')
    await user.click(submit)

    await waitFor(() => expect(api.completeProfile).toHaveBeenCalledWith({
      identification: 'AB1234567', name: 'Ana Torres', phone: '0991234567',
      faculty_id: 1, career_id: 3, cycle_id: 7,
      password: 'Nueva-Clave-2026', password_confirmation: 'Nueva-Clave-2026',
    }))
    expect(replaceUser).toHaveBeenCalledWith(completed)
  })

  it('a una cuenta sin cédula solo le pide sus datos, sin cambiar la contraseña', async () => {
    const user = userEvent.setup()
    const account = { ...imported, role: 'docente', phone: '0991234567', must_change_password: false }
    vi.mocked(useAuth).mockReturnValue({ user: account, status: 'authenticated', login: vi.fn(), completeTwoFactor: vi.fn(), logout: vi.fn(), replaceUser: vi.fn() })
    vi.spyOn(api, 'completeProfile').mockResolvedValue({ ...account, identification: '0926687856', must_complete_profile: false })

    render(<CompleteProfilePage />)
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Cédula o pasaporte'), '0926687856')
    await user.click(screen.getByRole('button', { name: 'Guardar y continuar' }))

    await waitFor(() => expect(api.completeProfile).toHaveBeenCalledWith({ identification: '0926687856', name: 'Ana Torres', phone: '0991234567' }))
  })

  it('muestra los errores de validación del servidor', async () => {
    const user = userEvent.setup()
    vi.mocked(useAuth).mockReturnValue({ user: { ...imported, role: 'docente', identification: '0926687856', phone: '0991234567' }, status: 'authenticated', login: vi.fn(), completeTwoFactor: vi.fn(), logout: vi.fn(), replaceUser: vi.fn() })
    vi.spyOn(api, 'completeProfile').mockRejectedValue(new ApiError(422, { errors: { password: ['La nueva contraseña debe ser distinta de la contraseña provisional.'] } }))

    render(<CompleteProfilePage />)
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

    render(<CompleteProfilePage />)
    await waitFor(() => expect(screen.getByLabelText('Ciclo')).toHaveValue('8'))
    await user.selectOptions(screen.getByLabelText('Ciclo'), '2.º ciclo · Segundo · Paralelo A')
    await user.click(screen.getByRole('button', { name: 'Guardar y continuar' }))

    await waitFor(() => expect(api.completeProfile).toHaveBeenCalledWith({
      identification: '0926687856', name: 'Ana Torres', phone: '0991234567', faculty_id: 1, career_id: 3, cycle_id: 7,
    }))
  })
})
