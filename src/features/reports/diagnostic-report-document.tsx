import { formatDecimal, type DiagnosticReportSummary } from '@/lib/diagnostic-report'
import { cn } from '@/lib/utils'
import { cell, head } from './report-styles'
import { Letterhead, Sheet, Signature } from './report-sheet'

// Reproduce el formato oficial "1. Reporte Evaluación Diagnóstica" y, como anexo,
// "1.a Calificaciones Diagnóstica".

export function DiagnosticReportDocument({ summary }: Readonly<{ summary: DiagnosticReportSummary }>) {
  const cycle = summary.cycle ?? summary.cycle_name ?? '—'

  return (
    <div className="diagnostic-report flex flex-col gap-4">
      <Sheet>
        <Letterhead faculty={summary.faculty} career={summary.career} title="REPORTE DE LA EVALUACIÓN DIAGNÓSTICA" />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse" aria-label="Datos generales">
            <tbody>
              <tr><th scope="row" className={cn(head, 'w-36 text-left')}>Fecha:</th><td className={cell} colSpan={3}>{summary.date}</td></tr>
              <tr><th scope="row" className={cn(head, 'text-left')}>Docente:</th><td className={cell} colSpan={3}>{summary.teacher}</td></tr>
              <tr>
                <th scope="row" className={cn(head, 'text-left')}>Asignatura:</th><td className={cell}>{summary.subject}</td>
                <th scope="row" className={cn(head, 'w-28 text-left')}>Ciclo:</th><td className={cn(cell, 'w-24')}>{cycle}</td>
              </tr>
              <tr>
                <th scope="row" className={cn(head, 'text-left')}>Período acad:</th><td className={cell}>{summary.academic_period ?? '—'}</td>
                <th scope="row" className={cn(head, 'text-left')}>Paralelo:</th><td className={cell}>{summary.section ?? '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="font-bold">2. PARÁMETROS DE LA EVALUACIÓN AL ESTUDIANTE:</h4>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse" aria-label="Parámetros de la evaluación al estudiante">
              <thead>
                <tr>
                  <th scope="col" className={cn(head, 'w-[30%] text-left')}>Métricas de conocimiento mínimo evaluado</th>
                  <th scope="col" className={cn(head, 'w-[14%] text-center')}>Nº de estudiantes</th>
                  <th scope="col" className={cn(head, 'w-[18%] text-center')}>Total general (%) de conocimiento evaluado</th>
                  <th scope="col" className={cn(head, 'text-left')}>Plan de acción</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={cell} />
                  <td className={cn(cell, 'text-center')} colSpan={2}>
                    <div className="grid grid-cols-2 gap-2">
                      <span>En la lista<br /><strong className="text-sm">{summary.students_listed}</strong></span>
                      <span>En el aula<br /><strong className="text-sm">{summary.students_evaluated}</strong></span>
                    </div>
                  </td>
                  <td className={cell} />
                </tr>
                {summary.groups.map((group) => (
                  <tr key={group.key}>
                    <th scope="row" className={cn(cell, 'text-left font-semibold')}>{group.label} ({group.range_label})</th>
                    <td className={cn(cell, 'text-center tabular-nums')}>{group.count}</td>
                    <td className={cn(cell, 'text-center tabular-nums')}>{formatDecimal(group.percentage)}</td>
                    <td className={cell}>
                      <ul className="flex flex-col gap-0.5">
                        {group.action_plan.map((action) => <li key={action}>- {action}</li>)}
                      </ul>
                    </td>
                  </tr>
                ))}
                <tr>
                  <th scope="row" className={cn(head, 'text-left')}>Observaciones</th>
                  <td className={cn(cell, 'whitespace-pre-wrap [overflow-wrap:anywhere]')} colSpan={3}>{summary.observations ?? 'Sin observaciones.'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>Adjunto calificaciones.</p>
        </div>

        <div className="flex flex-wrap justify-around gap-8">
          <Signature name={summary.teacher} role="Docente" />
          <Signature name={summary.coordinator} role="Coordinador/a de carrera" />
        </div>
      </Sheet>

      <Sheet className="report-page-break">
        <Letterhead faculty={summary.faculty} career={summary.career} title="CALIFICACIONES EVALUACIÓN DIAGNÓSTICA" />
        <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          <div><dt className="inline font-semibold">PERÍODO ACADÉMICO: </dt><dd className="inline">{summary.academic_period ?? '—'}</dd></div>
          <div><dt className="inline font-semibold">DOCENTE: </dt><dd className="inline">{summary.teacher}</dd></div>
          <div><dt className="inline font-semibold">ASIGNATURA: </dt><dd className="inline">{summary.subject}</dd></div>
          <div>
            <dt className="inline font-semibold">CICLO: </dt><dd className="inline">{summary.cycle_name ?? cycle}</dd>
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
    </div>
  )
}
