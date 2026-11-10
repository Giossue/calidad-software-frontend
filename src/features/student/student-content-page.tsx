import { useState } from 'react'
import { ChevronDownIcon } from 'lucide-react'

import { TopicFileList } from '@/components/topic-file-list'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { ErrorNotice } from '@/components/ui/error-notice'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { studentApi, type StudentClassSession, type StudentContent, type StudentTopic } from '@/lib/student-api'
import { StudentEmpty } from './student-shared'
import { ListFooter, RedProgress } from './student-ui'
import { usePagedList } from './student-hooks'
import { ContentSkeleton } from './student-skeletons'

type TopicFilter = '' | 'covered' | 'pending'

function TopicRow({ topic, number }: Readonly<{ topic: StudentTopic; number: number }>) {
  const [open, setOpen] = useState(false)
  const files = (topic.files ?? []).map((file) => ({ key: file.id, name: file.name, size: file.size, file }))
  return <li className="rounded-md bg-card shadow-surface ring-1 ring-surface-ring">
    <button type="button" aria-expanded={open} aria-label={`${open ? 'Ocultar' : 'Ver'} detalle de ${topic.name}`} onClick={() => setOpen(!open)} className="flex w-full items-center gap-4 rounded-md p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">{number}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="break-words font-medium">{topic.name}</span>
        <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{topic.activities_count === 1 ? '1 actividad' : `${topic.activities_count} actividades`}</span>
          {files.length > 0 && <span>{files.length === 1 ? '1 recurso' : `${files.length} recursos`}</span>}
        </span>
      </span>
      <Badge variant={topic.is_covered ? 'success' : 'secondary'} className="hidden sm:inline-flex">{topic.is_covered ? 'Completado' : 'Pendiente'}</Badge>
      <ChevronDownIcon aria-hidden="true" className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
    </button>
    {open && <div className="flex flex-col gap-3 border-t px-4 py-4 text-sm sm:pl-18">
      <Badge variant={topic.is_covered ? 'success' : 'secondary'} className="w-fit sm:hidden">{topic.is_covered ? 'Completado' : 'Pendiente'}</Badge>
      {topic.description && <p className="break-words text-muted-foreground">{topic.description}</p>}
      {topic.activities.length === 0 ? <p className="text-muted-foreground">Este tema aún no tiene actividades.</p> : <ul className="flex flex-col gap-3">
        {topic.activities.map((activity) => <li key={activity.id} className="flex flex-col gap-1 border-l-2 border-border pl-4">
          <span className="font-medium">{activity.name} <span className="font-normal text-muted-foreground">· {activity.duration}</span></span>
          {activity.methodologies.length > 0 && <ul className="list-disc pl-5 text-muted-foreground">{activity.methodologies.map((methodology) => <li key={methodology.id} className="break-words">{methodology.description}</li>)}</ul>}
        </li>)}
      </ul>}
      {files.length > 0 && <div className="flex flex-col gap-2 pt-1">
        <span className="font-medium">Recursos</span>
        <TopicFileList files={files} onDownload={(item) => studentApi.downloadTopicFile(topic.tutoring_id, topic.id, item.file)} />
      </div>}
    </div>}
  </li>
}

function ContentView({ content }: Readonly<{ content: StudentContent }>) {
  const { progress, topics } = content
  // De la más reciente a la primera; la primera clase de la tutoría es la Sesión 1.
  const sessions = [...(content.sessions ?? [])].sort((a, b) => b.date.localeCompare(a.date))
  const [selectedDate, setSelectedDate] = useState<string>('all')
  const [filter, setFilter] = useState<TopicFilter>('')
  const [search, setSearch] = useState('')

  const activeSession = selectedDate !== 'all' ? sessions.find((s) => s.date === selectedDate) : null
  const fallbackTopics = topics.filter((t) => t.is_covered).length > 0 ? topics.filter((t) => t.is_covered) : topics
  const currentTopics = activeSession
    ? (activeSession.topics.length > 0 ? activeSession.topics : fallbackTopics)
    : topics
  const sessionLabel = (session: StudentClassSession) => `Sesión ${sessions.length - sessions.indexOf(session)} · ${formatDate(session.date)}`
  const topicCount = (session: StudentClassSession) => {
    const count = session.topics.length > 0 ? session.topics.length : fallbackTopics.length
    return count === 1 ? '1 tema' : `${count} temas`
  }
  const chooseSession = (date: string) => { setSelectedDate(date); pager.setPage(1) }

  const needle = search.trim().toLowerCase()
  const matches = currentTopics.filter((topic) => !needle || `${topic.name} ${topic.description ?? ''}`.toLowerCase().includes(needle))
  const visible = matches.filter((topic) => !filter || (filter === 'covered') === topic.is_covered)
  const pager = usePagedList(visible)
  const choose = (next: TopicFilter) => { setFilter(next); pager.setPage(1) }
  const clearFilters = () => { setSearch(''); setFilter(''); chooseSession('all') }

  return <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <RedProgress value={progress.progress_percentage} label="Avance de temas" />
      <p className="shrink-0 text-sm text-muted-foreground"><span className="font-semibold text-foreground tabular-nums">{Math.round(progress.progress_percentage)} %</span> · {progress.covered_topics} de {progress.total_topics} temas completados</p>
    </div>

    {(currentTopics.length > 0 || activeSession) && (
      <FilterBar
        id="student-topic"
        search={search}
        onSearch={(value) => { setSearch(value); pager.setPage(1) }}
        searchLabel="Buscar temas"
        searchPlaceholder="Buscar temas…"
        onClear={clearFilters}
        filters={[
          ...(sessions.length > 0 ? [{ id: 'session', label: 'clase', value: selectedDate === 'all' ? '' : selectedDate, onChange: (value: string) => chooseSession(value || 'all'), allLabel: 'Todas las clases', options: sessions.map((s) => ({ value: s.date, label: `${sessionLabel(s)} · ${topicCount(s)}` })) }] : []),
          { id: 'status', label: 'estado', value: filter, onChange: (value: string) => choose(value as TopicFilter), allLabel: `Todos los temas (${matches.length})`, options: [
            { value: 'covered', label: `Completados (${matches.filter((t) => t.is_covered).length})` },
            { value: 'pending', label: `Pendientes (${matches.filter((t) => !t.is_covered).length})` },
          ] },
        ]}
      />
    )}

    {activeSession && (
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">Mostrando los temas de la <strong className="font-medium text-foreground">{sessionLabel(activeSession)}</strong></span>
        <Button type="button" variant="tertiary" size="sm" onClick={() => chooseSession('all')}>
          Ver todas las clases
        </Button>
      </div>
    )}

    {currentTopics.length === 0 ? (
      activeSession ? (
        <StudentEmpty
          title={sessionLabel(activeSession)}
          description="En esta fecha se tomó lista de asistencia de la tutoría. El docente aún no ha asociado temas específicos a esta sesión."
        />
      ) : (
        <StudentEmpty
          title="El docente aún no registra temas"
          description="Los temas, actividades y metodologías aparecerán cuando se publiquen."
        />
      )
    ) : (
      <>
        {visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{needle ? 'Ningún tema coincide con tu búsqueda.' : 'No hay temas con estos filtros.'}</p>
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
    {content.loading ? <ContentSkeleton /> : content.data && <ContentView key={tutoringId} content={content.data} />}
  </div>
}
