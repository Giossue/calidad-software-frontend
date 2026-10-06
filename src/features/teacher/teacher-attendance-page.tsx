import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CheckCheckIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  PencilIcon,
  PlusIcon,
  SaveIcon,
  UserCheckIcon,
} from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTable } from '@/components/ui/data-table'
import { FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice, RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { compareNames, formatDate } from '@/lib/format'
import { DAY_LABELS } from '@/lib/tutoring-api'
import { teacherApi, type Enrollment, type TeacherTutoring, type TutoringSession } from '@/lib/teacher-api'
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

// Sugiere una fecha de asistencia acotada al período y que coincida con los días de horario registrados
function suggestedDate(tutoring: TeacherTutoring, allowedDays: readonly string[] = []): string {
  const today = todayDate()
  const rawMin = tutoring.period_start_date || '2000-01-01'
  const minDate = rawMin <= today ? rawMin : '2000-01-01'
  const maxDate = today < (tutoring.period_end_date || '2099-12-31') ? today : (tutoring.period_end_date || '2099-12-31')

  if (allowedDays.length === 0) {
    if (today > maxDate) return maxDate
    if (today < minDate) return minDate
    return today
  }

  // Si hoy es un día permitido y está dentro del rango
  const todayDay = getDayOfWeekFromDate(today)
  if (today >= minDate && today <= maxDate && allowedDays.includes(todayDay)) {
    return today
  }

  // Buscar hacia atrás desde hoy hasta minDate el día permitido más reciente
  const [ty, tm, td] = today.split('-').map(Number)
  const curr = new Date(ty, tm - 1, td, 12, 0, 0)
  for (let i = 0; i < 30; i++) {
    const y = curr.getFullYear()
    const m = String(curr.getMonth() + 1).padStart(2, '0')
    const d = String(curr.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${d}`
    if (dateStr < minDate) break
    if (dateStr <= maxDate && allowedDays.includes(getDayOfWeekFromDate(dateStr))) {
      return dateStr
    }
    curr.setDate(curr.getDate() - 1)
  }

  // Si no se encuentra hacia atrás, buscar hacia adelante desde minDate
  const [sy, sm, sd] = minDate.split('-').map(Number)
  const startCurr = new Date(sy, sm - 1, sd, 12, 0, 0)
  for (let i = 0; i < 30; i++) {
    const y = startCurr.getFullYear()
    const m = String(startCurr.getMonth() + 1).padStart(2, '0')
    const d = String(startCurr.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${d}`
    if (dateStr > maxDate) break
    if (allowedDays.includes(getDayOfWeekFromDate(dateStr))) {
      return dateStr
    }
    startCurr.setDate(startCurr.getDate() + 1)
  }

  return today
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

// Pestañas internas como control segmentado: sin subrayado, para no repetir el separador de las pestañas principales.
const SECTION_TRIGGER = 'mb-0 rounded-md border-b-0 px-3 py-2 data-[state=active]:border-transparent data-[state=active]:bg-card data-[state=active]:font-semibold data-[state=active]:shadow-sm'

// --- Panel: dos secciones (Registrar asistencia y Consultar asistencia) ---

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

  // Fecha seleccionada para registrar asistencia
  const [targetDate, setTargetDate] = useState<string>(() => {
    if (sessionDate && DATE_PATTERN.test(sessionDate)) return sessionDate
    return suggestedDate(tutoring, activeScheduleDays)
  })

  useEffect(() => {
    if (sessionDate && DATE_PATTERN.test(sessionDate)) {
      setTargetDate(sessionDate)
      setSection('register')
    }
  }, [sessionDate])

  function handleSectionChange(newSection: string) {
    if (newSection === 'register' || newSection === 'consult') {
      setSection(newSection)
      setConsultingSession(null)
      if (newSection === 'consult') {
        const next = new URLSearchParams(params)
        next.delete(SESSION_PARAM)
        setParams(next, { replace: true })
      }
    }
  }

  function openRegisterForDate(date: string) {
    setTargetDate(date)
    setSection('register')
    setConsultingSession(null)
    const next = new URLSearchParams(params)
    next.set(SESSION_PARAM, date)
    setParams(next, { replace: true })
  }

  function handleDateChange(newDate: string) {
    setTargetDate(newDate)
    const next = new URLSearchParams(params)
    next.set(SESSION_PARAM, newDate)
    setParams(next, { replace: true })
  }

  function handleCloseRegister() {
    setSection('consult')
    setConsultingSession(null)
    const next = new URLSearchParams(params)
    next.delete(SESSION_PARAM)
    setParams(next, { replace: true })
  }

  return (
    <div className="flex flex-col gap-6">
      <Tabs value={section} onValueChange={handleSectionChange}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList aria-label="Secciones de asistencia" className="w-fit gap-1 rounded-lg border-b-0 bg-muted p-1">
            <TabsTrigger value="consult" className={SECTION_TRIGGER}>
              <ClipboardListIcon data-icon="inline-start" />
              Consultar asistencia
            </TabsTrigger>
            <TabsTrigger value="register" className={SECTION_TRIGGER}>
              <UserCheckIcon data-icon="inline-start" />
              Registrar asistencia
            </TabsTrigger>
          </TabsList>

          {activeScheduleDays.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDaysIcon className="size-3.5 text-primary" />
              <span>Días programados:</span>
              <span className="font-semibold text-foreground">
                {activeScheduleDays.map((d) => DAY_LABELS[d] ?? d).join(', ')}
              </span>
            </div>
          )}
        </div>

        <TabsContent value="register" className="pt-2">
          <SessionFlow
            key={`${tutoring.id}:${targetDate}`}
            tutoring={tutoring}
            date={targetDate}
            allowedDays={activeScheduleDays}
            onDateChange={handleDateChange}
            onClose={handleCloseRegister}
          />
        </TabsContent>

        <TabsContent value="consult" className="pt-2">
          {consultingSession ? (
            <SessionConsult
              session={consultingSession}
              onClose={() => setConsultingSession(null)}
            />
          ) : (
            <SessionsList
              tutoring={tutoring}
              allowedDays={activeScheduleDays}
              onOpenConsult={(session) => setConsultingSession(session)}
              onOpenRegister={(date) => openRegisterForDate(date)}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function attendanceSummary(session: TutoringSession): string {
  const present = session.attendance.filter((record) => record.present).length
  return `${present} de ${session.attendance.length} presentes`
}

function SessionsList({
  tutoring,
  allowedDays,
  onOpenConsult,
  onOpenRegister,
}: Readonly<{
  tutoring: TeacherTutoring
  allowedDays: readonly string[]
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

  return (
    <div className="flex flex-col gap-5">
      {taken ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden="true" />
            <div className="flex flex-col">
              <p className="font-medium">La lista de hoy ya se tomó</p>
              <p className="text-sm text-muted-foreground">{attendanceSummary(taken)}. Puedes modificarla solo durante hoy.</p>
            </div>
          </div>
          {tutoring.can_manage && (
            <Button variant="outline" className="shrink-0" onClick={() => onOpenRegister(today)}>
              <PencilIcon data-icon="inline-start" />Modificar lista de hoy
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Consulta el historial de asistencias tomadas o registra una nueva sesión.
          </p>
          <Button
            className="shrink-0"
            disabled={!tutoring.can_manage || todaySession.loading}
            onClick={() => onOpenRegister(suggestedDate(tutoring, allowedDays))}
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
        rowTitle={(session) => `Abrir la sesión del ${formatDate(session.date)}`}
        empty={
          <TeacherEmpty
            title="Aún no hay sesiones registradas"
            description="Registra la asistencia de la primera sesión de esta tutoría en la sección 'Registrar asistencia'."
          />
        }
        columns={[
          {
            label: 'Día',
            render: (session) => {
              const day = getDayOfWeekFromDate(session.date)
              return (
                <Badge variant="outline" className="font-medium">
                  {DAY_LABELS[day] ?? day}
                </Badge>
              )
            },
          },
          {
            label: 'Fecha',
            render: (session) => <span className="font-medium">{formatDate(session.date)}</span>,
          },
          { label: 'Asistencia', render: (session) => attendanceSummary(session) },
        ]}
      />
      <CatalogPagination label="sesiones" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
    </div>
  )
}

type AttendanceTableMeta = { marks: Marks; disabled: boolean; onMark: (studentId: number, present: boolean) => void }

const ATTENDANCE_COLUMNS: ColumnDef<Enrollment>[] = [
  { id: 'number', header: 'N.°', cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.index + 1}</span> },
  { id: 'name', header: 'Estudiante', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
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
  { id: 'number', header: 'N.°', cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.index + 1}</span> },
  { id: 'name', header: 'Estudiante', cell: ({ row }) => <span className="font-medium">{row.original.student_name}</span> },
  {
    id: 'present',
    header: () => <div className="text-center">Asistencia</div>,
    cell: ({ row }) => (
      <div className="flex justify-center">
        <Badge variant={row.original.present ? 'default' : 'secondary'}>
          {row.original.present ? 'Presente' : 'Ausente'}
        </Badge>
      </div>
    ),
  },
]

// --- Flujo de registro de asistencia ---

function SessionFlow({
  tutoring,
  date,
  allowedDays,
  onDateChange,
  onClose,
}: Readonly<{
  tutoring: TeacherTutoring
  date: string
  allowedDays: readonly string[]
  onDateChange: (date: string) => void
  onClose: () => void
}>) {
  const resource = useDegreeResource(async () => {
    const [students, sessions] = await Promise.all([
      teacherApi.allStudents(tutoring.id),
      teacherApi.sessions(tutoring.id, { date }),
    ])
    return { students, session: sessions.data[0] ?? null }
  }, `${tutoring.id}:${date}`)

  return (
    <div className="flex flex-col gap-5">
      <ErrorNotice message={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Skeleton className="h-64 w-full" aria-label="Cargando asistencia" />
      ) : (
        resource.data && (
          <SessionForm
            tutoring={tutoring}
            date={date}
            allowedDays={allowedDays}
            onDateChange={onDateChange}
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Volver a las sesiones"
            title="Volver a las sesiones"
            onClick={onClose}
          >
            <ArrowLeftIcon />
          </Button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-xl font-semibold leading-tight">
                Sesión del {formatDate(session.date)}
              </h3>
              {dayLabel && (
                <Badge variant="outline" className="font-semibold">
                  {dayLabel}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Registro histórico · {attendanceSummary(session)}</p>
          </div>
        </div>
        <Badge variant="secondary">Solo consulta</Badge>
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

function SessionForm({
  tutoring,
  date,
  allowedDays,
  onDateChange,
  onClose,
  students,
  session,
}: Readonly<{
  tutoring: TeacherTutoring
  date: string
  allowedDays: readonly string[]
  onDateChange: (date: string) => void
  onClose: () => void
  students: readonly Enrollment[]
  session: TutoringSession | null
}>) {
  const operation = useOperation()
  const active = useMemo(
    () => students.filter((student) => student.is_active && student.student_is_active).sort((a, b) => compareNames(a.name, b.name)),
    [students],
  )

  const selectedDay = getDayOfWeekFromDate(date)
  const isDayAllowed = allowedDays.length === 0 || allowedDays.includes(selectedDay)

  // El borrador local tiene prioridad sobre lo guardado en el servidor
  const [draft] = useState(() => readDraft(tutoring.id, date))
  const [marks, setMarks] = useState<Marks>(() => draft?.marks ?? Object.fromEntries((session?.attendance ?? []).map((record) => [record.enrollment_id, record.present])))
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (touched) writeDraft(tutoring.id, date, { marks })
  }, [touched, tutoring.id, date, marks])

  const absent = active.filter((student) => marks[student.id] !== true)
  const presentCount = active.length - absent.length
  const allPresent = active.length > 0 && absent.length === 0
  const readOnly = !tutoring.can_manage
  const today = todayDate()
  const minDate = tutoring.period_start_date && tutoring.period_start_date <= today
    ? tutoring.period_start_date
    : undefined
  const maxDate = today < (tutoring.period_end_date || '2099-12-31')
    ? today
    : (tutoring.period_end_date || undefined)

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
    if (!isDayAllowed || active.length === 0 || readOnly || operation.pending) return
    void operation.run(
      () =>
        teacherApi.saveSession(tutoring.id, {
          date,
          topics_covered: false,
          topic_ids: [],
          attendance: active.map((student) => ({ enrollment_id: student.id, present: marks[student.id] === true })),
        }),
      'Asistencia guardada.',
      () => {
        clearDraft(tutoring.id, date)
        onClose()
      },
    )
  }

  const tableMeta: AttendanceTableMeta = { marks, disabled: readOnly || operation.pending, onMark: mark }

  return (
    <form
      role="form"
      onSubmit={submit}
      aria-label="Registrar asistencia"
      className="flex flex-col gap-5"
    >
      {/* Validación de coincidencia de días */}
      {allowedDays.length > 0 && !isDayAllowed && (
        <Alert variant="destructive">
          <AlertDescription>
            La fecha seleccionada corresponde a un <strong>{DAY_LABELS[selectedDay] ?? selectedDay}</strong>, pero esta tutoría solo tiene horario los días: <strong>{allowedDays.map((d) => DAY_LABELS[d] ?? d).join(', ')}</strong>. Solo se puede tomar asistencia en las fechas que coinciden con los días registrados.
          </AlertDescription>
        </Alert>
      )}

      {allowedDays.length === 0 && (
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <AlertDescription>
            Esta tutoría aún no tiene días de horario configurados. Te recomendamos definir los horarios en la pestaña <strong>Horarios</strong>.
          </AlertDescription>
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
            {date === todayDate()
              ? 'La lista de hoy ya se tomó. Estás modificándola: al guardar se reemplaza ese registro.'
              : 'Ya existe una sesión registrada para esta fecha. Lo que guardes la reemplazará.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex items-center gap-2">
            <FieldLabel htmlFor="teacher-session-date" className="sr-only">Fecha de la sesión</FieldLabel>
            <Input
              id="teacher-session-date"
              type="date"
              min={minDate}
              max={maxDate}
              value={date}
              onChange={(event) => event.target.value && onDateChange(event.target.value)}
              required
              disabled={operation.pending}
              className="w-auto"
            />
            {selectedDay && isDayAllowed && (
              <span className="text-sm text-muted-foreground">{DAY_LABELS[selectedDay] ?? selectedDay}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {presentCount} de {active.length} presentes
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={readOnly || active.length === 0}
              onClick={() => markAll(!allPresent)}
            >
              <CheckCheckIcon data-icon="inline-start" />
              {allPresent ? 'Desmarcar todos' : 'Marcar todos'}
            </Button>
          </div>
        </div>

        <DataTable
          dense
          columns={ATTENDANCE_COLUMNS}
          meta={tableMeta}
          data={active}
          getRowId={(student) => String(student.id)}
          onRowClick={readOnly || operation.pending ? undefined : (student) => mark(student.id, marks[student.id] !== true)}
          emptyMessage="No hay estudiantes activos en esta tutoría. Inscríbelos en la pestaña Estudiantes."
        />

        <ErrorNotice message={operation.error} />

        <div className="flex items-center justify-end">
          <Button
            type="submit"
            disabled={!isDayAllowed || active.length === 0 || operation.pending}
          >
            {operation.pending ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
            {operation.pending ? 'Guardando…' : 'Guardar asistencia'}
          </Button>
        </div>
      </div>
    </form>
  )
}
