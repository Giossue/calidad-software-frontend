import { useMemo, useState } from 'react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ErrorNotice } from '@/components/ui/error-notice'
import { SelectInput } from '@/components/ui/select-field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DEGREE_STATUS_LABELS, formatDegreeDate, roundPercent } from '@/features/degree-coordination/degree-format'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { DegreeTrackingStatusBadge } from '@/features/degree-coordination/degree-shared'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { degreeCoordinationApi, type DegreeActivity, type DegreeTopic } from '@/lib/degree-coordination-api'
import { StudentEmpty } from '@/features/student/student-shared'
import { Initials, RedProgress } from '@/features/student/student-ui'
import { DegreeTrackingSkeleton } from '@/features/student/student-skeletons'

type StatusFilter = '' | 'pending' | 'completed'
type RoleFilter = '' | 'tutor' | 'peer'
type TrackingTab = 'estado-ficha' | 'equipo-titulacion' | 'tareas'

function teacherRole(activity: DegreeActivity): string | undefined {
  return activity.teacher && 'role' in activity.teacher ? (activity.teacher as { role?: string }).role : undefined
}

function roleLabel(role: string | undefined): string {
  return role === 'tutor' ? 'Docente tutor' : role === 'par_academico' ? 'Par académico' : 'Docente'
}

/** Dato de la ficha: etiqueta pequeña, valor y una línea de apoyo. */
function Stat({ label, value, hint, className }: Readonly<{ label: string; value: string | number; hint: string; className?: string }>) {
  return <div className="flex flex-col gap-1">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className={className ?? 'text-2xl font-semibold tabular-nums text-foreground'}>{value}</dd>
    <dd className="text-xs text-muted-foreground">{hint}</dd>
  </div>
}

function Person({ name, email }: Readonly<{ name: string; email?: string | null }>) {
  return <div className="flex items-center gap-3">
    <Initials name={name} />
    <div className="flex min-w-0 flex-col">
      <span className="text-sm font-medium">{name}</span>
      {email && <span className="truncate text-xs text-muted-foreground">{email}</span>}
    </div>
  </div>
}

