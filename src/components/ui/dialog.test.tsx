import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Dialog } from '@/components/ui/dialog'

afterEach(() => cleanup())

describe('Dialog', () => {
  it('por defecto se cierra sin pedir confirmación', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Dialog open onClose={onClose} title="Informe">contenido</Dialog>)

    await user.click(screen.getByRole('button', { name: 'Cerrar modal' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('¿Descartar los cambios?')).not.toBeInTheDocument()
  })

  it('con cambios sin guardar pide confirmar antes de cerrar', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Dialog open onClose={onClose} confirmClose title="Formulario">contenido</Dialog>)

    await user.click(screen.getByRole('button', { name: 'Cerrar modal' }))
    expect(screen.getByText('¿Descartar los cambios?')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /descartar y salir/ }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
