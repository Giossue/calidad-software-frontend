import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { UserMenu } from '@/components/user-menu'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function renderMenu(overrides: Partial<Parameters<typeof UserMenu>[0]> = {}) {
  const props = {
    name: 'Administrador Prueba', email: 'admin@email.com', roleLabel: 'Administrador del Sistema', initials: 'AP',
    onSignOut: vi.fn(), signingOut: false, ...overrides,
  }
  render(<UserMenu {...props} />)
  return props
}

describe('UserMenu', () => {
  it('muestra los datos del usuario y cierra sesión', async () => {
    const user = userEvent.setup()
    const props = renderMenu()
    const trigger = screen.getByRole('button', { name: 'Menú de Administrador Prueba' })

    await user.click(trigger)
    expect(screen.getByText('Administrador del Sistema')).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Accesibilidad' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }))
    expect(props.onSignOut).toHaveBeenCalledTimes(1)
  })
})
