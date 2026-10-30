import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AccessibilityButton } from '@/components/accessibility-button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { getStoredAccessibility } from '@/lib/accessibility'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('controles fijos del panel', () => {
  it('el botón de tema alterna el modo oscuro de inmediato', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    const initialDark = getStoredAccessibility().darkMode

    await user.click(screen.getByRole('button', { name: initialDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro' }))

    expect(getStoredAccessibility().darkMode).toBe(!initialDark)
    expect(screen.getByRole('button', { name: initialDark ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro' })).toBeInTheDocument()
  })

  it('el botón de accesibilidad llama a su acción', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<AccessibilityButton onClick={onClick} />)

    await user.click(screen.getByRole('button', { name: 'Opciones de accesibilidad' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