function TopicTrackingView({ topic }: Readonly<{ topic: DegreeTopic }>) {
  const [activeTab, setActiveTab] = useState<TrackingTab>('estado-ficha')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('')
  const [search, setSearch] = useState('')

  const tracking = topic.tracking
  const activities = useMemo(() => tracking?.activities ?? [], [tracking?.activities])
  const progressPercentage = roundPercent(tracking?.progress_percentage)

  const tutor = topic.assignments.find((a) => a.role === 'tutor')?.teacher
  const peers = topic.assignments.filter((a) => a.role === 'par_academico')

  const totalTasks = activities.length
  const completedTasks = activities.filter((a) => a.is_completed).length
  const pendingTasks = totalTasks - completedTasks

  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      if (statusFilter === 'pending' && act.is_completed) return false
      if (statusFilter === 'completed' && !act.is_completed) return false

      // Las tareas sin docente no se ocultan al filtrar por quién las asignó.
      if (roleFilter && act.teacher) {
        const role = teacherRole(act)
        if (roleFilter === 'tutor' && role !== 'tutor') return false
        if (roleFilter === 'peer' && role !== 'par_academico') return false
      }

      if (search.trim()) {
        const needle = search.trim().toLowerCase()
        const text = `${act.description} ${act.teacher?.name ?? ''}`.toLowerCase()
        if (!text.includes(needle)) return false
      }

      return true
    })
  }, [activities, statusFilter, roleFilter, search])

  const context = [topic.academic_period?.name, topic.section ? `Paralelo ${topic.section.name}` : null].filter(Boolean).join(' · ')

  return (
    <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as TrackingTab)} className="w-full">
      <TabsList aria-label="Pestañas de seguimiento">
        <TabsTrigger value="estado-ficha">Estado de la ficha</TabsTrigger>
        <TabsTrigger value="equipo-titulacion">Equipo de titulación</TabsTrigger>
        <TabsTrigger value="tareas">Tareas ({activities.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="estado-ficha">
        <Card>
          <CardContent className="flex flex-col gap-6 pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex max-w-2xl min-w-0 flex-col gap-1">
                <h3 className="break-words text-xl font-semibold tracking-tight">{topic.title}</h3>
                {context && <p className="text-sm text-muted-foreground">{context}</p>}
              </div>
              <Badge variant="success">{DEGREE_STATUS_LABELS.aprobado}</Badge>
            </div>

            <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1">
                <dt className="text-sm text-muted-foreground">Avance general</dt>
                <dd className="text-2xl font-semibold tabular-nums text-foreground">{progressPercentage}%</dd>
                <dd><RedProgress value={progressPercentage} label="Avance de titulación" className="mt-1" /></dd>
              </div>
              <Stat label="Tareas asignadas" value={totalTasks} hint="En ficha de seguimiento" />
              <Stat label="Tareas completadas" value={completedTasks} hint="Revisadas con éxito" className="text-2xl font-semibold tabular-nums text-success" />
              <Stat label="Tareas pendientes" value={pendingTasks} hint="Por entregar o revisar" className="text-2xl font-semibold tabular-nums text-warning" />
            </dl>

            {tracking?.opened_at && (
              <dl className="grid gap-6 border-t pt-6 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <dt className="text-sm text-muted-foreground">Ficha abierta</dt>
                  <dd className="text-sm font-medium text-foreground">{formatDegreeDate(tracking.opened_at)}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-sm text-muted-foreground">Estado de la ficha</dt>
                  <dd><DegreeTrackingStatusBadge status={tracking.status} /></dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="equipo-titulacion">
        <Card>
          <CardContent className="grid gap-6 pt-6 sm:grid-cols-2 sm:gap-0 sm:divide-x">
            <section aria-labelledby="tracking-tutor" className="flex flex-col gap-3 sm:pr-6">
              <h3 id="tracking-tutor" className="font-semibold">Docente tutor</h3>
              {tutor ? <Person name={tutor.name} email={tutor.email} /> : <p className="text-sm text-muted-foreground">Aún no se ha asignado un tutor.</p>}
            </section>
            <section aria-labelledby="tracking-peers" className="flex flex-col gap-3 sm:pl-6">
              <h3 id="tracking-peers" className="font-semibold">Pares académicos</h3>
              {peers.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {peers.map((peer) => <li key={peer.id}><Person name={peer.teacher?.name ?? 'Docente'} email={peer.teacher?.email} /></li>)}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Aún no se han asignado pares académicos.</p>
              )}
            </section>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="tareas" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xl font-semibold tracking-tight">Tareas y actividades de seguimiento</h3>
          <span className="text-sm text-muted-foreground">{filteredActivities.length} {filteredActivities.length === 1 ? 'tarea' : 'tareas'}</span>
        </div>
        <FilterBar
          id="student-tasks"
          search={search}
          onSearch={setSearch}
          searchLabel="Buscar tareas"
          searchPlaceholder="Buscar por descripción o docente…"
          filters={[
            { id: 'status', label: 'estado', value: statusFilter, onChange: (value) => setStatusFilter(value as StatusFilter), allLabel: 'Todos los estados', options: [{ value: 'pending', label: 'Pendientes' }, { value: 'completed', label: 'Completadas' }] },
            { id: 'role', label: 'docente', value: roleFilter, onChange: (value) => setRoleFilter(value as RoleFilter), allLabel: 'Todos los docentes', options: [{ value: 'tutor', label: 'Tutor' }, { value: 'peer', label: 'Pares académicos' }] },
          ]}
          onClear={() => { setStatusFilter(''); setRoleFilter('') }}
        />
        <RecordTable
          rows={filteredActivities}
          loading={false}
          empty={activities.length === 0
            ? 'Aún no hay tareas registradas. Tu docente tutor y pares académicos las registrarán aquí.'
            : 'Ninguna tarea coincide con los filtros.'}
          columns={[
            { label: 'Tarea', render: (activity) => <span className="break-words">{activity.description}</span> },
            { label: 'Asignada por', render: (activity) => activity.teacher
              ? <div className="flex min-w-0 flex-col"><span>{activity.teacher.name}</span><span>{roleLabel(teacherRole(activity))}</span></div>
              : 'Sin docente' },
            { label: 'Fecha', render: (activity) => activity.registered_at ? formatDegreeDate(activity.registered_at) : 'Sin fecha' },
            { label: 'Estado', render: (activity) => <Badge variant={activity.is_completed ? 'success' : 'warning'}>{activity.is_completed ? 'Completada' : 'Pendiente'}</Badge> },
          ]}
        />
      </TabsContent>
    </Tabs>
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
        actions={approvedTopics.length > 1 && currentTopic ? (
          <SelectInput
            id="student-tracking-topic"
            ariaLabel="Tema de titulación"
            className="w-full sm:w-80"
            value={String(currentTopic.id)}
            onValueChange={(value) => setSelectedTopicId(Number(value))}
            options={approvedTopics.map((topic) => ({ value: String(topic.id), label: topic.title }))}
          />
        ) : undefined}
      />

      <ErrorNotice message={resource.error} retry={resource.reload} />

      {resource.loading ? (
        <DegreeTrackingSkeleton />
      ) : resource.error ? null : approvedTopics.length === 0 ? (
        <StudentEmpty
          title="No tienes un tema de titulación aprobado"
          description="Para consultar el seguimiento, tu propuesta de tema de titulación debe ser revisada y aprobada por la Coordinación de Titulación."
        />
      ) : (
        currentTopic && <TopicTrackingView topic={currentTopic} />
      )}
    </section>
  )
}
