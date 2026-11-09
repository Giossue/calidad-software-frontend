import { useEffect, useState } from 'react'

import type { TutoringSchedule } from '@/lib/tutoring-api'

// La asistencia solo se toma mientras la tutoría está en curso: hoy y dentro de uno
// de sus horarios activos. El servidor aplica la misma regla con la hora local.

const DAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const

function normalizeDay(day: string): string {
  return day.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function minutes(time: string): number {
  const [hours, mins] = time.split(':').map(Number)
  return hours * 60 + (mins || 0)
}

/** Hora actual, actualizada cada `intervalMs` para abrir y cerrar la toma de asistencia a tiempo. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

export type ClassWindow = Readonly<{
  /** La tutoría está en curso: se puede tomar o modificar la lista de hoy. */
  open: boolean
  current: TutoringSchedule | null
  today: readonly TutoringSchedule[]
  hasSchedule: boolean
}>

export function classWindow(schedules: readonly TutoringSchedule[] | undefined, now: Date): ClassWindow {
  const active = (schedules ?? []).filter((schedule) => schedule.is_active)
  const today = active
    .filter((schedule) => normalizeDay(schedule.day) === DAYS[now.getDay()])
    .sort((a, b) => minutes(a.start_time) - minutes(b.start_time))
  const time = now.getHours() * 60 + now.getMinutes()
  const current = today.find((schedule) => minutes(schedule.start_time) <= time && time <= minutes(schedule.end_time)) ?? null
  return { open: current !== null, current, today, hasSchedule: active.length > 0 }
}

/** "08:00 a 10:00" */
export function hoursLabel(schedule: TutoringSchedule): string {
  return `${schedule.start_time.slice(0, 5)} a ${schedule.end_time.slice(0, 5)}`
}

/** Por qué no se puede tomar asistencia ahora, o null si la clase está en curso. */
export function closedReason(classTime: ClassWindow): string | null {
  if (classTime.open) return null
  if (!classTime.hasSchedule) return 'Registra el horario de la tutoría en la pestaña Horarios para poder tomar asistencia.'
  if (classTime.today.length === 0) return 'Hoy no hay clase de esta tutoría. La asistencia solo se toma durante su horario.'
  return `La asistencia solo se toma durante el horario de la tutoría: hoy de ${classTime.today.map(hoursLabel).join(' y de ')}.`
}
