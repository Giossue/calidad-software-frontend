import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Dialog } from '@/components/ui/dialog'

afterEach(() => {
  cleanup()
})

describe('Dialog', () => {
  it('por defecto puede cerrarse con el botón de cerrar, sin pedir confirmación', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Dialog open onClose={onClose} title="Título" confirmClose={false}>
        Contenido
      </Dialog>,
    )

    await user.click(screen.getByLabelText('Cerrar modal'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('con dismissible=false no muestra botón de cerrar ni cierra con el backdrop o Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Dialog open onClose={onClose} title="Completa tu cuenta" dismissible={false}>
        Contenido
      </Dialog>,
    )

    expect(screen.queryByLabelText('Cerrar modal')).not.toBeInTheDocument()

    await user.click(screen.getByRole('dialog').previousSibling as Element)
    await user.keyboard('{Escape}')

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
