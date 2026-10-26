// Estructura del "Reporte de la Evaluación Diagnóstica" (formato oficial de Tutorías Académicas).
// El servidor calcula todos los valores; el cliente solo los presenta.

export const DIAGNOSTIC_REPORT_FORMAT = 'diagnostic_evaluation'

export interface DiagnosticReportGroup {
  readonly key: string
  readonly label: string
  readonly range_label: string
  readonly count: number
  readonly percentage: number
  readonly action_plan: readonly string[]
}

export interface DiagnosticReportGrade {
  readonly number: number
  readonly identification: string | null
  readonly name: string
  readonly grade: number | null
  readonly group: string | null
}

export interface DiagnosticReportSummary {
  readonly format: typeof DIAGNOSTIC_REPORT_FORMAT
  readonly faculty: string | null
  readonly career: string | null
  readonly date: string
  readonly teacher: string
  readonly subject: string
  readonly cycle: number | null
  readonly cycle_name: string | null
  readonly academic_period: string | null
  readonly section: string | null
  readonly students_listed: number
  readonly students_evaluated: number
  readonly groups: readonly DiagnosticReportGroup[]
  readonly observations: string | null
  readonly grades: readonly DiagnosticReportGrade[]
  readonly coordinator: string | null
}

export function isDiagnosticReport(summary: unknown): summary is DiagnosticReportSummary {
  return typeof summary === 'object' && summary !== null && (summary as { format?: unknown }).format === DIAGNOSTIC_REPORT_FORMAT
}

const decimal = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 })

export function formatDecimal(value: number): string {
  return decimal.format(value)
}
