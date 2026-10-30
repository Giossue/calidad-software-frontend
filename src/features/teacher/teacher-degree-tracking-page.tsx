import { useState, type ComponentType, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ActivityIcon,
  ArrowLeftIcon,
  CalendarIcon,
  CheckCircle2Icon,
  ClockIcon,
  EyeIcon,
  ListTodoIcon,
  PlusIcon,
  SparklesIcon,
  UsersIcon,
} from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { Field, FieldCounter, FieldLabel } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/auth-context'
import { formatDegreeDate } from '@/features/degree-coordination/degree-format'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { InitialsAvatar, SectionCard } from '@/features/degree-coordination/degree-shared'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { describeError } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice, RecordTable } from '@/features/tutoring/tutoring-shared'
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
  if (pct < 66) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function progressTextTone(pct: number): string {
  if (pct < 34) return 'text-destructive'
  if (pct < 66) return 'text-amber-600 dark:text-amber-400'
  return 'text-emerald-600 dark:text-emerald-400'
}

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
            allLabel: 'Todas',
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
                <span className="font-semibold text-foreground">{topic.title}</span>
                <span className="text-xs text-muted-foreground">{topic.academic_period?.name}</span>
              </div>
            ),
          },
          {
            label: 'Estudiante',
            render: (topic) => (
              <div className="flex flex-col gap-1">
                <span className="font-medium text-foreground">{topic.student?.name}</span>
                <span className="text-xs text-muted-foreground">{topic.student?.email}</span>
              </div>
            ),
          },
          {
            label: 'Mi Participación',
            render: (topic) => {
              const myRole = topic.assignments.find((a) => a.teacher?.id === user?.id)?.role
              return (
                <Badge variant={myRole === 'tutor' ? 'default' : 'secondary'}>
                  {myRole === 'tutor' ? 'Docente Tutor' : myRole === 'par_academico' ? 'Par Académico' : 'Asignado'}
                </Badge>
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
                  <span className={cn('text-xs font-semibold w-9 text-right', progressTextTone(pct))}>{pct}%</span>
                </div>
              )
            },
          },
          {
            label: 'Acciones',
            render: (topic) => (
              <Button variant="secondary" size="sm" onClick={() => onOpen(topic.id)}>
                <EyeIcon data-icon="inline-start" />
                Seguimiento
              </Button>
            ),
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

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="break-words font-display text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{topic.title}</h1>
            <p className="text-sm text-muted-foreground">
              Estudiante: <span className="font-medium text-foreground">{topic.student?.name}</span>
            </p>
          </div>
          {myAssignment && (
            <Badge variant="secondary" className="shrink-0 px-3 py-1 text-xs font-semibold">
              {myAssignment.role === 'tutor' ? 'Docente Tutor' : 'Par Académico'}
            </Badge>
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

      <Dialog
        open={activityDialogOpen}
        title="Asignar nueva tarea de seguimiento"
        description={`Tema: ${topic.title}`}
        onClose={() => setActivityDialogOpen(false)}
      >
        <div className="flex flex-col gap-4">
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="activity-desc">Descripción de la tarea o entrega</FieldLabel>
              <FieldCounter current={newActivityDesc.length} max={1000} />
            </div>
            <Textarea
              id="activity-desc"
              maxLength={1000}
              placeholder="Ejemplo: Presentar avances del capítulo 2 y correcciones del marco metodológico..."
              value={newActivityDesc}
              onChange={(e) => setNewActivityDesc(e.target.value)}
              rows={4}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <DialogCancelButton disabled={activitySubmitting}>Cancelar</DialogCancelButton>
            <Button
              onClick={handleAddActivity}
              disabled={activitySubmitting || !newActivityDesc.trim()}
            >
              {activitySubmitting ? <Spinner data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
              {activitySubmitting ? 'Registrando...' : 'Registrar tarea'}
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  )
}

const STAT_TILE_TONES = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
  gray: 'bg-muted text-foreground',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
} as const

// Cada dato con su propia tarjeta e ícono: evita que queden "sueltos" dentro de
// un único bloque de texto plano, y reutiliza la paleta de SectionCard/InitialsAvatar.
function StatTile({
  icon: Icon,
  tone,
  label,
  value,
}: Readonly<{ icon: ComponentType<{ className?: string }>; tone: keyof typeof STAT_TILE_TONES; label: string; value: ReactNode }>) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3.5 pt-6">
        <span aria-hidden="true" className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', STAT_TILE_TONES[tone])}>
          <Icon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="truncate text-sm font-semibold text-foreground">{value}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function EstadoFichaPanel({
  tracking,
  activities,
  progress,
}: Readonly<{ tracking: DegreeTopic['tracking']; activities: readonly DegreeActivity[]; progress: number }>) {
  const completed = activities.filter((a) => a.is_completed).length

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        icon={SparklesIcon}
        title="Estado de la Ficha de Seguimiento"
        description="Resumen del avance acumulado del tema y estado general"
        tone="red"
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progreso general</span>
            <span className={cn('text-lg font-bold tabular-nums', progressTextTone(progress))}>{progress}%</span>
          </div>
          <div className="h-3.5 w-full overflow-hidden rounded-full bg-muted">
            <div className={cn('h-full transition-all duration-300', progressTone(progress))} style={{ width: `${progress}%` }} />
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={CalendarIcon}
          tone="blue"
          label="Ficha abierta"
          value={tracking?.opened_at ? formatDegreeDate(tracking.opened_at) : 'En progreso'}
        />
        <StatTile
          icon={ActivityIcon}
          tone="gray"
          label="Estado de la ficha"
          value={<Badge variant="outline" className="w-fit capitalize text-xs">{tracking?.status || 'En progreso'}</Badge>}
        />
        <StatTile icon={CheckCircle2Icon} tone="emerald" label="Tareas completadas" value={`${completed} de ${activities.length}`} />
        <StatTile icon={ClockIcon} tone="amber" label="Tareas pendientes" value={activities.length - completed} />
      </div>
    </div>
  )
}

