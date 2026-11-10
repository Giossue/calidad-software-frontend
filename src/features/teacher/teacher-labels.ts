import type { FriendlyErrorInfo } from '@/components/ui/error-modal'

/** Error del servidor sobre uno de estos campos (p. ej. `email`), para mostrarlo bajo el campo; si no, null. */
export function serverFieldError(operation: Readonly<{ error: string | null; errorModal: FriendlyErrorInfo | null }>, ...fields: readonly string[]): string | null {
  const field = operation.errorModal?.field
  return field && fields.includes(field) ? operation.error : null
}

/** Participación del docente en una titulación: el mismo texto en «Mis asignaciones» y en «Seguimiento». */
export const DEGREE_ROLE_LABELS: Readonly<Record<string, string>> = { tutor: 'Docente tutor', par_academico: 'Par académico' }
export const DEGREE_ROLE_OPTIONS = [{ value: 'tutor', label: 'Docente tutor' }, { value: 'par_academico', label: 'Par académico' }] as const
