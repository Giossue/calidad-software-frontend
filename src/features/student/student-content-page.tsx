import { useState } from 'react'
import { CalendarDaysIcon, CheckCircle2Icon, ChevronDownIcon, CircleDashedIcon, ClockIcon, FileTextIcon, UsersIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { ErrorNotice } from '@/features/tutoring/tutoring-shared'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { studentApi, type StudentContent, type StudentTopic } from '@/lib/student-api'
import { StudentEmpty } from './student-shared'
import { FilterChips, ListFooter, RedProgress, SearchField } from './student-ui'
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
      <Badge variant={topic.is_covered ? 'success' : 'secondary'} className="hidden gap-1.5 px-3 py-1 sm:inline-flex">{topic.is_covered ? <CheckCircle2Icon aria-hidden="true" /> : <CircleDashedIcon aria-hidden="true" />}{topic.is_covered ? 'Completado' : 'Pendiente'}</Badge>
      <ChevronDownIcon aria-hidden="true" className={cn('size-5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
    </button>
    {open && <div className="flex flex-col gap-3 border-t px-4 py-4 text-sm sm:pl-[4.75rem]">
      <Badge variant={topic.is_covered ? 'success' : 'secondary'} className="w-fit sm:hidden">{topic.is_covered ? 'Completado' : 'Pendiente'}</Badge>
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
  const sessions = content.sessions ?? []
  const [selectedDate, setSelectedDate] = useState<string>('all')
  const [filter, setFilter] = useState<TopicFilter>('all')
  const [search, setSearch] = useState('')

  const activeSession = selectedDate !== 'all' ? sessions.find((s) => s.date === selectedDate) : null
  const fallbackTopics = topics.filter((t) => t.is_covered).length > 0 ? topics.filter((t) => t.is_covered) : topics
  const currentTopics = activeSession
    ? (activeSession.topics.length > 0 ? activeSession.topics : fallbackTopics)
    : topics

  const needle = search.trim().toLowerCase()
  const matches = currentTopics.filter((topic) => !needle || `${topic.name} ${topic.description ?? ''}`.toLowerCase().includes(needle))
  const visible = matches.filter((topic) => filter === 'all' || (filter === 'covered') === topic.is_covered)
  const pager = usePagedList(visible)
  const done = progress.total_topics > 0 && progress.pending_topics === 0
  const choose = (next: TopicFilter) => { setFilter(next); pager.setPage(1) }

  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-base">Contenido didáctico</h3>
      </div>
      {progress.total_topics > 0 && (done ? <Badge variant="success">Completado</Badge> : <StatusBadge active activeLabel="En progreso" />)}
    </div>

    <div className="flex flex-col gap-2">
      <p className="text-4xl font-semibold tabular-nums">{Math.round(progress.progress_percentage)}%</p>
      <RedProgress value={progress.progress_percentage} label="Avance de temas" />
      <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
        <span>{progress.covered_topics} de {progress.total_topics} temas completados</span>
        <span>{progress.pending_topics} pendientes</span>
      </div>
    </div>

    {sessions.length > 0 && (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <CalendarDaysIcon className="size-3.5 text-primary" />
          <span>Fecha de clase:</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer',
              selectedDate === 'all'
                ? 'bg-primary text-primary-foreground border-primary shadow-xs font-semibold'
                : 'bg-card text-muted-foreground hover:text-foreground border-border'
            )}
            onClick={() => { setSelectedDate('all'); pager.setPage(1) }}
          >
            Todas las clases
          </button>
          {sessions.map((s) => {
            const isSelected = selectedDate === s.date
            return (
              <button
                key={s.id}
                type="button"
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer inline-flex items-center gap-1.5',
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs font-semibold'
                    : 'bg-card text-muted-foreground hover:text-foreground border-border'
                )}
                onClick={() => { setSelectedDate(s.date); pager.setPage(1) }}
              >
                <span>{formatDate(s.date)}</span>
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.2 rounded-full font-medium',
                    isSelected
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {(s.topics.length > 0 ? s.topics.length : fallbackTopics.length)} {(s.topics.length > 0 ? s.topics.length : fallbackTopics.length) === 1 ? 'tema' : 'temas'}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )}

    {selectedDate !== 'all' && activeSession && (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3.5 py-2 text-xs">
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="size-4 text-primary shrink-0" />
          <span>Mostrando temas y actividades tratados en la clase del <strong>{formatDate(activeSession.date)}</strong></span>
        </div>
        <button
          type="button"
          className="text-primary hover:underline font-medium cursor-pointer"
          onClick={() => { setSelectedDate('all'); pager.setPage(1) }}
        >
          Ver todas las clases
        </button>
      </div>
    )}

    {currentTopics.length === 0 ? (
      selectedDate !== 'all' && activeSession ? (
        <div className="rounded-xl border border-dashed p-8 text-center bg-card">
          <CalendarDaysIcon className="mx-auto size-8 text-muted-foreground/60 mb-2" />
          <h4 className="font-semibold text-base">Clase del {formatDate(activeSession.date)}</h4>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            En esta fecha se tomó lista de asistencia de la tutoría. El docente aún no ha asociado temas específicos a esta sesión.
          </p>
        </div>
      ) : (
        <StudentEmpty
          title="El docente aún no registra temas"
          description="Los temas, actividades y metodologías aparecerán cuando se publiquen."
        />
      )
    ) : (
      <>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchField
            id="student-topic-search"
            label="Buscar temas"
            placeholder="Buscar temas…"
            value={search}
            onChange={(value) => { setSearch(value); pager.setPage(1) }}
          />
          <FilterChips
            label="Filtrar temas"
            value={filter}
            onChange={choose}
            options={[
              { value: 'all', label: 'Todos', count: matches.length },
              { value: 'covered', label: 'Completados', count: matches.filter((t) => t.is_covered).length },
              { value: 'pending', label: 'Pendientes', count: matches.filter((t) => !t.is_covered).length },
            ]}
          />
        </div>
        {visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Ningún tema coincide con tu búsqueda.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pager.rows.map((topic) => (
              <TopicRow key={topic.id} topic={topic} number={currentTopics.indexOf(topic) + 1} />
            ))}
          </ul>
        )}
        <ListFooter
          noun="temas"
          total={visible.length}
          start={pager.start}
          shown={pager.rows.length}
          page={pager.page}
          lastPage={pager.lastPage}
          onPage={pager.setPage}
        />
      </>
    )}
  </div>
}

// Plan didáctico de una tutoría: temas, actividades y metodologías con el avance.
export function ContentPanel({ tutoringId }: Readonly<{ tutoringId: number }>) {
  const content = useDegreeResource(() => studentApi.content(tutoringId), String(tutoringId))

  return <div className="flex flex-col gap-5">
    <ErrorNotice message={content.error} retry={content.reload} />
    {content.loading ? <Skeleton role="status" aria-label="Cargando temas" className="h-64 w-full" /> : content.data && <ContentView key={tutoringId} content={content.data} />}
  </div>
}
