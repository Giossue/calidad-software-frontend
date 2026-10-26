import type { ReactNode } from 'react'

import { formatDecimal } from '@/lib/diagnostic-report'
import { formatReportDate, type FinalPaoContact, type FinalPaoReportSummary } from '@/lib/final-pao-report'
import { formatActivityDate, formatGrade } from '@/lib/follow-up-report'
import { DAY_LABELS } from '@/lib/tutoring-api'
import { cn } from '@/lib/utils'
import { cell, head } from './report-styles'
import { SectionTitle, Sheet } from './report-sheet'

// Reproduce el formato oficial "4. Informe final PAO" con el membrete de la Facultad.

const small = 'border border-slate-800 px-1.5 py-1 align-top text-[11px]'
const smallHead = cn(small, 'bg-slate-100 text-center font-semibold')

function Letterhead() {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-slate-300 pb-3">
      <img src="/ueb-logo.png" alt="Universidad Estatal de Bolívar" className="h-14 w-auto object-contain" />
      <p className="max-w-56 text-right text-xs font-bold uppercase leading-tight text-[#0b1f4b]">
        Facultad de Ciencias Administrativas, Gestión Empresarial e Informática
      </p>
    </header>
  )
}

function Footer() {
  return (
    <footer className="mt-auto flex flex-col gap-0.5 border-t border-slate-300 pt-2 text-[11px] text-[#0b1f4b]">
      <p><span className="font-semibold">Dirección:</span> Av. Ernesto Che Guevara y Gabriel Secaira, Guaranda-Ecuador</p>
      <p>Teléfono: (593) 3220 6059 · <span className="font-bold">www.ueb.edu.ec</span></p>
    </footer>
  )
}

function ContactRows({ label, contact }: Readonly<{ label: string; contact: FinalPaoContact }>) {
  return (
    <>
      <tr>
        <th scope="rowgroup" rowSpan={3} className={cn(head, 'w-36 text-left normal-case')}>{label}</th>
        <th scope="col" rowSpan={2} className={cn(head, 'text-center normal-case')}>Nombre</th>
        <th scope="col" colSpan={2} className={cn(head, 'text-center normal-case')}>Contacto</th>
        <th scope="col" rowSpan={2} className={cn(head, 'text-center normal-case')}>Cargo</th>
      </tr>
      <tr>
        <th scope="col" className={cn(head, 'text-center normal-case')}>Extensión telefónica</th>
        <th scope="col" className={cn(head, 'text-center normal-case')}>Correo electrónico</th>
      </tr>
      <tr>
        <td className={cell}>{contact.name ?? '—'}</td>
        <td className={cn(cell, 'text-center')}>{contact.extension ?? 'S/n'}</td>
        <td className={cn(cell, '[overflow-wrap:anywhere]')}>{contact.email ?? '—'}</td>
        <td className={cell}>{contact.position}</td>
      </tr>
    </>
  )
}

function Paragraphs({ text, empty }: Readonly<{ text: string | null; empty: string }>) {
  return <p className="whitespace-pre-wrap text-justify [overflow-wrap:anywhere]">{text ?? empty}</p>
}

