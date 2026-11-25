import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeftIcon, BookOpenIcon, CheckCheckIcon, PencilIcon, PlusIcon, SaveIcon } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { EnrollmentNumberTag } from '@/components/enrollment-number-tag'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTable } from '@/components/ui/data-table'
import { IconAction } from '@/components/ui/icon-action'
import { Skeleton } from '@/components/ui/skeleton'
import { HeadedTableSkeleton } from '@/features/tutoring/tutoring-skeletons'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice } from '@/components/ui/error-notice'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { compareNames, formatDate } from '@/lib/format'
import { DAY_LABELS } from '@/lib/tutoring-api'
import { teacherApi, type Enrollment, type TeacherAbsenceNotice, type TeacherTutoring, type TutoringSession } from '@/lib/teacher-api'
import { DATE_PATTERN, todayIso } from '@/lib/date'
import { NO_CLASS_THAT_DAY, SessionCalendar, sessionDateIssue } from './session-calendar'
import { jointGroup, ownGroup, type ClassGroup } from './joint-groups'
import { JointNotice } from './joint-notice'
import { TeacherEmpty } from './teacher-shared'
import { SessionConsultSkeleton, SessionsTabSkeleton } from './teacher-skeletons'

/** Fecha de la sesión que se registra o modifica: va en la URL para que «atrás» vuelva a la lista. */
const SESSION_PARAM = 'session'
/** Sesión abierta para consulta (su fecha). */
const CONSULT_PARAM = 'consult'

export const DAY_OF_WEEK_MAP: Record<number, string> = {
  0: 'domingo',
  1: 'lunes',
  2: 'martes',
  3: 'miercoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sabado',
}

export function getDayOfWeekFromDate(dateStr: string): string {
  if (!dateStr || !DATE_PATTERN.test(dateStr)) return ''
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day, 12, 0, 0)
  return DAY_OF_WEEK_MAP[d.getDay()] ?? ''
}

// --- Borrador: el avance se guarda solo para no perder nada si el docente retrocede o recarga. ---

type Marks = Readonly<Record<number, boolean>>
type Draft = { marks: Marks }

const draftKey = (tutoringId: number, date: string) => `attendance-draft:${tutoringId}:${date}`

function readDraft(tutoringId: number, date: string): Draft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(tutoringId, date))
    return raw ? JSON.parse(raw) as Draft : null
  } catch {
    return null
  }
}
function writeDraft(tutoringId: number, date: string, draft: Draft) {
  try { sessionStorage.setItem(draftKey(tutoringId, date), JSON.stringify(draft)) } catch { /* sin almacenamiento */ }
}
function clearDraft(tutoringId: number, date: string) {
  try { sessionStorage.removeItem(draftKey(tutoringId, date)) } catch { /* nada que limpiar */ }
}

// --- Panel: el calendario y la lista de sesiones; desde ellos se registra o modifica la sesión de un día ---

