import type { BusySchedule, TutoringScheduleItem } from '@/lib/tutoring-api'

export type ScheduleConflict = BusySchedule

/** Nombre de asignatura comparable: sin tildes, mayúsculas ni espacios repetidos. */
export function sameSubjectName(a: string | null | undefined, b: string | null | undefined): boolean {
  const normalize = (value: string) => value.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
  return Boolean(a && b) && normalize(a ?? '') === normalize(b ?? '')
}

/**
 * Franjas ocupadas del docente que se cruzan con los horarios elegidos (mismo
 * día y horas superpuestas). Franjas contiguas, como 10:00–12:00 y 12:00–13:00,
 * no chocan. La misma asignatura a la misma hora es una clase conjunta (p. ej.
 * Cálculo III para dos carreras) y no cuenta como cruce. El servidor aplica la
 * misma regla; esto solo avisa antes de guardar.
 */
export function findScheduleConflicts(
  busy: readonly BusySchedule[],
  schedules: readonly TutoringScheduleItem[],
  excludeTutoringId?: number,
  subjectName?: string | null,
): ScheduleConflict[] {
  return busy.filter((slot) =>
    slot.tutoring_id !== excludeTutoringId &&
    !sameSubjectName(slot.tutoring_name, subjectName) &&
    schedules.some((schedule) =>
      schedule.day === slot.day &&
      schedule.start_time < slot.end_time &&
      slot.start_time < schedule.end_time,
    ),
  )
}
