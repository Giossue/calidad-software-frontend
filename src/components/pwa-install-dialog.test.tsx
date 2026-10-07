import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PwaInstallDialog } from './pwa-install-dialog'

describe('PwaInstallDialog', () => {
  afterEach(() => {
    cleanup()
  })

  it('se renderiza correctamente con el título y las opciones', () => {
    render(<PwaInstallDialog open={true} onClose={vi.fn()} />)

    expect(screen.getByText('Acceso directo en el Escritorio')).toBeInTheDocument()
    expect(screen.getByText('Sistema de Gestión Académica')).toBeInTheDocument()
    expect(screen.getByText('Universidad Estatal de Bolívar')).toBeInTheDocument()
    expect(screen.getByText(/Descargar archivo de acceso directo/i)).toBeInTheDocument()
  })

  it('llama a onClose al hacer clic en el botón de cerrar', () => {
    const handleClose = vi.fn()
    render(<PwaInstallDialog open={true} onClose={handleClose} />)

    const closeBtn = screen.getByRole('button', { name: /Entendido \/ Cerrar/i })
    fireEvent.click(closeBtn)

    expect(handleClose).toHaveBeenCalled()
  })
})

