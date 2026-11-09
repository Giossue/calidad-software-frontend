import { useSearchParams } from 'react-router-dom'
import { MailIcon, PhoneIcon } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ErrorNotice } from '@/components/ui/error-notice'
import { formatDate } from '@/lib/format'
import { formatSubjectName } from '@/lib/sanitize'
import { studentApi, type StudentTutoring } from '@/lib/student-api'
import { DAY_LABELS, WEEK_DAYS } from '@/lib/tutoring-api'
import { AttendancePanel } from './student-attendance-page'
import { ContentPanel } from './student-content-page'
import { GradesPanel } from './student-grades-page'

const TABS = [
  { id: 'content', label: 'Contenido' },
  { id: 'attendance', label: 'Asistencia' },
  { id: 'grades', label: 'Calificaciones' },
  { id: 'schedules', label: 'Horarios' },
] as const
type TabId = typeof TABS[number]['id']

function isTabId(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value)
}

// Espacio de una tutoría del estudiante: contenido, asistencia, notas y horarios reunidos,
// sin volver a elegir la tutoría en cada sección.
export function StudentTutoringWorkspace({ subjectId }: Readonly<{ subjectId: number }>) {
  const [params, setParams] = useSearchParams()
  const resource = useDegreeResource(studentApi.tutorings)
  const requestedTab = params.get('tab')
  const tab: TabId = isTabId(requestedTab) ? requestedTab : 'content'
  const enrollment = resource.data?.find((item) => item.subject?.id === subjectId)
  const subject = enrollment?.subject

  function selectTab(value: string) {
    const next = new URLSearchParams(params)
    next.set('tab', value)
    setParams(next, { replace: true })
  }

  return <section className="flex min-w-0 flex-col gap-6">
    <ErrorNotice message={resource.error} retry={resource.reload} />
    {resource.loading ? <div role="status" aria-label="Cargando tutoría" className="flex flex-col gap-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-48 w-full" /></div>
      : resource.error ? null
      : !enrollment || !subject ? <Alert><AlertDescription>Ya no estás inscrito en esta tutoría. Vuelve a tus tutorías y elige otra.</AlertDescription></Alert>
      : <>
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{formatSubjectName(subject.name)}</h2>
            <StatusBadge active={enrollment.is_active && subject.is_active} activeLabel="En curso" inactiveLabel="Finalizada" />
          </div>
          <p className="text-sm text-muted-foreground">{[subject.cycle?.name ?? 'Sin ciclo', subject.section ? `Paralelo ${subject.section.name}` : null, subject.teacher?.name ?? 'Sin docente', enrollment.enrolled_at ? `Inscrito el ${formatDate(enrollment.enrolled_at)}` : null].filter(Boolean).join(' · ')}</p>
        </header>
        {!(enrollment.is_active && subject.is_active) && <Alert><AlertDescription>Esta tutoría ya finalizó. Puedes consultar su información, pero no tendrá nuevas sesiones.</AlertDescription></Alert>}
        <Tabs value={tab} onValueChange={selectTab}>
          <TabsList aria-label="Secciones de la tutoría">{TABS.map((item) => <TabsTrigger key={item.id} value={item.id}>{item.label}</TabsTrigger>)}</TabsList>
          <TabsContent value="content"><ContentPanel tutoringId={subject.id} /></TabsContent>
          <TabsContent value="attendance"><AttendancePanel tutoringId={subject.id} canNotify={enrollment.is_active && subject.is_active} /></TabsContent>
          <TabsContent value="grades"><GradesPanel tutoringId={subject.id} /></TabsContent>
          <TabsContent value="schedules"><SchedulesPanel enrollment={enrollment} /></TabsContent>
        </Tabs>
      </>}
  </section>
}

function durationMinutes(start: string, end: string): number {
  const [startHour = 0, startMinute = 0] = start.split(':').map(Number)
  const [endHour = 0, endMinute = 0] = end.split(':').map(Number)
  return Math.max(0, endHour * 60 + endMinute - (startHour * 60 + startMinute))
}

function durationLabel(minutes: number): string {
  if (minutes <= 0) return '—'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return [hours ? `${hours} h` : '', rest ? `${rest} min` : ''].filter(Boolean).join(' ')
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

function SchedulesPanel({ enrollment }: Readonly<{ enrollment: StudentTutoring }>) {
  const subject = enrollment.subject
  const schedules = (subject?.schedules ?? [])
    .filter((item) => item.is_active)
    .toSorted((a, b) => WEEK_DAYS.indexOf(a.day_of_week as typeof WEEK_DAYS[number]) - WEEK_DAYS.indexOf(b.day_of_week as typeof WEEK_DAYS[number]) || a.start_time.localeCompare(b.start_time))
  const teacher = subject?.teacher
  const modality = subject?.modality?.name ?? 'Modalidad sin definir'
  const durations = Array.from(new Set(schedules.map((item) => durationMinutes(item.start_time, item.end_time))))
  const durationDetail = schedules.length === 0 ? null : durations.length === 1 ? `${durationLabel(durations[0] ?? 0)} por sesión` : 'duración según el día'

  return <div className="grid gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
    <section aria-label="Horario de clases" className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-5">
      <h4 className="font-semibold">Horario de clases</h4>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-11 px-5">Día</TableHead>
              <TableHead className="h-11 px-5">Horario</TableHead>
              <TableHead className="h-11 px-5">Aula</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.length === 0
              ? <TableRow><TableCell colSpan={3} className="px-5 py-8 text-center whitespace-normal text-muted-foreground">Aún no hay horarios registrados.</TableCell></TableRow>
              : schedules.map((item) => <TableRow key={item.id}>
                <TableCell className="px-5 py-4 font-medium text-foreground">{DAY_LABELS[item.day_of_week] ?? item.day_of_week}</TableCell>
                <TableCell className="px-5 py-4">{item.start_time.slice(0, 5)} – {item.end_time.slice(0, 5)}</TableCell>
                <TableCell className="px-5 py-4 text-muted-foreground">{item.room || '—'}</TableCell>
              </TableRow>)}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">{[modality, durationDetail].filter(Boolean).join(' · ')}</p>
    </section>
    <section aria-label="Docente" className="flex min-w-0 flex-col gap-4 rounded-lg border bg-card p-5">
      <h4 className="font-semibold">Docente</h4>
      {teacher ? <>
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-base font-medium text-foreground">{initials(teacher.name)}</span>
          <p className="min-w-0 font-medium leading-tight text-foreground">{teacher.name}</p>
        </div>
        <ul className="flex flex-col gap-2.5 text-sm">
          <li><a href={`mailto:${teacher.email}`} className="flex items-center gap-3 break-all text-foreground hover:underline"><MailIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />{teacher.email}</a></li>
          {teacher.phone && <li><a href={`tel:${teacher.phone}`} className="flex items-center gap-3 text-foreground hover:underline"><PhoneIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />{teacher.phone}</a></li>}
        </ul>
      </> : <p className="text-sm text-muted-foreground">Sin docente asignado.</p>}
    </section>
  </div>
}
