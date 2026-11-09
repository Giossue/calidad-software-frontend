// Estructura de las "Calificaciones Evaluación Diagnóstica" (formato oficial 1.a).
// El servidor calcula los valores; el cliente solo los presenta.

export const DIAGNOSTIC_GRADES_FORMAT = 'diagnostic_grades'

export interface DiagnosticGradeRow {
  readonly number: number
  readonly identification: string | null
  readonly name: string
  readonly grade: number | null
}

export interface DiagnosticGradesSummary {
  readonly format: typeof DIAGNOSTIC_GRADES_FORMAT
  readonly faculty: string | null
  readonly career: string | null
  readonly subject: string
  readonly cycle: number | null
  readonly cycle_name: string | null
  readonly academic_period: string | null
  readonly section: string | null
  readonly teacher: string
  readonly students_listed: number
  readonly students_evaluated: number
  readonly grades: readonly DiagnosticGradeRow[]
}

export function isDiagnosticGradesReport(summary: unknown): summary is DiagnosticGradesSummary {
  return typeof summary === 'object' && summary !== null && (summary as { format?: unknown }).format === DIAGNOSTIC_GRADES_FORMAT
}
