import type { DegreeTopicStatus } from '@/lib/degree-coordination-api'

export const DEGREE_STATUS_LABELS: Record<DegreeTopicStatus, string> = { pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado' }

export function formatDegreeDate(value?: string | null): string {
  if (!value) return 'Sin registrar'
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium' }).format(date)
}
