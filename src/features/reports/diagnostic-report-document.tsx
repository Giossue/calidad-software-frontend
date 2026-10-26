import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PrinterIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatDecimal, type DiagnosticReportSummary } from '@/lib/diagnostic-report'
import { cn } from '@/lib/utils'

// Reproduce el formato oficial "1. Reporte Evaluación Diagnóstica" y, como anexo,
// "1.a Calificaciones Diagnóstica". Se ve como una hoja de papel también en modo oscuro.

const cell = 'border border-slate-800 px-2 py-1.5 align-top'
const head = cn(cell, 'bg-slate-100 font-semibold uppercase')

function Sheet({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <section className={cn('diagnostic-sheet flex flex-col gap-5 bg-white p-5 text-[13px] leading-snug text-slate-900 sm:p-8', className)}>
      {children}
    </section>
  )
}

function Letterhead({ summary, title }: Readonly<{ summary: DiagnosticReportSummary; title: string }>) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center gap-3 border-b border-slate-300 pb-3">
        <img src="/ueb-logo.png" alt="Universidad Estatal de Bolívar" className="size-12 object-contain" />
        <div className="flex flex-col gap-0.5">
          <p><span className="font-semibold">FACULTAD:</span> {summary.faculty ?? '—'}</p>
          <p><span className="font-semibold">CARRERA:</span> {summary.career ?? '—'}</p>
        </div>
      </div>
      <h3 className="text-center text-base font-bold tracking-wide">{title}</h3>
    </header>
  )
}

function Signature({ name, role }: Readonly<{ name: string | null; role: string }>) {
  return (
    <div className="flex min-w-48 flex-1 flex-col items-center gap-1 pt-10 text-center">
      <span className="w-full border-t border-slate-800" />
      <span className="font-medium">{name ?? ' '}</span>
      <span className="text-xs font-semibold uppercase">{role}</span>
    </div>
  )
}

export function DiagnosticReportDocument({ summary }: Readonly<{ summary: DiagnosticReportSummary }>) {
  const cycle = summary.cycle ?? summary.cycle_name ?? '—'

  return (
    <div className="diagnostic-report flex flex-col gap-4">
      <Sheet>
        <Letterhead summary={summary} title="REPORTE DE LA EVALUACIÓN DIAGNÓSTICA" />

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

      <Sheet className="diagnostic-annex">
        <Letterhead summary={summary} title="CALIFICACIONES EVALUACIÓN DIAGNÓSTICA" />
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

/**
 * Botón para imprimir o guardar en PDF. El documento se copia fuera de los diálogos
 * (directamente en <body>) para que la hoja de estilos de impresión lo muestre solo a él.
 */
export function PrintDiagnosticReport({ summary, disabled = false }: Readonly<{ summary: DiagnosticReportSummary; disabled?: boolean }>) {
  return (
    <>
      <Button type="button" variant="outline" disabled={disabled} onClick={() => window.print()}>
        <PrinterIcon data-icon="inline-start" />
        Imprimir o guardar PDF
      </Button>
      {createPortal(
        <div className="print-root" aria-hidden="true">
          <DiagnosticReportDocument summary={summary} />
        </div>,
        document.body,
      )}
    </>
  )
}
