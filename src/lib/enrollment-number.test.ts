import { describe, expect, it } from 'vitest'

import { DEFAULT_ENROLLMENT_NUMBER, ENROLLMENT_NUMBER_OPTIONS, enrollmentNumberLabel, parseEnrollmentNumber } from './enrollment-number'

describe('número de matrícula', () => {
  it('nombra cada matrícula con su ordinal', () => {
    expect(enrollmentNumberLabel(1)).toBe('1.ª matrícula')
    expect(enrollmentNumberLabel(2)).toBe('2.ª matrícula')
    expect(enrollmentNumberLabel(3)).toBe('3.ª matrícula')
  })

  it('ofrece la 1.ª, 2.ª y 3.ª matrícula, y la 1.ª por defecto', () => {
    expect(ENROLLMENT_NUMBER_OPTIONS).toEqual([
      { value: '1', label: '1.ª matrícula' },
      { value: '2', label: '2.ª matrícula' },
      { value: '3', label: '3.ª matrícula' },
    ])
    expect(DEFAULT_ENROLLMENT_NUMBER).toBe(1)
  })

  it('lee el valor elegido en el select y vuelve a la 1.ª si no es válido', () => {
    expect(parseEnrollmentNumber('2')).toBe(2)
    expect(parseEnrollmentNumber('3')).toBe(3)
    expect(parseEnrollmentNumber('')).toBe(1)
    expect(parseEnrollmentNumber('4')).toBe(1)
  })
})
