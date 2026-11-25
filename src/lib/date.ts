// Fechas de calendario ("YYYY-MM-DD") en la hora local del navegador, sin desfases por UTC.

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const

const pad = (value: number) => String(value).padStart(2, '0')

/** "2026-09-28" de una fecha local. */
export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** La fecha de hoy en la hora local. */
export function todayIso(now = new Date()): string {
  return isoDate(now)
}

/** Fecha local a mediodía, para no cambiar de día por la zona horaria. */
export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

/** Día de la semana (0 = domingo) de una fecha "YYYY-MM-DD". */
export function weekdayOf(value: string): number {
  return parseIsoDate(value).getDay()
}

/** Día de la semana (0 = domingo) de un nombre como «Miércoles» o «miercoles»; null si no lo reconoce. */
export function weekdayIndex(day: string): number | null {
  const normalized = day.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const index = WEEKDAYS.indexOf(normalized as (typeof WEEKDAYS)[number])
  return index === -1 ? null : index
}

/** "2026-09" de una fecha "YYYY-MM-DD". */
export function monthOf(value: string): string {
  return value.slice(0, 7)
}

/** Suma meses a un mes "YYYY-MM". */
export function addMonths(month: string, amount: number): string {
  const [year, index] = month.split('-').map(Number)
  const date = new Date(year, index - 1 + amount, 1, 12)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

/** Mes "YYYY-MM" de una fecha, limitado a un rango de meses. */
export function clampMonth(date: string, min?: string, max?: string): string {
  const month = monthOf(date)
  if (min && month < min) return min
  if (max && month > max) return max
  return month
}
