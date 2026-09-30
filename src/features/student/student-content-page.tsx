import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpenIcon, CalendarDaysIcon, CheckCircle2Icon, ChevronDownIcon, CircleDashedIcon, ClockIcon, FileTextIcon, UsersIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { ErrorNotice } from '@/features/tutoring/tutoring-shared'
import { cn } from '@/lib/utils'
import { studentApi, type StudentContent, type StudentTopic } from '@/lib/student-api'
import { tutoringContext } from './student-format'
import { StudentEmpty } from './student-shared'
import { FilterChips, IconTile, ListFooter, RedProgress, SearchField, TutoringInfoChips } from './student-ui'
import { usePagedList } from './student-hooks'

type TopicFilter = 'all' | 'covered' | 'pending'

function TopicRow({ topic, number }: Readonly<{ topic: StudentTopic; number: number }>) {
  const [open, setOpen] = useState(false)
  const firstActivity = topic.activities[0]
  const firstMethodology = firstActivity?.methodologies[0]
  return <li className="rounded-xl border bg-card transition-colors hover:border-primary/40">
    <button type="button" aria-expanded={open} aria-label={`${open ? 'Ocultar' : 'Ver'} detalle de ${topic.name}`} onClick={() => setOpen(!open)} className="flex w-full items-center gap-4 rounded-xl p-4 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
      <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-base font-semibold text-foreground">{number}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="break-words font-semibold">{topic.name}</span>
        {topic.description && <span className="line-clamp-2 text-sm text-muted-foreground">{topic.description}</span>}
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {firstActivity && <span className="flex items-center gap-1.5"><ClockIcon className="size-3.5" aria-hidden="true" />{firstActivity.duration}</span>}
          <span className="flex items-center gap-1.5"><FileTextIcon className="size-3.5" aria-hidden="true" />{topic.activities_count === 1 ? '1 actividad' : `${topic.activities_count} actividades`}</span>
          {firstMethodology && <span className="flex min-w-0 items-center gap-1.5"><UsersIcon className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{firstMethodology.description}</span></span>}
        </span>
      </span>
      <Badge variant={topic.is_covered ? 'success' : 'secondary'} className="hidden gap-1.5 px-3 py-1 sm:inline-flex">{topic.is_covered ? <CheckCircle2Icon aria-hidden="true" /> : <CircleDashedIcon aria-hidden="true" />}{topic.is_covered ? 'Visto' : 'Pendiente'}</Badge>
      <ChevronDownIcon aria-hidden="true" className={cn('size-5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
    </button>
    {open && <div className="flex flex-col gap-3 border-t px-4 py-4 text-sm sm:pl-[4.75rem]">
      <Badge variant={topic.is_covered ? 'success' : 'secondary'} className="w-fit sm:hidden">{topic.is_covered ? 'Visto' : 'Pendiente'}</Badge>
      {topic.activities.length === 0 ? <p className="text-muted-foreground">Este tema aún no tiene actividades.</p> : <ul className="flex flex-col gap-3">
        {topic.activities.map((activity) => <li key={activity.id} className="flex flex-col gap-1 border-l-2 border-border pl-4">
          <span className="font-medium">{activity.name} <span className="font-normal text-muted-foreground">· {activity.duration}</span></span>
          {activity.methodologies.length > 0 && <ul className="list-disc pl-5 text-muted-foreground">{activity.methodologies.map((methodology) => <li key={methodology.id} className="break-words">{methodology.description}</li>)}</ul>}
        </li>)}
      </ul>}
    </div>}
  </li>
}

function ContentView({ content }: Readonly<{ content: StudentContent }>) {
  const { progress, topics } = content
  const [filter, setFilter] = useState<TopicFilter>('all')
  const [search, setSearch] = useState('')
  const needle = search.trim().toLowerCase()
  const matches = topics.filter((topic) => !needle || `${topic.name} ${topic.description ?? ''}`.toLowerCase().includes(needle))
  const visible = matches.filter((topic) => filter === 'all' || (filter === 'covered') === topic.is_covered)
  const pager = usePagedList(visible)
  const done = progress.total_topics > 0 && progress.pending_topics === 0
  const choose = (next: TopicFilter) => { setFilter(next); pager.setPage(1) }

  return <Card>
    <CardContent className="flex flex-col gap-6 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-xl font-semibold tracking-tight">Avance del plan didáctico</h3>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><span className="flex items-center gap-2"><CalendarDaysIcon className="size-4" aria-hidden="true" />{tutoringContext(content.tutoring)}</span>{progress.total_topics > 0 && (done ? <Badge variant="success">Completado</Badge> : <StatusBadge active activeLabel="En progreso" />)}</div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-4xl font-semibold tabular-nums">{Math.round(progress.progress_percentage)}%</p>
        <RedProgress value={progress.progress_percentage} label="Avance de temas" />
        <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground"><span>{progress.covered_topics} de {progress.total_topics} temas completados</span><span>{progress.pending_topics} pendientes</span></div>
      </div>
      {topics.length === 0 ? <StudentEmpty title="El docente aún no registra temas" description="Los temas, actividades y metodologías aparecerán cuando se publiquen." /> : <>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchField id="student-topic-search" label="Buscar temas" placeholder="Buscar temas…" value={search} onChange={(value) => { setSearch(value); pager.setPage(1) }} />
          <FilterChips label="Filtrar temas" value={filter} onChange={choose} options={[{ value: 'all', label: 'Todos', count: matches.length }, { value: 'covered', label: 'Completados', count: matches.filter((topic) => topic.is_covered).length }, { value: 'pending', label: 'Pendientes', count: matches.filter((topic) => !topic.is_covered).length }]} />
        </div>
        {visible.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Ningún tema coincide con tu búsqueda.</p> : <ul className="flex flex-col gap-3">{pager.rows.map((topic) => <TopicRow key={topic.id} topic={topic} number={topics.indexOf(topic) + 1} />)}</ul>}
        <ListFooter noun="temas" total={visible.length} start={pager.start} shown={pager.rows.length} page={pager.page} lastPage={pager.lastPage} onPage={pager.setPage} />
      </>}
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
    {tutorings.loading ? <div role="status" aria-label="Cargando contenido" className="flex flex-col gap-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div> : !tutorings.error && !selected ? <StudentEmpty title="Aún no estás inscrito en ninguna tutoría" description="Cuando tu docente te inscriba, podrás revisar aquí su contenido." /> : selected && <>
      <Card><CardContent className="flex flex-col gap-5 pt-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center"><IconTile icon={BookOpenIcon} /><Field className="w-full min-w-0 max-w-md"><FieldLabel htmlFor="student-tutoring">Tutoría</FieldLabel><NativeSelect id="student-tutoring" value={selectedId} onChange={(event) => setParams({ tutoring: event.target.value })}>
          {rows.filter((item) => item.subject).map((item) => <option key={item.id} value={item.subject?.id}>{item.subject?.name} · {item.subject?.academic_period?.name}{item.is_active && item.subject?.is_active ? '' : ' (finalizada)'}</option>)}
        </NativeSelect></Field></div>
        <TutoringInfoChips source={selected.subject} />
      </CardContent></Card>
      {!(selected.is_active && selected.subject?.is_active) && <Alert><AlertDescription>Esta tutoría ya finalizó. Puedes consultar su contenido, pero no tendrá nuevas sesiones.</AlertDescription></Alert>}
      {content.loading ? <Skeleton role="status" aria-label="Cargando temas" className="h-64 w-full" /> : content.data && <ContentView key={selectedId} content={content.data} />}
    </>}
  </section>
}
