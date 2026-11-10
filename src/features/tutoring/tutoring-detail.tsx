import { useState } from 'react'
import { ArrowLeftIcon, CalendarClockIcon, PencilIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorNotice } from '@/components/ui/error-notice'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { DAY_LABELS, tutoringApi, WEEK_DAYS, type SupervisionSession, type Tutoring, type TutoringSchedule } from '@/lib/tutoring-api'
import { RecordTable } from './tutoring-shared'
import { CoordinatorStudentsPanel } from './coordinator-students-panel'

function formatDate(value: string, time = false): string {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', ...(time ? { timeStyle: 'short' as const } : {}) }).format(date)
}

/**
 * Pantalla de una tutoría: se abre al pulsar su fila. Arriba lo esencial y la acción de
 * editar; debajo, la información separada en pestañas (resumen, supervisión, estudiantes).
 */
export function TutoringDetail({
  tutoring,
  schedules = [],
  onBack,
  onEdit,
}: Readonly<{
  tutoring: Tutoring
  schedules?: readonly TutoringSchedule[]
  onBack: () => void
  onEdit?: () => void
}>) {
  const context = [tutoring.cycle_name, tutoring.section_name ? `Paralelo ${tutoring.section_name}` : null, tutoring.modality_name, tutoring.period_name]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex flex-col gap-6" data-tour-view="detail">
      <div>
        <Button type="button" variant="tertiary" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" />
          Volver a tutorías
        </Button>
      </div>

      <AdminSectionHeader
        title={tutoring.subject_name}
        description={context}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge active={tutoring.is_active} activeLabel="Tutoría activa" inactiveLabel="Tutoría inactiva" />
            {onEdit && (
              <Button type="button" variant="tertiary" size="icon" aria-label="Editar tutoría" onClick={onEdit}>
                <PencilIcon />
              </Button>
            )}
          </div>
        }
      />

      <Tabs defaultValue="summary">
        <TabsList aria-label="Secciones de la tutoría">
          <TabsTrigger value="summary">Resumen</TabsTrigger>
          <TabsTrigger value="supervision">Supervisión</TabsTrigger>
          <TabsTrigger value="students">Estudiantes</TabsTrigger>
        </TabsList>
        <TabsContent value="summary">
          <SummaryPanel tutoring={tutoring} schedules={schedules} />
        </TabsContent>
        <TabsContent value="supervision">
          <SupervisionPanel tutoring={tutoring} />
        </TabsContent>
        <TabsContent value="students">
          <CoordinatorStudentsPanel tutoring={tutoring} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

const dayOrder = (day: string) => (WEEK_DAYS as readonly string[]).indexOf(day)

