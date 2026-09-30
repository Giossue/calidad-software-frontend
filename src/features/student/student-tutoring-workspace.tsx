import { useSearchParams } from 'react-router-dom'
import { ArrowLeftIcon, CalendarDaysIcon, MailIcon } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { ErrorNotice } from '@/features/tutoring/tutoring-shared'
import { formatDate } from '@/lib/format'
import { studentApi, type StudentTutoring } from '@/lib/student-api'
import { DAY_LABELS } from '@/lib/tutoring-api'
import { AttendancePanel } from './student-attendance-page'
import { ContentPanel } from './student-content-page'
import { GradesPanel } from './student-grades-page'
import { ContextPills } from './student-ui'

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
export function StudentTutoringWorkspace({ subjectId, onBack }: Readonly<{ subjectId: number; onBack: () => void }>) {
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
    <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground" onClick={onBack}><ArrowLeftIcon data-icon="inline-start" />Volver a mis tutorías</Button>
    <ErrorNotice message={resource.error} retry={resource.reload} />
    {resource.loading ? <div role="status" aria-label="Cargando tutoría" className="flex flex-col gap-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-48 w-full" /></div>
      : resource.error ? null
      : !enrollment || !subject ? <Alert><AlertDescription>Ya no estás inscrito en esta tutoría. Vuelve a tus tutorías y elige otra.</AlertDescription></Alert>
      : <>
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{subject.name}</h2>
            <StatusBadge active={enrollment.is_active && subject.is_active} activeLabel="En curso" inactiveLabel="Finalizada" />
          </div>
          <ContextPills source={subject} />
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

function SchedulesPanel({ enrollment }: Readonly<{ enrollment: StudentTutoring }>) {
  const subject = enrollment.subject
  const schedules = (subject?.schedules ?? []).filter((item) => item.is_active)
  const teacher = subject?.teacher
  return <div className="grid gap-6 text-sm md:grid-cols-2">
    <div className="flex flex-col gap-2">
      <h4 className="flex items-center gap-2 font-semibold"><CalendarDaysIcon className="size-4 text-muted-foreground" aria-hidden="true" />Horarios</h4>
      {schedules.length === 0 ? <p className="text-muted-foreground">Aún no hay horarios registrados.</p> : <ul className="flex flex-wrap gap-2">
        {schedules.map((item) => <li key={item.id}><Badge variant="secondary" className="px-3 py-1">{DAY_LABELS[item.day_of_week] ?? item.day_of_week} · {item.start_time.slice(0, 5)} – {item.end_time.slice(0, 5)}</Badge></li>)}
      </ul>}
      {subject?.modality && <p className="text-muted-foreground">Modalidad {subject.modality.name}</p>}
    </div>
    <div className="flex flex-col gap-2">
      <h4 className="font-semibold">Contacto del docente</h4>
      {teacher ? <><p className="font-medium">{teacher.name}</p><p className="flex items-center gap-2 break-all text-muted-foreground"><MailIcon className="size-4 shrink-0" aria-hidden="true" />{teacher.email}</p>{teacher.phone && <p className="text-muted-foreground">{teacher.phone}</p>}</> : <p className="text-muted-foreground">Sin docente asignado.</p>}
      {enrollment.enrolled_at && <p className="text-xs text-muted-foreground">Inscrito el {formatDate(enrollment.enrolled_at)}</p>}
    </div>
  </div>
}
