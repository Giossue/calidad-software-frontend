import { useEffect, useState, type ComponentType, type FormEvent } from 'react'
import { AlertTriangleIcon, ArrowLeftIcon, BookOpenIcon, CalendarClockIcon, CalendarDaysIcon, ClipboardCheckIcon, FileTextIcon, GraduationCapIcon, MapPinIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, PowerOffIcon, UserIcon, UserPlusIcon, UsersIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldCounter, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { getInitials } from '@/lib/format'
import { DAY_LABELS, tutoringApi, WEEK_DAYS, type ScheduleInput, type Tutoring, type TutoringReport, type TutoringSchedule } from '@/lib/tutoring-api'
import { cn } from '@/lib/utils'
import { ErrorNotice, MutationDialog, RecordTable, SelectField } from './tutoring-shared'
import { describeError, useOperation } from './tutoring-hooks'

const EMPTY_SCHEDULE = { day: 'lunes', start_time: '', end_time: '', room: '' }

function formatDate(value: string, time = false): string {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', ...(time ? { timeStyle: 'short' as const } : {}) }).format(date)
}

function InfoChip({ icon: Icon, label }: Readonly<{ icon: ComponentType<{ className?: string }>; label: string }>) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"><Icon className="size-3.5" />{label}</span>
}

