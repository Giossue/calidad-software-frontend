import { useState, type FormEvent } from 'react'
import { CheckCheckIcon, SaveIcon } from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice, RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { formatDate } from '@/lib/format'
import { teacherApi, type Enrollment, type TeacherAttendance, type TeacherTutoring, type TutoringSession, type TutoringTopic } from '@/lib/teacher-api'
import { TeacherEmpty, TeacherWorkspacePage } from './teacher-shared'

function todayDate(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function TeacherAttendancePage() {
  return <TeacherWorkspacePage title="Asistencia" description="Registra la participación de tus estudiantes y los temas vistos en cada sesión de tutoría.">{(tutoring) => <AttendancePanel tutoring={tutoring} />}</TeacherWorkspacePage>
}

function AttendancePanel({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  const [date, setDate] = useState(todayDate())
  const [dirty, setDirty] = useState(false)
  const [nextDate, setNextDate] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const history = usePaginatedCatalog((page) => teacherApi.attendance(tutoring.id, { page }), String(tutoring.id))
  const resource = useDegreeResource(async () => {
    const [students, topics, sessions, attendance] = await Promise.all([teacherApi.allStudents(tutoring.id), teacherApi.allTopics(tutoring.id), teacherApi.sessions(tutoring.id, { date }), teacherApi.allAttendance(tutoring.id, date)])
    return { students, topics, session: sessions.data[0] ?? null, attendance }
  }, `${tutoring.id}:${date}`)

  function changeDate(value: string) {
    if (!value) return
    if (dirty) setNextDate(value)
    else setDate(value)
  }
  return <div className="flex flex-col gap-5">
    <Field className="max-w-xs"><FieldLabel htmlFor="teacher-session-date">Fecha de la sesión</FieldLabel><Input id="teacher-session-date" type="date" min={tutoring.period_start_date} max={todayDate() < tutoring.period_end_date ? todayDate() : tutoring.period_end_date} value={date} onChange={(event) => changeDate(event.target.value)} required disabled={pending} /></Field>
    <ErrorNotice message={resource.error} retry={resource.reload} />
    {resource.loading ? <Skeleton className="h-48 w-full" aria-label="Cargando asistencia" /> : resource.data && <AttendanceForm tutoring={tutoring} date={date} {...resource.data} onDirty={() => setDirty(true)} onPending={setPending} onSaved={async () => { setDirty(false); resource.reload(); await history.reload() }} />}
    <Card><CardHeader><CardTitle>Historial de asistencia</CardTitle><CardDescription>Incluye las sesiones y registros previos de esta tutoría.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4">
      <ErrorNotice message={history.error} retry={history.reload} />
      <RecordTable rows={history.data} loading={history.isInitialLoading || history.isFetching} empty={<TeacherEmpty title="Aún no hay asistencias registradas" />} columns={[
        { label: 'Sesión', render: (record) => <Button variant="link" size="sm" disabled={pending} onClick={() => changeDate(record.date)}>{formatDate(record.date)}</Button> }, { label: 'Estudiante', render: (record) => record.student_name },
        { label: 'Asistencia', render: (record) => <Badge variant={record.present ? 'default' : 'secondary'}>{record.present ? 'Presente' : 'Ausente'}</Badge> },
        { label: 'Temas vistos', render: (record) => record.topics_covered === null ? 'Sin registro' : record.topics_covered ? 'Sí' : 'No' },
      ]} />
      <CatalogPagination label="asistencias" page={history.page} lastPage={history.meta?.last_page ?? 1} disabled={history.isFetching} onChange={history.setPage} />
    </CardContent></Card>
    <ConfirmModal open={nextDate !== null} title="¿Cambiar de sesión?" description="Los cambios de asistencia que aún no guardaste se descartarán." confirmLabel="Cambiar sesión" onClose={() => setNextDate(null)} onConfirm={() => { if (nextDate) { setDate(nextDate); setNextDate(null); setDirty(false) } }} />
  </div>
}

function AttendanceForm({ tutoring, date, students, topics, session, attendance, onDirty, onPending, onSaved }: Readonly<{ tutoring: TeacherTutoring; date: string; students: readonly Enrollment[]; topics: readonly TutoringTopic[]; session: TutoringSession | null; attendance: readonly TeacherAttendance[]; onDirty: () => void; onPending: (value: boolean) => void; onSaved: () => Promise<void> }>) {
  const operation = useOperation()
  const [values, setValues] = useState<Readonly<Record<number, boolean | undefined>>>(() => Object.fromEntries((session?.attendance ?? attendance).map((record) => [record.enrollment_id, record.present])))
  const [covered, setCovered] = useState(session?.topics_covered ?? false)
  const [topicIds, setTopicIds] = useState<readonly number[]>(session?.topics.map((topic) => topic.id) ?? [])
  const active = students.filter((student) => student.is_active && student.student_is_active)
  const incomplete = active.length === 0 || active.some((student) => values[student.id] === undefined)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (incomplete || !tutoring.can_manage || operation.pending) return
    onPending(true)
    void operation.run(() => teacherApi.saveSession(tutoring.id, { date, topics_covered: covered, topic_ids: covered ? topicIds : [], attendance: active.map((student) => ({ enrollment_id: student.id, present: values[student.id] === true })) }), 'Asistencia guardada.', onSaved).finally(() => onPending(false))
  }

  return <form onSubmit={submit} aria-label="Registrar asistencia">
    <fieldset disabled={!tutoring.can_manage || operation.pending}>
      <Card><CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3"><div className="flex flex-col gap-1"><CardTitle>Asistencia de {formatDate(date)}</CardTitle><CardDescription>{active.length} estudiantes activos</CardDescription></div><Button type="button" variant="outline" size="sm" disabled={active.length === 0} onClick={() => { setValues(Object.fromEntries(active.map((student) => [student.id, true]))); onDirty() }}><CheckCheckIcon data-icon="inline-start" />Todos presentes</Button></CardHeader>
        <CardContent className="flex flex-col gap-5">
          <RecordTable rows={active} loading={false} empty={<TeacherEmpty title="No hay estudiantes activos en esta tutoría" />} columns={[
            { label: 'Estudiante', render: (student) => <div className="flex flex-col gap-1"><span className="font-medium">{student.name}</span><span className="text-xs text-muted-foreground">{student.identification}</span></div> },
            { label: 'Asistencia', render: (student) => <Field orientation="horizontal"><Checkbox id={`teacher-attendance-${student.id}`} aria-label={`Presente: ${student.name}`} checked={values[student.id] === undefined ? 'indeterminate' : values[student.id]} onCheckedChange={(checked) => { setValues({ ...values, [student.id]: checked === true }); onDirty() }} /><FieldLabel htmlFor={`teacher-attendance-${student.id}`}>{values[student.id] === undefined ? 'Sin registrar' : values[student.id] ? 'Presente' : 'Ausente'}</FieldLabel></Field> },
          ]} />
          <FieldGroup>
            <Field orientation="horizontal"><Checkbox id="teacher-topics-covered" checked={covered} onCheckedChange={(checked) => { setCovered(checked === true); if (checked !== true) setTopicIds([]); onDirty() }} /><FieldLabel htmlFor="teacher-topics-covered">Se abordaron temas en esta sesión</FieldLabel></Field>
            {covered && <FieldSet><FieldLegend>Temas vistos</FieldLegend><FieldGroup>{topics.filter((topic) => topic.is_active || topicIds.includes(topic.id)).map((topic) => <Field orientation="horizontal" key={topic.id}><Checkbox id={`teacher-covered-topic-${topic.id}`} checked={topicIds.includes(topic.id)} disabled={!topic.is_active} onCheckedChange={(checked) => { setTopicIds(checked === true ? [...topicIds, topic.id] : topicIds.filter((id) => id !== topic.id)); onDirty() }} /><FieldLabel htmlFor={`teacher-covered-topic-${topic.id}`}>{topic.name}{topic.is_active ? '' : ' (deshabilitado)'}</FieldLabel></Field>)}{topics.every((topic) => !topic.is_active) && topicIds.length === 0 && <p className="text-sm text-muted-foreground">Esta tutoría aún no tiene temas activos.</p>}</FieldGroup></FieldSet>}
          </FieldGroup>
          <ErrorNotice message={operation.error} />
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-3">{incomplete && active.length > 0 && <p className="text-sm text-muted-foreground">Marca la asistencia de todos los estudiantes antes de guardar.</p>}<Button type="submit" disabled={incomplete || operation.pending || !tutoring.can_manage}>{operation.pending ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}{operation.pending ? 'Guardando…' : 'Guardar asistencia'}</Button></CardFooter>
      </Card>
    </fieldset>
  </form>
}
