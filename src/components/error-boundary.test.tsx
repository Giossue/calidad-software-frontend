import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ErrorBoundary } from '@/components/error-boundary'

afterEach(cleanup)

function Broken(): never {
  throw new Error('fallo de prueba')
}

describe('ErrorBoundary', () => {
  it('muestra un aviso con Recargar en lugar de una pantalla en blanco', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<ErrorBoundary><Broken /></ErrorBoundary>)
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo mostrar esta pantalla')
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
  })
})
