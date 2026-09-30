import { useSearchParams } from 'react-router-dom'
import { ArrowLeftIcon } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { ErrorNotice, RecordTable } from '@/features/tutoring/tutoring-shared'
import { teacherApi, type TeacherTutoring } from '@/lib/teacher-api'
import { DAY_LABELS } from '@/lib/tutoring-api'
import { AttendancePanel } from './teacher-attendance-page'
import { ContentPanel } from './teacher-content-page'
import { GradesPanel } from './teacher-grades-page'
import { ReportsPanel } from './teacher-reports-page'
import { TeacherEmpty } from './teacher-shared'
import { StudentsPanel } from './teacher-students-page'

const TABS = [
  { id: 'students', label: 'Estudiantes' },
  { id: 'content', label: 'Contenido' },
  { id: 'attendance', label: 'Asistencia' },
  { id: 'grades', label: 'Calificaciones' },
  { id: 'schedules', label: 'Horarios' },
  { id: 'reports', label: 'Informes' },
] as const
type TabId = typeof TABS[number]['id']

function isTabId(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value)
}

// Espacio de trabajo de una tutoría: todo lo que el docente gestiona de ella
// (estudiantes, notas, asistencia, contenido, informes y horarios) en un solo lugar,
// sin volver a elegir la tutoría en cada sección.
export function TeacherTutoringWorkspace({ tutoringId, onBack }: Readonly<{ tutoringId: number; onBack: () => void }>) {
  const [params, setParams] = useSearchParams()
  const resource = useDegreeResource(() => teacherApi.allTutorings())
  const requestedTab = params.get('tab')
  const tab: TabId = isTabId(requestedTab) ? requestedTab : 'students'
  const tutoring = resource.data?.find((item) => item.id === tutoringId)

  function selectTab(value: string) {
    const next = new URLSearchParams(params)
    next.set('tab', value)
    next.delete('session')
    setParams(next, { replace: true })
  }

  return <section className="flex flex-col gap-6">
    <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground" onClick={onBack}><ArrowLeftIcon data-icon="inline-start" />Volver a mis tutorías</Button>
    <ErrorNotice message={resource.error} retry={resource.reload} />
    {resource.loading ? <div role="status" aria-label="Cargando tutoría" className="flex flex-col gap-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-48 w-full" /></div>
      : resource.error ? null
      : !tutoring ? <Alert><AlertDescription>Esta tutoría ya no está asignada a tu cuenta. Vuelve a tus tutorías y elige otra.</AlertDescription></Alert>
      : <>
        <TutoringHeader tutoring={tutoring} />
        {!tutoring.can_manage && <Alert><AlertDescription>Esta tutoría o su período están inactivos. Puedes consultar su historial.</AlertDescription></Alert>}
        <Tabs value={tab} onValueChange={selectTab}>
          <TabsList aria-label="Secciones de la tutoría">{TABS.map((item) => <TabsTrigger key={item.id} value={item.id}>{item.label}</TabsTrigger>)}</TabsList>
          {/* key: al cambiar de tutoría no se reutiliza el estado de la anterior. */}
          <TabsContent value="students" key={`students-${tutoring.id}`}><StudentsPanel tutoring={tutoring} /></TabsContent>
          <TabsContent value="content" key={`content-${tutoring.id}`}><ContentPanel tutoring={tutoring} /></TabsContent>
          <TabsContent value="attendance" key={`attendance-${tutoring.id}`}><AttendancePanel tutoring={tutoring} /></TabsContent>
          <TabsContent value="grades" key={`grades-${tutoring.id}`}><GradesPanel tutoring={tutoring} /></TabsContent>
          <TabsContent value="schedules" key={`schedules-${tutoring.id}`}><SchedulesPanel tutoring={tutoring} /></TabsContent>
          <TabsContent value="reports" key={`reports-${tutoring.id}`}><ReportsPanel tutoring={tutoring} /></TabsContent>
        </Tabs>
      </>}
  </section>
}

function TutoringHeader({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  return <header className="flex flex-col gap-2">
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="font-display text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{tutoring.subject_name}</h2>
      <StatusBadge active={tutoring.can_manage} activeLabel="En curso" inactiveLabel="Solo consulta" />
    </div>
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span>{tutoring.career_name}</span>
      <Badge variant="secondary">{tutoring.cycle_name}{tutoring.section_name ? ` · ${tutoring.section_name}` : ''}</Badge>
      <Badge variant="secondary">{tutoring.modality_name}</Badge>
    </div>
  </header>
}

function SchedulesPanel({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  return <RecordTable rows={tutoring.schedules} loading={false} empty={<TeacherEmpty title="Sin horarios registrados" description="El Coordinador de Carrera registra los horarios de esta tutoría." />} columns={[
    { label: 'Día', render: (item) => DAY_LABELS[item.day] ?? item.day },
    { label: 'Horario', render: (item) => `${item.start_time.slice(0, 5)} – ${item.end_time.slice(0, 5)}` },
    { label: 'Aula o lugar', render: (item) => item.room || 'Sin aula' },
    { label: 'Estado', render: (item) => <StatusBadge active={item.is_active} /> },
  ]} />
}
