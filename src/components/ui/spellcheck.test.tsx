import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Input } from './input'
import { Textarea } from './textarea'

describe('Corrector ortográfico en los campos de texto', () => {
  it('revisa la ortografía en español en los textos y las descripciones', () => {
    render(<><Input aria-label="Nombre" /><Input type="text" aria-label="Tema" /><Textarea aria-label="Descripción" /></>)
    for (const name of ['Nombre', 'Tema', 'Descripción']) {
      expect(screen.getByLabelText(name)).toHaveAttribute('spellcheck', 'true')
      expect(screen.getByLabelText(name)).toHaveAttribute('lang', 'es')
    }
  })

  it('no revisa correos, contraseñas, números ni campos numéricos como la cédula', () => {
    render(<>
      <Input type="email" aria-label="Correo" />
      <Input type="password" aria-label="Contraseña" />
      <Input type="number" aria-label="Nota" />
      <Input inputMode="numeric" aria-label="Cédula" />
    </>)
    for (const name of ['Correo', 'Contraseña', 'Nota', 'Cédula']) {
      expect(screen.getByLabelText(name)).not.toHaveAttribute('spellcheck', 'true')
    }
  })

  it('respeta cuando un campo lo desactiva', () => {
    render(<Input spellCheck={false} aria-label="Código" />)
    expect(screen.getByLabelText('Código')).toHaveAttribute('spellcheck', 'false')
  })
})
