import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeftIcon, CheckCheckIcon, PencilIcon, PlusIcon, SaveIcon } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTable } from '@/components/ui/data-table'
import { IconAction } from '@/components/ui/icon-action'
import { Skeleton } from '@/components/ui/skeleton'
import { TableSkeleton } from '@/components/ui/loading-skeletons'
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
import { classWindow, closedReason, hoursLabel, useNow } from './class-hours'
import { jointGroup, ownGroup, type ClassGroup } from './joint-groups'
import { JointNotice } from './joint-notice'
import { TeacherEmpty } from './teacher-shared'

const SESSION_PARAM = 'session'
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

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

function todayDate(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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

// --- Panel: la lista de sesiones; desde ella se toma la lista de hoy o se consulta una sesión ---

export function AttendancePanel({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  const [params, setParams] = useSearchParams()
  const sessionDate = params.get(SESSION_PARAM)
  const [consultingSession, setConsultingSession] = useState<TutoringSession | null>(null)

  const activeScheduleDays = useMemo(() => {
    const active = (tutoring.schedules ?? []).filter((s) => s.is_active)
    return Array.from(new Set(active.map((s) => s.day)))
  }, [tutoring.schedules])

  // Sección activa: 'register' o 'consult'
  const [section, setSection] = useState<'register' | 'consult'>(() => {
    return sessionDate && DATE_PATTERN.test(sessionDate) ? 'register' : 'consult'
  })

  // La asistencia solo se toma el día de la clase: la lista que se registra es siempre la de hoy.
  const targetDate = todayDate()

  useEffect(() => {
    if (sessionDate && DATE_PATTERN.test(sessionDate)) setSection('register')
  }, [sessionDate])

  function openRegisterForDate(date: string) {
    setSection('register')
    setConsultingSession(null)
    const next = new URLSearchParams(params)
    next.set(SESSION_PARAM, date)
    setParams(next, { replace: true })
  }

  function handleCloseRegister() {
    setSection('consult')
    setConsultingSession(null)
    const next = new URLSearchParams(params)
    next.delete(SESSION_PARAM)
    setParams(next, { replace: true })
  }

  if (section === 'register') {
    return (
      <div className="flex flex-col gap-4" data-tour-view="register">
        <div className="flex items-center gap-2">
          <IconAction label="Volver a las sesiones" icon={ArrowLeftIcon} onClick={handleCloseRegister} />
          <h3 className="text-xl font-semibold tracking-tight">Registrar asistencia</h3>
        </div>
        <SessionFlow
          key={`${tutoring.id}:${targetDate}`}
          tutoring={tutoring}
          date={targetDate}
          onClose={handleCloseRegister}
        />
      </div>
    )
  }

  if (consultingSession) {
    return <SessionConsult session={consultingSession} onClose={() => setConsultingSession(null)} />
  }

  return (
    <SessionsList
      tutoring={tutoring}
      scheduleDays={activeScheduleDays.map((day) => DAY_LABELS[day] ?? day)}
      onOpenConsult={(session) => setConsultingSession(session)}
      onOpenRegister={(date) => openRegisterForDate(date)}
    />
  )
}

function attendanceSummary(session: TutoringSession): string {
  const present = session.attendance.filter((record) => record.present).length
  return `${present} de ${session.attendance.length} presentes`
}

function SessionsList({
  tutoring,
  scheduleDays,
  onOpenConsult,
  onOpenRegister,
}: Readonly<{
  tutoring: TeacherTutoring
  /** Días de clase de la tutoría, ya con su nombre. */
  scheduleDays: readonly string[]
  onOpenConsult: (session: TutoringSession) => void
  onOpenRegister: (date: string) => void
}>) {
  const list = usePaginatedCatalog((page) => teacherApi.sessions(tutoring.id, { page }), String(tutoring.id))

  // Una tutoría tiene un solo grupo: la lista se toma una vez al día. Si ya existe la de hoy, solo se modifica.
  const today = todayDate()
  const todaySession = useDegreeResource(
    async () => (await teacherApi.sessions(tutoring.id, { date: today })).data[0] ?? null,
    `${tutoring.id}:${today}`,
  )
  const taken = todaySession.data
  const classTime = classWindow(tutoring.schedules, useNow())
  const closed = closedReason(classTime)

  return (
    <div className="flex flex-col gap-5">
      {taken ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <p className="text-sm font-medium">La lista de hoy ya se tomó</p>
            <p className="text-sm text-muted-foreground">{attendanceSummary(taken)}. Puedes modificarla solo durante el horario de la clase.</p>
          </div>
          {tutoring.can_manage && (
            <BlockedReason reason={closed}>
              <Button variant="secondary" className="shrink-0" disabled={closed !== null} onClick={() => onOpenRegister(today)}>
                <PencilIcon data-icon="inline-start" />Modificar lista de hoy
              </Button>
            </BlockedReason>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <p className="text-sm text-muted-foreground">
              {closed ?? `Clase en curso (${classTime.current ? hoursLabel(classTime.current) : ''}): registra la asistencia de hoy.`}
            </p>
            {scheduleDays.length > 0 && <p className="text-sm text-muted-foreground">Días de clase: <span className="text-foreground">{scheduleDays.join(', ')}</span></p>}
          </div>
          <Button
            className="shrink-0"
            disabled={!tutoring.can_manage || todaySession.loading || closed !== null}
            onClick={() => onOpenRegister(today)}
          >
            <PlusIcon data-icon="inline-start" />Registrar asistencia
          </Button>
        </div>
      )}

      <ErrorNotice message={list.error} retry={list.reload} />

      <RecordTable
        rows={list.data}
        loading={list.isInitialLoading || list.isFetching}
        onRowClick={(session) => onOpenConsult(session)}
        rowTitle={(session) => `Abrir la ${session.number ? `sesión ${session.number}` : 'sesión'} del ${formatDate(session.date)}`}
        empty={
          <TeacherEmpty
            title="Aún no hay sesiones registradas"
            description="Pulsa «Registrar asistencia» durante la clase para crear la primera sesión."
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
    header: 'Estudiante',
    cell: ({ row, table }) => {
      const meta = table.options.meta as AttendanceTableMeta
      const notice = meta.notices.get(row.original.id)
      return (
        <div className="flex flex-col gap-1">
          <span>{row.original.name}</span>
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
  { id: 'name', header: 'Estudiante', cell: ({ row }) => row.original.student_name },
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
      <TableSkeleton columns={3} />
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

// Las sesiones de fechas anteriores a hoy son un registro histórico: solo se consultan.
function SessionConsult({ session, onClose }: Readonly<{ session: TutoringSession; onClose: () => void }>) {
  const sessionDay = getDayOfWeekFromDate(session.date)
  const dayLabel = DAY_LABELS[sessionDay] ?? sessionDay

  return (
    <div className="flex flex-col gap-4">
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
            <p className="text-sm text-muted-foreground">Registro histórico · {attendanceSummary(session)}</p>
          </div>
        </div>
        <span className="text-sm text-muted-foreground">Solo consulta</span>
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
  students.filter((student) => student.is_active && student.student_is_active).sort((a, b) => compareNames(a.name, b.name))

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
  const own = useMemo(() => activeStudents(students), [students])
  const [includeJoint, setIncludeJoint] = useState(true)
  const jointGroups = useMemo(
    () => (includeJoint ? joint : []).map((item) => ({ ...item, active: activeStudents(item.students) })),
    [joint, includeJoint],
  )
  // Todos los estudiantes de la clase: los del grupo propio y, si se incluyen, los de los grupos conjuntos.
  const active = useMemo(() => [...own, ...jointGroups.flatMap((item) => item.active)], [own, jointGroups])

  const selectedDay = getDayOfWeekFromDate(date)
  const classTime = classWindow(tutoring.schedules, useNow())
  const closed = closedReason(classTime)

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
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (closed || active.length === 0 || readOnly || operation.pending) return
    // Cada grupo guarda su sesión en su propia tutoría.
    const groups = [{ id: tutoring.id, active: own }, ...jointGroups.map((item) => ({ id: item.group.id, active: item.active }))]
      .filter((group) => group.active.length > 0)
    void operation.run(
      async () => {
        for (const group of groups) {
          await teacherApi.saveSession(group.id, {
            date,
            topics_covered: false,
            topic_ids: [],
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
            La lista de hoy ya se tomó. Estás modificándola: al guardar se reemplaza ese registro.
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
            <span className="font-medium">Hoy, {DAY_LABELS[selectedDay] ?? selectedDay} {formatDate(date)}</span>
            {classTime.current && <span className="text-muted-foreground"> · Clase de {hoursLabel(classTime.current)}</span>}
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

        <div className="flex items-center justify-end">
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
