import { formatDecimal } from '@/lib/diagnostic-report'
import type { DiagnosticGradeRow } from '@/lib/diagnostic-grades'
import { cn } from '@/lib/utils'
import { cell, head } from './report-styles'
import { Letterhead, Sheet, Signature } from './report-sheet'

type GradesSheetData = {
  readonly faculty: string | null
  readonly career: string | null
  readonly subject: string
  readonly cycle: number | null
  readonly cycle_name: string | null
  readonly academic_period: string | null
  readonly section: string | null
  readonly teacher: string
  readonly grades: readonly DiagnosticGradeRow[]
}

// Reproduce el formato oficial "1.a Calificaciones Diagnóstica". También es el anexo
// del Reporte de la Evaluación Diagnóstica.
export function DiagnosticGradesSheet({ summary, className }: Readonly<{ summary: GradesSheetData; className?: string }>) {
  return (
    <Sheet className={className}>
      <Letterhead faculty={summary.faculty} career={summary.career} title="CALIFICACIONES EVALUACIÓN DIAGNÓSTICA" />
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        <div><dt className="inline font-semibold">PERÍODO ACADÉMICO: </dt><dd className="inline">{summary.academic_period ?? '—'}</dd></div>
        <div><dt className="inline font-semibold">DOCENTE: </dt><dd className="inline">{summary.teacher}</dd></div>
        <div><dt className="inline font-semibold">ASIGNATURA: </dt><dd className="inline">{summary.subject}</dd></div>
        <div>
          <dt className="inline font-semibold">CICLO: </dt><dd className="inline">{summary.cycle_name ?? summary.cycle ?? '—'}</dd>
          <dt className="ml-4 inline font-semibold">PARALELO: </dt><dd className="inline">{summary.section ?? '—'}</dd>
        </div>
      </dl>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse" aria-label="Calificaciones de la evaluación diagnóstica">
          <thead>
            <tr>
              <th scope="col" className={cn(head, 'w-12 text-center')}>No.</th>
              <th scope="col" className={cn(head, 'w-32 text-center')}>Cédula</th>
              <th scope="col" className={cn(head, 'text-left')}>Apellidos y nombres</th>
              <th scope="col" className={cn(head, 'w-32 text-center')}>Calificación /10</th>
            </tr>
          </thead>
          <tbody>
            {summary.grades.map((row) => (
              <tr key={row.number}>
                <td className={cn(cell, 'text-center tabular-nums')}>{row.number}</td>
                <td className={cn(cell, 'text-center tabular-nums')}>{row.identification ?? '—'}</td>
                <td className={cn(cell, 'uppercase')}>{row.name}</td>
                <td className={cn(cell, 'text-center tabular-nums')}>{row.grade === null ? 'No asiste' : formatDecimal(row.grade)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-center">
        <Signature name={summary.teacher} role="Firma del docente" />
      </div>
    </Sheet>
  )
}