export function AttendancePanel({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  const [params, setParams] = useSearchParams()
  const sessionDate = params.get(SESSION_PARAM)
  const consultParam = params.get(CONSULT_PARAM)
  const consultDate = consultParam && DATE_PATTERN.test(consultParam) ? consultParam : null
  // La sesión elegida en la lista se reutiliza; si se abre por enlace (o al volver con «adelante»), se consulta por su fecha.
  const [picked, setPicked] = useState<TutoringSession | null>(null)

  const activeScheduleDays = useMemo(() => {
    const active = (tutoring.schedules ?? []).filter((s) => s.is_active)
    return Array.from(new Set(active.map((s) => s.day)))
  }, [tutoring.schedules])

  // La sesión de cualquier día con clase del período, hasta hoy, se registra o modifica en el mismo formulario.
  const targetDate = sessionDate && DATE_PATTERN.test(sessionDate) ? sessionDate : null

  // Cada sub-vista (toma de lista o consulta) es una entrada del historial: «atrás» vuelve a las sesiones.
  function openView(param: string | null, value: string | null) {
    const next = new URLSearchParams(params)
    next.delete(SESSION_PARAM)
    next.delete(CONSULT_PARAM)
    if (param && value) next.set(param, value)
    setParams(next)
  }

  // Una tutoría de un período cerrado solo se consulta; en el período vigente cada sesión se abre para editarla.
  function openSession(session: TutoringSession) {
    if (tutoring.can_manage) {
      openView(SESSION_PARAM, session.date)
    } else {
      setPicked(session)
      openView(CONSULT_PARAM, session.date)
    }
  }
  function openDate(date: string, session: TutoringSession | null) {
    if (tutoring.can_manage && sessionDateIssue(tutoring, date, todayIso()) === null) {
      openView(SESSION_PARAM, date)
    } else {
      setPicked(session)
      openView(CONSULT_PARAM, date)
    }
  }

  if (targetDate) {
    return (
      <div className="flex flex-col gap-4" data-tour-view="register">
        <div className="flex items-center gap-2">
          <IconAction label="Volver a las sesiones" icon={ArrowLeftIcon} onClick={() => openView(null, null)} />
          <h3 className="text-xl font-semibold tracking-tight">
            {targetDate === todayIso() ? 'Registrar asistencia' : `Sesión del ${formatDate(targetDate)}`}
          </h3>
        </div>
        <SessionFlow
          key={`${tutoring.id}:${targetDate}`}
          tutoring={tutoring}
          date={targetDate}
          onClose={() => openView(null, null)}
        />
      </div>
    )
  }

  if (consultDate) {
    return (
      <SessionConsultView
        tutoring={tutoring}
        date={consultDate}
        picked={picked?.date === consultDate ? picked : null}
        onClose={() => openView(null, null)}
        onEdit={() => openView(SESSION_PARAM, consultDate)}
      />
    )
  }

  return (
    <SessionsList
      tutoring={tutoring}
      scheduleDays={activeScheduleDays.map((day) => DAY_LABELS[day] ?? day)}
      onOpenSession={openSession}
      onOpenDate={openDate}
      onOpenRegister={(date) => openView(SESSION_PARAM, date)}
    />
  )
}

/** Sesión abierta por la URL: la elegida en la lista o, si no, la que se consulta por su fecha. */
function SessionConsultView({ tutoring, date, picked, onClose, onEdit }: Readonly<{ tutoring: TeacherTutoring; date: string; picked: TutoringSession | null; onClose: () => void; onEdit: () => void }>) {
  const resource = useDegreeResource(
    async () => picked ?? (await teacherApi.sessions(tutoring.id, { date })).data[0] ?? null,
    `consult:${tutoring.id}:${date}:${picked ? picked.id : 'url'}`,
  )
  if (resource.loading) return <SessionConsultSkeleton />
  if (resource.error) return <ErrorNotice message={resource.error} retry={resource.reload} />
  if (!resource.data) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <IconAction label="Volver a las sesiones" icon={ArrowLeftIcon} onClick={onClose} />
          <h3 className="text-xl font-semibold tracking-tight">Sesión del {formatDate(date)}</h3>
        </div>
        <Alert><AlertDescription>No hay una sesión registrada en esta fecha.</AlertDescription></Alert>
      </div>
    )
  }
  const editable = tutoring.can_manage && sessionDateIssue(tutoring, date, todayIso()) === null
  return <SessionConsult session={resource.data} readOnly={!tutoring.can_manage} onClose={onClose} onEdit={editable ? onEdit : undefined} />
}

function attendanceSummary(session: TutoringSession): string {
  const present = session.attendance.filter((record) => record.present).length
  return `${present} de ${session.attendance.length} presentes`
}