/** Docente y horario de la tutoría, en una sola tarjeta. */
function SummaryPanel({ tutoring, schedules }: Readonly<{ tutoring: Tutoring; schedules: readonly TutoringSchedule[] }>) {
  const active = schedules
    .filter((schedule) => schedule.is_active)
    .sort((a, b) => dayOrder(a.day) - dayOrder(b.day) || a.start_time.localeCompare(b.start_time))

  return (
    <Card>
      <CardContent className="pt-6">
        <dl className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">Docente</dt>
            <dd className="font-medium">{tutoring.teacher_name || 'Sin docente asignado'}</dd>
            {tutoring.teacher_id && !tutoring.teacher_is_active && (
              <dd className="text-sm text-destructive">El docente está inactivo: asigna otro desde «Editar tutoría».</dd>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">Horario</dt>
            {active.length > 0 ? (
              <dd>
                <ul className="flex flex-col gap-1" aria-label="Lista de horarios">
                  {active.map((schedule) => (
                    <li key={schedule.id} className="text-sm">
                      <span className="font-medium">{DAY_LABELS[schedule.day] ?? schedule.day}</span>{' '}
                      {schedule.start_time.slice(0, 5)} – {schedule.end_time.slice(0, 5)}
                      {schedule.room && schedule.room !== 'Por asignar' ? <span className="text-muted-foreground"> · Aula {schedule.room}</span> : null}
                    </li>
                  ))}
                </ul>
              </dd>
            ) : (
              <dd className="text-sm text-muted-foreground">Sin horario registrado.</dd>
            )}
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}

function SupervisionPanel({ tutoring }: Readonly<{ tutoring: Tutoring }>) {
  const sessions = usePaginatedCatalog(
    (page) => tutoringApi.sessions(tutoring.id, page),
    String(tutoring.id),
  )
  const [openSessionId, setOpenSessionId] = useState<number | null>(null)
  const open = sessions.data.find((session) => session.id === openSessionId) ?? null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Supervisión de asistencias</CardTitle>
        <CardDescription>Cada vez que se imparte la tutoría es una sesión. Abre una para ver su lista.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ErrorNotice message={sessions.error} retry={sessions.reload} />
        {open ? (
          <SessionDetail session={open} onClose={() => setOpenSessionId(null)} />
        ) : (
          <>
            <RecordTable
              rows={sessions.data}
              loading={sessions.isFetching || sessions.isInitialLoading}
              onRowClick={(session) => setOpenSessionId(session.id)}
              rowTitle={(session) => `Abrir la sesión ${session.number} del ${formatDate(session.date)}`}
              empty={
                <Empty className="border-none p-0">
                  <EmptyMedia variant="icon"><CalendarClockIcon /></EmptyMedia>
                  <EmptyTitle>Aún no hay sesiones registradas</EmptyTitle>
                  <EmptyDescription>Cada sesión aparecerá aquí cuando el docente tome la asistencia.</EmptyDescription>
                </Empty>
              }
              columns={[
                { label: 'Sesión', render: (session) => `Sesión ${session.number}` },
                { label: 'Fecha', render: (session) => formatDate(session.date) },
                { label: 'Temas tratados', render: (session) => <span className="text-muted-foreground" title={session.topics.map((topic) => topic.name).join(', ') || undefined}>{firstTopic(session.topics) ?? (session.topics_covered ? 'Sin temas registrados' : 'Sin temas vistos')}</span> },
                { label: 'Asistencia', render: (session) => `${session.present_count} de ${session.present_count + session.absent_count} presentes` },
              ]}
            />
            <CatalogPagination
              label="sesiones"
              page={sessions.page}
              lastPage={sessions.meta?.last_page ?? 1}
              disabled={sessions.isFetching}
              onChange={sessions.setPage}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** El primer tema de la sesión y cuántos más hubo. */
function firstTopic(topics: readonly { readonly name: string }[]): string | null {
  if (topics.length === 0) return null
  return topics.length === 1 ? topics[0].name : `${topics[0].name} +${topics.length - 1} más`
}

function SessionDetail({ session, onClose }: Readonly<{ session: SupervisionSession; onClose: () => void }>) {
  return (
    <section aria-label={`Sesión ${session.number}`} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="tertiary" size="sm" onClick={onClose}>
          <ArrowLeftIcon data-icon="inline-start" />Volver a las sesiones
        </Button>
        <div className="flex flex-col">
          <h3 className="font-display text-lg font-semibold">Sesión {session.number} · {formatDate(session.date)}</h3>
          <p className="text-sm text-muted-foreground">
            {session.present_count} presentes · {session.absent_count} ausentes
            {session.topics.length > 0 ? ` · ${session.topics.map((topic) => topic.name).join(', ')}` : ''}
          </p>
        </div>
      </div>
      <RecordTable
        numberFrom={1}
        rows={session.attendance}
        loading={false}
        empty="Esta sesión no tiene estudiantes registrados."
        columns={[
          { label: 'Estudiante', render: (record) => record.student_name },
          { label: 'Cédula', render: (record) => <span className="text-muted-foreground">{record.student_identification || '—'}</span> },
          { label: 'Asistencia', render: (record) => <StatusBadge active={record.present} activeLabel="Presente" inactiveLabel="Ausente" /> },
        ]}
      />
    </section>
  )
}
