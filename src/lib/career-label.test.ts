import { describe, expect, it } from 'vitest'

import { careerLabel } from './career-label'

const software2019 = { id: 1, name: 'Software', code: 'SW-2019' }
const software2024 = { id: 2, name: 'Software', code: 'SW-2024' }
const medicine = { id: 3, name: 'Medicina', code: 'MED-01' }

describe('careerLabel', () => {
  it('shows only the name when no other career in the list shares it', () => {
    expect(careerLabel(medicine, [software2019, software2024, medicine])).toBe('Medicina')
    expect(careerLabel(software2019, [software2019, medicine])).toBe('Software')
  })

  it('adds the code when another career in the list has the same name', () => {
    const careers = [software2019, software2024, medicine]
    expect(careerLabel(software2019, careers)).toBe('Software · SW-2019')
    expect(careerLabel(software2024, careers)).toBe('Software · SW-2024')
  })

  it('compares names ignoring case and surrounding spaces', () => {
    expect(careerLabel(software2019, [software2019, { id: 4, name: ' software ', code: 'SW-2010' }])).toBe('Software · SW-2019')
  })

  it('keeps the plain name when the career has no code yet', () => {
    expect(careerLabel({ id: 5, name: 'Software', code: null }, [software2019, { id: 5, name: 'Software', code: null }])).toBe('Software')
  })
})