function EquipoTitulacionPanel({
  topic,
  tutorAssignment,
  peerAssignments,
}: Readonly<{ topic: DegreeTopic; tutorAssignment?: DegreeAssignment; peerAssignments: readonly DegreeAssignment[] }>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UsersIcon className="size-5 text-brand-red" /> Equipo de Titulación
        </CardTitle>
        <CardDescription>Estudiante y docentes evaluadores designados para esta titulación</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estudiante</span>
          <Card className="flex items-center gap-3.5 bg-muted/15 p-4 shadow-none">
            <InitialsAvatar name={topic.student?.name ?? 'Estudiante'} tone="gray" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-foreground">{topic.student?.name}</span>
              <span className="text-xs text-muted-foreground">
                Cédula: {topic.student?.identification} &bull; {topic.student?.email}
              </span>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Docentes Evaluadores</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="flex items-center gap-3.5 p-4 shadow-none">
              <InitialsAvatar name={tutorAssignment?.teacher?.name ?? 'Sin tutor'} tone="red" />
              <div className="flex min-w-0 flex-col">
                <Badge variant="outline" className="mb-1 w-fit text-[10px] font-semibold">
                  Docente Tutor
                </Badge>
                <span className="truncate text-sm font-semibold">{tutorAssignment?.teacher?.name ?? 'Sin tutor asignado'}</span>
                <span className="truncate text-xs text-muted-foreground">{tutorAssignment?.teacher?.email ?? '---'}</span>
              </div>
            </Card>

            {peerAssignments.map((peer, idx) => (
              <Card key={peer.id} className="flex items-center gap-3.5 p-4 shadow-none">
                <InitialsAvatar name={peer.teacher?.name ?? `Par ${idx + 1}`} tone="blue" />
                <div className="flex min-w-0 flex-col">
                  <Badge variant="outline" className="mb-1 w-fit text-[10px] font-semibold">
                    Par Académico {idx + 1}
                  </Badge>
                  <span className="truncate text-sm font-semibold">{peer.teacher?.name ?? 'Docente'}</span>
                  <span className="truncate text-xs text-muted-foreground">{peer.teacher?.email ?? '---'}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
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
          <h2 className="text-base font-semibold text-foreground">Tareas y Actividades de Avance</h2>
          <p className="text-xs text-muted-foreground">Cada docente marca como completada solo la tarea que registró.</p>
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
        searchPlaceholder="Buscar tarea o docente..."
        onClear={() => setTaskStatusFilter('')}
        filters={[
          {
            id: 'status',
            label: 'Estado',
            value: taskStatusFilter,
            onChange: (value) => setTaskStatusFilter(value as StatusFilter),
            allLabel: 'Todas',
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
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <ListTodoIcon className="size-10 mb-2 opacity-40" />
            <p className="font-medium">No hay tareas o actividades registradas con estos criterios.</p>
            <p className="text-xs mt-1">Usa el botón "Asignar tarea" para añadir entregas al estudiante.</p>
          </div>
        }
        columns={[
          {
            label: 'Actividad / Tarea',
            render: (act) => (
              <div className="flex max-w-lg flex-col gap-1">
                <span className="break-words font-medium text-foreground">{act.description}</span>
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
                <div className="flex min-w-0 items-center gap-2.5">
                  <InitialsAvatar name={act.teacher.name} tone={isTutor ? 'red' : isPeer ? 'blue' : 'gray'} className="size-8 shrink-0 text-xs" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-xs font-semibold text-foreground">
                      {act.teacher.name} {isMyTask && <span className="font-bold text-brand-red">(Tú)</span>}
                    </span>
                    <Badge variant="outline" className="mt-0.5 w-fit px-1.5 py-0 text-[10px]">
                      {isTutor ? 'Docente Tutor' : isPeer ? 'Par Académico' : 'Docente'}
                    </Badge>
                  </div>
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
                    <span className={cn('text-xs font-medium', act.is_completed ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                      {act.is_completed ? 'Completada' : 'Pendiente'}
                    </span>
                  </label>
                )
              }

              return (
                <Badge variant={act.is_completed ? 'success' : 'secondary'} className="gap-1.5">
                  {act.is_completed ? <CheckCircle2Icon className="size-3.5" /> : <ClockIcon className="size-3.5" />}
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
