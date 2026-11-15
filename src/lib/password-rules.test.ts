import { describe, expect, it } from 'vitest'

import { isPasswordValid } from './password-rules'

describe('password-rules', () => {
  it('acepta 8 caracteres con una letra, un número y un carácter especial', () => {
    expect(isPasswordValid('clave12!')).toBe(true)
    expect(isPasswordValid('CLAVE12!')).toBe(true)
  })

  it('cuenta los caracteres como el backend, no las unidades UTF-16', () => {
    expect(isPasswordValid('Ab1!😀😀')).toBe(false)
  })

  it('solo considera carácter especial la puntuación y los símbolos, como el backend', () => {
    expect(isPasswordValid('abcdefg1́')).toBe(false)
    expect(isPasswordValid('abcdefg1­')).toBe(false)
  })
})
