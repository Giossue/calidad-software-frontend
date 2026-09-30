import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeftIcon, CheckCheckIcon, CheckCircle2Icon, ChevronRightIcon, PencilIcon, PlusIcon, SaveIcon } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTable } from '@/components/ui/data-table'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice, RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { compareNames, formatDate } from '@/lib/format'
import { teacherApi, type Enrollment, type TeacherTutoring, type TutoringSession, type TutoringTopic } from '@/lib/teacher-api'
import { TeacherEmpty } from './teacher-shared'

const SESSION_PARAM = 'session'
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function todayDate(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Fecha sugerida para una sesión nueva: hoy, acotada al período de la tutoría.
function suggestedDate(tutoring: TeacherTutoring): string {
  const today = todayDate()
  if (today > tutoring.period_end_date) return tutoring.period_end_date
  if (today < tutoring.period_start_date) return tutoring.period_start_date
  return today
}

// --- Borrador: el avance se guarda solo para no perder nada si el docente retrocede o recarga. ---

type Marks = Readonly<Record<number, boolean>>
type Draft = { marks: Marks; covered: boolean | null; topicIds: readonly number[]; step: 1 | 2 }

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
  try { sessionStorage.setItem(draftKey(tutoringId, date), JSON.stringify(draft)) } catch { /* sin almacenamiento: el formulario sigue funcionando */ }
}
function clearDraft(tutoringId: number, date: string) {
  try { sessionStorage.removeItem(draftKey(tutoringId, date)) } catch { /* nada que limpiar */ }
}

// --- Panel: lista de sesiones, o el flujo de registro cuando hay una fecha en la URL. ---

