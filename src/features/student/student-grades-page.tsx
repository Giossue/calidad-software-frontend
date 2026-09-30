import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/format'
import { studentApi, type StudentGradeEntry, type StudentGrades } from '@/lib/student-api'
import { StudentEmpty, StudentReadPage } from './student-shared'
import { ContextPills, IconTile, RedProgress } from './student-ui'

function GradeTile({ label, entry, maximum }: Readonly<{ label: string; entry: StudentGradeEntry | null; maximum: number }>) {
  return <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-5">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="text-4xl font-semibold tabular-nums">{entry ? entry.formatted_value : '—'}<span className="ml-1 text-sm font-normal text-muted-foreground">/ {maximum}</span></dd>
    <dd><RedProgress value={entry && maximum > 0 ? (entry.value / maximum) * 100 : 0} label={`${label} sobre ${maximum}`} /></dd>
    <dd className="text-xs text-muted-foreground">{entry?.registered_at ? `Registrada el ${formatDate(entry.registered_at)}` : 'Aún sin registrar'}</dd>
  </div>
}

function GradesCard({ item }: Readonly<{ item: StudentGrades }>) {
  const { diagnostic, partial } = item.grades
  const metric = item.knowledge_metric
  return <Card>
    <CardContent className="flex flex-col gap-6 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4"><IconTile /><div className="flex min-w-0 flex-col gap-2"><h3 className="break-words text-lg font-semibold tracking-tight">{item.tutoring?.name ?? 'Tutoría no disponible'}</h3><ContextPills source={item.tutoring} /></div></div>
        {metric ? <Badge variant="secondary" className="px-3 py-1">Grupo de conocimiento: {metric.group}</Badge> : <Badge variant="secondary" className="px-3 py-1">Sin clasificar</Badge>}
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <GradeTile label="Diagnóstico" entry={diagnostic} maximum={item.scale_settings.maximum} />
        <GradeTile label="Nota parcial" entry={partial} maximum={item.scale_settings.maximum} />
      </dl>
      {metric && <p className="text-sm text-muted-foreground">Tu diagnóstico te ubica en el rango {metric.min_score} – {metric.max_score}.</p>}
      <section aria-label={`Historial de notas de ${item.tutoring?.name ?? 'la tutoría'}`} className="flex flex-col gap-3 border-t pt-5">
        <h4 className="font-semibold">Historial de registros</h4>
        {item.grades.history.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay notas registradas.</p> : <ul className="flex flex-col gap-2 text-sm">
          {item.grades.history.map((entry) => <li key={entry.id} className="flex flex-wrap justify-between gap-2 border-l-2 border-border pl-4"><span>{entry.type === 'diagnostic' ? 'Diagnóstico' : 'Nota parcial'}: <strong className="tabular-nums">{entry.formatted_value}</strong></span><span className="text-muted-foreground">{entry.registered_at ? formatDate(entry.registered_at) : 'Sin fecha'}</span></li>)}
        </ul>}
      </section>
    </CardContent>
  </Card>
}

export function StudentGradesPage() {
  return <StudentReadPage title="Mis calificaciones" description="Revisa tu diagnóstico, tu nota parcial y el grupo de conocimiento asignado en cada tutoría." label="calificaciones" loader={studentApi.grades}
    empty={<StudentEmpty title="Aún no tienes calificaciones" description="Cuando tu docente registre notas de una tutoría, las verás aquí." />}>
    {(rows) => rows.map((item) => <GradesCard key={item.enrollment_id} item={item} />)}
  </StudentReadPage>
}
