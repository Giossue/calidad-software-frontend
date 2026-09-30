import { useSearchParams } from 'react-router-dom'
import { CheckCircle2Icon, CircleDashedIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { ErrorNotice } from '@/features/tutoring/tutoring-shared'
import { studentApi, type StudentContent, type StudentTopic } from '@/lib/student-api'
import { StudentEmpty } from './student-shared'
import { tutoringContext } from './student-format'

function TopicItem({ topic }: Readonly<{ topic: StudentTopic }>) {
  return <li className="flex flex-col gap-3 rounded-lg border p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <h3 className="min-w-0 break-words font-semibold">{topic.name}</h3>
      <Badge variant={topic.is_covered ? 'success' : 'secondary'} className="gap-1.5">{topic.is_covered ? <CheckCircle2Icon aria-hidden="true" /> : <CircleDashedIcon aria-hidden="true" />}{topic.is_covered ? 'Visto' : 'Pendiente'}</Badge>
    </div>
    {topic.description && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{topic.description}</p>}
    {topic.activities.length === 0 ? <p className="text-sm text-muted-foreground">Este tema aún no tiene actividades.</p> : <ul className="flex flex-col gap-3 border-l-2 border-border pl-4">
      {topic.activities.map((activity) => <li key={activity.id} className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{activity.name} <span className="font-normal text-muted-foreground">· {activity.duration}</span></span>
        {activity.methodologies.length > 0 && <ul className="list-disc pl-5 text-muted-foreground">{activity.methodologies.map((methodology) => <li key={methodology.id} className="break-words">{methodology.description}</li>)}</ul>}
      </li>)}
    </ul>}
  </li>
}

function ContentView({ content }: Readonly<{ content: StudentContent }>) {
  const { progress } = content
  return <Card>
    <CardHeader><CardTitle>Avance del plan didáctico</CardTitle><CardDescription>{tutoringContext(content.tutoring)}{content.tutoring.teacher ? ` · ${content.tutoring.teacher.name}` : ''}</CardDescription></CardHeader>
    <CardContent className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div role="progressbar" aria-label="Avance de temas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.progress_percentage} className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, progress.progress_percentage)}%` }} /></div>
        <p className="text-sm text-muted-foreground">{progress.covered_topics} de {progress.total_topics} temas vistos ({progress.progress_percentage}%) · {progress.pending_topics} pendientes</p>
      </div>
      {content.topics.length === 0 ? <StudentEmpty title="El docente aún no registra temas" description="Los temas, actividades y metodologías aparecerán cuando se publiquen." /> : <ul className="flex flex-col gap-3">{content.topics.map((topic) => <TopicItem key={topic.id} topic={topic} />)}</ul>}
    </CardContent>
  </Card>
}

export function StudentContentPage() {
  const tutorings = useDegreeResource(studentApi.tutorings)
  const [params, setParams] = useSearchParams()
  const rows = tutorings.data ?? []
  const requested = params.get('tutoring')
  const selected = rows.find((item) => item.subject && String(item.subject.id) === requested) ?? rows.find((item) => item.subject)
  const selectedId = selected?.subject?.id
  const content = useDegreeResource(() => selectedId === undefined ? Promise.resolve(null) : studentApi.content(selectedId), String(selectedId ?? ''))

  return <section className="flex min-w-0 flex-col gap-6" aria-busy={tutorings.loading || content.loading}>
    <AdminSectionHeader title="Contenido de la tutoría" description="Revisa los temas, actividades y metodologías de tu tutoría y el avance del plan didáctico." />
    <ErrorNotice message={tutorings.error ?? content.error} retry={tutorings.error ? tutorings.reload : content.reload} />
    {tutorings.loading ? <div role="status" aria-label="Cargando contenido" className="flex flex-col gap-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-48 w-full" /></div> : !tutorings.error && !selected ? <StudentEmpty title="Aún no estás inscrito en ninguna tutoría" description="Cuando tu docente te inscriba, podrás revisar aquí su contenido." /> : selected && <>
      <Card><CardContent><Field className="max-w-2xl"><FieldLabel htmlFor="student-tutoring">Tutoría</FieldLabel><NativeSelect id="student-tutoring" value={selectedId} onChange={(event) => setParams({ tutoring: event.target.value })}>
        {rows.filter((item) => item.subject).map((item) => <option key={item.id} value={item.subject?.id}>{item.subject?.name} · {item.subject?.academic_period?.name}</option>)}
      </NativeSelect></Field></CardContent></Card>
      {content.loading ? <Skeleton role="status" aria-label="Cargando temas" className="h-48 w-full" /> : content.data && <ContentView content={content.data} />}
    </>}
  </section>
}
