import { useState } from 'react'
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ClipboardListIcon,
  FileCheck2Icon,
  SheetIcon,
  TrendingUpIcon,
} from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PrintStructuredReport, StructuredReport } from '@/features/reports/structured-report'
import { ErrorNotice } from '@/components/ui/error-notice'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { formatDate } from '@/lib/format'
import { isStructuredReport } from '@/lib/structured-report'
import { DAY_LABELS } from '@/lib/tutoring-api'
import { teacherApi, type TeacherReport, type TeacherTutoring, type TutoringSession } from '@/lib/teacher-api'
import { getDayOfWeekFromDate } from './teacher-attendance-page'
import { DiagnosticGradesDialog } from './teacher-diagnostic-grades-dialog'
import { DiagnosticReportDialog } from './teacher-diagnostic-report-dialog'
import { FinalPaoReportDialog } from './teacher-final-pao-report-dialog'
import { FollowUpReportDialog } from './teacher-follow-up-report-dialog'
import { TeacherEmpty } from './teacher-shared'


export function ReportsPanel({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  const [tab, setTab] = useState<'reports' | 'activities'>('reports')

  return (
    <div className="flex flex-col gap-5">
      <Tabs value={tab} onValueChange={(val) => setTab(val as 'reports' | 'activities')}>
        <TabsList aria-label="Secciones de informes">
          <TabsTrigger value="reports">Informes enviados</TabsTrigger>
          <TabsTrigger value="activities">Revisión de actividades</TabsTrigger>
        </TabsList>

        <TabsContent value="reports">
          <ReportsListSection tutoring={tutoring} />
        </TabsContent>

        <TabsContent value="activities">
          <ActivitiesReviewSection tutoring={tutoring} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ReportsListSection({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  const list = usePaginatedCatalog((page) => teacherApi.reports(tutoring.id, { page }), String(tutoring.id))
  const [reading, setReading] = useState<TeacherReport | null>(null)
  const [diagnosticOpen, setDiagnosticOpen] = useState(false)
  const [gradesOpen, setGradesOpen] = useState(false)
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [finalOpen, setFinalOpen] = useState(false)
  const readingStructured = Boolean(reading && isStructuredReport(reading.summary))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Los reportes oficiales siguen el formato institucional.</p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                disabled={!tutoring.can_manage}
              >
                <FileCheck2Icon data-icon="inline-start" />
                Reportes oficiales
                <ChevronDownIcon data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setDiagnosticOpen(true)}>
                <ClipboardListIcon />
                Reporte de Evaluación Diagnóstica
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setGradesOpen(true)}>
                <SheetIcon />
                Calificaciones Diagnósticas
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setFollowUpOpen(true)}>
                <TrendingUpIcon />
                Seguimiento de Tutorías
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setFinalOpen(true)}>
                <FileCheck2Icon />
                Informe Final PAO
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <DiagnosticReportDialog tutoring={tutoring} open={diagnosticOpen} onClose={() => setDiagnosticOpen(false)} onSent={list.reload} />
      <DiagnosticGradesDialog tutoring={tutoring} open={gradesOpen} onClose={() => setGradesOpen(false)} onSent={list.reload} />
      <FollowUpReportDialog tutoring={tutoring} open={followUpOpen} onClose={() => setFollowUpOpen(false)} onSent={list.reload} />
      <FinalPaoReportDialog tutoring={tutoring} open={finalOpen} onClose={() => setFinalOpen(false)} onSent={list.reload} />

      <ErrorNotice message={list.error} retry={list.reload} />

      <RecordTable
        rows={list.data}
        loading={list.isInitialLoading || list.isFetching}
        empty={
          <TeacherEmpty
            title="Aún no hay informes enviados"
            description="Genera uno de los reportes oficiales para compartir el desarrollo de esta tutoría con el coordinador."
          />
        }
        onRowClick={(report) => { if (report.content) setReading(report) }}
        rowTitle={(report) => (report.content ? 'Leer informe' : '')}
        columns={[
          { label: 'Informe', render: (report) => <span className="font-medium">{report.type}</span> },
          { label: 'Autor', render: (report) => report.author_name },
          { label: 'Enviado', render: (report) => formatDate(report.generated_at, true) },
        ]}
      />

      <CatalogPagination
        label="informes"
        page={list.page}
        lastPage={list.meta?.last_page ?? 1}
        disabled={list.isFetching}
        onChange={list.setPage}
      />

      <Dialog
        open={Boolean(reading)}
        title={reading?.type ?? 'Informe'}
        description={reading ? `${reading.author_name} · ${formatDate(reading.generated_at, true)}` : undefined}
        confirmClose={false}
        onClose={() => setReading(null)}
        maxWidth={readingStructured ? 'max-w-5xl' : undefined}
      >
        <div className="flex flex-col gap-5">
          <article aria-label="Contenido del informe" className="max-h-[60vh] overflow-y-auto">
            {readingStructured ? (
              <StructuredReport summary={reading?.summary} />
            ) : (
              <p className="whitespace-pre-wrap break-words text-sm leading-6">{reading?.content}</p>
            )}
          </article>
          <div className="flex flex-wrap justify-end gap-3">
            {readingStructured && <PrintStructuredReport summary={reading?.summary} />}
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
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="tertiary"
            size="sm"
            onClick={() => setSelectedSession(null)}
            className="-ml-2 w-fit"
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Volver a las fechas de tutoría
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold tracking-tight">Tutoría del {formatDate(selectedSession.date)}</h3>
            {dayLabel && <Badge variant="outline">{dayLabel}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {presentStudents.length} {presentStudents.length === 1 ? 'estudiante presente' : 'estudiantes presentes'} · {activities.length} {activities.length === 1 ? 'actividad realizada' : 'actividades realizadas'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section aria-label="Actividades realizadas" className="flex flex-col gap-3">
            <h4 className="font-semibold">Actividades realizadas ({activities.length})</h4>
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No se registraron actividades en el contenido para esta fecha.</p>
            ) : (
              <Card className="divide-y divide-border">
                {activities.map((act) => (
                  <div key={act.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
                    <span className="font-medium">{act.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {act.topic_name && <span>Tema: {act.topic_name}</span>}
                      {act.topic_name && act.duration && ' · '}
                      {act.duration && <span>{act.duration}</span>}
                    </span>
                    {act.methodologies.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        <span>Metodología:</span>
                        {act.methodologies.map((m, idx) => <Badge key={idx} variant="outline">{m}</Badge>)}
                      </div>
                    )}
                  </div>
                ))}
              </Card>
            )}
          </section>

          <section aria-label="Estudiantes que asistieron" className="flex flex-col gap-3">
            <h4 className="font-semibold">Estudiantes que asistieron ({presentStudents.length})</h4>
            {presentStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ningún estudiante fue marcado como presente en esta fecha.</p>
            ) : (
              <Card className="divide-y divide-border">
                {presentStudents.map((st, idx) => (
                  <div key={st.id || st.enrollment_id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">{idx + 1}</span>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{st.student_name}</span>
                      {(st.student_identification || st.student_email) && (
                        <span className="truncate text-xs text-muted-foreground">
                          {[st.student_identification, st.student_email].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </section>
        </div>
      </div>
    )
  }

  // Lista de sesiones para consultar
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-xl font-semibold tracking-tight">Fechas de tutorías con asistencia registrada</h3>
        <p className="text-sm text-muted-foreground">
          Elige una fecha para revisar las actividades realizadas y los estudiantes que asistieron.
        </p>
      </div>

      <ErrorNotice message={list.error} retry={list.reload} />

      <RecordTable
        rows={list.data}
        loading={list.isInitialLoading || list.isFetching}
        onRowClick={setSelectedSession}
        rowTitle={(session) => `Revisar actividades del ${formatDate(session.date)}`}
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
                <Badge variant="outline">
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
              return `${present} de ${session.attendance.length} presentes`
            },
          },
          {
            label: 'Actividades',
            render: (session) => {
              const count = (session.activities ?? []).length
              return `${count} ${count === 1 ? 'actividad' : 'actividades'}`
            },
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
