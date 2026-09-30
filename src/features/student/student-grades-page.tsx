import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/format'
import { studentApi, type StudentGradeEntry, type StudentGrades } from '@/lib/student-api'
import { StudentEmpty, StudentReadPage } from './student-shared'
import { tutoringContext } from './student-format'

function GradeTile({ label, entry, maximum }: Readonly<{ label: string; entry: StudentGradeEntry | null; maximum: number }>) {
  return <div className="flex flex-col gap-1 rounded-lg border bg-muted/30 p-4">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="text-3xl font-semibold tabular-nums">{entry ? entry.formatted_value : '—'}<span className="ml-1 text-sm font-normal text-muted-foreground">/ {maximum}</span></dd>
    <dd className="text-xs text-muted-foreground">{entry?.registered_at ? `Registrada el ${formatDate(entry.registered_at)}` : 'Aún sin registrar'}</dd>
  </div>
}

function GradesCard({ item }: Readonly<{ item: StudentGrades }>) {
  const { diagnostic, partial } = item.grades
  const metric = item.knowledge_metric
  return <Card>
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CardTitle className="min-w-0 break-words">{item.tutoring?.name ?? 'Tutoría no disponible'}</CardTitle>
        {metric ? <Badge>Grupo de conocimiento: {metric.group}</Badge> : <Badge variant="secondary">Sin clasificar</Badge>}
      </div>
      <CardDescription>{tutoringContext(item.tutoring)}{item.tutoring?.teacher ? ` · ${item.tutoring.teacher.name}` : ''}</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-5">
      <dl className="grid gap-4 sm:grid-cols-2">
        <GradeTile label="Diagnóstico" entry={diagnostic} maximum={item.scale_settings.maximum} />
        <GradeTile label="Nota parcial" entry={partial} maximum={item.scale_settings.maximum} />
      </dl>
      {metric && <p className="text-sm text-muted-foreground">Tu diagnóstico te ubica en el rango {metric.min_score} – {metric.max_score}.</p>}
      <section aria-label={`Historial de notas de ${item.tutoring?.name ?? 'la tutoría'}`} className="flex flex-col gap-2">
        <h3 className="font-semibold">Historial de registros</h3>
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
