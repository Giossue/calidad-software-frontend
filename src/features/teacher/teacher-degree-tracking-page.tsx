import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeftIcon, PlusIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/auth-context'
import { formatDegreeDate } from '@/features/degree-coordination/degree-format'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { describeError } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice } from '@/components/ui/error-notice'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { type DegreeActivity, type DegreeAssignment, type DegreeTopic } from '@/lib/degree-coordination-api'
import { teacherApi } from '@/lib/teacher-api'
import { cn } from '@/lib/utils'
import { TeacherEmpty } from './teacher-shared'

// Las pestañas de un tema se navegan desde el sidebar (sub-apartado de "Seguimiento"),
// no con un Tabs dentro de la pantalla: dashboard-page.tsx reutiliza esta lista.
export const TEACHER_TRACKING_TABS = [
  { id: 'estado-ficha', label: 'Estado de la Ficha' },
  { id: 'equipo-titulacion', label: 'Equipo de Titulación' },
  { id: 'tareas', label: 'Tareas' },
] as const

export type TeacherTrackingTab = typeof TEACHER_TRACKING_TABS[number]['id']

function isTrackingTab(value: string | null): value is TeacherTrackingTab {
  return TEACHER_TRACKING_TABS.some((item) => item.id === value)
}

type StatusFilter = '' | 'pending' | 'completed'

// Semáforo del avance: rojo hasta 33%, naranja hasta 65%, verde de 66% a 100%.
function progressTone(pct: number): string {
  if (pct < 34) return 'bg-destructive'
  if (pct < 66) return 'bg-warning'
  return 'bg-success'
}

function progressTextTone(pct: number): string {
  if (pct < 34) return 'text-destructive'
  if (pct < 66) return 'text-warning'
  return 'text-success'
}

const ROLE_LABELS: Readonly<Record<string, string>> = { tutor: 'Docente Tutor', par_academico: 'Par Académico' }

export function TeacherDegreeTrackingPage() {
  const [params, setParams] = useSearchParams()
  const topicId = Number(params.get('topic'))

  if (Number.isInteger(topicId) && topicId > 0) {
    return (
      <TrackingTopicDetail
        key={topicId}
        topicId={topicId}
        onBack={() => setParams({}, { replace: true })}
      />
    )
  }

  return <TrackingTopicsList onOpen={(id) => setParams({ topic: String(id), tab: TEACHER_TRACKING_TABS[0].id })} />
}

function TrackingTopicsList({ onOpen }: Readonly<{ onOpen: (id: number) => void }>) {
  const { user } = useAuth()
  const [roleFilter, setRoleFilter] = useState<'' | 'tutor' | 'par_academico'>('')
  const list = usePaginatedCatalog(
    (page, search) => teacherApi.degreeTracking({ page, search, role: roleFilter || undefined }),
    roleFilter,
  )

  return (
    <section className="flex flex-col gap-6">
      <AdminSectionHeader
        title="Seguimiento de Titulación"
        description="Supervisa el avance de los estudiantes que tienes asignados como tutor o par académico y registra tareas de seguimiento."
      />

      <FilterBar
        id="teacher-degree-tracking"
        search={list.searchInput}
        onSearch={list.setSearchInput}
        searchLabel="Buscar tema o estudiante"
        searchPlaceholder="Título del tema o nombre del estudiante"
        onClear={() => setRoleFilter('')}
        filters={[
          {
            id: 'role',
            label: 'Participación',
            value: roleFilter,
            onChange: (val) => setRoleFilter(val as typeof roleFilter),
            allLabel: 'Todas las participaciones',
            options: [
              { value: 'tutor', label: 'Tutor' },
              { value: 'par_academico', label: 'Par académico' },
            ],
          },
        ]}
      />

      <ErrorNotice message={list.error} retry={list.reload} />

      <RecordTable
        rows={list.data}
        loading={list.isInitialLoading || list.isFetching}
        onRowClick={(topic) => onOpen(topic.id)}
        rowTitle={(topic) => `Abrir seguimiento de ${topic.title}`}
        empty={
          <TeacherEmpty
            title="No tienes asignaciones de titulación para seguimiento"
            description="Los temas aparecerán aquí cuando tengas una asignación activa como tutor o par académico en propuestas aprobadas."
          />
        }
        columns={[
          {
            label: 'Tema',
            render: (topic) => (
              <div className="flex flex-col gap-1">
                <span className="font-medium text-foreground">{topic.title}</span>
                <span className="text-xs text-muted-foreground">{topic.academic_period?.name}</span>
              </div>
            ),
          },
          {
            label: 'Estudiante',
            render: (topic) => (
              <div className="flex flex-col gap-1">
                <span className="text-foreground">{topic.student?.name}</span>
                <span className="text-xs text-muted-foreground">{topic.student?.email}</span>
              </div>
            ),
          },
          {
            label: 'Mi Participación',
            render: (topic) => {
              const myRole = topic.assignments.find((a) => a.teacher?.id === user?.id)?.role
              return (
                <span>{myRole === 'tutor' ? 'Docente tutor' : myRole === 'par_academico' ? 'Par académico' : 'Asignado'}</span>
              )
            },
          },
          {
            label: 'Avance',
            render: (topic) => {
              const pct = Math.min(Math.max(topic.tracking?.progress_percentage ?? 0, 0), 100)
              return (
                <div className="flex items-center gap-2.5 w-36">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full transition-all', progressTone(pct))} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={cn('text-xs font-medium w-9 text-right', progressTextTone(pct))}>{pct}%</span>
                </div>
              )
            },
          },
        ]}
      />

      <CatalogPagination
        label="temas"
        page={list.page}
        lastPage={list.meta?.last_page ?? 1}
        disabled={list.isFetching}
        onChange={list.setPage}
      />
    </section>
  )
}