function SessionsList({
  tutoring,
  scheduleDays,
  onOpenSession,
  onOpenDate,
  onOpenRegister,
}: Readonly<{
  tutoring: TeacherTutoring
  /** Días de clase de la tutoría, ya con su nombre. */
  scheduleDays: readonly string[]
  onOpenSession: (session: TutoringSession) => void
  /** Día elegido en el calendario, con su sesión si ya está registrada. */
  onOpenDate: (date: string, session: TutoringSession | null) => void
  onOpenRegister: (date: string) => void
}>) {
  const list = usePaginatedCatalog((page) => teacherApi.sessions(tutoring.id, { page }), String(tutoring.id))
  // Todas las sesiones del período, para marcarlas en el calendario.
  const all = useDegreeResource(() => teacherApi.allSessions(tutoring.id), `calendar:${tutoring.id}`)

  // Una tutoría tiene un solo grupo: hay una sesión por día. Si ya existe la de hoy, solo se modifica.
  const today = todayIso()
  const todaySession = useDegreeResource(
    async () => (await teacherApi.sessions(tutoring.id, { date: today })).data[0] ?? null,
    `${tutoring.id}:${today}`,
  )
  const taken = todaySession.data
  const issue = sessionDateIssue(tutoring, today, today)
  const todayIssue = issue === NO_CLASS_THAT_DAY ? 'Hoy no hay clase de esta tutoría.' : issue
  const sessions = all.data ?? []

  // Primera carga: el aviso de hoy, su botón, el calendario y la tabla de sesiones son un solo esqueleto.
  if (list.isInitialLoading || todaySession.loading || all.loading) return <SessionsTabSkeleton />

  return (
    <div className="flex flex-col gap-5">
      {taken ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <p className="text-sm font-medium">La lista de hoy ya se tomó</p>
            <p className="text-sm text-muted-foreground">{attendanceSummary(taken)}.{tutoring.can_manage ? ' Puedes modificarla durante todo el período.' : ''}</p>
          </div>
          {tutoring.can_manage && (
            <BlockedReason reason={todayIssue}>
              <Button variant="secondary" className="shrink-0" disabled={todayIssue !== null} onClick={() => onOpenRegister(today)}>
                <PencilIcon data-icon="inline-start" />Modificar lista de hoy
              </Button>
            </BlockedReason>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <p className="text-sm text-muted-foreground">{todayIssue ?? 'Hoy hay clase: registra la asistencia de hoy.'}</p>
            {scheduleDays.length > 0 && <p className="text-sm text-muted-foreground">Días de clase: <span className="text-foreground">{scheduleDays.join(', ')}</span></p>}
          </div>
          <BlockedReason reason={!tutoring.can_manage ? 'Esta tutoría está en modo consulta.' : todayIssue}>
            <Button className="shrink-0" disabled={!tutoring.can_manage || todayIssue !== null} onClick={() => onOpenRegister(today)}>
              <PlusIcon data-icon="inline-start" />Registrar asistencia
            </Button>
          </BlockedReason>
        </div>
      )}

      <ErrorNotice message={list.error ?? all.error} retry={list.error ? list.reload : all.reload} />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <section aria-labelledby="session-calendar-title" className="flex shrink-0 flex-col gap-2 rounded-lg border p-3 lg:w-80">
          <h4 id="session-calendar-title" className="text-sm font-medium">Calendario</h4>
          <p className="text-xs text-muted-foreground">
            {tutoring.can_manage
              ? 'Elige un día con clase del período para registrar o modificar su sesión. Los días marcados ya tienen sesión.'
              : 'Elige un día marcado para consultar su sesión.'}
          </p>
          <SessionCalendar
            tutoring={tutoring}
            sessions={sessions}
            today={today}
            onSelect={(date) => onOpenDate(date, sessions.find((session) => session.date === date) ?? null)}
          />
        </section>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <RecordTable
            rows={list.data}
            loading={list.isFetching}
            onRowClick={onOpenSession}
            rowTitle={(session) => `Abrir la ${session.number ? `sesión ${session.number}` : 'sesión'} del ${formatDate(session.date)}`}
            empty={
              <TeacherEmpty
                title="Aún no hay sesiones registradas"
                description="Registra la asistencia de hoy o elige en el calendario un día con clase del período."
              />
            }
            columns={[
              { label: 'Sesión', render: (session) => (session.number ? `Sesión ${session.number}` : 'Sesión') },
              {
                label: 'Día',
                render: (session) => {
                  const day = getDayOfWeekFromDate(session.date)
                  return (
                    <span>{DAY_LABELS[day] ?? day}</span>
                  )
                },
              },
              {
                label: 'Fecha',
                render: (session) => formatDate(session.date),
              },
              { label: 'Asistencia', render: (session) => attendanceSummary(session) },
            ]}
          />
          <CatalogPagination label="sesiones" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
        </div>
      </div>
    </div>
  )
}

type AttendanceTableMeta = {
  marks: Marks
  notices: ReadonlyMap<number, TeacherAbsenceNotice>
  disabled: boolean
  onMark: (studentId: number, present: boolean) => void
}

const ATTENDANCE_COLUMNS: ColumnDef<Enrollment>[] = [
  { id: 'number', header: '#', cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.index + 1}</span> },
  {
    id: 'name',
    header: 'Apellidos y nombres',
    cell: ({ row, table }) => {
      const meta = table.options.meta as AttendanceTableMeta
      const notice = meta.notices.get(row.original.id)
      return (
        <div className="flex flex-col gap-1">
          <span>{row.original.name}</span>
          <EnrollmentNumberTag enrollmentNumber={row.original.enrollment_number} attendanceRequired={row.original.attendance_required} />
          {notice && <span className="whitespace-normal text-xs text-warning">Avisó que no asistirá: {notice.reason}</span>}
        </div>
      )
    },
  },
  {
    id: 'present',
    header: () => <div className="text-center">Asistió</div>,
    cell: ({ row, table }) => {
      const meta = table.options.meta as AttendanceTableMeta
      return (
        <div className="flex justify-center" onClick={(event) => event.stopPropagation()}>
          <Checkbox
            className="size-5"
            aria-label={`Presente: ${row.original.name}`}
            checked={meta.marks[row.original.id] === true}
            disabled={meta.disabled}
            onCheckedChange={(checked) => meta.onMark(row.original.id, checked === true)}
          />
        </div>
      )
    },
  },
]

