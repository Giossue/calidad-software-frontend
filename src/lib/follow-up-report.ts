// Estructura del "Reporte de Seguimiento a las Tutorías Académicas" (formato oficial).
// El servidor calcula todos los valores; el cliente solo los presenta.

export const FOLLOW_UP_REPORT_FORMAT = 'tutoring_follow_up'

export interface FollowUpActivity {
  readonly date: string
  readonly topic: string
  readonly activity: string | null
  readonly methodology: string | null
}

export interface FollowUpImprovement {
  readonly number: number
  readonly name: string
  readonly diagnostic: number
  readonly partial: number
}

export interface FollowUpReportSummary {
  readonly format: typeof FOLLOW_UP_REPORT_FORMAT
  readonly faculty: string | null
  readonly career: string | null
  readonly subject: string
  readonly academic_period: string | null
  readonly section: string | null
  readonly coordinator: string | null
  readonly teacher: string
  readonly date: string
  readonly partial: 1 | 2
  readonly partial_label: string
  readonly partial_title: string
  readonly from: string
  readonly to: string
  readonly background: string
  readonly session_count: number
  readonly activities: readonly FollowUpActivity[]
  readonly attendance: {
    readonly at_risk_total: number
    readonly at_risk_attending: number
    readonly not_at_risk_attending: number
    readonly unclassified_attending: number
  }
  readonly improved: readonly FollowUpImprovement[]
  readonly observations: string | null
}

export function isFollowUpReport(summary: unknown): summary is FollowUpReportSummary {
  return typeof summary === 'object' && summary !== null && (summary as { format?: unknown }).format === FOLLOW_UP_REPORT_FORMAT
}

const grade = new Intl.NumberFormat('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const longDate = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })

/** Nota con dos decimales, como en el formato oficial (3,00). */
export function formatGrade(value: number): string {
  return grade.format(value)
}

/** 2026-04-24 → "24 de abril del 2026". */
export function formatPresentationDate(value: string): string {
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return longDate.format(date).replace(/ de (\d{4})$/, ' del $1')
}

/** 2026-03-19 → "2026/03/19". */
export function formatActivityDate(value: string): string {
  return value.replaceAll('-', '/')
}