function TrackingTopicDetail({ topicId, onBack }: Readonly<{ topicId: number; onBack: () => void }>) {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const requestedTab = params.get('tab')
  const tab: TeacherTrackingTab = isTrackingTab(requestedTab) ? requestedTab : 'estado-ficha'

  const resource = useDegreeResource(() => teacherApi.degreeTrackingTopic(topicId), `teacher-tracking-topic:${topicId}`)
  const topic = resource.data

  const [activityDialogOpen, setActivityDialogOpen] = useState(false)
  const [newActivityDesc, setNewActivityDesc] = useState('')
  const [activitySubmitting, setActivitySubmitting] = useState(false)
  const [taskStatusFilter, setTaskStatusFilter] = useState<StatusFilter>('')
  const [taskSearch, setTaskSearch] = useState('')

  async function handleAddActivity() {
    if (!newActivityDesc.trim()) return
    setActivitySubmitting(true)
    try {
      await teacherApi.addDegreeTrackingActivity(topicId, { descripcion: newActivityDesc.trim() })
      setNewActivityDesc('')
      setActivityDialogOpen(false)
      toast.success('Tarea de seguimiento registrada exitosamente.')
      resource.reload()
    } catch (err) {
      toast.error(describeError(err))
    } finally {
      setActivitySubmitting(false)
    }
  }

  async function handleToggleActivity(activity: DegreeActivity) {
    try {
      await teacherApi.toggleDegreeTrackingActivity(topicId, activity.id, !activity.is_completed)
      toast.success(activity.is_completed ? 'Tarea marcada como pendiente y guardada.' : 'Tarea marcada como completada y guardada.')
      resource.reload()
    } catch (err) {
      toast.error(describeError(err))
    }
  }

  if (resource.loading) {
    return (
      <div role="status" aria-label="Cargando seguimiento" className="flex flex-col gap-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (resource.error) {
    return <ErrorNotice message={resource.error} retry={resource.reload} />
  }

  if (!topic) {
    return (
      <Alert>
        <AlertDescription>Este tema ya no está asignado a tu cuenta. Vuelve a tus temas y elige otro.</AlertDescription>
      </Alert>
    )
  }

  const tracking = topic.tracking
  const activities = tracking?.activities ?? []
  const progress = Math.min(Math.max(tracking?.progress_percentage ?? 0, 0), 100)
  const tutorAssignment = topic.assignments.find((a) => a.role === 'tutor')
  const peerAssignments = topic.assignments.filter((a) => a.role === 'par_academico')
  const myAssignment = topic.assignments.find((a) => a.teacher?.id === user?.id)

  // Pendientes arriba, completadas abajo: al marcar una tarea se reordena sola.
  const filteredActivities = activities
    .filter((act) => {
      if (taskStatusFilter === 'pending' && act.is_completed) return false
      if (taskStatusFilter === 'completed' && !act.is_completed) return false
      if (taskSearch.trim()) {
        const q = taskSearch.toLowerCase()
        const matchesDesc = act.description.toLowerCase().includes(q)
        const matchesTeacher = act.teacher?.name.toLowerCase().includes(q) ?? false
        if (!matchesDesc && !matchesTeacher) return false
      }
      return true
    })
    .sort((a, b) => Number(a.is_completed) - Number(b.is_completed))

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          onClick={onBack}
          className="-ml-2 w-fit"
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Volver a mis temas
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3" data-tour="page-header">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="break-words text-2xl font-semibold tracking-tight">{topic.title}</h1>
            <p className="text-sm text-muted-foreground">
              Estudiante: <span className="font-medium text-foreground">{topic.student?.name}</span>
            </p>
          </div>
          {myAssignment && (
            <span className="shrink-0 text-sm text-muted-foreground">
              {ROLE_LABELS[myAssignment.role] ?? 'Docente'}
            </span>
          )}
        </div>
      </div>

      {/* Pestaña activa: se elige desde el sub-apartado de "Seguimiento" en el sidebar. */}
      {tab === 'estado-ficha' && <EstadoFichaPanel tracking={tracking} activities={activities} progress={progress} />}

      {tab === 'equipo-titulacion' && (
        <EquipoTitulacionPanel topic={topic} tutorAssignment={tutorAssignment} peerAssignments={peerAssignments} />
      )}

      {tab === 'tareas' && (
        <TareasPanel
          filteredActivities={filteredActivities}
          taskSearch={taskSearch}
          setTaskSearch={setTaskSearch}
          taskStatusFilter={taskStatusFilter}
          setTaskStatusFilter={setTaskStatusFilter}
          currentUserId={user?.id}
          onToggle={handleToggleActivity}
          onAddActivity={() => {
            setNewActivityDesc('')
            setActivityDialogOpen(true)
          }}
        />
      )}

      <FormDialog
        open={activityDialogOpen}
        title="Asignar nueva tarea de seguimiento"
        description={topic.student?.name ? `Para ${topic.student.name}` : undefined}
        pending={activitySubmitting}
        error={null}
        dirty={newActivityDesc.trim() !== ''}
        blockReason={newActivityDesc.trim() ? null : 'Escribe la descripción de la tarea.'}
        onClose={() => setActivityDialogOpen(false)}
        onSubmit={(event) => { event.preventDefault(); void handleAddActivity() }}
        submitLabel="Registrar tarea"
        submitIcon={PlusIcon}
      >
        <FormField id="activity-desc" label="Descripción de la tarea o entrega" counter={{ current: newActivityDesc.length, max: 1000 }}>
          <Textarea
            id="activity-desc"
            maxLength={1000}
            placeholder="Ej. Presentar avances del capítulo 2 y correcciones del marco metodológico"
            value={newActivityDesc}
            onChange={(e) => setNewActivityDesc(e.target.value)}
            rows={4}
          />
        </FormField>
      </FormDialog>
    </section>
  )
}

