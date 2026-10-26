import type { ReactNode } from 'react'

import { isDiagnosticReport } from '@/lib/diagnostic-report'
import { isFinalPaoReport } from '@/lib/final-pao-report'
import { isFollowUpReport } from '@/lib/follow-up-report'
import { DiagnosticReportDocument } from './diagnostic-report-document'
import { FinalPaoReportDocument } from './final-pao-report-document'
import { FollowUpReportDocument } from './follow-up-report-document'
import { PrintReport, SheetFrame } from './report-sheet'

/** Documento del formato oficial que corresponde al resumen guardado, o null si es un informe libre. */
function documentFor(summary: unknown): ReactNode | null {
  if (isDiagnosticReport(summary)) return <DiagnosticReportDocument summary={summary} />
  if (isFollowUpReport(summary)) return <FollowUpReportDocument summary={summary} />
  if (isFinalPaoReport(summary)) return <FinalPaoReportDocument summary={summary} />
  return null
}

/** Muestra un informe con formato oficial dentro de un diálogo de lectura. */
export function StructuredReport({ summary }: Readonly<{ summary: unknown }>) {
  const document = documentFor(summary)
  return document && <SheetFrame>{document}</SheetFrame>
}

export function PrintStructuredReport({ summary }: Readonly<{ summary: unknown }>) {
  const document = documentFor(summary)
  return document && <PrintReport>{document}</PrintReport>
}
