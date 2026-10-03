import { useMemo, useState } from 'react'
import {
  CheckCircle2Icon,
  ClockIcon,
  ListTodoIcon,
  SparklesIcon,
  TrendingUpIcon,
  UserCheckIcon,
  UsersIcon,
} from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDegreeDate } from '@/features/degree-coordination/degree-format'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { InitialsAvatar, SectionCard } from '@/features/degree-coordination/degree-shared'
import { ErrorNotice } from '@/features/tutoring/tutoring-shared'
import { degreeCoordinationApi, type DegreeActivity, type DegreeTopic } from '@/lib/degree-coordination-api'
import { cn } from '@/lib/utils'
import { FilterChips, RedProgress, SearchField } from '@/features/student/student-ui'

type StatusFilter = 'all' | 'pending' | 'completed'
type RoleFilter = 'all' | 'tutor' | 'peer'
type TrackingTab = 'estado-ficha' | 'equipo-titulacion' | 'tareas'

function TaskCard({ activity }: Readonly<{ activity: DegreeActivity }>) {
  const teacherRole = activity.teacher && 'role' in activity.teacher
    ? (activity.teacher as { role?: string }).role
    : undefined
  const isTutor = teacherRole === 'tutor'
  const isPeer = teacherRole === 'par_academico'

  return (
    <li
      className={cn(
        'rounded-xl border bg-card p-4 transition-all hover:border-primary/40 flex flex-col gap-3',
        activity.is_completed ? 'border-border/60 bg-card/60' : 'border-border shadow-2xs'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {activity.is_completed ? (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2Icon className="size-4" />
            </span>
          ) : (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <ClockIcon className="size-4" />
            </span>
          )}
          <Badge
            variant={activity.is_completed ? 'success' : 'secondary'}
            className="gap-1.5 px-2.5 py-0.5 text-xs font-semibold"
          >
            {activity.is_completed ? 'Completada' : 'Pendiente'}
          </Badge>
        </div>

        {activity.registered_at && (
          <span className="text-xs text-muted-foreground">
            Asignada el {formatDegreeDate(activity.registered_at)}
          </span>
        )}
      </div>

      <div className="text-sm font-medium leading-relaxed break-words text-foreground">
        {activity.description}
      </div>

      {activity.teacher && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 mt-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <InitialsAvatar
              name={activity.teacher.name}
              tone={isTutor ? 'red' : isPeer ? 'blue' : 'gray'}
              className="size-7 text-xs"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium truncate">{activity.teacher.name}</span>
              <span className="text-[11px] text-muted-foreground truncate">{activity.teacher.email}</span>
            </div>
          </div>
          <Badge variant="outline" className="text-[11px] font-medium">
            {isTutor ? 'Docente Tutor' : isPeer ? 'Par Académico' : 'Docente'}
          </Badge>
        </div>
      )}
    </li>
  )
}

function TopicTrackingView({ topic }: Readonly<{ topic: DegreeTopic }>) {
  const [activeTab, setActiveTab] = useState<TrackingTab>('estado-ficha')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [search, setSearch] = useState('')

  const tracking = topic.tracking
  const activities = tracking?.activities ?? []
  const progressPercentage = tracking?.progress_percentage ?? 0

  const tutor = topic.assignments.find((a) => a.role === 'tutor')?.teacher
  const peers = topic.assignments.filter((a) => a.role === 'par_academico')

  const totalTasks = activities.length
  const completedTasks = activities.filter((a) => a.is_completed).length
  const pendingTasks = totalTasks - completedTasks

  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // Status filter
      if (statusFilter === 'pending' && act.is_completed) return false
      if (statusFilter === 'completed' && !act.is_completed) return false

      // Role filter
      if (roleFilter !== 'all' && act.teacher) {
        const teacherRole = 'role' in act.teacher ? (act.teacher as { role?: string }).role : undefined
        if (roleFilter === 'tutor' && teacherRole !== 'tutor') return false
        if (roleFilter === 'peer' && teacherRole !== 'par_academico') return false
      }

      // Search filter
      if (search.trim()) {
        const needle = search.trim().toLowerCase()
        const text = `${act.description} ${act.teacher?.name ?? ''}`.toLowerCase()
        if (!text.includes(needle)) return false
      }

      return true
    })
  }, [activities, statusFilter, roleFilter, search])

  return (
    <div className="flex flex-col gap-6">
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as TrackingTab)} className="w-full">
        <TabsList aria-label="Pestañas de seguimiento">
          <TabsTrigger value="estado-ficha" className="gap-2">
            <SparklesIcon className="size-4" />
            Estado de la Ficha
          </TabsTrigger>
          <TabsTrigger value="equipo-titulacion" className="gap-2">
            <UsersIcon className="size-4" />
            Equipo de Titulación
          </TabsTrigger>
          <TabsTrigger value="tareas" className="gap-2">
            <ListTodoIcon className="size-4" />
            Tareas ({activities.length})
          </TabsTrigger>
        </TabsList>

        {/* 1. Estado de la Ficha */}
        <TabsContent value="estado-ficha" className="flex flex-col gap-6 pt-2">
          <div className="rounded-xl border bg-card p-5 flex flex-col gap-4 shadow-2xs">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1 max-w-2xl">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tema de titulación aprobado
                </span>
                <h3 className="font-display text-xl font-bold tracking-tight text-foreground">
                  {topic.title}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {[topic.academic_period?.name, topic.section ? `Paralelo ${topic.section.name}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <Badge variant="success" className="px-3 py-1 font-semibold text-xs">
                Propuesta aprobada
              </Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 border-t pt-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Avance general</span>
                <span className="text-2xl font-bold tabular-nums text-foreground">
                  {Math.round(progressPercentage)}%
                </span>
                <RedProgress value={progressPercentage} label="Avance de titulación" className="mt-1" />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Tareas asignadas</span>
                <span className="text-2xl font-bold tabular-nums text-foreground">{totalTasks}</span>
                <span className="text-xs text-muted-foreground">En ficha de seguimiento</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Tareas completadas</span>
                <span className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {completedTasks}
                </span>
                <span className="text-xs text-muted-foreground">Revisadas con éxito</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Tareas pendientes</span>
                <span className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                  {pendingTasks}
                </span>
                <span className="text-xs text-muted-foreground">Por entregar o revisar</span>
              </div>
            </div>

            {tracking?.opened_at && (
              <div className="grid gap-4 sm:grid-cols-2 border-t pt-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Ficha abierta</span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatDegreeDate(tracking.opened_at)}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Estado de la ficha</span>
                  <Badge variant="outline" className="w-fit capitalize text-xs">
                    {tracking.status || 'En progreso'}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* 2. Equipo de Titulación */}
        <TabsContent value="equipo-titulacion" className="flex flex-col gap-6 pt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <SectionCard icon={UsersIcon} title="Docente Tutor" description="Responsable principal del acompañamiento">
              {tutor ? (
                <div className="flex items-center gap-3">
                  <InitialsAvatar name={tutor.name} tone="red" />
                  <div className="flex min-w-0 flex-col">
                    <span className="font-medium text-sm">{tutor.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{tutor.email}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Aún no se ha asignado un tutor.</p>
              )}
            </SectionCard>

            <SectionCard icon={UserCheckIcon} title="Pares Académicos" description="Docentes revisores de tu propuesta">
              {peers.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {peers.map((peer) => (
                    <li key={peer.id} className="flex items-center gap-3">
                      <InitialsAvatar name={peer.teacher?.name ?? 'Docente'} tone="blue" />
                      <div className="flex min-w-0 flex-col">
                        <span className="font-medium text-sm">{peer.teacher?.name ?? 'Docente'}</span>
                        <span className="text-xs text-muted-foreground truncate">{peer.teacher?.email}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Aún no se han asignado pares académicos.</p>
              )}
            </SectionCard>
          </div>
        </TabsContent>

        {/* 3. Tareas */}
        <TabsContent value="tareas" className="flex flex-col gap-6 pt-2">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2">
                <ListTodoIcon className="size-5 text-primary" />
                <h4 className="font-semibold text-base">Tareas y actividades de seguimiento</h4>
              </div>
              <Badge variant="outline" className="text-xs">
                {filteredActivities.length} {filteredActivities.length === 1 ? 'tarea' : 'tareas'}
              </Badge>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <SearchField
                id="student-task-search"
                label="Buscar tareas"
                placeholder="Buscar por descripción o docente…"
                value={search}
                onChange={setSearch}
              />
              <div className="flex flex-wrap items-center gap-2">
                <FilterChips
                  label="Filtrar por estado"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: 'all', label: 'Todas', count: totalTasks },
                    { value: 'pending', label: 'Pendientes', count: pendingTasks },
                    { value: 'completed', label: 'Completadas', count: completedTasks },
                  ]}
                />
              </div>
            </div>

            {/* Role filter buttons */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-muted-foreground mr-1">Filtrar por asignador:</span>
              <button
                type="button"
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer',
                  roleFilter === 'all'
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs font-semibold'
                    : 'bg-card text-muted-foreground hover:text-foreground border-border'
                )}
                onClick={() => setRoleFilter('all')}
              >
                Todos
              </button>
              <button
                type="button"
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer',
                  roleFilter === 'tutor'
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs font-semibold'
                    : 'bg-card text-muted-foreground hover:text-foreground border-border'
                )}
                onClick={() => setRoleFilter('tutor')}
              >
                Tutor
              </button>
              <button
                type="button"
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer',
                  roleFilter === 'peer'
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs font-semibold'
                    : 'bg-card text-muted-foreground hover:text-foreground border-border'
                )}
                onClick={() => setRoleFilter('peer')}
              >
                Pares académicos
              </button>
            </div>

            {filteredActivities.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center bg-card">
                <ListTodoIcon className="mx-auto size-8 text-muted-foreground/60 mb-2" />
                <h5 className="font-semibold text-base">
                  {activities.length === 0
                    ? 'Aún no hay tareas registradas'
                    : 'Ninguna tarea coincide con los filtros'}
                </h5>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  {activities.length === 0
                    ? 'Tu docente tutor y pares académicos registrarán aquí las tareas, observaciones y avances de tu proyecto de titulación.'
                    : 'Intenta cambiar los filtros de búsqueda o seleccionar "Todas".'}
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {filteredActivities.map((activity) => (
                  <TaskCard key={activity.id} activity={activity} />
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function StudentDegreeTrackingPage() {
  const resource = useDegreeResource(() => degreeCoordinationApi.studentTopics())
  const topics = resource.data ?? []
  const approvedTopics = topics.filter((t) => t.status === 'aprobado')
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null)

  const currentTopic =
    approvedTopics.find((t) => t.id === selectedTopicId) ?? approvedTopics[0]

  return (
    <section className="flex flex-col gap-6">
      <AdminSectionHeader
        title="Seguimiento de titulación"
        description="Consulta las tareas, avances y actividades registradas por tu docente tutor y pares académicos."
      />

      <ErrorNotice message={resource.error} retry={resource.reload} />

      {resource.loading ? (
        <Skeleton role="status" aria-label="Cargando seguimiento" className="h-64 w-full" />
      ) : approvedTopics.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <TrendingUpIcon className="size-6" />
            </div>
            <h4 className="font-display text-lg font-semibold">
              No tienes un tema de titulación aprobado
            </h4>
            <p className="text-sm text-muted-foreground max-w-md">
              Para consultar el seguimiento, tu propuesta de tema de titulación debe ser revisada y aprobada por la Coordinación de Titulación.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {approvedTopics.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Seleccionar propuesta:</span>
              {approvedTopics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer',
                    (currentTopic?.id === topic.id)
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs font-semibold'
                      : 'bg-card text-muted-foreground hover:text-foreground border-border'
                  )}
                  onClick={() => setSelectedTopicId(topic.id)}
                >
                  {topic.title}
                </button>
              ))}
            </div>
          )}

          {currentTopic && <TopicTrackingView topic={currentTopic} />}
        </>
      )}
    </section>
  )
}
