import { isDiagnosticReport } from '@/lib/diagnostic-report'
import { isFinalPaoReport } from '@/lib/final-pao-report'
import { isFollowUpReport } from '@/lib/follow-up-report'

/** Indica si el resumen guardado corresponde a un formato oficial (y no a un informe libre). */
export function isStructuredReport(summary: unknown): boolean {
  return isDiagnosticReport(summary) || isFollowUpReport(summary) || isFinalPaoReport(summary)
}
