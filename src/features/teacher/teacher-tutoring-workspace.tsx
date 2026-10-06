import { useSearchParams } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { ErrorNotice } from '@/features/tutoring/tutoring-shared'
import { teacherApi, type TeacherTutoring } from '@/lib/teacher-api'
import { AttendancePanel } from './teacher-attendance-page'
import { ContentPanel } from './teacher-content-page'
import { GradesPanel } from './teacher-grades-page'
import { SchedulesPanel } from './teacher-schedules-page'
import { StudentsPanel } from './teacher-students-page'

const TABS = [
  { id: 'students', label: 'Estudiantes' },
  { id: 'content', label: 'Contenido' },
  { id: 'attendance', label: 'Asistencia' },
  { id: 'grades', label: 'Calificaciones' },
  { id: 'schedules', label: 'Horarios' },
] as const
type TabId = typeof TABS[number]['id']

function isTabId(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value)
}

// Espacio de trabajo de una tutoría: todo lo que el docente gestiona de ella
// (estudiantes, notas, asistencia, contenido, informes y horarios) en un solo lugar,
// sin volver a elegir la tutoría en cada sección.
export function TeacherTutoringWorkspace({ tutoringId }: Readonly<{ tutoringId: number }>) {
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
          <TabsContent value="schedules" key={`schedules-${tutoring.id}`}><SchedulesPanel tutoring={tutoring} onReload={resource.reload} /></TabsContent>
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
    <p className="text-sm text-muted-foreground">
      {[tutoring.career_name, `${tutoring.cycle_name}${tutoring.section_name ? ` · ${tutoring.section_name}` : ''}`, tutoring.modality_name].filter(Boolean).join(' · ')}
    </p>
  </header>
}
