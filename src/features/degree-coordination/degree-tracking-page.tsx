import { useState, type FormEvent } from 'react'
import { ArrowLeftIcon, CheckCircle2Icon, CircleIcon, FileTextIcon, ListTodoIcon, PlusIcon, SaveIcon, SparklesIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorNotice } from '@/components/ui/error-notice'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { IconAction } from '@/components/ui/icon-action'
import { Textarea } from '@/components/ui/textarea'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { degreeCoordinationApi, type DegreeActivity, type DegreeTopic } from '@/lib/degree-coordination-api'
import { formatDegreeDate } from './degree-format'
import { useDegreePeriod, useDegreeResource, useDegreeSearch } from './degree-hooks'
import { DegreePeriodCard } from './degree-shared'

export function DegreeTrackingPage() {
  const period = useDegreePeriod()
  const search = useDegreeSearch()
  const [selectedTopic, setSelectedTopic] = useState<DegreeTopic | null>(null)

  // Dialogs
  const [activityDialogOpen, setActivityDialogOpen] = useState(false)
  const [newActivityDesc, setNewActivityDesc] = useState('')
  const [activitySubmitting, setActivitySubmitting] = useState(false)
  const [activityError, setActivityError] = useState<string | null>(null)

  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [reportObservations, setReportObservations] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const topicsResource = useDegreeResource(
    () => degreeCoordinationApi.topics({ status: 'aprobado', search: search.search }),
    `approved-topics-${search.search}`,
  )

  const rows = topicsResource.data?.data ?? []

  const activityBlockReason = newActivityDesc.trim() ? null : 'Describe la actividad o entregable.'
  const reportBlockReason = reportObservations.trim() ? null : 'Escribe las observaciones y conclusiones finales.'

  async function handleAddActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTopic || activityBlockReason || activitySubmitting) return
    setActivitySubmitting(true)
    setActivityError(null)
    try {
      await degreeCoordinationApi.addActivity(selectedTopic.id, {
        descripcion: newActivityDesc.trim(),
      })
      setNewActivityDesc('')
      setActivityDialogOpen(false)
      setFeedbackMsg('Actividad de avance registrada exitosamente.')
      const updated = await degreeCoordinationApi.topic(selectedTopic.id)
      setSelectedTopic(updated)
      topicsResource.reload()
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : 'Error al registrar actividad')
    } finally {
      setActivitySubmitting(false)
    }
  }

  async function handleToggleActivity(activity: DegreeActivity) {
    if (!selectedTopic) return
    setActionError(null)
    try {
      await degreeCoordinationApi.toggleActivity(selectedTopic.id, activity.id, !activity.is_completed)
      const updated = await degreeCoordinationApi.topic(selectedTopic.id)
      setSelectedTopic(updated)
      topicsResource.reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al cambiar estado de la actividad')
    }
  }


  async function handleGenerateReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTopic || reportBlockReason || reportSubmitting) return
    setReportSubmitting(true)
    setReportError(null)
    try {
      await degreeCoordinationApi.generateReport(selectedTopic.id, {
        observaciones_finales: reportObservations.trim(),
      })
      setReportObservations('')
      setReportDialogOpen(false)
      setFeedbackMsg('Informe de titulación generado con éxito. Puedes consultarlo en la pestaña de Reportes.')
      const updated = await degreeCoordinationApi.topic(selectedTopic.id)
      setSelectedTopic(updated)
      topicsResource.reload()
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Error al generar informe')
    } finally {
      setReportSubmitting(false)
    }
  }

  if (selectedTopic) {
    const tracking = selectedTopic.tracking
    const activities = tracking?.activities ?? []
    const progress = tracking?.progress_percentage ?? 0
    const tutor = selectedTopic.assignments.find((a) => a.role === 'tutor')?.teacher

    return (
      <section className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Button variant="tertiary" size="sm" onClick={() => setSelectedTopic(null)} className="mb-2 -ml-3">
              <ArrowLeftIcon data-icon="inline-start" />
              Volver al listado de temas
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{selectedTopic.title}</h1>
            <p className="text-sm text-muted-foreground">
              Estudiante: <span className="font-semibold text-foreground">{selectedTopic.student?.name}</span> ({selectedTopic.student?.identification})
              {tutor && <> &bull; Tutor asignado: <span className="font-semibold text-foreground">{tutor.name}</span></>}
            </p>
          </div>

          <div className="flex items-center gap-2">

            <Button
              variant="secondary"
              onClick={() => {
                setReportObservations('')
                setReportError(null)
                setReportDialogOpen(true)
              }}
            >
              <FileTextIcon data-icon="inline-start" /> Generar Informe
            </Button>
            <Button
              onClick={() => {
                setNewActivityDesc('')
                setActivityError(null)
                setActivityDialogOpen(true)
              }}
            >
              <PlusIcon data-icon="inline-start" /> Nueva actividad
            </Button>
          </div>
        </div>

        {feedbackMsg && (
          <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
            <span>{feedbackMsg}</span>
            <Button type="button" variant="tertiary" size="sm" onClick={() => setFeedbackMsg(null)}>
              Cerrar
            </Button>
          </div>
        )}

        <ErrorNotice message={actionError} />

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <SparklesIcon className="size-5 text-primary" /> Estado de la Ficha
              </CardTitle>
              <CardDescription>Resumen del avance acumulado</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progreso general</span>
                  <span className="font-semibold text-foreground">{progress}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3 text-xs flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ficha abierta:</span>
                  <span className="text-foreground">{tracking?.opened_at ? formatDegreeDate(tracking.opened_at) : 'En apertura'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estado de ficha:</span>
                  <Badge variant="outline" className="capitalize text-[11px]">{tracking?.status || 'En progreso'}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Actividades totales:</span>
                  <span className="text-foreground">{activities.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Actividades completadas:</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {activities.filter((a) => a.is_completed).length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListTodoIcon className="size-5 text-primary" /> Cronograma de Actividades
                </CardTitle>
                <CardDescription>Seguimiento de entregables y avances del estudiante</CardDescription>
              </div>
              <Button size="sm" variant="secondary" onClick={() => { setNewActivityDesc(''); setActivityError(null); setActivityDialogOpen(true) }}>
                <PlusIcon data-icon="inline-start" /> Añadir
              </Button>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Aún no se han registrado actividades de avance para este tema. Haz clic en "Nueva actividad" para comenzar.
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-start justify-between gap-4 py-3">
                      <div className="flex items-start gap-3">
                        <IconAction
                          label={activity.is_completed ? 'Marcar como pendiente' : 'Marcar como completada'}
                          icon={activity.is_completed ? CheckCircle2Icon : CircleIcon}
                          onClick={() => void handleToggleActivity(activity)}
                        />
                        <div className="flex flex-col">
                          <span className={`text-sm font-medium ${activity.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {activity.description}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Registrada: {activity.registered_at ? formatDegreeDate(activity.registered_at) : 'Reciente'}
                            {activity.teacher && ` • Docente: ${activity.teacher.name}`}
                          </span>
                        </div>
                      </div>
                      <Badge variant={activity.is_completed ? 'success' : 'secondary'} className="text-[11px] shrink-0">
                        {activity.is_completed ? 'Completada' : 'Pendiente'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Modal Nueva Actividad */}
        <FormDialog
          open={activityDialogOpen}
          onClose={() => setActivityDialogOpen(false)}
          title="Registrar actividad de avance"
          description="Define el hito o entregable para la ficha de seguimiento de titulación."
          pending={activitySubmitting}
          error={activityError}
          dirty={newActivityDesc !== ''}
          blockReason={activityBlockReason}
          onSubmit={(event) => void handleAddActivity(event)}
          submitLabel="Registrar actividad"
          submitIcon={SaveIcon}
        >
          <FormField id="new-activity-desc" label="Descripción de la actividad / entregable" counter={{ current: newActivityDesc.length, max: 1000 }}>
            <Textarea
              id="new-activity-desc"
              maxLength={1000}
              rows={3}
              placeholder="Ej. Entrega del Capítulo 1: Marco Metodológico y diseño de prototipo..."
              value={newActivityDesc}
              onChange={(e) => setNewActivityDesc(e.target.value)}
            />
          </FormField>
        </FormDialog>

        {/* Modal Generar Informe */}
        <FormDialog
          open={reportDialogOpen}
          onClose={() => setReportDialogOpen(false)}
          title="Generar informe de titulación"
          description="Registra las observaciones y dictamen de la evolución del tema de titulación."
          pending={reportSubmitting}
          error={reportError}
          dirty={reportObservations !== ''}
          blockReason={reportBlockReason}
          onSubmit={(event) => void handleGenerateReport(event)}
          submitLabel="Generar informe"
          submitIcon={FileTextIcon}
        >
          <FormField id="report-obs" label="Observaciones y conclusiones finales" counter={{ current: reportObservations.length, max: 2000 }}>
            <Textarea
              id="report-obs"
              maxLength={2000}
              rows={4}
              placeholder="Detalla el estado general, recomendaciones y cumplimiento del trabajo de titulación..."
              value={reportObservations}
              onChange={(e) => setReportObservations(e.target.value)}
            />
          </FormField>
        </FormDialog>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-6">
      <AdminSectionHeader
        title="Seguimiento de titulación"
      />

      <DegreePeriodCard resource={period} />

      <FilterBar
        id="degree-tracking"
        search={search.input}
        onSearch={search.setInput}
        searchLabel="Buscar tema o estudiante"
        searchPlaceholder="Título del tema, estudiante o cédula"
        onClear={() => search.setInput('')}
        filters={[]}
      />

      <ErrorNotice message={topicsResource.error} retry={topicsResource.reload} />

      <RecordTable
        rows={rows}
        loading={topicsResource.loading}
        empty="No hay temas aprobados en seguimiento para este período académico."
        onRowClick={setSelectedTopic}
        rowTitle={(topic) => `Ver evolución de ${topic.title}`}
        columns={[
          {
            label: 'Tema de titulación',
            render: (topic) => (
              <div className="flex flex-col gap-1 max-w-md">
                <span className="font-medium text-foreground">{topic.title}</span>
                <span className="text-xs text-muted-foreground line-clamp-2">{topic.description || 'Sin descripción'}</span>
              </div>
            ),
          },
          {
            label: 'Estudiante',
            render: (topic) => (
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground">{topic.student?.name}</span>
                <span className="text-xs text-muted-foreground">{topic.student?.identification}</span>
              </div>
            ),
          },
          {
            label: 'Tutor',
            render: (topic) => {
              const tutor = topic.assignments.find((a) => a.role === 'tutor')?.teacher
              return tutor ? (
                <span className="text-xs text-foreground">{tutor.name}</span>
              ) : (
                <span className="text-xs text-muted-foreground">Por asignar</span>
              )
            },
          },
          {
            label: 'Avance',
            render: (topic) => {
              const progress = topic.tracking?.progress_percentage ?? 0
              return (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(progress, 100)}%` }} />
                  </div>
                  <span className="text-xs text-foreground">{progress}%</span>
                </div>
              )
            },
          },
        ]}
      />
    </section>
  )
}
