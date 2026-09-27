import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeftIcon, CalendarDaysIcon, PlusIcon, UserPlusIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { DAY_LABELS, tutoringApi, WEEK_DAYS, type ScheduleInput, type Tutoring, type TutoringReport, type TutoringSchedule } from '@/lib/tutoring-api'
import { ErrorNotice, MutationDialog, RecordActions, RecordTable, SelectField } from './tutoring-shared'
import { describeError, useOperation } from './tutoring-hooks'

const EMPTY_SCHEDULE = { day: 'lunes', start_time: '', end_time: '', room: '' }

function formatDate(value: string, time = false): string {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', ...(time ? { timeStyle: 'short' as const } : {}) }).format(date)
}

export function TutoringDetail({ tutoring, onBack, onAssignTeacher }: Readonly<{ tutoring: Tutoring; onBack: () => void; onAssignTeacher: () => void }>) {
  const [schedules, setSchedules] = useState<readonly TutoringSchedule[]>([])
  const [schedulesLoading, setSchedulesLoading] = useState(true)
  const [schedulesError, setSchedulesError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const attendance = usePaginatedCatalog((page) => tutoringApi.attendance(tutoring.id, page), String(tutoring.id))
  const reports = usePaginatedCatalog((page) => tutoringApi.reports(tutoring.id, page), String(tutoring.id))
  const operation = useOperation()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TutoringSchedule | null>(null)
  const [form, setForm] = useState<ScheduleInput>(EMPTY_SCHEDULE)
  const [initialForm, setInitialForm] = useState<ScheduleInput>(EMPTY_SCHEDULE)
  const [deactivating, setDeactivating] = useState<TutoringSchedule | null>(null)
  const [readingReport, setReadingReport] = useState<TutoringReport | null>(null)

  useEffect(() => {
    let cancelled = false
    tutoringApi.schedules(tutoring.id)
      .then((data) => { if (!cancelled) setSchedules(data) })
      .catch((caught: unknown) => { if (!cancelled) setSchedulesError(describeError(caught)) })
      .finally(() => { if (!cancelled) setSchedulesLoading(false) })
    return () => { cancelled = true }
  }, [tutoring.id, revision])

  function edit(schedule: TutoringSchedule | null) {
    const next = schedule ? { day: schedule.day, start_time: schedule.start_time.slice(0, 5), end_time: schedule.end_time.slice(0, 5), room: schedule.room ?? '' } : EMPTY_SCHEDULE
    setEditing(schedule)
    setForm(next)
    setInitialForm(next)
    operation.clearError()
    setOpen(true)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void operation.run(() => editing ? tutoringApi.updateSchedule(tutoring.id, editing.id, form) : tutoringApi.createSchedule(tutoring.id, form), editing ? 'Horario actualizado.' : 'Horario registrado.', () => { setOpen(false); reloadSchedules() })
  }

  function reloadSchedules() { setSchedulesLoading(true); setSchedulesError(null); setRevision((value) => value + 1) }

  return <div className="flex flex-col gap-8">
    <div><Button type="button" variant="ghost" onClick={onBack} disabled={operation.pending}><ArrowLeftIcon data-icon="inline-start" />Volver a tutorías</Button></div>
    <AdminSectionHeader title={tutoring.subject_name} description={`${tutoring.period_name} · ${tutoring.cycle_name}${tutoring.section_name ? ` · Paralelo ${tutoring.section_name}` : ''} · ${tutoring.modality_name}`} actions={<StatusBadge active={tutoring.is_active} activeLabel="Tutoría activa" inactiveLabel="Tutoría inactiva" />} />
    <Card><CardHeader><CardTitle>Docente responsable</CardTitle><CardDescription>{tutoring.teacher_name || 'Sin docente asignado'}</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">{tutoring.teacher_id && !tutoring.teacher_is_active ? 'El docente está inactivo. Asigna un docente activo para continuar la tutoría.' : tutoring.teacher_id ? 'Revisa la planificación y el seguimiento académico de esta tutoría.' : 'Asigna un docente para completar la planificación de esta tutoría.'}</p>
      {tutoring.is_active && <Button type="button" variant="outline" onClick={onAssignTeacher} disabled={operation.pending}><UserPlusIcon data-icon="inline-start" />{tutoring.teacher_id ? 'Cambiar docente' : 'Asignar docente'}</Button>}
    </CardContent></Card>
    <section aria-labelledby="tutoring-schedules-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 id="tutoring-schedules-title" className="text-xl font-semibold">Horarios</h3>{tutoring.is_active && <Button type="button" disabled={operation.pending} onClick={() => edit(null)}><PlusIcon data-icon="inline-start" />Registrar horario</Button>}</div>
      <ErrorNotice message={schedulesError} retry={reloadSchedules} />
      <RecordTable rows={schedules} loading={schedulesLoading} empty="Esta tutoría todavía no tiene horarios registrados." columns={[
        { label: 'Día', render: (schedule) => DAY_LABELS[schedule.day] ?? schedule.day },
        { label: 'Horario', render: (schedule) => `${schedule.start_time.slice(0, 5)} – ${schedule.end_time.slice(0, 5)}` },
        { label: 'Aula o lugar', render: (schedule) => schedule.room || 'Sin especificar' },
        { label: 'Estado', render: (schedule) => <StatusBadge active={schedule.is_active} /> },
        { label: 'Acciones', render: (schedule) => <RecordActions name={`horario del ${DAY_LABELS[schedule.day] ?? schedule.day}`} disabled={operation.pending} onEdit={tutoring.is_active && schedule.is_active ? () => edit(schedule) : undefined} onDeactivate={tutoring.is_active && schedule.is_active ? () => { operation.clearError(); setDeactivating(schedule) } : undefined} /> },
      ]} />
    </section>
    <section aria-labelledby="tutoring-attendance-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1"><h3 id="tutoring-attendance-title" className="text-xl font-semibold">Supervisión de asistencias</h3><p className="text-sm text-muted-foreground">Consulta las asistencias registradas por los docentes.</p></div>
      <ErrorNotice message={attendance.error} retry={attendance.reload} />
      <RecordTable rows={attendance.data} loading={attendance.isFetching || attendance.isInitialLoading} empty="No hay asistencias registradas en esta tutoría." columns={[
        { label: 'Estudiante', render: (record) => record.student_name },
        { label: 'Fecha', render: (record) => formatDate(record.date) },
        { label: 'Asistencia', render: (record) => <Badge variant={record.present ? 'secondary' : 'inactive'}>{record.present ? 'Presente' : 'Ausente'}</Badge> },
      ]} />
      <CatalogPagination label="asistencias" page={attendance.page} lastPage={attendance.meta?.last_page ?? 1} disabled={attendance.isFetching} onChange={attendance.setPage} />
    </section>
    <section aria-labelledby="tutoring-reports-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1"><h3 id="tutoring-reports-title" className="text-xl font-semibold">Informes de tutoría</h3><p className="text-sm text-muted-foreground">Revisa los informes disponibles y el resumen de participación.</p></div>
      <ErrorNotice message={reports.error} retry={reports.reload} />
      {reports.meta && !reports.error && <div className="grid gap-4 sm:grid-cols-3">
        {[['Estudiantes inscritos', reports.meta.enrollment_count], ['Asistencias registradas', reports.meta.present_count], ['Ausencias registradas', reports.meta.absent_count]].map(([label, value]) => <Card key={String(label)}><CardHeader><CardDescription>{label}</CardDescription><CardTitle>{value ?? 0}</CardTitle></CardHeader></Card>)}
      </div>}
      <RecordTable rows={reports.data} loading={reports.isFetching || reports.isInitialLoading} empty="No hay informes registrados para esta tutoría." columns={[
        { label: 'Informe', render: (report) => <div className="flex flex-col gap-1"><span className="font-medium">{report.type}</span><span className="text-xs text-muted-foreground">Informe #{report.id}</span></div> },
        { label: 'Autor', render: (report) => report.author_name },
        { label: 'Generado', render: (report) => formatDate(report.generated_at, true) },
        { label: 'Contenido', render: (report) => report.content ? <Button type="button" variant="outline" size="sm" onClick={() => setReadingReport(report)}>Leer informe</Button> : <span className="text-sm text-muted-foreground">Este registro conserva únicamente los datos del informe; no tiene contenido adjunto.</span> },
      ]} />
      <CatalogPagination label="informes" page={reports.page} lastPage={reports.meta?.last_page ?? 1} disabled={reports.isFetching} onChange={reports.setPage} />
    </section>
    <Dialog open={Boolean(readingReport)} title={`Informe: ${readingReport?.type ?? ''}`} description={tutoring.subject_name} confirmClose={false} onClose={() => setReadingReport(null)} maxWidth="max-w-2xl">
      {readingReport && <div className="flex min-w-0 flex-col gap-5">
        <article aria-label="Contenido del informe" className="flex max-h-[60vh] min-w-0 flex-col gap-5 overflow-y-auto">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Autor</dt><dd>{readingReport.author_name}</dd></div>
            <div><dt className="text-muted-foreground">Fecha de generación</dt><dd>{formatDate(readingReport.generated_at, true)}</dd></div>
          </dl>
          <p className="whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{readingReport.content}</p>
        </article>
        <div className="flex justify-end"><DialogCancelButton>Cerrar informe</DialogCancelButton></div>
      </div>}
    </Dialog>
    <MutationDialog open={open} title={editing ? 'Editar horario' : 'Registrar horario'} description={tutoring.subject_name} pending={operation.pending} error={operation.error} dirty={JSON.stringify(form) !== JSON.stringify(initialForm)} onClose={() => setOpen(false)} onSubmit={submit} submitLabel={editing ? 'Guardar cambios' : 'Registrar horario'}>
      <SelectField id="schedule-day" label="Día" value={form.day} onChange={(value) => setForm({ ...form, day: value })}>{WEEK_DAYS.map((day) => <option key={day} value={day}>{DAY_LABELS[day]}</option>)}</SelectField>
      <Field><FieldLabel htmlFor="schedule-start">Hora de inicio</FieldLabel><Input id="schedule-start" type="time" value={form.start_time} onChange={(event) => setForm({ ...form, start_time: event.target.value })} required /></Field>
      <Field><FieldLabel htmlFor="schedule-end">Hora de fin</FieldLabel><Input id="schedule-end" type="time" value={form.end_time} onChange={(event) => setForm({ ...form, end_time: event.target.value })} required /></Field>
      <Field><FieldLabel htmlFor="schedule-room">Aula o lugar</FieldLabel><Input id="schedule-room" value={form.room} onChange={(event) => setForm({ ...form, room: event.target.value })} maxLength={100} required /></Field>
      <Alert><CalendarDaysIcon /><AlertDescription>La hora de fin debe ser posterior al inicio. El horario no puede cruzarse con otro horario de esta tutoría.</AlertDescription></Alert>
    </MutationDialog>
    <ConfirmModal open={Boolean(deactivating)} title="¿Desactivar horario?" description={`El horario del ${DAY_LABELS[deactivating?.day ?? ''] ?? ''}, ${deactivating?.start_time.slice(0, 5) ?? ''} – ${deactivating?.end_time.slice(0, 5) ?? ''}, dejará de estar disponible.`} confirmLabel="Desactivar horario" pending={operation.pending} onClose={() => { if (!operation.pending) setDeactivating(null) }} onConfirm={() => { if (deactivating) void operation.run(() => tutoringApi.deactivateSchedule(tutoring.id, deactivating.id), 'Horario desactivado.', () => { setDeactivating(null); reloadSchedules() }) }} />
  </div>
}