function EstadoFichaPanel({
  tracking,
  activities,
  progress,
}: Readonly<{ tracking: DegreeTopic['tracking']; activities: readonly DegreeActivity[]; progress: number }>) {
  const completed = activities.filter((a) => a.is_completed).length
  const facts = [
    { label: 'Ficha abierta', value: tracking?.opened_at ? formatDegreeDate(tracking.opened_at) : 'En progreso' },
    { label: 'Estado de la ficha', value: <span className="capitalize">{tracking?.status || 'En progreso'}</span> },
    { label: 'Tareas completadas', value: `${completed} de ${activities.length}` },
    { label: 'Tareas pendientes', value: activities.length - completed },
  ]

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">Estado de la Ficha de Seguimiento</h2>
        <p className="text-sm text-muted-foreground">Avance acumulado del tema y su estado general.</p>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progreso general</span>
          <span className={cn('text-lg font-semibold tabular-nums', progressTextTone(progress))}>{progress}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Progreso general" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className={cn('h-full transition-all duration-300', progressTone(progress))} style={{ width: `${progress}%` }} />
        </div>
      </div>
      <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.label} className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">{fact.label}</dt>
            <dd className="font-medium">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function TeamMember({ role, name, detail }: Readonly<{ role: string; name: string; detail: string }>) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-4">
      <span className="text-muted-foreground sm:w-40 sm:shrink-0">{role}</span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{name}</span>
        <span className="truncate text-xs text-muted-foreground">{detail}</span>
      </span>
    </div>
  )
}