const CONSULT_COLUMNS: ColumnDef<TutoringSession['attendance'][number]>[] = [
  { id: 'number', header: '#', cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.index + 1}</span> },
  {
    id: 'name',
    header: 'Apellidos y nombres',
    cell: ({ row }) => (
      <div className="flex flex-col gap-1">
        <span>{row.original.student_name}</span>
        <EnrollmentNumberTag attendanceRequired={row.original.attendance_required} />
      </div>
    ),
  },
  {
    id: 'present',
    header: () => <div className="text-center">Asistencia</div>,
    cell: ({ row }) => (
      <div className="flex justify-center">
        <Badge variant={row.original.present ? 'success' : 'danger'}>
          {row.original.present ? 'Presente' : 'Ausente'}
        </Badge>
      </div>
    ),
  },
]

// --- Flujo de registro de asistencia ---

/** La fecha de hoy con el conteo de presentes y la lista de estudiantes por marcar. */
function SessionFormSkeleton() {
  return (
    <div role="status" aria-label="Cargando asistencia" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3" aria-hidden="true">
        <Skeleton className="h-5 w-64 max-w-full" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
      <HeadedTableSkeleton headers={['#', 'Apellidos y nombres', 'Asistió']} />
      <div className="flex justify-end" aria-hidden="true"><Skeleton className="h-9 w-44" /></div>
    </div>
  )
}

