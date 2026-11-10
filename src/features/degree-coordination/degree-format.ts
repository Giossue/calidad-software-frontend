import type { DegreeTopicStatus } from '@/lib/degree-coordination-api'

/** Estado de una propuesta (femenino: «la propuesta»). Mismo nombre para coordinación y estudiante. */
export const DEGREE_STATUS_LABELS: Record<DegreeTopicStatus, string> = { pendiente: 'Pendiente', aprobado: 'Aprobada', rechazado: 'Rechazada' }

// El backend también devuelve «descartado» cuando el estudiante reemplaza una propuesta pendiente.
const EXTRA_TOPIC_STATUS_LABELS: Readonly<Record<string, string>> = { descartado: 'Reemplazada' }

/** Nombre legible del estado de una propuesta, incluido «descartado». */
export function degreeTopicStatusLabel(status: string): string {
  return DEGREE_STATUS_LABELS[status as DegreeTopicStatus] ?? EXTRA_TOPIC_STATUS_LABELS[status] ?? humanize(status)
}

const TRACKING_STATUS_LABELS: Readonly<Record<string, string>> = {
  en_progreso: 'En progreso',
  abierta: 'Abierta',
  finalizado: 'Finalizado',
  finalizada: 'Finalizada',
  completado: 'Completado',
  completada: 'Completada',
  cerrado: 'Cerrado',
  cerrada: 'Cerrada',
}

/** Nombre legible del estado de una ficha de seguimiento («en_progreso» → «En progreso»). */
export function trackingStatusLabel(status?: string | null): string {
  if (!status) return 'En progreso'
  return TRACKING_STATUS_LABELS[status.toLowerCase()] ?? humanize(status)
}

/** Una ficha terminada se pinta como éxito; el resto, neutra. */
export function isTrackingFinished(status?: string | null): boolean {
  return /^(finalizad|completad|cerrad)/.test(status?.toLowerCase() ?? '')
}

/** Avance acotado a 0–100 y redondeado a un entero (66.67 → 67). */
export function roundPercent(value?: number | null): number {
  return Math.round(Math.min(Math.max(Number(value) || 0, 0), 100))
}

function humanize(value: string): string {
  const text = value.replaceAll('_', ' ').trim().toLowerCase()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function formatDegreeDate(value?: string | null): string {
  if (!value) return 'Sin registrar'
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium' }).format(date)
}
