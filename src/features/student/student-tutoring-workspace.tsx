import { useSearchParams } from 'react-router-dom'
import type { ComponentType, ReactNode } from 'react'
import { CalendarDaysIcon, ClockIcon, InfoIcon, MailIcon, MapPinIcon, PhoneIcon, UserIcon } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ErrorNotice } from '@/features/tutoring/tutoring-shared'
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
          <p className="text-sm text-muted-foreground">{[subject.cycle?.name ?? 'Sin ciclo', subject.section ? `Paralelo ${subject.section.name}` : null, subject.teacher?.name ?? 'Sin docente'].filter(Boolean).join(' · ')}</p>
        </header>
        {!(enrollment.is_active && subject.is_active) && <Alert><AlertDescription>Esta tutoría ya finalizó. Puedes consultar su información, pero no tendrá nuevas sesiones.</AlertDescription></Alert>}
        <Tabs value={tab} onValueChange={selectTab}>
          <TabsList aria-label="Secciones de la tutoría">{TABS.map((item) => <TabsTrigger key={item.id} value={item.id}>{item.label}</TabsTrigger>)}</TabsList>
          <TabsContent value="content"><ContentPanel tutoringId={subject.id} /></TabsContent>
          <TabsContent value="attendance"><AttendancePanel tutoringId={subject.id} /></TabsContent>
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

const TINT_CIRCLE = 'flex shrink-0 items-center justify-center rounded-full bg-secondary text-brand-blue dark:text-foreground'

function PanelCard({ icon: Icon, title, description, label, children }: Readonly<{ icon: ComponentType<{ className?: string }>; title: string; description: string; label: string; children: ReactNode }>) {
  return <section aria-label={label} className="min-w-0 overflow-hidden rounded-xl border bg-card">
    <header className="flex items-center gap-4 border-b bg-muted/60 px-6 py-5">
      <span aria-hidden="true" className={`${TINT_CIRCLE} size-14`}><Icon className="size-6" /></span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h4 className="text-xl font-semibold leading-tight tracking-tight text-foreground">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </header>
    <div className="flex flex-col gap-5 p-6">{children}</div>
  </section>
}

function StatTile({ icon: Icon, title, detail }: Readonly<{ icon: ComponentType<{ className?: string }>; title: string; detail: string }>) {
  return <div className="flex min-w-0 items-center gap-3 rounded-xl border bg-muted/40 p-3.5">
    <span aria-hidden="true" className={`${TINT_CIRCLE} size-12`}><Icon className="size-5" /></span>
    <div className="flex min-w-0 flex-col">
      <span className="text-sm font-semibold text-foreground">{title}</span>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </div>
  </div>
}

function SchedulesPanel({ enrollment }: Readonly<{ enrollment: StudentTutoring }>) {
  const subject = enrollment.subject
  const schedules = (subject?.schedules ?? [])
    .filter((item) => item.is_active)
    .toSorted((a, b) => WEEK_DAYS.indexOf(a.day_of_week as typeof WEEK_DAYS[number]) - WEEK_DAYS.indexOf(b.day_of_week as typeof WEEK_DAYS[number]) || a.start_time.localeCompare(b.start_time))
  const teacher = subject?.teacher
  const modality = subject?.modality?.name ?? 'Sin definir'
  const durations = Array.from(new Set(schedules.map((item) => durationMinutes(item.start_time, item.end_time))))
  const durationDetail = schedules.length === 0 ? 'Sin horarios' : durations.length === 1 ? `${durationLabel(durations[0] ?? 0)} por sesión` : 'Varía según el día'

  return <div className="grid gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
    <PanelCard label="Horario de clases" icon={CalendarDaysIcon} title="Horario de clases" description="Consulta los días y horarios de tus sesiones de tutoría.">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile icon={CalendarDaysIcon} title={`${schedules.length} ${schedules.length === 1 ? 'sesión semanal' : 'sesiones semanales'}`} detail="Frecuencia de clases" />
        <StatTile icon={ClockIcon} title="Duración" detail={durationDetail} />
        <StatTile icon={MapPinIcon} title="Modalidad" detail={modality} />
      </div>
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-11 px-5">Día</TableHead>
              <TableHead className="h-11 px-5">Horario</TableHead>
              <TableHead className="h-11 px-5">Duración</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.length === 0
              ? <TableRow><TableCell colSpan={3} className="px-5 py-8 text-center whitespace-normal text-muted-foreground">Aún no hay horarios registrados.</TableCell></TableRow>
              : schedules.map((item) => <TableRow key={item.id}>
                <TableCell className="px-5 py-4 font-medium text-foreground">{DAY_LABELS[item.day_of_week] ?? item.day_of_week}</TableCell>
                <TableCell className="px-5 py-4">{item.start_time.slice(0, 5)} – {item.end_time.slice(0, 5)}</TableCell>
                <TableCell className="px-5 py-4 text-muted-foreground">{durationLabel(durationMinutes(item.start_time, item.end_time))}</TableCell>
              </TableRow>)}
          </TableBody>
        </Table>
      </div>
      <p className="flex items-center gap-3 rounded-xl bg-secondary/70 px-5 py-4 text-sm text-muted-foreground">
        <InfoIcon className="size-5 shrink-0 text-brand-blue dark:text-foreground" aria-hidden="true" />
        <span><strong className="font-semibold text-foreground">Modalidad:</strong> {modality}</span>
      </p>
    </PanelCard>
    <PanelCard label="Docente" icon={UserIcon} title="Docente" description="Información de contacto de tu tutor.">
      {teacher ? <>
        <div className="flex items-center gap-4">
          <span aria-hidden="true" className={`${TINT_CIRCLE} size-[4.5rem] text-2xl font-semibold`}>{initials(teacher.name)}</span>
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <p className="text-lg font-semibold leading-tight text-foreground">{teacher.name}</p>
            <span className="rounded-full bg-secondary px-3 py-0.5 text-xs font-medium text-secondary-foreground">Docente</span>
          </div>
        </div>
        <ul className="flex flex-col gap-3 border-t pt-5">
          <li><a href={`mailto:${teacher.email}`} className="flex items-center gap-4 break-all text-foreground hover:underline"><MailIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />{teacher.email}</a></li>
          {teacher.phone && <li><a href={`tel:${teacher.phone}`} className="flex items-center gap-4 text-foreground hover:underline"><PhoneIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />{teacher.phone}</a></li>}
        </ul>
      </> : <p className="text-sm text-muted-foreground">Sin docente asignado.</p>}
      {enrollment.enrolled_at && <p className="flex items-center gap-4 border-t pt-5 text-sm text-muted-foreground"><CalendarDaysIcon className="size-5 shrink-0" aria-hidden="true" />Inscrito el {formatDate(enrollment.enrolled_at)}</p>}
    </PanelCard>
  </div>
}