function SessionFlow({
  tutoring,
  date,
  onClose,
}: Readonly<{
  tutoring: TeacherTutoring
  date: string
  onClose: () => void
}>) {
  const resource = useDegreeResource(async () => {
    const [students, sessions, notices, joints] = await Promise.all([
      teacherApi.allStudents(tutoring.id),
      teacherApi.sessions(tutoring.id, { date }),
      teacherApi.absenceNotices(tutoring.id, date),
      teacherApi.jointTutorings(tutoring.id),
    ])
    // Clase conjunta: los grupos de la misma asignatura que coinciden a la misma hora ese día.
    const day = getDayOfWeekFromDate(date)
    const joint = await Promise.all(joints.filter((item) => item.can_manage && item.days.includes(day)).map(async (item): Promise<JointClass> => {
      const [groupStudents, groupSessions, groupNotices] = await Promise.all([
        teacherApi.allStudents(item.id),
        teacherApi.sessions(item.id, { date }),
        teacherApi.absenceNotices(item.id, date),
      ])
      return { group: jointGroup(item), students: groupStudents, session: groupSessions.data[0] ?? null, notices: groupNotices }
    }))
    return { students, session: sessions.data[0] ?? null, notices, joint }
  }, `${tutoring.id}:${date}`)

  return (
    <div className="flex flex-col gap-5">
      <ErrorNotice message={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <SessionFormSkeleton />
      ) : (
        resource.data && (
          <SessionForm
            tutoring={tutoring}
            date={date}
            onClose={onClose}
            {...resource.data}
          />
        )
      )}
    </div>
  )
}

