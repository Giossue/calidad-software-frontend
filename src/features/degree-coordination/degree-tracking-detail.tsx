import { useState, type FormEvent } from 'react'
import { ArrowLeftIcon, FileTextIcon, PlusIcon, SaveIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ErrorNotice } from '@/components/ui/error-notice'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { degreeCoordinationApi, type DegreeActivity } from '@/lib/degree-coordination-api'
import { formatDegreeDate } from './degree-format'
import { useDegreeResource } from './degree-hooks'

type DialogKind = 'activity' | 'report'

/**
 * Ficha de seguimiento de un tema aprobado: se abre al pulsar su fila. Arriba el tema y
 * las acciones (informe, nueva actividad); debajo el avance y el cronograma de actividades.
 * `onChanged` avisa al listado que debe recargarse tras una acción confirmada.
 */
export function DegreeTrackingDetail({ topicId, onBack, onChanged }: Readonly<{ topicId: number; onBack: () => void; onChanged: () => void }>) {
  const resource = useDegreeResource(() => degreeCoordinationApi.topic(topicId), String(topicId))
  const operation = useOperation()
  const [dialog, setDialog] = useState<DialogKind | null>(null)
  const [activityText, setActivityText] = useState('')
  const [reportText, setReportText] = useState('')
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const topic = resource.data
  const tracking = topic?.tracking
  const activities = tracking?.activities ?? []
  const completed = activities.filter((activity) => activity.is_completed).length
  const progress = Math.min(Math.max(tracking?.progress_percentage ?? 0, 0), 100)
  const tutor = topic?.assignments.find((assignment) => assignment.role === 'tutor')?.teacher

  const activityBlockReason = activityText.trim() ? null : 'Describe la actividad o entregable.'
  const reportBlockReason = reportText.trim() ? null : 'Escribe las observaciones y conclusiones finales.'

  function refresh() {
    resource.reload()
    onChanged()
  }

  function openDialog(kind: DialogKind) {
    if (kind === 'activity') setActivityText('')
    else setReportText('')
    operation.clearError()
    setDialog(kind)
  }

  function addActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (activityBlockReason) return
    void operation.run(
      () => degreeCoordinationApi.addActivity(topicId, { descripcion: activityText.trim() }),
      'Actividad registrada',
      () => { setActivityText(''); setDialog(null); refresh() },
    )
  }

  function toggleActivity(activity: DegreeActivity) {
    if (operation.pending) return
    setTogglingId(activity.id)
    void operation.run(
      () => degreeCoordinationApi.toggleActivity(topicId, activity.id, !activity.is_completed),
      activity.is_completed ? 'Actividad marcada como pendiente' : 'Actividad completada',
      refresh,
    ).finally(() => setTogglingId(null))
  }

  function generateReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (reportBlockReason) return
    void operation.run(
      () => degreeCoordinationApi.generateReport(topicId, { observaciones_finales: reportText.trim() }),
      'Informe generado, disponible en Reportes',
      () => { setReportText(''); setDialog(null); refresh() },
    )
  }

  const context = topic ? [
    topic.student ? `${topic.student.name} (${topic.student.identification})` : 'Sin estudiante',
    tutor ? `Tutor: ${tutor.name}` : 'Tutor por asignar',
  ].join(' · ') : undefined

  return (
    <section className="flex flex-col gap-6" data-tour-view="detail">
      <div>
        <Button type="button" variant="tertiary" onClick={onBack} disabled={operation.pending}>
          <ArrowLeftIcon data-icon="inline-start" />
          Volver a seguimiento
        </Button>
      </div>
      {resource.loading && <Skeleton role="status" aria-label="Cargando ficha de seguimiento" className="h-40 w-full" />}
      <ErrorNotice message={resource.error} retry={resource.reload} />
      {topic && <>
        <AdminSectionHeader
          title={topic.title}
          description={context}
          actions={
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" disabled={operation.pending} onClick={() => openDialog('report')}>
                <FileTextIcon data-icon="inline-start" />Generar Informe
              </Button>
              <Button type="button" disabled={operation.pending} onClick={() => openDialog('activity')}>
                <PlusIcon data-icon="inline-start" />Nueva actividad
              </Button>
            </div>
          }
        />

        <Card><CardContent className="grid gap-6 pt-6 sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Avance</span><span className="font-medium tabular-nums">{progress}%</span></div>
            <div role="progressbar" aria-label="Avance del tema" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <SummaryItem label="Actividades completadas" value={`${completed} de ${activities.length}`} />
          <SummaryItem label="Ficha abierta" value={tracking?.opened_at ? formatDegreeDate(tracking.opened_at) : 'En apertura'} />
          <div className="flex flex-col gap-0.5 text-sm"><span className="text-muted-foreground">Estado de la ficha</span><span><Badge variant="outline" className="capitalize">{tracking?.status || 'En progreso'}</Badge></span></div>
        </CardContent></Card>

        <RecordTable
          rows={activities}
          loading={false}
          empty="Aún no hay actividades. Registra la primera con «Nueva actividad»."
          columns={[
            {
              label: 'Completada',
              render: (activity) => togglingId === activity.id
                ? <Spinner role="status" aria-label="Guardando actividad" />
                : <Checkbox
                    aria-label={`Completada: ${activity.description}`}
                    checked={activity.is_completed}
                    disabled={operation.pending}
                    onCheckedChange={() => toggleActivity(activity)}
                  />,
            },
            {
              label: 'Actividad',
              render: (activity) => <span className={activity.is_completed ? 'text-muted-foreground line-through' : 'font-medium'}>{activity.description}</span>,
            },
            { label: 'Registrada', render: (activity) => <span className="text-sm text-muted-foreground">{activity.registered_at ? formatDegreeDate(activity.registered_at) : 'Reciente'}</span> },
            { label: 'Docente', render: (activity) => <span className="text-sm text-muted-foreground">{activity.teacher?.name ?? 'Coordinación'}</span> },
          ]}
        />
      </>}

      <FormDialog
        open={dialog === 'activity'}
        onClose={() => setDialog(null)}
        title="Registrar actividad de avance"
        description={topic?.title}
        pending={operation.pending}
        error={operation.error}
        dirty={activityText !== ''}
        blockReason={activityBlockReason}
        onSubmit={addActivity}
        submitLabel="Registrar actividad"
        submitIcon={SaveIcon}
      >
        <FormField id="new-activity-desc" label="Descripción de la actividad / entregable" counter={{ current: activityText.length, max: 1000 }}>
          <Textarea id="new-activity-desc" maxLength={1000} rows={3} placeholder="Ej. Entrega del capítulo 1: marco metodológico" value={activityText} onChange={(event) => setActivityText(event.target.value)} />
        </FormField>
      </FormDialog>

      <FormDialog
        open={dialog === 'report'}
        onClose={() => setDialog(null)}
        title="Generar informe de titulación"
        description="El informe quedará disponible en Reportes con el avance actual del tema."
        pending={operation.pending}
        error={operation.error}
        dirty={reportText !== ''}
        blockReason={reportBlockReason}
        onSubmit={generateReport}
        submitLabel="Generar informe"
        submitIcon={FileTextIcon}
      >
        <FormField id="report-obs" label="Observaciones y conclusiones finales" counter={{ current: reportText.length, max: 2000 }}>
          <Textarea id="report-obs" maxLength={2000} rows={4} placeholder="Ej. Cumple los objetivos; se recomienda revisar la bibliografía" value={reportText} onChange={(event) => setReportText(event.target.value)} />
        </FormField>
      </FormDialog>
    </section>
  )
}

function SummaryItem({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div className="flex flex-col gap-0.5 text-sm"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>
}
