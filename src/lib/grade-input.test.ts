import { describe, expect, it } from 'vitest'

import { isValidGrade, sanitizeGradeInput } from './grade-input'

describe('sanitizeGradeInput', () => {
  it('acepta números con hasta dos decimales y convierte la coma en punto', () => {
    expect(sanitizeGradeInput('9.42', '')).toBe('9.42')
    expect(sanitizeGradeInput('9,4', '')).toBe('9.4')
    expect(sanitizeGradeInput('10', '1')).toBe('10')
    expect(sanitizeGradeInput('', '7')).toBe('')
  })

  it('rechaza letras, más de dos decimales y valores sobre la escala conservando el anterior', () => {
    expect(sanitizeGradeInput('9.425', '9.42')).toBe('9.42')
    expect(sanitizeGradeInput('9a', '9')).toBe('9')
    expect(sanitizeGradeInput('-1', '')).toBe('')
    expect(sanitizeGradeInput('11', '1')).toBe('1')
    expect(sanitizeGradeInput('10.5', '10')).toBe('10')
  })
})

describe('isValidGrade', () => {
  it('solo da por completa una nota numérica dentro de la escala', () => {
    expect(isValidGrade('9.42')).toBe(true)
    expect(isValidGrade('0')).toBe(true)
    expect(isValidGrade('10.00')).toBe(true)
    expect(isValidGrade('9.')).toBe(false)
    expect(isValidGrade('')).toBe(false)
    expect(isValidGrade(undefined)).toBe(false)
    expect(isValidGrade('10.01')).toBe(false)
  })
})
