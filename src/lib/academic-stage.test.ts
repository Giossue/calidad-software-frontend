import { describe, expect, it } from 'vitest'

import { DEGREE_FROM_CYCLE, isDegreeCycleNumber } from './academic-stage'

describe('academic-stage', () => {
  it('titulación va desde el 6.º ciclo en todas las carreras, como en el servidor', () => {
    expect(DEGREE_FROM_CYCLE).toBe(6)
    expect(isDegreeCycleNumber(5)).toBe(false)
    expect(isDegreeCycleNumber(6)).toBe(true)
    expect(isDegreeCycleNumber(7)).toBe(true)
    expect(isDegreeCycleNumber(9)).toBe(true)
    expect(isDegreeCycleNumber(null)).toBe(false)
    expect(isDegreeCycleNumber(undefined)).toBe(false)
  })
})
