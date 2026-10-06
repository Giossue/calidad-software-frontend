import { useState } from 'react'
import {
  CheckCircle2Icon,
  ClockIcon,
  EyeIcon,
  ListTodoIcon,
  LockIcon,
  PlusIcon,
  SparklesIcon,
  UsersIcon,
} from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { Field, FieldCounter, FieldLabel } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { formatDegreeDate } from '@/features/degree-coordination/degree-format'
import { InitialsAvatar } from '@/features/degree-coordination/degree-shared'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { ErrorNotice, RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { type DegreeActivity, type DegreeTopic } from '@/lib/degree-coordination-api'
import { teacherApi } from '@/lib/teacher-api'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/auth-context'
import { FilterChips, SearchField } from '@/features/student/student-ui'
import { TeacherEmpty } from './teacher-shared'

type StatusFilter = 'all' | 'pending' | 'completed'
type TrackingTab = 'estado-ficha' | 'equipo-titulacion' | 'tareas'

export function TeacherDegreeTrackingPage() {
  const { user } = useAuth()
  const [roleFilter, setRoleFilter] = useState<'' | 'tutor' | 'par_academico'>('')
  const [selectedTopic, setSelectedTopic] = useState<DegreeTopic | null>(null)
  const [activeTab, setActiveTab] = useState<TrackingTab>('estado-ficha')

  // Dialogs
  const [activityDialogOpen, setActivityDialogOpen] = useState(false)
  const [newActivityDesc, setNewActivityDesc] = useState('')
  const [activitySubmitting, setActivitySubmitting] = useState(false)

  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)

  // Local filter inside topic
  const [taskStatusFilter, setTaskStatusFilter] = useState<StatusFilter>('all')
  const [taskSearch, setTaskSearch] = useState('')

  const list = usePaginatedCatalog(
    (page, search) =>
      teacherApi.degreeTracking({
        page,
        search,
        role: roleFilter || undefined,
      }),
    roleFilter,
  )

  async function handleAddActivity() {
    if (!selectedTopic || !newActivityDesc.trim()) return
    setActivitySubmitting(true)
    try {
      await teacherApi.addDegreeTrackingActivity(selectedTopic.id, {
        descripcion: newActivityDesc.trim(),
      })
      setNewActivityDesc('')
      setActivityDialogOpen(false)
      setFeedbackMsg('Tarea de seguimiento registrada exitosamente.')
      const updated = await teacherApi.degreeTrackingTopic(selectedTopic.id)
      setSelectedTopic(updated)
      list.reload()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al registrar la tarea')
    } finally {
      setActivitySubmitting(false)
    }
  }

  async function handleToggleActivity(activity: DegreeActivity) {
    if (!selectedTopic) return
    try {
      await teacherApi.toggleDegreeTrackingActivity(selectedTopic.id, activity.id, !activity.is_completed)
      setFeedbackMsg(
        !activity.is_completed
          ? 'Tarea marcada como completada y guardada.'
          : 'Tarea marcada como pendiente y guardada.'
      )
      const updated = await teacherApi.degreeTrackingTopic(selectedTopic.id)
      setSelectedTopic(updated)
      list.reload()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cambiar estado de la actividad')
    }
  }



  if (selectedTopic) {
    const tracking = selectedTopic.tracking
    const activities = tracking?.activities ?? []
    const progress = tracking?.progress_percentage ?? 0
    const tutorAssignment = selectedTopic.assignments.find((a) => a.role === 'tutor')
    const peerAssignments = selectedTopic.assignments.filter((a) => a.role === 'par_academico')
    const myAssignment = selectedTopic.assignments.find((a) => a.teacher?.id === user?.id)

    const filteredActivities = activities.filter((act) => {
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

    return (
      <section className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedTopic(null)
                setActiveTab('estado-ficha')
              }}
              className="mb-2"
            >
              &larr; Volver a mis temas
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{selectedTopic.title}</h1>
            <p className="text-sm text-muted-foreground">
              Estudiante: <span className="font-semibold text-foreground">{selectedTopic.student?.name}</span> ({selectedTopic.student?.identification})
              {myAssignment && (
                <>
                  {' '}&bull; Tu rol:{' '}
                  <Badge variant="secondary" className="font-semibold">
                    {myAssignment.role === 'tutor' ? 'Docente Tutor' : 'Par Académico'}
                  </Badge>
                </>
              )}
            </p>
          </div>
        </div>

        {feedbackMsg && (
          <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
            <span>{feedbackMsg}</span>
            <button type="button" onClick={() => setFeedbackMsg(null)} className="text-xs font-semibold hover:underline">
              Cerrar
            </button>
          </div>
        )}

        {/* Pestañas internas dentro de seguimiento */}
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
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <SparklesIcon className="size-5 text-brand-red" /> Estado de la Ficha de Seguimiento
                  </CardTitle>
                  <CardDescription>Resumen del avance acumulado del tema y estado general</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progreso general</span>
                    <span className="font-bold text-foreground">{progress}%</span>
                  </div>
                  <div className="h-3.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-brand-red transition-all duration-300"
                      style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border bg-muted/20 p-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Ficha abierta</span>
                    <span className="text-sm font-semibold text-foreground">
                      {tracking?.opened_at ? formatDegreeDate(tracking.opened_at) : 'En progreso'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Estado de la ficha</span>
                    <Badge variant="outline" className="w-fit capitalize text-xs">
                      {tracking?.status || 'En progreso'}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Tareas completadas</span>
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {activities.filter((a) => a.is_completed).length} de {activities.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Tareas pendientes</span>
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                      {activities.filter((a) => !a.is_completed).length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 2. Equipo de Titulación */}
          <TabsContent value="equipo-titulacion" className="flex flex-col gap-6 pt-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UsersIcon className="size-5 text-brand-red" /> Equipo de Titulación
                </CardTitle>
                <CardDescription>Estudiante y docentes evaluadores designados para esta titulación</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                {/* Estudiante vinculado */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estudiante</span>
                  <div className="rounded-xl border p-4 flex items-center gap-3.5 bg-muted/15">
                    <InitialsAvatar name={selectedTopic.student?.name ?? 'Estudiante'} tone="gray" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-foreground truncate">{selectedTopic.student?.name}</span>
                      <span className="text-xs text-muted-foreground">
                        Cédula: {selectedTopic.student?.identification} &bull; {selectedTopic.student?.email}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Docentes asignados */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Docentes Evaluadores</span>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border p-4 flex items-center gap-3.5">
                      <InitialsAvatar name={tutorAssignment?.teacher?.name ?? 'Sin tutor'} tone="red" />
                      <div className="flex flex-col min-w-0">
                        <Badge variant="outline" className="w-fit text-[10px] mb-1 font-semibold">
                          Docente Tutor
                        </Badge>
                        <span className="text-sm font-semibold truncate">
                          {tutorAssignment?.teacher?.name ?? 'Sin tutor asignado'}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {tutorAssignment?.teacher?.email ?? '---'}
                        </span>
                      </div>
                    </div>

                    {peerAssignments.map((peer, idx) => (
                      <div key={peer.id} className="rounded-xl border p-4 flex items-center gap-3.5">
                        <InitialsAvatar name={peer.teacher?.name ?? `Par ${idx + 1}`} tone="blue" />
                        <div className="flex flex-col min-w-0">
                          <Badge variant="outline" className="w-fit text-[10px] mb-1 font-semibold">
                            Par Académico {idx + 1}
                          </Badge>
                          <span className="text-sm font-semibold truncate">
                            {peer.teacher?.name ?? 'Docente'}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {peer.teacher?.email ?? '---'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 3. Tareas */}
          <TabsContent value="tareas" className="flex flex-col gap-6 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <ListTodoIcon className="size-5 text-brand-red" />
                  Tareas y Actividades de Avance ({activities.length})
                </h2>
                <p className="text-xs text-muted-foreground">
                  Cada docente puede marcar como completada únicamente la tarea que haya subido él mismo.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => {
                    setNewActivityDesc('')
                    setActivityDialogOpen(true)
                  }}
                  className="bg-brand-red hover:bg-brand-red/90 text-white"
                >
                  <PlusIcon className="size-4 mr-2" /> Asignar tarea / actividad
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <SearchField
                id="teacher-task-search"
                label="Buscar tarea o docente"
                value={taskSearch}
                onChange={setTaskSearch}
                placeholder="Buscar tarea o docente..."
              />
              <FilterChips<StatusFilter>
                label="Filtrar por estado"
                value={taskStatusFilter}
                onChange={setTaskStatusFilter}
                options={[
                  { value: 'all', label: 'Todas', count: activities.length },
                  { value: 'pending', label: 'Pendientes', count: activities.filter((a) => !a.is_completed).length },
                  { value: 'completed', label: 'Completadas', count: activities.filter((a) => a.is_completed).length },
                ]}
              />
            </div>

            <RecordTable
              rows={filteredActivities}
              loading={false}
              empty={
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <ListTodoIcon className="size-10 mb-2 opacity-40" />
                  <p className="font-medium">No hay tareas o actividades registradas con estos criterios.</p>
                  <p className="text-xs mt-1">Usa el botón "Asignar tarea / actividad" para añadir entregas al estudiante.</p>
                </div>
              }
              columns={[
                {
                  label: 'Actividad / Tarea',
                  render: (act) => (
                    <div className="flex flex-col gap-1 max-w-lg">
                      <span className="font-medium text-foreground break-words">{act.description}</span>
                      {act.registered_at && (
                        <span className="text-xs text-muted-foreground">
                          Asignada el {formatDegreeDate(act.registered_at)}
                        </span>
                      )}
                    </div>
                  ),
                },
                {
                  label: 'Docente Asignador',
                  render: (act) => {
                    const teacherRole = act.teacher && 'role' in act.teacher
                      ? (act.teacher as { role?: string }).role
                      : undefined
                    const isTutor = teacherRole === 'tutor'
                    const isPeer = teacherRole === 'par_academico'
                    const isMyTask = act.teacher?.id === user?.id

                    return act.teacher ? (
                      <div className="flex items-center gap-2.5 min-w-0">
                        <InitialsAvatar
                          name={act.teacher.name}
                          tone={isTutor ? 'red' : isPeer ? 'blue' : 'gray'}
                          className="size-8 text-xs shrink-0"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {act.teacher.name}{' '}
                            {isMyTask ? (
                              <span className="text-brand-red font-bold">(Tú)</span>
                            ) : (
                              <span className="text-muted-foreground font-normal">(Autor)</span>
                            )}
                          </span>
                          <span className="text-[11px] text-muted-foreground truncate">{act.teacher.email}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {isTutor ? 'Docente Tutor' : isPeer ? 'Par Académico' : 'Docente'}
                            </Badge>
                          </div>
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
                    const isMyTask = act.teacher?.id === user?.id

                    if (isMyTask) {
                      return (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleActivity(act)}
                            aria-label={act.is_completed ? 'Marcar como pendiente' : 'Marcar como completada'}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-2xs hover:scale-105',
                              act.is_completed
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25 hover:border-emerald-500/50'
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25 hover:border-amber-500/50'
                            )}
                            title={
                              act.is_completed
                                ? 'Completado. Clic para marcar como Pendiente'
                                : 'Pendiente. Clic para marcar como Completado'
                            }
                          >
                            {act.is_completed ? (
                              <>
                                <CheckCircle2Icon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Completado</span>
                              </>
                            ) : (
                              <>
                                <ClockIcon className="size-3.5 text-amber-600 dark:text-amber-400" />
                                <span>Pendiente</span>
                              </>
                            )}
                          </button>
                        </div>
                      )
                    }

                    return (
                      <div
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border shadow-2xs opacity-85',
                          act.is_completed
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                        )}
                        title={`Solo ${act.teacher?.name ?? 'el docente autor'} puede marcar esta tarea como completada`}
                      >
                        {act.is_completed ? (
                          <>
                            <CheckCircle2Icon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Completado</span>
                          </>
                        ) : (
                          <>
                            <ClockIcon className="size-3.5 text-amber-600 dark:text-amber-400" />
                            <span>Pendiente</span>
                          </>
                        )}
                        <LockIcon className="size-3 ml-1 text-muted-foreground" />
                      </div>
                    )
                  },
                },
              ]}
            />
          </TabsContent>
        </Tabs>

        {/* Dialog: Nueva Actividad */}
        <Dialog
          open={activityDialogOpen}
          title="Asignar nueva tarea de seguimiento"
          description={`Tema: ${selectedTopic.title}`}
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
                className="bg-brand-red hover:bg-brand-red/90 text-white"
              >
                {activitySubmitting ? 'Registrando...' : 'Registrar tarea'}
              </Button>
            </div>
          </div>
        </Dialog>


      </section>
    )
  }

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
              const pct = topic.tracking?.progress_percentage ?? 0
              return (
                <div className="flex items-center gap-2.5 w-36">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-brand-red transition-all"
                      style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-foreground w-9 text-right">{pct}%</span>
                </div>
              )
            },
          },
          {
            label: 'Acciones',
            render: (topic) => (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedTopic(topic)
                  setActiveTab('estado-ficha')
                }}
                className="gap-1.5 text-xs"
              >
                <EyeIcon className="size-3.5" />
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
