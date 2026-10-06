import { describe, expect, it } from 'vitest'

import { findScheduleConflicts } from '@/lib/schedule-conflicts'

const busy = [
  { tutoring_id: 1, tutoring_name: 'Cálculo', day: 'lunes', start_time: '10:00', end_time: '12:00' },
  { tutoring_id: 2, tutoring_name: 'Física', day: 'martes', start_time: '08:00', end_time: '09:00' },
]

describe('findScheduleConflicts', () => {
  it('detecta franjas superpuestas del mismo día', () => {
    expect(findScheduleConflicts(busy, [{ day: 'lunes', start_time: '11:00', end_time: '13:00' }]))
      .toEqual([busy[0]])
  })

  it('no considera choque las franjas contiguas ni otros días', () => {
    expect(findScheduleConflicts(busy, [
      { day: 'lunes', start_time: '12:00', end_time: '13:00' },
      { day: 'miercoles', start_time: '10:00', end_time: '12:00' },
    ])).toEqual([])
  })

  it('ignora la tutoría que se está editando', () => {
    expect(findScheduleConflicts(busy, [{ day: 'lunes', start_time: '10:00', end_time: '12:00' }], 1)).toEqual([])
  })
})