function Block({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-2">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  )
}

export function FinalPaoReportDocument({ summary }: Readonly<{ summary: FinalPaoReportSummary }>) {
  return (
    <div className="final-pao-report flex flex-col gap-4">
      <Sheet className="min-h-[60rem]">
        <Letterhead />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse" aria-label="Datos generales">
            <tbody>
              <tr>
                <td rowSpan={2} className={cn(cell, 'w-32 text-center align-middle text-[11px] font-semibold text-slate-500')}>SELLO DE LA CARRERA</td>
                <td colSpan={3} className={cn(cell, 'text-center font-bold')}>Universidad Estatal de Bolívar</td>
                <td rowSpan={2} className={cn(head, 'w-24 align-middle normal-case')}>Versión:</td>
                <td rowSpan={2} className={cn(cell, 'w-16 text-center align-middle')}>1.0</td>
              </tr>
              <tr>
                <td colSpan={3} className={cn(cell, 'text-center font-semibold')}>Informe General</td>
              </tr>
              <tr><th colSpan={6} scope="colgroup" className={cn(head, 'text-center')}>Datos generales</th></tr>
              <tr>
                <th scope="row" className={cn(head, 'text-left normal-case')}>Fecha de informe</th>
                <td colSpan={2} className={cell}>{formatReportDate(summary.date)}</td>
                <th scope="row" className={cn(head, 'text-left normal-case')}>No. de informe</th>
                <td colSpan={2} className={cell}>{summary.report_number}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse" aria-label="Funcionario responsable y destinatario">
            <tbody>
              <ContactRows label="Funcionario responsable de informe" contact={summary.teacher} />
              <ContactRows label="Informe dirigido a:" contact={summary.coordinator} />
              <tr><th colSpan={5} scope="colgroup" className={cn(head, 'text-left')}>Asunto: {summary.subject_line}</th></tr>
            </tbody>
          </table>
        </div>

        <Block title="Información general">
          <p><span className="font-semibold">Facultad:</span> {summary.faculty ?? '—'}</p>
          <p><span className="font-semibold">Carrera:</span> {summary.career}</p>
          <p className="text-justify"><span className="font-semibold">Objetivo del Informe:</span> {summary.objective}</p>
        </Block>

        <Block title="1. Antecedentes">
          <p className="text-justify">{summary.background}</p>
          <p>Las tutorías académicas fueron ejecutadas en el siguiente horario:</p>
          <table className="w-full border-collapse" aria-label="Horario de tutorías">
            <thead>
              <tr>
                <th scope="col" className={cn(head, 'text-left normal-case')}>Asignatura</th>
                <th scope="col" className={cn(head, 'w-28 text-left normal-case')}>Día</th>
                <th scope="col" className={cn(head, 'w-32 text-center normal-case')}>Hora</th>
                <th scope="col" className={cn(head, 'w-28 text-left normal-case')}>Aula</th>
              </tr>
            </thead>
            <tbody>
              {summary.schedule.length === 0 ? (
                <tr><td colSpan={4} className={cn(cell, 'text-center text-slate-600')}>Sin horarios registrados.</td></tr>
              ) : (
                summary.schedule.map((slot) => (
                  <tr key={`${slot.subject}-${slot.section}-${slot.day}-${slot.start}`}>
                    <td className={cell}>{slot.subject}{slot.section ? ` (${slot.section})` : ''}</td>
                    <td className={cell}>{DAY_LABELS[slot.day] ?? slot.day}</td>
                    <td className={cn(cell, 'text-center tabular-nums')}>{slot.start} – {slot.end}</td>
                    <td className={cell}>{slot.room ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Block>

        <Block title="2. Resultados de ejecución de las tutorías académicas">
          <h5 className="font-semibold">2.1. Matriz de Operacionalización de Tutorías</h5>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse" aria-label="Matriz de operacionalización de tutorías">
              <thead>
                <tr>
                  {[
                    'Asignatura', 'Ciclo', '# Horas por semana asignadas a tutorías', '# Horas de tutorías realizadas',
                    '# Estudiantes matriculados en la asignatura', '# Estudiantes con riesgo académico',
                    '# Estudiantes con riesgo académico que asisten a tutorías',
                    '# Estudiantes con riesgo académico que asistieron a tutorías y aprobaron',
                    '# Estudiantes con riesgo académico que mejoraron su rendimiento académico',
                    '% Efectividad de las tutorías', 'Observaciones',
                  ].map((label) => <th key={label} scope="col" className={smallHead}>{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {summary.matrix.map((row) => (
                  <tr key={row.tutoring_id}>
                    <th scope="row" className={cn(small, 'text-left font-medium')}>{row.subject}{row.section ? ` (${row.section})` : ''}</th>
                    <td className={cn(small, 'text-center')}>{row.cycle ?? row.cycle_name ?? '—'}</td>
                    <td className={cn(small, 'text-center tabular-nums')}>{formatDecimal(row.weekly_hours)}</td>
                    <td className={cn(small, 'text-center tabular-nums')}>{formatDecimal(row.hours_done)}</td>
                    <td className={cn(small, 'text-center tabular-nums')}>{row.enrolled}</td>
                    <td className={cn(small, 'text-center tabular-nums')}>{row.at_risk}</td>
                    <td className={cn(small, 'text-center tabular-nums')}>{row.at_risk_attending}</td>
                    <td className={cn(small, 'text-center tabular-nums')}>{row.at_risk_attending_passed}</td>
                    <td className={cn(small, 'text-center tabular-nums')}>{row.at_risk_improved}</td>
                    <td className={cn(small, 'text-center tabular-nums')}>{row.effectiveness === null ? '—' : `${formatDecimal(row.effectiveness)}%`}</td>
                    <td className={cn(small, 'whitespace-pre-wrap [overflow-wrap:anywhere]')}>{row.observation ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-600">
            Riesgo académico: evaluación diagnóstica Bajo o Medio. Aprobó: promedio de los dos parciales ≥ {formatDecimal(summary.passing_grade)}.
            Mejoró: segundo parcial mayor que el primero. % Efectividad: con riesgo que asistieron y aprobaron ÷ con riesgo que asisten.
          </p>
        </Block>

        <Block title="4. Conclusiones">
          <Paragraphs text={summary.conclusions} empty="—" />
        </Block>
        <Block title="5. Recomendaciones">
          <Paragraphs text={summary.recommendations} empty="—" />
        </Block>

        <Footer />
      </Sheet>

      <Sheet className="report-page-break min-h-[60rem]">
        <Letterhead />
        <Block title="6. Anexos">
          <h5 className="font-semibold">Anexo 1: Estudiantes que mejoraron su rendimiento al segundo parcial</h5>
          {summary.improved.map((group) => (
            <div key={`${group.subject}-${group.section}`} className="flex flex-col gap-1">
              <p><span className="font-semibold">Asignatura:</span> {group.subject}{group.section ? ` (paralelo ${group.section})` : ''}</p>
              <table className="w-full border-collapse" aria-label={`Estudiantes que mejoraron su rendimiento en ${group.subject}`}>
                <thead>
                  <tr>
                    <th scope="col" className={cn(head, 'w-12 text-center')}>No.</th>
                    <th scope="col" className={cn(head, 'text-left')}>Estudiante</th>
                    <th scope="col" className={cn(head, 'w-32 text-center normal-case')}>Evaluación Primer Parcial</th>
                    <th scope="col" className={cn(head, 'w-32 text-center normal-case')}>Evaluación Segundo Parcial</th>
                  </tr>
                </thead>
                <tbody>
                  {group.students.length === 0 ? (
                    <tr><td colSpan={4} className={cn(cell, 'text-center text-slate-600')}>Ningún estudiante mejoró su nota en el segundo parcial.</td></tr>
                  ) : (
                    group.students.map((student) => (
                      <tr key={student.number}>
                        <td className={cn(cell, 'text-center tabular-nums')}>{student.number}</td>
                        <td className={cn(cell, 'uppercase')}>{student.name}</td>
                        <td className={cn(cell, 'text-center tabular-nums')}>{formatGrade(student.first)}</td>
                        <td className={cn(cell, 'text-center tabular-nums')}>{formatGrade(student.second)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ))}

          <h5 className="mt-2 font-semibold">Anexo 2: Registro de tutorías</h5>
          {summary.register.map((group) => (
            <div key={`${group.subject}-${group.section}`} className="flex flex-col gap-1">
              <p><span className="font-semibold">Asignatura:</span> {group.subject}{group.section ? ` (paralelo ${group.section})` : ''}</p>
              <table className="w-full border-collapse" aria-label={`Registro de tutorías de ${group.subject}`}>
                <thead>
                  <tr>
                    <th scope="col" className={cn(head, 'w-28 text-center')}>Fecha</th>
                    <th scope="col" className={cn(head, 'text-left')}>Temas abordados</th>
                    <th scope="col" className={cn(head, 'w-32 text-center')}>Asistentes</th>
                  </tr>
                </thead>
                <tbody>
                  {group.sessions.length === 0 ? (
                    <tr><td colSpan={3} className={cn(cell, 'text-center text-slate-600')}>Sin tutorías registradas.</td></tr>
                  ) : (
                    group.sessions.map((session) => (
                      <tr key={session.date}>
                        <td className={cn(cell, 'text-center tabular-nums')}>{formatActivityDate(session.date)}</td>
                        <td className={cell}>{session.topics.length ? session.topics.join('; ') : '—'}</td>
                        <td className={cn(cell, 'text-center tabular-nums')}>{session.present} de {session.total}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </Block>

        <table className="mt-4 w-full border-collapse" aria-label="Firmas">
          <thead>
            <tr>
              <th scope="col" className={cn(head, 'w-40 text-left normal-case')}>Datos</th>
              <th scope="col" className={cn(head, 'text-center normal-case')}>Elaborado por:</th>
              <th scope="col" className={cn(head, 'text-center normal-case')}>Revisado por:</th>
            </tr>
          </thead>
          <tbody>
            <tr><th scope="row" className={cn(cell, 'text-left font-semibold')}>Firma</th><td className={cn(cell, 'h-16')} /><td className={cell} /></tr>
            <tr>
              <th scope="row" className={cn(cell, 'text-left font-semibold')}>Nombre y Apellido</th>
              <td className={cn(cell, 'text-center')}>{summary.teacher.name}</td>
              <td className={cn(cell, 'text-center')}>{summary.coordinator.name ?? ''}</td>
            </tr>
            <tr>
              <th scope="row" className={cn(cell, 'text-left font-semibold')}>Cargo</th>
              <td className={cn(cell, 'text-center')}>Docente</td>
              <td className={cn(cell, 'text-center')}>Coordinador/a de Carrera</td>
            </tr>
          </tbody>
        </table>

        <Footer />
      </Sheet>
    </div>
  )
}
