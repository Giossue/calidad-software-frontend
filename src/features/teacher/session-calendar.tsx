// oxlint-disable react/only-export-components
import { useMemo } from 'react'

import { Calendar } from '@/components/ui/calendar'
import { clampMonth, monthOf, weekdayIndex, weekdayOf } from '@/lib/date'
import type { TeacherTutoring, TutoringSession } from '@/lib/teacher-api'

// La sesión de un día se registra o modifica durante todo el período (PAO), desde su
// inicio hasta hoy, en los días en que la tutoría tiene clase. El servidor aplica la misma regla.

export const NO_CLASS_THAT_DAY = 'La tutoría no tiene clase ese día.'
export const NO_SCHEDULE = 'Registra el horario de la tutoría en la pestaña Horarios para poder tomar asistencia.'

/** Días de la semana (0 = domingo) con un horario activo. */
function classWeekdays(tutoring: TeacherTutoring): ReadonlySet<number> {
  return new Set((tutoring.schedules ?? []).filter((schedule) => schedule.is_active).map((schedule) => weekdayIndex(schedule.day)).filter((day) => day !== null))
}

/** Por qué no se puede registrar la sesión de `date`, o null si se puede. */
export function sessionDateIssue(tutoring: TeacherTutoring, date: string, today: string): string | null {
  if (date > today) return 'No se pueden registrar sesiones de fechas futuras.'
  if ((tutoring.period_start_date && date < tutoring.period_start_date) || (tutoring.period_end_date && date > tutoring.period_end_date)) {
    return 'La fecha está fuera del período académico de la tutoría.'
  }
  const weekdays = classWeekdays(tutoring)
  if (weekdays.size === 0) return NO_SCHEDULE
  return weekdays.has(weekdayOf(date)) ? null : NO_CLASS_THAT_DAY
}

/**
 * Calendario de sesiones del período: los días con clase hasta hoy se pueden abrir y los
 * que ya tienen sesión van marcados (y siempre se pueden abrir). En modo consulta solo se abren los días con sesión.
 */
export function SessionCalendar({
  tutoring,
  sessions,
  today,
  selected,
  onSelect,
}: Readonly<{
  tutoring: TeacherTutoring
  sessions: readonly TutoringSession[]
  today: string
  selected?: string | null
  onSelect: (date: string) => void
}>) {
  const marked = useMemo(() => new Set(sessions.map((session) => session.date)), [sessions])
  const minMonth = tutoring.period_start_date ? monthOf(tutoring.period_start_date) : undefined
  const maxMonth = tutoring.period_end_date ? monthOf(tutoring.period_end_date) : undefined

  return (
    <Calendar
      label="Calendario de sesiones"
      defaultMonth={clampMonth(selected ?? today, minMonth, maxMonth)}
      minMonth={minMonth}
      maxMonth={maxMonth}
      today={today}
      selected={selected}
      marked={marked}
      markLabel="sesión registrada"
      isDisabled={(date) => !marked.has(date) && (!tutoring.can_manage || sessionDateIssue(tutoring, date, today) !== null)}
      onSelect={onSelect}
    />
  )
}
