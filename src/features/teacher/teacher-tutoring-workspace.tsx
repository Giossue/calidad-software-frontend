import { useSearchParams } from 'react-router-dom'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FilterBarSkeleton, TableSkeleton } from '@/components/ui/loading-skeletons'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { ErrorNotice } from '@/components/ui/error-notice'
import { teacherApi, type TeacherTutoring } from '@/lib/teacher-api'
import { AttendancePanel } from './teacher-attendance-page'
import { ContentPanel } from './teacher-content-page'
import { GradesPanel } from './teacher-grades-page'
import { SchedulesPanel } from './teacher-schedules-page'
import { StudentsPanel } from './teacher-students-page'
import { TabsSkeleton } from '@/features/tutoring/tutoring-skeletons'

const TABS = [
  { id: 'attendance', label: 'Asistencia' },
  { id: 'content', label: 'Contenido' },
  { id: 'schedules', label: 'Horarios' },
  { id: 'students', label: 'Estudiantes' },
  { id: 'grades', label: 'Calificaciones' },
] as const
type TabId = typeof TABS[number]['id']

function isTabId(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value)
}

// Espacio de trabajo de una tutoría: todo lo que el docente gestiona de ella
// (asistencia, contenido, horarios, estudiantes y notas) en un solo nivel de
// pestañas, sin volver a elegir la tutoría en cada sección.
export function TeacherTutoringWorkspace({ tutoringId }: Readonly<{ tutoringId: number }>) {
  const [params, setParams] = useSearchParams()
  const resource = useDegreeResource(() => teacherApi.allTutorings())
  const requestedTab = params.get('tab')
  const tab: TabId = isTabId(requestedTab) ? requestedTab : 'attendance'
  const tutoring = resource.data?.find((item) => item.id === tutoringId)

  function selectTab(value: string) {
    const next = new URLSearchParams(params)
    next.set('tab', value)
    next.delete('session')
    // El tema o la actividad abiertos en Contenido no se arrastran a otra pestaña.
    next.delete('topic')
    next.delete('activity')
    // Tampoco la sesión consultada en Asistencia.
    next.delete('consult')
    setParams(next, { replace: true })
  }

  return <section className="flex flex-col gap-6">
    <ErrorNotice message={resource.error} retry={resource.reload} />
    {resource.loading ? <WorkspaceSkeleton tab={tab} />
      : resource.error ? null
      : !tutoring ? <Alert><AlertDescription>Esta tutoría ya no está asignada a tu cuenta. Vuelve a tus tutorías y elige otra.</AlertDescription></Alert>
      : <>
        <TutoringHeader tutoring={tutoring} />
        {!tutoring.can_manage && <Alert><AlertDescription>Esta tutoría o su período están inactivos. Puedes consultar su historial.</AlertDescription></Alert>}
        <Tabs value={tab} onValueChange={selectTab}>
          <TabsList aria-label="Secciones de la tutoría">{TABS.map((item) => <TabsTrigger key={item.id} value={item.id}>{item.label}</TabsTrigger>)}</TabsList>
          {/* key: al cambiar de tutoría no se reutiliza el estado de la anterior. */}
          <TabsContent value="attendance" key={`attendance-${tutoring.id}`}><AttendancePanel tutoring={tutoring} /></TabsContent>
          <TabsContent value="content" key={`content-${tutoring.id}`}><ContentPanel tutoring={tutoring} /></TabsContent>
          <TabsContent value="schedules" key={`schedules-${tutoring.id}`}><SchedulesPanel tutoring={tutoring} onReload={resource.reload} /></TabsContent>
          <TabsContent value="students" key={`students-${tutoring.id}`}><StudentsPanel tutoring={tutoring} /></TabsContent>
          <TabsContent value="grades" key={`grades-${tutoring.id}`}><GradesPanel tutoring={tutoring} /></TabsContent>
        </Tabs>
      </>}
  </section>
}

function TutoringHeader({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  // Título principal (h1) de la pantalla, como en las demás pantallas de detalle.
  return <AdminSectionHeader
    title={tutoring.subject_name}
    description={<span className="flex flex-wrap items-center gap-2">
      <span>{[tutoring.career_name, `${tutoring.cycle_name}${tutoring.section_name ? ` · ${tutoring.section_name}` : ''}`, tutoring.modality_name].filter(Boolean).join(' · ')}</span>
      <StatusBadge active={tutoring.can_manage} activeLabel="En curso" inactiveLabel="Solo consulta" />
    </span>}
  />
}

/** Encabezado de la tutoría, sus pestañas y la forma del panel que se va a abrir. */
function WorkspaceSkeleton({ tab }: Readonly<{ tab: TabId }>) {
  return <div role="status" aria-label="Cargando tutoría" className="flex flex-col gap-6">
    <div className="flex flex-col gap-2" aria-hidden="true">
      <div className="flex items-center gap-3"><Skeleton className="h-8 w-72 max-w-full" /><Skeleton className="h-5 w-20 rounded-full" /></div>
      <Skeleton className="h-5 w-96 max-w-full" />
    </div>
    <div className="flex flex-col gap-4">
      <TabsSkeleton tabs={TABS.length} />
      {tab === 'attendance' || tab === 'schedules'
        ? <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-hidden="true"><Skeleton className="h-5 w-80 max-w-full" /><Skeleton className="h-9 w-48" /></div>
        : tab === 'grades'
          ? <div className="flex items-center gap-2" aria-hidden="true"><Skeleton className="h-9 w-56" /></div>
          : <FilterBarSkeleton />}
      <TableSkeleton columns={tab === 'grades' ? 6 : 4} />
    </div>
  </div>
}
