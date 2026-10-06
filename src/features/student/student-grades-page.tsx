import { Skeleton } from '@/components/ui/skeleton'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { ErrorNotice } from '@/features/tutoring/tutoring-shared'
import { formatDate } from '@/lib/format'
import { studentApi, type StudentGradeEntry } from '@/lib/student-api'
import { StudentEmpty } from './student-shared'
import { RedProgress } from './student-ui'

function GradeTile({ label, entry, maximum }: Readonly<{ label: string; entry: StudentGradeEntry | null; maximum: number }>) {
  return <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-5">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="text-4xl font-semibold tabular-nums">{entry ? entry.formatted_value : '—'}<span className="ml-1 text-sm font-normal text-muted-foreground">/ {maximum}</span></dd>
    <dd><RedProgress value={entry && maximum > 0 ? (entry.value / maximum) * 100 : 0} label={`${label} sobre ${maximum}`} /></dd>
    <dd className="text-xs text-muted-foreground">{entry?.registered_at ? `Registrada el ${formatDate(entry.registered_at)}` : 'Aún sin registrar'}</dd>
  </div>
}

// Notas de una tutoría: diagnóstico, parcial 1 y parcial 2, con el grupo de conocimiento.
export function GradesPanel({ tutoringId }: Readonly<{ tutoringId: number }>) {
  const resource = useDegreeResource(studentApi.grades)
  const item = resource.data?.find((grades) => grades.tutoring?.id === tutoringId)

  return <div className="flex flex-col gap-5">
    <ErrorNotice message={resource.error} retry={resource.reload} />
    {resource.loading ? <Skeleton role="status" aria-label="Cargando calificaciones" className="h-48 w-full" /> : !resource.error && (!item ? <StudentEmpty title="Aún no tienes calificaciones" description="Cuando tu docente registre notas de esta tutoría, las verás aquí." /> : <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{item.knowledge_metric ? `Tu diagnóstico te ubica en el rango ${item.knowledge_metric.min_score} – ${item.knowledge_metric.max_score}.` : 'Tu grupo de conocimiento se define con la nota diagnóstica.'}</p>
        <span className="text-sm font-medium text-foreground">{item.knowledge_metric ? `Grupo de conocimiento: ${item.knowledge_metric.group}` : 'Sin clasificar'}</span>
      </div>
      <dl className="grid gap-4 sm:grid-cols-3">
        <GradeTile label="Diagnóstico" entry={item.grades.diagnostic} maximum={item.scale_settings.maximum} />
        <GradeTile label="Parcial 1" entry={item.grades.partial} maximum={item.scale_settings.maximum} />
        <GradeTile label="Parcial 2" entry={item.grades.second_partial} maximum={item.scale_settings.maximum} />
      </dl>
    </>)}
  </div>
}