function EquipoTitulacionPanel({
  topic,
  tutorAssignment,
  peerAssignments,
}: Readonly<{ topic: DegreeTopic; tutorAssignment?: DegreeAssignment; peerAssignments: readonly DegreeAssignment[] }>) {
  return (
    <section className="flex flex-col gap-3" aria-label="Equipo de Titulación">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">Equipo de Titulación</h2>
        <p className="text-sm text-muted-foreground">Estudiante y docentes evaluadores designados para esta titulación.</p>
      </div>
      <Card className="divide-y divide-border">
        <TeamMember
          role="Estudiante"
          name={topic.student?.name ?? 'Estudiante'}
          detail={[topic.student?.identification && `Cédula: ${topic.student.identification}`, topic.student?.email].filter(Boolean).join(' · ')}
        />
        <TeamMember role="Docente Tutor" name={tutorAssignment?.teacher?.name ?? 'Sin tutor asignado'} detail={tutorAssignment?.teacher?.email ?? '—'} />
        {peerAssignments.map((peer, idx) => (
          <TeamMember key={peer.id} role={`Par Académico ${idx + 1}`} name={peer.teacher?.name ?? 'Docente'} detail={peer.teacher?.email ?? '—'} />
        ))}
      </Card>
    </section>
  )
}

function TareasPanel({
  filteredActivities,
  taskSearch,
  setTaskSearch,
  taskStatusFilter,
  setTaskStatusFilter,
  currentUserId,
  onToggle,
  onAddActivity,
}: Readonly<{
  filteredActivities: readonly DegreeActivity[]
  taskSearch: string
  setTaskSearch: (value: string) => void
  taskStatusFilter: StatusFilter
  setTaskStatusFilter: (value: StatusFilter) => void
  currentUserId?: number
  onToggle: (activity: DegreeActivity) => void
  onAddActivity: () => void
}>) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-xl font-semibold tracking-tight">Tareas y Actividades de Avance</h2>
          <p className="text-sm text-muted-foreground">Cada docente marca como completada solo la tarea que registró.</p>
        </div>

        <Button onClick={onAddActivity}>
          <PlusIcon data-icon="inline-start" /> Asignar tarea
        </Button>
      </div>

      <FilterBar
        id="teacher-degree-tasks"
        search={taskSearch}
        onSearch={setTaskSearch}
        searchLabel="Buscar tarea o docente"
        searchPlaceholder="Busca por tarea o docente…"
        onClear={() => setTaskStatusFilter('')}
        filters={[
          {
            id: 'status',
            label: 'Estado',
            value: taskStatusFilter,
            onChange: (value) => setTaskStatusFilter(value as StatusFilter),
            allLabel: 'Todos los estados',
            options: [
              { value: 'pending', label: 'Pendientes' },
              { value: 'completed', label: 'Completadas' },
            ],
          },
        ]}
      />

      <RecordTable
        rows={filteredActivities}
        loading={false}
        empty={
          <TeacherEmpty
            title={taskSearch.trim() || taskStatusFilter ? 'No hay tareas con estos filtros' : 'Aún no hay tareas registradas'}
            description="Pulsa «Asignar tarea» para añadir entregas al estudiante."
          />
        }
        columns={[
          {
            label: 'Actividad / Tarea',
            render: (act) => (
              <div className="flex max-w-lg flex-col gap-1">
                <span className="break-words text-foreground">{act.description}</span>
                {act.registered_at && (
                  <span className="text-xs text-muted-foreground">Asignada el {formatDegreeDate(act.registered_at)}</span>
                )}
              </div>
            ),
          },
          {
            label: 'Docente Asignador',
            render: (act) => {
              const teacherRole = act.teacher && 'role' in act.teacher ? (act.teacher as { role?: string }).role : undefined
              const isTutor = teacherRole === 'tutor'
              const isPeer = teacherRole === 'par_academico'
              const isMyTask = act.teacher?.id === currentUserId

              return act.teacher ? (
                <div className="flex min-w-0 flex-col">
                  <span className="truncate">
                    {act.teacher.name} {isMyTask && <span className="font-medium text-primary">(Tú)</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{isTutor ? 'Docente Tutor' : isPeer ? 'Par Académico' : 'Docente'}</span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Sin docente asignado</span>
              )
            },
          },
          {
            label: 'Estado',
            render: (act) => {
              const isMyTask = act.teacher?.id === currentUserId

              if (isMyTask) {
                return (
                  <label className="flex w-fit cursor-pointer items-center gap-2 select-none">
                    <Checkbox
                      checked={act.is_completed}
                      onCheckedChange={() => onToggle(act)}
                      aria-label={act.is_completed ? 'Marcar como pendiente' : 'Marcar como completada'}
                    />
                    <span className={cn('text-sm', act.is_completed ? 'text-success' : 'text-muted-foreground')}>
                      {act.is_completed ? 'Completada' : 'Pendiente'}
                    </span>
                  </label>
                )
              }

              return (
                <Badge variant={act.is_completed ? 'success' : 'neutral'}>
                  {act.is_completed ? 'Completada' : 'Pendiente'}
                </Badge>
              )
            },
          },
        ]}
      />
    </div>
  )
}
