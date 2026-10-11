import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { UserMenu } from '@/components/user-menu'
import { getStoredAccessibility } from '@/lib/accessibility'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function renderMenu(overrides: Partial<Parameters<typeof UserMenu>[0]> = {}) {
  const props = {
    name: 'Administrador Prueba', email: 'admin@email.com', roleLabel: 'Administrador del Sistema', initials: 'AP',
    onOpenAccessibility: vi.fn(), onSignOut: vi.fn(), signingOut: false, ...overrides,
  }
  render(<UserMenu {...props} />)
  return props
}

describe('UserMenu', () => {
  it('abre accesibilidad, cambia el tema sin cerrarse y cierra sesión', async () => {
    const user = userEvent.setup()
    const props = renderMenu()
    const trigger = screen.getByRole('button', { name: 'Menú de Administrador Prueba' })
    const initialDark = getStoredAccessibility().darkMode

    await user.click(trigger)
    expect(screen.getByText('Administrador del Sistema')).toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: initialDark ? 'Modo claro' : 'Modo oscuro' }))
    expect(getStoredAccessibility().darkMode).toBe(!initialDark)
    expect(screen.getByRole('menuitem', { name: initialDark ? 'Modo oscuro' : 'Modo claro' })).toBeInTheDocument()

    await user.click(screen.getByRole('menuitem', { name: 'Accesibilidad' }))
    expect(props.onOpenAccessibility).toHaveBeenCalledTimes(1)

    await user.click(trigger)
    await user.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }))
    expect(props.onSignOut).toHaveBeenCalledTimes(1)
  })
})
