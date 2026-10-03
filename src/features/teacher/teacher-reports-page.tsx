import { useState, type FormEvent } from 'react'
import {
  ArrowLeftIcon,
  BookOpenIcon,
  CalendarCheckIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  ClockIcon,
  EyeIcon,
  FileTextIcon,
  SendIcon,
  UsersIcon,
} from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice, MutationDialog, RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { formatDate } from '@/lib/format'
import { DAY_LABELS } from '@/lib/tutoring-api'
import { teacherApi, type TeacherReport, type TeacherTutoring, type TutoringSession } from '@/lib/teacher-api'
import { getDayOfWeekFromDate } from './teacher-attendance-page'
import { TeacherEmpty } from './teacher-shared'

const INITIAL = { title: 'Informe de tutorías', observations: '' }

export function ReportsPanel({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  const [tab, setTab] = useState<'reports' | 'activities'>('reports')

  return (
    <div className="flex flex-col gap-5">
      <Tabs value={tab} onValueChange={(val) => setTab(val as 'reports' | 'activities')}>
        <TabsList aria-label="Secciones de informes">
          <TabsTrigger value="reports">
            <FileTextIcon data-icon="inline-start" />
            Informes enviados
          </TabsTrigger>
          <TabsTrigger value="activities">
            <CalendarCheckIcon data-icon="inline-start" />
            Revisión de actividades
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="pt-4">
          <ReportsListSection tutoring={tutoring} />
        </TabsContent>

        <TabsContent value="activities" className="pt-4">
          <ActivitiesReviewSection tutoring={tutoring} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ReportsListSection({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  const list = usePaginatedCatalog((page) => teacherApi.reports(tutoring.id, { page }), String(tutoring.id))
  const operation = useOperation()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(INITIAL)
  const [reading, setReading] = useState<TeacherReport | null>(null)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void operation.run(
      () => teacherApi.sendReport(tutoring.id, { title: form.title.trim(), observations: form.observations.trim() }),
      'Informe enviado al Coordinador de Carrera.',
      async () => {
        setOpen(false)
        await list.reload()
      }
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Conserva el consolidado de estudiantes, notas, asistencia y temas al momento del envío.
        </p>
        <Button
          className="shrink-0"
          disabled={!tutoring.can_manage || operation.pending}
          onClick={() => {
            operation.clearError()
            setForm(INITIAL)
            setOpen(true)
          }}
        >
          <SendIcon data-icon="inline-start" />
          Enviar informe
        </Button>
      </div>

      <ErrorNotice message={list.error} retry={list.reload} />

      <RecordTable
        rows={list.data}
        loading={list.isInitialLoading || list.isFetching}
        empty={
          <TeacherEmpty
            title="Aún no hay informes enviados"
            description="Envía un informe para compartir el desarrollo de esta tutoría con el coordinador."
          />
        }
        columns={[
          { label: 'Informe', render: (report) => <span className="font-medium">{report.type}</span> },
          { label: 'Autor', render: (report) => report.author_name },
          { label: 'Enviado', render: (report) => formatDate(report.generated_at, true) },
          {
            label: 'Acciones',
            render: (report) => (
              <Button variant="outline" size="sm" disabled={!report.content} onClick={() => setReading(report)}>
                <FileTextIcon data-icon="inline-start" />
                Leer informe
              </Button>
            ),
          },
        ]}
      />

      <CatalogPagination
        label="informes"
        page={list.page}
        lastPage={list.meta?.last_page ?? 1}
        disabled={list.isFetching}
        onChange={list.setPage}
      />

      <MutationDialog
        open={open}
        title="Enviar informe al coordinador"
        description={tutoring.subject_name}
        pending={operation.pending}
        error={operation.error}
        dirty={JSON.stringify(form) !== JSON.stringify(INITIAL)}
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Enviar informe"
      >
        <Field>
          <FieldLabel htmlFor="teacher-report-title">Título del informe</FieldLabel>
          <Input
            id="teacher-report-title"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            maxLength={100}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="teacher-report-observations">Resultados y observaciones</FieldLabel>
          <Textarea
            id="teacher-report-observations"
            value={form.observations}
            onChange={(event) => setForm({ ...form, observations: event.target.value })}
            maxLength={10000}
            rows={6}
            placeholder="Describe los avances, dificultades y resultados de las sesiones."
          />
        </Field>
      </MutationDialog>

      <Dialog
        open={Boolean(reading)}
        title={reading?.type ?? 'Informe'}
        description={reading ? `${reading.author_name} · ${formatDate(reading.generated_at, true)}` : undefined}
        confirmClose={false}
        onClose={() => setReading(null)}
      >
        <div className="flex flex-col gap-5">
          <article aria-label="Contenido del informe" className="max-h-[60vh] overflow-y-auto">
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{reading?.content}</p>
          </article>
          <div className="flex justify-end">
            <DialogCancelButton>Cerrar informe</DialogCancelButton>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

function ActivitiesReviewSection({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  const [selectedSession, setSelectedSession] = useState<TutoringSession | null>(null)
  const list = usePaginatedCatalog((page) => teacherApi.sessions(tutoring.id, { page }), `sessions-review:${tutoring.id}`)

  if (selectedSession) {
    const sessionDay = getDayOfWeekFromDate(selectedSession.date)
    const dayLabel = DAY_LABELS[sessionDay] ?? sessionDay
    const presentStudents = selectedSession.attendance.filter((r) => r.present)
    const activities = selectedSession.activities ?? []

    return (
      <div className="flex flex-col gap-6" aria-label="Detalle de revisión de actividades">
        {/* Cabecera de la sesión seleccionada */}
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelectedSession(null)}
            className="-ml-2 w-fit text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" />
            Volver a las fechas de tutoría
          </Button>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-xs">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xl font-semibold tracking-[-0.02em]">
                  Tutoría del {formatDate(selectedSession.date)}
                </h3>
                {dayLabel && (
                  <Badge variant="outline" className="font-semibold">
                    {dayLabel}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Revisión de temas, actividades realizadas y asistencia de los estudiantes en esta fecha.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1 border-success/30 bg-success/10 text-success-foreground font-medium">
                <UsersIcon className="size-3.5" />
                {presentStudents.length} {presentStudents.length === 1 ? 'estudiante presente' : 'estudiantes presentes'}
              </Badge>
              <Badge variant="secondary" className="gap-1 font-medium">
                <BookOpenIcon className="size-3.5" />
                {activities.length} {activities.length === 1 ? 'actividad realizada' : 'actividades realizadas'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Dos bloques: Actividades realizadas y Estudiantes que asistieron */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Bloque 1: Actividades realizadas */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpenIcon className="size-5 text-primary" />
                <h4 className="font-display text-base font-semibold">
                  Actividades realizadas ({activities.length})
                </h4>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Actividades registradas en el contenido de la tutoría para esta fecha.
            </p>

            {activities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No se registraron actividades en el contenido para esta fecha.
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {activities.map((act) => (
                  <li
                    key={act.id}
                    className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-xs transition-colors hover:border-primary/30"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-foreground text-sm">{act.name}</span>
                      {act.topic_name && (
                        <Badge variant="secondary" className="text-xs">
                          Tema: {act.topic_name}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {act.duration && (
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <ClockIcon className="size-3.5 text-primary" />
                          {act.duration}
                        </span>
                      )}
                      {act.methodologies.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-muted-foreground">Metodología:</span>
                          {act.methodologies.map((m, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {m}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Bloque 2: Estudiantes que asistieron */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UsersIcon className="size-5 text-success" />
                <h4 className="font-display text-base font-semibold">
                  Estudiantes que asistieron ({presentStudents.length})
                </h4>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Estudiantes registrados con asistencia confirmada (presente) en esta tutoría.
            </p>

            {presentStudents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Ningún estudiante fue marcado como presente en esta fecha.
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
                <div className="max-h-[500px] overflow-y-auto divide-y divide-border">
                  {presentStudents.map((st, idx) => (
                    <div
                      key={st.id || st.enrollment_id}
                      className="flex items-center justify-between gap-3 p-3.5 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="size-6 shrink-0 flex items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {idx + 1}
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium truncate text-foreground">
                            {st.student_name}
                          </span>
                          {(st.student_identification || st.student_email) && (
                            <span className="text-xs text-muted-foreground truncate">
                              {[st.student_identification, st.student_email].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </div>
                      </div>

                      <Badge
                        variant="default"
                        className="shrink-0 bg-success/15 text-success-foreground border-success/30 font-semibold gap-1 text-xs"
                      >
                        <CheckCircle2Icon className="size-3" />
                        Presente
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Lista de sesiones para consultar
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-lg font-semibold tracking-[-0.02em]">
          Fechas de tutorías con asistencia registrada
        </h3>
        <p className="text-sm text-muted-foreground">
          Selecciona una fecha para revisar las actividades realizadas y los estudiantes que asistieron a la sesión.
        </p>
      </div>

      <ErrorNotice message={list.error} retry={list.reload} />

      <RecordTable
        rows={list.data}
        loading={list.isInitialLoading || list.isFetching}
        empty={
          <TeacherEmpty
            title="Aún no hay asistencias registradas"
            description="Cuando tomes asistencia en tus tutorías, podrás consultar aquí las fechas, actividades realizadas y los estudiantes presentes."
          />
        }
        columns={[
          {
            label: 'Día',
            render: (session) => {
              const day = getDayOfWeekFromDate(session.date)
              const label = DAY_LABELS[day] ?? day
              return (
                <Badge variant="outline" className="font-medium">
                  {label}
                </Badge>
              )
            },
          },
          {
            label: 'Fecha',
            render: (session) => <span className="font-medium">{formatDate(session.date)}</span>,
          },
          {
            label: 'Asistencia',
            render: (session) => {
              const present = session.attendance.filter((r) => r.present).length
              return (
                <Badge
                  variant="outline"
                  className="gap-1 border-success/30 bg-success/5 text-success-foreground font-medium"
                >
                  <UsersIcon className="size-3" />
                  {present} de {session.attendance.length} presentes
                </Badge>
              )
            },
          },
          {
            label: 'Actividades',
            render: (session) => {
              const count = (session.activities ?? []).length
              return (
                <Badge variant="secondary" className="gap-1 font-normal">
                  <BookOpenIcon className="size-3" />
                  {count} {count === 1 ? 'actividad' : 'actividades'}
                </Badge>
              )
            },
          },
          {
            label: 'Acciones',
            render: (session) => (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedSession(session)}
                aria-label={`Revisar actividades del ${formatDate(session.date)}`}
              >
                <EyeIcon data-icon="inline-start" className="size-4" />
                Revisar
                <ChevronRightIcon data-icon="inline-end" className="size-4" />
              </Button>
            ),
          },
        ]}
      />

      <CatalogPagination
        label="sesiones"
        page={list.page}
        lastPage={list.meta?.last_page ?? 1}
        disabled={list.isFetching}
        onChange={list.setPage}
      />
    </div>
  )
}
