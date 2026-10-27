import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ResetPasswordPage } from '@/features/auth/reset-password-page'
import { api } from '@/lib/api'

function LoginProbe() {
  const location = useLocation()
  return <p>Login de {(location.state as { email?: string } | null)?.email}</p>
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ResetPasswordPage', () => {
  it('al restablecer la contraseña lleva al inicio de sesión con el correo de la cuenta', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'resetPassword').mockResolvedValue({ message: 'Tu contraseña fue restablecida.' })
    const success = vi.spyOn(toast, 'success')

    render(
      <MemoryRouter initialEntries={['/reset-password?token=abc&email=ana.torres%40ueb.edu.ec']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>,
    )
    await user.type(screen.getByLabelText('Nueva contraseña'), 'Nueva-Clave-2026')
    await user.type(screen.getByLabelText('Confirma la contraseña'), 'Nueva-Clave-2026')
    await user.click(screen.getByRole('button', { name: 'Restablecer contraseña' }))

    expect(await screen.findByText('Login de ana.torres@ueb.edu.ec')).toBeInTheDocument()
    await waitFor(() => expect(success).toHaveBeenCalledWith('Tu contraseña fue restablecida.', { description: 'Inicia sesión con tu nueva contraseña.' }))
    expect(api.resetPassword).toHaveBeenCalledWith({ email: 'ana.torres@ueb.edu.ec', token: 'abc', password: 'Nueva-Clave-2026', password_confirmation: 'Nueva-Clave-2026' })
  })
})
