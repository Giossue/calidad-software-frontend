import { formatActivityDate, formatGrade, formatPresentationDate, type FollowUpReportSummary } from '@/lib/follow-up-report'
import { cn } from '@/lib/utils'
import { cell, head } from './report-styles'
import { Letterhead, SectionTitle, Sheet, Signature } from './report-sheet'

// Reproduce el formato oficial "3. Seguimiento Tutorías".

export function FollowUpReportDocument({ summary }: Readonly<{ summary: FollowUpReportSummary }>) {
  const subject = summary.subject
  const { attendance } = summary

  return (
    <div className="follow-up-report flex flex-col gap-4">
      <Sheet>
        <Letterhead title="REPORTE DE SEGUIMIENTO A LAS TUTORÍAS ACADÉMICAS" />

        <div className="flex flex-col gap-2">
          <SectionTitle>Datos informativos</SectionTitle>
          <table className="w-full border-collapse" aria-label="Datos informativos">
            <tbody>
              {[
                ['Facultad:', summary.faculty ?? '—'],
                ['Carrera:', summary.career ?? '—'],
                ['Periodo académico:', summary.academic_period ?? '—'],
                ['Docente:', summary.teacher],
                ['Fecha de presentación:', formatPresentationDate(summary.date)],
              ].map(([label, value]) => (
                <tr key={label}>
                  <th scope="row" className={cn(cell, 'w-44 bg-slate-100 text-left font-semibold')}>{label}</th>
                  <td className={cell}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2">
          <SectionTitle>Antecedentes</SectionTitle>
          <p className="text-justify">{summary.background}</p>
        </div>

        <div className="flex flex-col gap-2">
          <SectionTitle>Actividades programadas</SectionTitle>
          <p>Durante el {summary.partial_label} en la asignatura de {subject} se revisó las siguientes temáticas:</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse" aria-label="Actividades programadas">
              <thead>
                <tr>
                  <th scope="col" className={cn(head, 'w-28 text-center')}>Fecha</th>
                  <th scope="col" className={cn(head, 'text-left')}>Tema</th>
                  <th scope="col" className={cn(head, 'text-left')}>Actividad</th>
                  <th scope="col" className={cn(head, 'text-left')}>Metodología</th>
                </tr>
              </thead>
              <tbody>
                {summary.activities.length === 0 ? (
                  <tr><td className={cn(cell, 'text-center text-slate-600')} colSpan={4}>No hay temas registrados en las tutorías de este período.</td></tr>
                ) : (
                  summary.activities.map((row, index) => (
                    <tr key={`${row.date}-${row.topic}-${row.activity ?? index}`}>
                      <td className={cn(cell, 'text-center tabular-nums')}>{formatActivityDate(row.date)}</td>
                      <td className={cell}>{row.topic}</td>
                      <td className={cell}>{row.activity ?? '—'}</td>
                      <td className={cell}>{row.methodology ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <SectionTitle>Número de estudiantes que asisten a tutorías</SectionTitle>
          <p>Durante el {summary.partial_label} en la asignatura de {subject} asistieron el siguiente número de estudiantes:</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse" aria-label="Número de estudiantes que asisten a tutorías">
              <thead>
                <tr>
                  <th scope="col" className={cn(head, 'text-center normal-case')}>Total estudiantes con riesgo académico</th>
                  <th scope="col" className={cn(head, 'text-center normal-case')}># de estudiantes con riesgo académico que asisten</th>
                  <th scope="col" className={cn(head, 'text-center normal-case')}># de estudiantes sin riesgo académico que asisten</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={cn(cell, 'text-center tabular-nums')}>{attendance.at_risk_total}</td>
                  <td className={cn(cell, 'text-center tabular-nums')}>{attendance.at_risk_attending}</td>
                  <td className={cn(cell, 'text-center tabular-nums')}>{attendance.not_at_risk_attending}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {attendance.unclassified_attending > 0 && (
            <p className="text-xs text-slate-600">
              Además asistieron {attendance.unclassified_attending} {attendance.unclassified_attending === 1 ? 'estudiante' : 'estudiantes'} sin evaluación diagnóstica registrada.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <SectionTitle>Estudiantes que mejoraron su rendimiento</SectionTitle>
          <p>Durante el {summary.partial_label} en la asignatura de {subject} se evidenció que los siguientes estudiantes mejoraron su rendimiento:</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse" aria-label="Estudiantes que mejoraron su rendimiento">
              <thead>
                <tr>
                  <th scope="col" className={cn(head, 'w-12 text-center')}>No.</th>
                  <th scope="col" className={cn(head, 'text-left')}>Estudiante</th>
                  <th scope="col" className={cn(head, 'w-32 text-center normal-case')}>Evaluación Diagnóstica</th>
                  <th scope="col" className={cn(head, 'w-32 text-center normal-case')}>Evaluación {summary.partial_title}</th>
                </tr>
              </thead>
              <tbody>
                {summary.improved.length === 0 ? (
                  <tr><td className={cn(cell, 'text-center text-slate-600')} colSpan={4}>Ningún estudiante registra mejora respecto a la evaluación diagnóstica.</td></tr>
                ) : (
                  summary.improved.map((row) => (
                    <tr key={row.number}>
                      <td className={cn(cell, 'text-center tabular-nums')}>{row.number}</td>
                      <td className={cn(cell, 'uppercase')}>{row.name}</td>
                      <td className={cn(cell, 'text-center tabular-nums')}>{formatGrade(row.diagnostic)}</td>
                      <td className={cn(cell, 'text-center tabular-nums')}>{formatGrade(row.partial)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <SectionTitle>Observación</SectionTitle>
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{summary.observations ?? 'Sin observaciones.'}</p>
        </div>

        <div className="flex flex-wrap justify-around gap-8">
          <Signature name={summary.teacher} role="Docente" />
          <Signature name={summary.coordinator} role="Coordinador/a de carrera" />
        </div>
      </Sheet>
    </div>
  )
}
