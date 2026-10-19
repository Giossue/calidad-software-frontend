import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { PasswordStrength } from './password-strength'

describe('PasswordStrength', () => {
  afterEach(cleanup)

  it('muestra todos los requisitos mientras la contraseña está vacía', () => {
    render(<PasswordStrength password="" />)
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.queryByText(/Seguridad:/)).not.toBeInTheDocument()
  })

  it('oculta cada requisito a medida que se cumple', () => {
    render(<PasswordStrength password="abcD1" />)
    expect(screen.getByText('Seguridad: Media')).toBeInTheDocument()
    expect(screen.queryByText('Una letra minúscula')).not.toBeInTheDocument()
    expect(screen.queryByText('Una letra mayúscula')).not.toBeInTheDocument()
    expect(screen.queryByText('Un número')).not.toBeInTheDocument()
    expect(screen.getByText('Al menos 12 caracteres')).toBeInTheDocument()
    expect(screen.getByText('Un carácter especial (!@#$%…)')).toBeInTheDocument()
  })

  it('indica una contraseña fuerte cuando se cumplen todos los requisitos', () => {
    render(<PasswordStrength password="Clave$egura2026" />)
    expect(screen.getByText('Seguridad: Fuerte')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.getByText('La contraseña cumple todos los requisitos.')).toBeInTheDocument()
  })
})
