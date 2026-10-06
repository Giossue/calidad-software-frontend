import type { BusySchedule, TutoringScheduleItem } from '@/lib/tutoring-api'

export type ScheduleConflict = BusySchedule

/**
 * Franjas ocupadas del docente que se cruzan con los horarios elegidos (mismo
 * día y horas superpuestas). Franjas contiguas, como 10:00–12:00 y 12:00–13:00,
 * no chocan. El servidor aplica la misma regla; esto solo avisa antes de guardar.
 */
export function findScheduleConflicts(
  busy: readonly BusySchedule[],
  schedules: readonly TutoringScheduleItem[],
  excludeTutoringId?: number,
): ScheduleConflict[] {
  return busy.filter((slot) =>
    slot.tutoring_id !== excludeTutoringId &&
    schedules.some((schedule) =>
      schedule.day === slot.day &&
      schedule.start_time < slot.end_time &&
      slot.start_time < schedule.end_time,
    ),
  )
}