export function AttendancePanel({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  const [params, setParams] = useSearchParams()
  const sessionDate = params.get(SESSION_PARAM)

  function go(date: string | null, replace = false) {
    const next = new URLSearchParams(params)
    if (date) next.set(SESSION_PARAM, date)
    else next.delete(SESSION_PARAM)
    setParams(next, { replace })
  }

  const validDate = sessionDate && DATE_PATTERN.test(sessionDate) ? sessionDate : null
  if (validDate) {
    return <SessionFlow key={`${tutoring.id}:${validDate}`} tutoring={tutoring} date={validDate} onDateChange={(date) => go(date, true)} onClose={() => go(null)} />
  }
  return <SessionsList tutoring={tutoring} onOpen={(date) => go(date)} />
}

function attendanceSummary(session: TutoringSession): string {
  const present = session.attendance.filter((record) => record.present).length
  return `${present} de ${session.attendance.length} presentes`
}

function SessionsList({ tutoring, onOpen }: Readonly<{ tutoring: TeacherTutoring; onOpen: (date: string) => void }>) {
  const list = usePaginatedCatalog((page) => teacherApi.sessions(tutoring.id, { page }), String(tutoring.id))

  // Una tutoría tiene un solo grupo: la lista se toma una vez al día. Si ya existe la de hoy, solo se modifica.
  const today = todayDate()
  const todaySession = useDegreeResource(async () => (await teacherApi.sessions(tutoring.id, { date: today })).data[0] ?? null, `${tutoring.id}:${today}`)
  const taken = todaySession.data

  return <div className="flex flex-col gap-5">
    {taken ? <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden="true" />
        <div className="flex flex-col">
          <p className="font-medium">La lista de hoy ya se tomó</p>
          <p className="text-sm text-muted-foreground">{attendanceSummary(taken)}. Puedes modificarla solo durante hoy.</p>
        </div>
      </div>
      {tutoring.can_manage && <Button variant="outline" className="shrink-0" onClick={() => onOpen(today)}><PencilIcon data-icon="inline-start" />Modificar lista de hoy</Button>}
    </div> : <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">La lista se toma una vez al día. Las sesiones anteriores son solo de consulta.</p>
      <Button className="shrink-0" disabled={!tutoring.can_manage || todaySession.loading} onClick={() => onOpen(suggestedDate(tutoring))}><PlusIcon data-icon="inline-start" />Registrar asistencia</Button>
    </div>}
    <ErrorNotice message={list.error} retry={list.reload} />
    <RecordTable rows={list.data} loading={list.isInitialLoading || list.isFetching} onRowClick={(session) => onOpen(session.date)} rowTitle={(session) => `Abrir la sesión del ${formatDate(session.date)}`} empty={<TeacherEmpty title="Aún no hay sesiones registradas" description="Registra la asistencia de la primera sesión de esta tutoría." />} columns={[
      { label: 'Sesión', render: (session) => <span className="font-medium">{formatDate(session.date)}</span> },
      { label: 'Asistencia', render: (session) => attendanceSummary(session) },
      { label: 'Temas vistos', render: (session) => !session.topics_covered ? <span className="text-muted-foreground">Sin temas</span> : <span>{session.topics.map((topic) => topic.name).join(', ') || 'Sin temas'}</span> },
      { label: '', render: () => <ChevronRightIcon className="size-5 text-muted-foreground" aria-hidden="true" /> },
    ]} />
    <CatalogPagination label="sesiones" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
  </div>
}

type AttendanceTableMeta = { marks: Marks; disabled: boolean; onMark: (studentId: number, present: boolean) => void }

// Columnas estables (módulo): el estado llega por `meta`, así las celdas no se remontan en cada marca.
const ATTENDANCE_COLUMNS: ColumnDef<Enrollment>[] = [
  { id: 'number', header: 'N.°', cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.index + 1}</span> },
  { id: 'name', header: 'Estudiante', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
  {
    id: 'present',
    header: () => <div className="text-center">Asistió</div>,
    cell: ({ row, table }) => {
      const meta = table.options.meta as AttendanceTableMeta
      return <div className="flex justify-center" onClick={(event) => event.stopPropagation()}><Checkbox className="size-5" aria-label={`Presente: ${row.original.name}`} checked={meta.marks[row.original.id] === true} disabled={meta.disabled} onCheckedChange={(checked) => meta.onMark(row.original.id, checked === true)} /></div>
    },
  },
]

const CONSULT_COLUMNS: ColumnDef<TutoringSession['attendance'][number]>[] = [
  { id: 'number', header: 'N.°', cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.index + 1}</span> },
  { id: 'name', header: 'Estudiante', cell: ({ row }) => <span className="font-medium">{row.original.student_name}</span> },
  { id: 'present', header: () => <div className="text-center">Asistencia</div>, cell: ({ row }) => <div className="flex justify-center"><Badge variant={row.original.present ? 'default' : 'secondary'}>{row.original.present ? 'Presente' : 'Ausente'}</Badge></div> },
]

// --- Flujo de registro: paso 1 asistencia, paso 2 temas y envío. ---