// Consulta de una sesión: en un período cerrado es un registro histórico de solo consulta;
// en el período vigente se puede abrir para modificarla.
function SessionConsult({ session, readOnly, onClose, onEdit }: Readonly<{ session: TutoringSession; readOnly: boolean; onClose: () => void; onEdit?: () => void }>) {
  const sessionDay = getDayOfWeekFromDate(session.date)
  const dayLabel = DAY_LABELS[sessionDay] ?? sessionDay

  return (
    <div className="flex flex-col gap-4" data-tour-view="session">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconAction label="Volver a las sesiones" icon={ArrowLeftIcon} onClick={onClose} />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold tracking-tight">
                {session.number ? `Sesión ${session.number} · ` : 'Sesión del '}{formatDate(session.date)}
              </h3>
              {dayLabel && (
                <span className="text-sm text-muted-foreground">{dayLabel}</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{readOnly ? 'Registro histórico · ' : ''}{attendanceSummary(session)}</p>
          </div>
        </div>
        {readOnly ? (
          <Badge variant="inactive">Solo consulta</Badge>
        ) : (
          onEdit && (
            <Button variant="secondary" onClick={onEdit}>
              <PencilIcon data-icon="inline-start" />Modificar sesión
            </Button>
          )
        )}
      </div>
      <DataTable
        dense
        columns={CONSULT_COLUMNS}
        data={[...session.attendance].sort((a, b) => compareNames(a.student_name, b.student_name))}
        getRowId={(record) => String(record.id)}
        emptyMessage="Esta sesión no tiene estudiantes registrados."
      />
    </div>
  )
}

type JointClass = Readonly<{ group: ClassGroup; students: readonly Enrollment[]; session: TutoringSession | null; notices: readonly TeacherAbsenceNotice[] }>

const activeStudents = (students: readonly Enrollment[]) =>
  students.filter((student) => student.is_active && student.student_is_active && !student.is_abandoned).sort((a, b) => compareNames(a.name, b.name))

function SessionForm({
  tutoring,
  date,
  onClose,
  students,
  session,
  notices,
  joint,
}: Readonly<{
  tutoring: TeacherTutoring
  date: string
  onClose: () => void
  students: readonly Enrollment[]
  session: TutoringSession | null
  notices: readonly TeacherAbsenceNotice[]
  joint: readonly JointClass[]
}>) {
  const operation = useOperation()
  const [params, setParams] = useSearchParams()
  const own = useMemo(() => activeStudents(students), [students])
  const [includeJoint, setIncludeJoint] = useState(true)
  const jointGroups = useMemo(
    () => (includeJoint ? joint : []).map((item) => ({ ...item, active: activeStudents(item.students) })),
    [joint, includeJoint],
  )
  // Todos los estudiantes de la clase: los del grupo propio y, si se incluyen, los de los grupos conjuntos.
  const active = useMemo(() => [...own, ...jointGroups.flatMap((item) => item.active)], [own, jointGroups])

  const selectedDay = getDayOfWeekFromDate(date)
  const isToday = date === todayIso()
  // La misma regla del servidor: un día con clase del período, desde su inicio hasta hoy.
  const closed = tutoring.can_manage ? sessionDateIssue(tutoring, date, todayIso()) : null

  // El borrador local tiene prioridad sobre lo guardado en el servidor
  const [draft] = useState(() => readDraft(tutoring.id, date))
  const [marks, setMarks] = useState<Marks>(() => draft?.marks ?? Object.fromEntries(
    [session, ...joint.map((item) => item.session)].flatMap((saved) => saved?.attendance ?? []).map((record) => [record.enrollment_id, record.present]),
  ))
  const [touched, setTouched] = useState(false)
  const noticesByEnrollment = useMemo(
    () => new Map([...notices, ...joint.flatMap((item) => item.notices)].map((notice) => [notice.enrollment_id, notice])),
    [notices, joint],
  )
  const noticedStudents = active.filter((student) => noticesByEnrollment.has(student.id))

  useEffect(() => {
    if (touched) writeDraft(tutoring.id, date, { marks })
  }, [touched, tutoring.id, date, marks])

  const absent = active.filter((student) => marks[student.id] !== true)
  const presentCount = active.length - absent.length
  const allPresent = active.length > 0 && absent.length === 0
  const readOnly = !tutoring.can_manage
  const locked = readOnly || closed !== null

  function mark(studentId: number, present: boolean) {
    setMarks((current) => ({ ...current, [studentId]: present }))
    setTouched(true)
  }
  function markAll(present: boolean) {
    setMarks(Object.fromEntries(active.map((student) => [student.id, present])))
    setTouched(true)
  }
  // Los temas de una sesión se asignan en Contenido, abriendo esa misma sesión.
  function openSessionContent(saved: TutoringSession) {
    const next = new URLSearchParams(params)
    next.delete(SESSION_PARAM)
    next.set('tab', 'content')
    next.set('content-session', String(saved.id))
    setParams(next)
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (closed || active.length === 0 || readOnly || operation.pending) return
    // Cada grupo guarda su sesión en su propia tutoría.
    const groups = [{ id: tutoring.id, active: own }, ...jointGroups.map((item) => ({ id: item.group.id, active: item.active }))]
      .filter((group) => group.active.length > 0)
    void operation.run(
      async () => {
        for (const group of groups) {
          // Los temas de la sesión se asignan en Contenido: al guardar la asistencia se conservan.
          const saved = group.id === tutoring.id ? session : jointGroups.find((item) => item.group.id === group.id)?.session ?? null
          await teacherApi.saveSession(group.id, {
            date,
            topics_covered: saved?.topics_covered ?? false,
            topic_ids: saved?.topics_covered ? saved.topics.map((topic) => topic.id) : [],
            attendance: group.active.map((student) => ({ enrollment_id: student.id, present: marks[student.id] === true })),
          })
        }
      },
      groups.length > 1 ? `Asistencia guardada en los ${groups.length} grupos.` : 'Asistencia guardada.',
      () => {
        clearDraft(tutoring.id, date)
        onClose()
      },
    )
  }

  const saveBlockReason = closed
    ?? (active.length === 0
      ? 'No hay estudiantes activos para registrar asistencia.'
      : null)

  const tableMeta: AttendanceTableMeta = {
    marks, notices: noticesByEnrollment, disabled: locked || operation.pending, onMark: mark,
  }

  return (
    <form
      role="form"
      onSubmit={submit}
      aria-label="Registrar asistencia"
      className="flex flex-col gap-5"
    >
      {!readOnly && closed && (
        <Alert variant="destructive">
          <AlertDescription>{closed}</AlertDescription>
        </Alert>
      )}

      {readOnly && (
        <Alert>
          <AlertDescription>Esta tutoría está en modo consulta: no se puede registrar asistencia.</AlertDescription>
        </Alert>
      )}
      {session && !draft && (
        <Alert>
          <AlertDescription>
            {isToday ? 'La lista de hoy ya se tomó.' : 'La sesión de esta fecha ya está registrada.'} Estás modificándola: al guardar se reemplaza ese registro.
          </AlertDescription>
        </Alert>
      )}

      {noticedStudents.length > 0 && (
        <div role="alert" className="rounded-md border border-notice-border bg-notice px-4 py-3 text-sm text-notice-foreground">
          {noticedStudents.length === 1
            ? `${noticedStudents[0].name} avisó que no asistirá en esta fecha.`
            : `${noticedStudents.length} estudiantes avisaron que no asistirán en esta fecha.`}{' '}
          Revisa el motivo y marca si asistió o no.
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <p className="text-sm">
            <span className="font-medium">{isToday ? 'Hoy, ' : ''}{DAY_LABELS[selectedDay] ?? selectedDay} {formatDate(date)}</span>
          </p>
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {presentCount} de {active.length} presentes
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={locked || active.length === 0}
              onClick={() => markAll(!allPresent)}
            >
              <CheckCheckIcon data-icon="inline-start" />
              {allPresent ? 'Desmarcar todos' : 'Marcar todos'}
            </Button>
          </div>
        </div>

        <JointNotice groups={joint.map((item) => item.group)} include={includeJoint} onIncludeChange={setIncludeJoint} action="tomar asistencia" />

        {[{ group: ownGroup(tutoring), active: own }, ...jointGroups].map(({ group, active: groupStudents }) => (
          <section key={group.id} aria-label={jointGroups.length > 0 ? `Grupo ${group.label}` : undefined} className="flex flex-col gap-2">
            {jointGroups.length > 0 && <h3 className="text-sm font-semibold">{group.label} <span className="font-normal text-muted-foreground">· {groupStudents.length} estudiantes</span></h3>}
            <DataTable
              dense
              columns={ATTENDANCE_COLUMNS}
              meta={tableMeta}
              data={groupStudents}
              getRowId={(student) => String(student.id)}
              onRowClick={locked || operation.pending ? undefined : (student) => mark(student.id, marks[student.id] !== true)}
              emptyMessage="No hay estudiantes activos en esta tutoría. Inscríbelos en la pestaña Estudiantes."
            />
          </section>
        ))}

        <ErrorNotice message={operation.error} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          {readOnly ? <span /> : session ? (
            <Button type="button" variant="tertiary" size="sm" disabled={operation.pending} onClick={() => openSessionContent(session)}>
              <BookOpenIcon data-icon="inline-start" />
              Asignar temas en Contenido
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Después de guardar, asigna los temas de esta sesión en «Contenido».</p>
          )}
          <BlockedReason reason={operation.pending ? null : saveBlockReason}>
            <Button type="submit" disabled={saveBlockReason !== null || operation.pending}>
              {operation.pending ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
              {operation.pending ? 'Guardando…' : 'Guardar asistencia'}
            </Button>
          </BlockedReason>
        </div>
      </div>
    </form>
  )
}

/** Botón bloqueado con su motivo en un tooltip (nunca con el atributo `title`). */
function BlockedReason({ reason, children }: Readonly<{ reason: string | null; children: ReactNode }>) {
  if (!reason) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="shrink-0">{children}</span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  )
}
