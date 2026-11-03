import { describe, expect, it } from 'vitest'

import { isInstitutionalEmail } from './institutional-email'

describe('isInstitutionalEmail', () => {
  it('acepta los dominios @ueb.edu.ec y @mailes.ueb.edu.ec', () => {
    expect(isInstitutionalEmail('ana.torres@ueb.edu.ec')).toBe(true)
    expect(isInstitutionalEmail('yechacha@mailes.ueb.edu.ec')).toBe(true)
  })

  it('rechaza otros dominios', () => {
    expect(isInstitutionalEmail('ana@gmail.com')).toBe(false)
    expect(isInstitutionalEmail('ana@fakeueb.edu.ec')).toBe(false)
    expect(isInstitutionalEmail('ana@otro.ueb.edu.ec')).toBe(false)
  })
})