function SessionFlow({ tutoring, date, onDateChange, onClose }: Readonly<{ tutoring: TeacherTutoring; date: string; onDateChange: (date: string) => void; onClose: () => void }>) {
  const resource = useDegreeResource(async () => {
    const [students, topics, sessions] = await Promise.all([teacherApi.allStudents(tutoring.id), teacherApi.allTopics(tutoring.id), teacherApi.sessions(tutoring.id, { date })])
    return { students, topics, session: sessions.data[0] ?? null }
  }, `${tutoring.id}:${date}`)

  return <div className="flex flex-col gap-5">
    {!resource.data && <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground" onClick={onClose}><ArrowLeftIcon data-icon="inline-start" />Volver a las sesiones</Button>}
    <ErrorNotice message={resource.error} retry={resource.reload} />
    {resource.loading ? <Skeleton className="h-64 w-full" aria-label="Cargando asistencia" /> : resource.data && resource.data.session && date < todayDate() ? <SessionConsult session={resource.data.session} onClose={onClose} /> : resource.data && <SessionForm tutoring={tutoring} date={date} onDateChange={onDateChange} onClose={onClose} {...resource.data} />}
  </div>
}

// Las sesiones de fechas anteriores a hoy son un registro histórico: solo se consultan.
function SessionConsult({ session, onClose }: Readonly<{ session: TutoringSession; onClose: () => void }>) {
  return <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" aria-label="Volver a las sesiones" title="Volver a las sesiones" onClick={onClose}><ArrowLeftIcon /></Button>
        <div className="flex flex-col">
          <h3 className="font-display text-xl font-semibold leading-tight">Sesión del {formatDate(session.date)}</h3>
          <p className="text-sm text-muted-foreground">Registro histórico · {attendanceSummary(session)}</p>
        </div>
      </div>
      <Badge variant="secondary">Solo consulta</Badge>
    </div>
    <DataTable dense columns={CONSULT_COLUMNS} data={[...session.attendance].sort((a, b) => compareNames(a.student_name, b.student_name))} getRowId={(record) => String(record.id)} emptyMessage="Esta sesión no tiene estudiantes registrados." />
    <p className="text-sm"><span className="font-medium">Temas vistos: </span><span className="text-muted-foreground">{session.topics_covered && session.topics.length > 0 ? session.topics.map((topic) => topic.name).join(', ') : 'No se abordaron temas'}</span></p>
  </div>
}

function SessionForm({ tutoring, date, onDateChange, onClose, students, topics: initialTopics, session }: Readonly<{ tutoring: TeacherTutoring; date: string; onDateChange: (date: string) => void; onClose: () => void; students: readonly Enrollment[]; topics: readonly TutoringTopic[]; session: TutoringSession | null }>) {
  const operation = useOperation()
  const active = useMemo(() => students.filter((student) => student.is_active && student.student_is_active).sort((a, b) => compareNames(a.name, b.name)), [students])
  // El borrador local tiene prioridad sobre lo guardado en el servidor: es lo último que el docente hizo.
  const [draft] = useState(() => readDraft(tutoring.id, date))
  const [marks, setMarks] = useState<Marks>(() => draft?.marks ?? Object.fromEntries((session?.attendance ?? []).map((record) => [record.enrollment_id, record.present])))
  const [covered, setCovered] = useState<boolean | null>(() => draft ? draft.covered : session ? session.topics_covered : null)
  const [topicIds, setTopicIds] = useState<readonly number[]>(() => draft?.topicIds ?? session?.topics.map((topic) => topic.id) ?? [])
  const [step, setStep] = useState<1 | 2>(() => draft?.step ?? 1)
  const [topics, setTopics] = useState(initialTopics)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (touched) writeDraft(tutoring.id, date, { marks, covered, topicIds, step })
  }, [touched, tutoring.id, date, marks, covered, topicIds, step])

  // Quien no está marcado cuenta como ausente: nunca se da por presente a alguien sin marcarlo.
  const absent = active.filter((student) => marks[student.id] !== true)
  const presentCount = active.length - absent.length
  const allPresent = active.length > 0 && absent.length === 0
  const readOnly = !tutoring.can_manage
  const topicsValid = covered === false || (covered === true && topicIds.length > 0)
  const minDate = tutoring.period_start_date
  const maxDate = todayDate() < tutoring.period_end_date ? todayDate() : tutoring.period_end_date

  function mark(studentId: number, present: boolean) {
    setMarks((current) => ({ ...current, [studentId]: present }))
    setTouched(true)
  }
  function markAll(present: boolean) {
    setMarks(Object.fromEntries(active.map((student) => [student.id, present])))
    setTouched(true)
  }
  function setCoveredValue(value: boolean) {
    setCovered(value)
    if (!value) setTopicIds([])
    setTouched(true)
  }
  function toggleTopic(id: number, checked: boolean) {
    setTopicIds((current) => checked ? [...current, id] : current.filter((item) => item !== id))
    setTouched(true)
  }
  function topicCreated(topic: TutoringTopic) {
    setTopics((current) => [...current, topic])
    setCovered(true)
    setTopicIds((current) => [...current, topic.id])
    setTouched(true)
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step === 1 || active.length === 0 || !topicsValid || readOnly || operation.pending) return
    void operation.run(() => teacherApi.saveSession(tutoring.id, {
      date,
      topics_covered: covered === true,
      topic_ids: covered === true ? topicIds : [],
      attendance: active.map((student) => ({ enrollment_id: student.id, present: marks[student.id] === true })),
    }), 'Asistencia guardada.', () => { clearDraft(tutoring.id, date); onClose() })
  }

  const tableMeta: AttendanceTableMeta = { marks, disabled: readOnly || operation.pending, onMark: mark }

  return <form onSubmit={submit} aria-label="Registrar asistencia" className="flex flex-col gap-5">
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" aria-label="Volver a las sesiones" title="Volver a las sesiones" onClick={onClose}><ArrowLeftIcon /></Button>
        <div className="flex flex-col">
          <h3 className="font-display text-xl font-semibold leading-tight">{session ? 'Editar asistencia' : 'Registrar asistencia'}</h3>
          <p className="text-sm text-muted-foreground">Paso {step} de 2 · {step === 1 ? 'Toca una fila para marcar quién asistió' : 'Temas de la sesión'}</p>
        </div>
      </div>
      <Field className="w-full sm:w-44"><FieldLabel htmlFor="teacher-session-date">Fecha de la sesión</FieldLabel><Input id="teacher-session-date" type="date" min={minDate} max={maxDate} value={date} onChange={(event) => event.target.value && onDateChange(event.target.value)} required disabled={operation.pending || step === 2} /></Field>
    </div>

    {readOnly && <Alert><AlertDescription>Esta tutoría está en modo consulta: no se puede registrar asistencia.</AlertDescription></Alert>}
    {session && !draft && <Alert><AlertDescription>{date === todayDate() ? 'La lista de hoy ya se tomó. Estás modificándola: al guardar se reemplaza ese registro.' : 'Ya existe una sesión registrada para esta fecha. Lo que guardes la reemplazará.'}</AlertDescription></Alert>}

    {step === 1 ? <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">{presentCount} de {active.length} presentes</p>
        <Button type="button" variant="outline" size="sm" disabled={readOnly || active.length === 0} onClick={() => markAll(!allPresent)}><CheckCheckIcon data-icon="inline-start" />{allPresent ? 'Desmarcar todos' : 'Marcar todos'}</Button>
      </div>
      <DataTable dense columns={ATTENDANCE_COLUMNS} meta={tableMeta} data={active} getRowId={(student) => String(student.id)} onRowClick={readOnly || operation.pending ? undefined : (student) => mark(student.id, marks[student.id] !== true)} emptyMessage="No hay estudiantes activos en esta tutoría. Inscríbelos en la pestaña Estudiantes." />
      <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t bg-background/95 py-3 backdrop-blur">
        <Button type="button" disabled={active.length === 0} onClick={() => { setStep(2); setTouched(true) }}>Continuar<ChevronRightIcon data-icon="inline-end" /></Button>
      </div>
    </div> : <fieldset disabled={readOnly || operation.pending} className="flex flex-col gap-5">
      <FieldGroup>
        <Field>
          <FieldLabel>¿Se abordaron temas en esta sesión?</FieldLabel>
          <div className="flex gap-2" role="group" aria-label="¿Se abordaron temas en esta sesión?">
            <Button type="button" variant={covered === true ? 'default' : 'outline'} aria-pressed={covered === true} onClick={() => setCoveredValue(true)}>Sí, se abordaron temas</Button>
            <Button type="button" variant={covered === false ? 'default' : 'outline'} aria-pressed={covered === false} onClick={() => setCoveredValue(false)}>No se abordaron temas</Button>
          </div>
        </Field>
        {covered === true && <TopicPicker tutoring={tutoring} topics={topics} topicIds={topicIds} onToggle={toggleTopic} onCreated={topicCreated} />}
      </FieldGroup>
      <ErrorNotice message={operation.error} />
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 py-3 backdrop-blur">
        <Button type="button" variant="outline" disabled={operation.pending} onClick={() => setStep(1)}><ArrowLeftIcon data-icon="inline-start" />Atrás</Button>
        <div className="flex items-center gap-3">
          {covered === true && topicIds.length === 0 && <p className="text-sm text-muted-foreground">Elige al menos un tema.</p>}
          {covered === null && <p className="text-sm text-muted-foreground">Indica si se abordaron temas.</p>}
          <Button type="submit" disabled={!topicsValid || operation.pending}>{operation.pending ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}{operation.pending ? 'Guardando…' : 'Guardar asistencia'}</Button>
        </div>
      </div>
    </fieldset>}
  </form>
}

