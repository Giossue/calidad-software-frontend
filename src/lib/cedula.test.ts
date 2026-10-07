import { describe, expect, it } from 'vitest'

import { identificationMaxLength, isValidIdentification, sanitizeIdentification, shouldShowIdentificationStatus } from './cedula'

describe('sanitizeIdentification', () => {
  it('conserva 10 dígitos para cédula y limita a 9 caracteres cuando hay letras', () => {
    expect(sanitizeIdentification('17-1003 4065 99')).toBe('1710034065')
    expect(sanitizeIdentification('ab-1234567890')).toBe('AB1234567')
    expect(sanitizeIdentification('ñx12.345')).toBe('X12345')
  })
})

describe('isValidIdentification', () => {
  it('valida cédulas ecuatorianas por dígito verificador', () => {
    expect(isValidIdentification('1710034065')).toBe(true)
    expect(isValidIdentification('0201234567')).toBe(false)
  })

  it('acepta pasaportes de 6 a 9 caracteres alfanuméricos en mayúsculas', () => {
    expect(isValidIdentification('AB1234567')).toBe(true)
    expect(isValidIdentification('123456789')).toBe(true)
    expect(isValidIdentification('AB123')).toBe(false)
    expect(isValidIdentification('ab1234567')).toBe(false)
    expect(isValidIdentification('AB12345678')).toBe(false)
  })
})

describe('shouldShowIdentificationStatus', () => {
  it('espera a la cédula completa, pero valida pasaportes desde 6 caracteres', () => {
    expect(shouldShowIdentificationStatus('171003')).toBe(false)
    expect(shouldShowIdentificationStatus('1710034065')).toBe(true)
    expect(shouldShowIdentificationStatus('AB1234')).toBe(true)
    expect(identificationMaxLength('171')).toBe(10)
    expect(identificationMaxLength('AB1')).toBe(9)
  })
})