function StatMiniCard({ icon: Icon, tone, label, value }: Readonly<{ icon: ComponentType<{ className?: string }>; tone: 'blue' | 'green' | 'red'; label: string; value: number }>) {
  const toneClass = tone === 'blue'
    ? 'bg-brand-blue/10 text-brand-blue'
    : tone === 'green'
      ? 'bg-success/10 text-success-foreground'
      : 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
  return <Card><CardContent className="flex items-center gap-4 pt-6">
    <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', toneClass)}><Icon className="size-5" /></div>
    <div className="flex flex-col"><span className="text-sm text-muted-foreground">{label}</span><span className="text-2xl font-semibold">{value}</span></div>
  </CardContent></Card>
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
    <AdminSectionHeader
      title={tutoring.subject_name}
      description={<div className="flex flex-wrap gap-2">
        <InfoChip icon={BookOpenIcon} label={tutoring.period_name} />
        <InfoChip icon={GraduationCapIcon} label={tutoring.cycle_name} />
        {tutoring.section_name && <InfoChip icon={UsersIcon} label={`Paralelo ${tutoring.section_name}`} />}
        <InfoChip icon={MapPinIcon} label={tutoring.modality_name} />
      </div>}
      actions={<StatusBadge active={tutoring.is_active} activeLabel="Tutoría activa" inactiveLabel="Tutoría inactiva" />}
    />
    <Card><CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
      <div className="flex items-center gap-4">
        <div className={cn('flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-bold', tutoring.teacher_name ? 'bg-brand-blue text-white' : 'bg-muted text-muted-foreground')}>
          {tutoring.teacher_name ? getInitials(tutoring.teacher_name) : <UserIcon className="size-5" />}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-muted-foreground">Docente responsable</span>
          <span className="text-lg font-semibold">{tutoring.teacher_name || 'Sin docente asignado'}</span>
          <span className="text-sm text-muted-foreground">{tutoring.teacher_id && !tutoring.teacher_is_active ? 'El docente está inactivo. Asigna un docente activo para continuar la tutoría.' : tutoring.teacher_id ? 'Revisa la planificación y el seguimiento académico de esta tutoría.' : 'Asigna un docente para completar la planificación de esta tutoría.'}</span>
        </div>
      </div>
      {tutoring.is_active && <Button type="button" variant="outline" onClick={onAssignTeacher} disabled={operation.pending}><UserPlusIcon data-icon="inline-start" />{tutoring.teacher_id ? 'Cambiar docente' : 'Asignar docente'}</Button>}
    </CardContent></Card>

    <Card>
      <CardHeader><div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-xl"><CalendarDaysIcon className="size-5" />Horarios</CardTitle>
        {tutoring.is_active && <Button type="button" disabled={operation.pending} onClick={() => edit(null)} className="bg-brand-red hover:bg-brand-red/90 text-white font-semibold"><PlusIcon data-icon="inline-start" />Registrar horario</Button>}
      </div></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ErrorNotice message={schedulesError} retry={reloadSchedules} />
        <RecordTable rows={schedules} loading={schedulesLoading} empty="Esta tutoría todavía no tiene horarios registrados." columns={[
          { label: 'Día', render: (schedule) => DAY_LABELS[schedule.day] ?? schedule.day },
          { label: 'Horario', render: (schedule) => `${schedule.start_time.slice(0, 5)} – ${schedule.end_time.slice(0, 5)}` },
          { label: 'Aula o lugar', render: (schedule) => schedule.room || 'Sin especificar' },
          { label: 'Estado', render: (schedule) => <StatusBadge active={schedule.is_active} /> },
          {
            label: 'Acciones', render: (schedule) => {
              if (!(tutoring.is_active && schedule.is_active)) return <span className="text-muted-foreground">—</span>
              const dayLabel = DAY_LABELS[schedule.day] ?? schedule.day
              return <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={operation.pending} onClick={() => edit(schedule)} aria-label={`Editar horario del ${dayLabel}`}><PencilIcon data-icon="inline-start" />Editar</Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button type="button" variant="outline" size="icon-sm" aria-label={`Más acciones para el horario del ${dayLabel}`} disabled={operation.pending}><MoreHorizontalIcon /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem variant="destructive" onSelect={() => { operation.clearError(); setDeactivating(schedule) }}><PowerOffIcon />Desactivar</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            },
          },
        ]} />
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl"><UsersIcon className="size-5" />Supervisión de asistencias</CardTitle>
        <CardDescription>Consulta las asistencias registradas por los docentes.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ErrorNotice message={attendance.error} retry={attendance.reload} />
        <RecordTable rows={attendance.data} loading={attendance.isFetching || attendance.isInitialLoading} empty={<Empty className="border-none p-0">
          <EmptyMedia variant="icon"><CalendarClockIcon /></EmptyMedia>
          <EmptyTitle>Aún no hay asistencias registradas</EmptyTitle>
          <EmptyDescription>Las asistencias aparecerán aquí cuando los docentes las registren.</EmptyDescription>
        </Empty>} columns={[
          { label: 'Estudiante', render: (record) => record.student_name },
          { label: 'Fecha', render: (record) => formatDate(record.date) },
          { label: 'Asistencia', render: (record) => <Badge variant={record.present ? 'secondary' : 'inactive'}>{record.present ? 'Presente' : 'Ausente'}</Badge> },
        ]} />
        <CatalogPagination label="asistencias" page={attendance.page} lastPage={attendance.meta?.last_page ?? 1} disabled={attendance.isFetching} onChange={attendance.setPage} />
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl"><FileTextIcon className="size-5" />Informes de tutoría</CardTitle>
        <CardDescription>Revisa los informes disponibles y el resumen de participación.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ErrorNotice message={reports.error} retry={reports.reload} />
        {reports.meta && !reports.error && <div className="grid gap-4 sm:grid-cols-3">
          <StatMiniCard icon={UsersIcon} tone="blue" label="Estudiantes inscritos" value={reports.meta.enrollment_count ?? 0} />
          <StatMiniCard icon={ClipboardCheckIcon} tone="green" label="Asistencias registradas" value={reports.meta.present_count ?? 0} />
          <StatMiniCard icon={AlertTriangleIcon} tone="red" label="Ausencias registradas" value={reports.meta.absent_count ?? 0} />
        </div>}
        <RecordTable rows={reports.data} loading={reports.isFetching || reports.isInitialLoading} empty={<Empty className="border-none p-0">
          <EmptyMedia variant="icon"><FileTextIcon /></EmptyMedia>
          <EmptyTitle>No hay informes registrados para esta tutoría.</EmptyTitle>
          <EmptyDescription>Cuando se generen informes, aparecerán en esta sección.</EmptyDescription>
        </Empty>} columns={[
          { label: 'Informe', render: (report) => <div className="flex flex-col gap-1"><span className="font-medium">{report.type}</span><span className="text-xs text-muted-foreground">Informe #{report.id}</span></div> },
          { label: 'Autor', render: (report) => report.author_name },
          { label: 'Generado', render: (report) => formatDate(report.generated_at, true) },
          { label: 'Contenido', render: (report) => report.content ? <Button type="button" variant="outline" size="sm" onClick={() => setReadingReport(report)}>Leer informe</Button> : <span className="text-sm text-muted-foreground">Este registro conserva únicamente los datos del informe; no tiene contenido adjunto.</span> },
        ]} />
        <CatalogPagination label="informes" page={reports.page} lastPage={reports.meta?.last_page ?? 1} disabled={reports.isFetching} onChange={reports.setPage} />
      </CardContent>
    </Card>

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
      <Field>
        <div className="flex items-center justify-between"><FieldLabel htmlFor="schedule-room">Aula o lugar</FieldLabel><FieldCounter current={form.room.length} max={100} /></div>
        <Input id="schedule-room" value={form.room} onChange={(event) => setForm({ ...form, room: event.target.value.slice(0, 100) })} maxLength={100} required placeholder="Ej. Aula 204" />
      </Field>
      <Alert><CalendarDaysIcon /><AlertDescription>La hora de fin debe ser posterior al inicio. El horario no puede cruzarse con otro horario de esta tutoría.</AlertDescription></Alert>
    </MutationDialog>
    <ConfirmModal open={Boolean(deactivating)} title="¿Desactivar horario?" description={`El horario del ${DAY_LABELS[deactivating?.day ?? ''] ?? ''}, ${deactivating?.start_time.slice(0, 5) ?? ''} – ${deactivating?.end_time.slice(0, 5) ?? ''}, dejará de estar disponible.`} confirmLabel="Desactivar horario" pending={operation.pending} onClose={() => { if (!operation.pending) setDeactivating(null) }} onConfirm={() => { if (deactivating) void operation.run(() => tutoringApi.deactivateSchedule(tutoring.id, deactivating.id), 'Horario desactivado.', () => { setDeactivating(null); reloadSchedules() }) }} />
  </div>
}
