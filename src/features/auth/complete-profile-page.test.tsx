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

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('CompleteProfilePage', () => {
  it('envía los datos y la nueva contraseña y actualiza la sesión', async () => {
    const user = userEvent.setup()
    const replaceUser = vi.fn()
    vi.mocked(useAuth).mockReturnValue({ user: imported, status: 'authenticated', login: vi.fn(), completeTwoFactor: vi.fn(), logout: vi.fn(), replaceUser })
    const completed = { ...imported, identification: 'AB1234567', phone: '0991234567', must_complete_profile: false }
    vi.spyOn(api, 'completeProfile').mockResolvedValue(completed)

    render(<CompleteProfilePage />)
    expect(screen.getByLabelText('Nombre completo')).toHaveValue('Ana Torres')
    const submit = screen.getByRole('button', { name: 'Guardar y continuar' })
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText('Cédula o pasaporte'), 'ab-1234567')
    await user.type(screen.getByLabelText('Teléfono celular'), '0991234567')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'Nueva-Clave-2026')
    await user.type(screen.getByLabelText('Confirma la contraseña'), 'Nueva-Clave-2026')
    await user.click(submit)

    await waitFor(() => expect(api.completeProfile).toHaveBeenCalledWith({
      identification: 'AB1234567', name: 'Ana Torres', phone: '0991234567',
      password: 'Nueva-Clave-2026', password_confirmation: 'Nueva-Clave-2026',
    }))
    expect(replaceUser).toHaveBeenCalledWith(completed)
  })

  it('muestra los errores de validación del servidor', async () => {
    const user = userEvent.setup()
    vi.mocked(useAuth).mockReturnValue({ user: { ...imported, identification: '0926687856', phone: '0991234567' }, status: 'authenticated', login: vi.fn(), completeTwoFactor: vi.fn(), logout: vi.fn(), replaceUser: vi.fn() })
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
})
