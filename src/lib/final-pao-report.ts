// Estructura del "Informe final PAO" (informe de ejecución de tutorías académicas, formato oficial).
// El servidor calcula todos los valores; el cliente solo los presenta.

export const FINAL_PAO_REPORT_FORMAT = 'final_pao'

export interface FinalPaoContact {
  readonly name: string | null
  readonly email: string | null
  readonly extension: string | null
  readonly position: string
}

export interface FinalPaoScheduleSlot {
  readonly subject: string
  readonly section: string | null
  readonly day: string
  readonly start: string
  readonly end: string
  readonly room: string | null
}

export interface FinalPaoMatrixRow {
  readonly tutoring_id: number
  readonly subject: string
  readonly cycle: number | null
  readonly cycle_name: string | null
  readonly section: string | null
  readonly weekly_hours: number
  readonly hours_done: number
  readonly enrolled: number
  readonly at_risk: number
  readonly at_risk_attending: number
  readonly at_risk_attending_passed: number
  readonly at_risk_improved: number
  readonly effectiveness: number | null
  readonly observation: string | null
}

export interface FinalPaoImprovedGroup {
  readonly subject: string
  readonly section: string | null
  readonly students: readonly { number: number; name: string; first: number; second: number }[]
}

export interface FinalPaoRegisterGroup {
  readonly subject: string
  readonly section: string | null
  readonly sessions: readonly { date: string; topics: readonly string[]; present: number; total: number }[]
}

export interface FinalPaoReportSummary {
  readonly format: typeof FINAL_PAO_REPORT_FORMAT
  readonly faculty: string | null
  readonly career: string
  readonly academic_period: string
  readonly date: string
  readonly report_number: string
  readonly teacher: FinalPaoContact
  readonly coordinator: FinalPaoContact
  readonly subject_line: string
  readonly objective: string
  readonly background: string
  readonly schedule: readonly FinalPaoScheduleSlot[]
  readonly matrix: readonly FinalPaoMatrixRow[]
  readonly conclusions: string | null
  readonly recommendations: string | null
  readonly improved: readonly FinalPaoImprovedGroup[]
  readonly register: readonly FinalPaoRegisterGroup[]
  readonly passing_grade: number
  readonly available_tutorings?: readonly { id: number; subject: string; cycle: number | null; section: string | null }[]
}

export function isFinalPaoReport(summary: unknown): summary is FinalPaoReportSummary {
  return typeof summary === 'object' && summary !== null && (summary as { format?: unknown }).format === FINAL_PAO_REPORT_FORMAT
}

/** 2026-09-29 → "29/09/2026", como en el formato oficial (XX/XX/202X). */
export function formatReportDate(value: string): string {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}