function TopicPicker({ tutoring, topics, topicIds, onToggle, onCreated }: Readonly<{ tutoring: TeacherTutoring; topics: readonly TutoringTopic[]; topicIds: readonly number[]; onToggle: (id: number, checked: boolean) => void; onCreated: (topic: TutoringTopic) => void }>) {
  const available = topics.filter((topic) => topic.is_active || topicIds.includes(topic.id))
  const [creating, setCreating] = useState(available.length === 0)
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const operation = useOperation()

  async function createAndAdd() {
    const trimmed = name.trim()
    if (!trimmed || operation.pending) return
    let created: TutoringTopic | null = null
    await operation.run(async () => { created = await teacherApi.createTopic(tutoring.id, { name: trimmed, description: description.trim() }) }, 'Tema creado.')
    if (created) { onCreated(created); setCreating(false); setName(''); setDescription('') }
  }

  const normalized = query.trim().toLowerCase()
  const visible = normalized ? available.filter((topic) => topic.name.toLowerCase().includes(normalized)) : available

  return <div className="flex flex-col gap-3">
    <div className="flex items-center justify-between gap-3">
      <FieldLabel>Temas vistos</FieldLabel>
      {topicIds.length > 0 && <span className="text-sm text-muted-foreground" aria-live="polite">{topicIds.length} {topicIds.length === 1 ? 'seleccionado' : 'seleccionados'}</span>}
    </div>
    {available.length > 6 && <Input type="search" aria-label="Buscar tema" placeholder="Buscar tema…" value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" />}
    {available.length === 0 ? <p className="text-sm text-muted-foreground">Esta tutoría aún no tiene temas. Crea el primero y quedará marcado para esta sesión.</p> : <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto rounded-xl border p-3">
      {visible.length === 0 && <li className="text-sm text-muted-foreground">Ningún tema coincide con la búsqueda.</li>}
      {visible.map((topic) => <li key={topic.id}><Field orientation="horizontal"><Checkbox id={`teacher-covered-topic-${topic.id}`} checked={topicIds.includes(topic.id)} disabled={!topic.is_active} onCheckedChange={(checked) => onToggle(topic.id, checked === true)} /><FieldLabel htmlFor={`teacher-covered-topic-${topic.id}`}>{topic.name}{topic.is_active ? '' : ' (deshabilitado)'}</FieldLabel></Field></li>)}
    </ul>}
    {creating ? <div className="flex flex-col gap-3 rounded-xl border p-4">
      <Field><FieldLabel htmlFor="teacher-new-topic-name">Nombre del tema nuevo</FieldLabel><Input id="teacher-new-topic-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={150} autoComplete="off" placeholder="Ej. Pruebas unitarias" /></Field>
      <Field><FieldLabel htmlFor="teacher-new-topic-description">Descripción</FieldLabel><Textarea id="teacher-new-topic-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={255} placeholder="Opcional. Breve resumen de lo que se verá en este tema" /><FieldDescription>Opcional.</FieldDescription></Field>
      <ErrorNotice message={operation.error} />
      <div className="flex justify-end gap-2">
        {available.length > 0 && <Button type="button" variant="ghost" size="sm" disabled={operation.pending} onClick={() => { setCreating(false); setName(''); setDescription('') }}>Cancelar</Button>}
        <Button type="button" size="sm" disabled={!name.trim() || operation.pending} onClick={() => void createAndAdd()}>{operation.pending && <Spinner data-icon="inline-start" />}Crear y marcar tema</Button>
      </div>
    </div> : <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setCreating(true)}><PlusIcon data-icon="inline-start" />Crear tema nuevo</Button>}
  </div>

}
