import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  BookOpenIcon,
  Building2Icon,
  CalendarDaysIcon,
  ClipboardListIcon,
  GraduationCapIcon,
  FileTextIcon,
  MonitorDownIcon,
  NetworkIcon,
  TrendingUpIcon,
  UserCheckIcon,
  UsersIcon,
} from 'lucide-react'

import { HelpButton } from '@/components/help-button'
import { NotificationBell } from '@/components/notification-bell'
import { PwaInstallDialog } from '@/components/pwa-install-dialog'
import { UserMenu } from '@/components/user-menu'
import { AccessibilityButton } from '@/components/accessibility-button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { AccessibilityModal } from '@/components/ui/accessibility-modal'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import {
  AdminSectionContent,
  isAdminSection,
  type AdminSection,
} from '@/features/admin/admin-page'
import { useAuth } from '@/features/auth/auth-context'
import { useSystemTours } from '@/features/help/use-system-tours'
import { canCoordinateDegrees, type DegreeSection } from '@/features/degree-coordination/degree-navigation'
import { DegreeStudentsPage } from '@/features/degree-coordination/degree-students-page'
import { DegreeTopicsPage } from '@/features/degree-coordination/degree-topics-page'
import { DegreeTrackingPage } from '@/features/degree-coordination/degree-tracking-page'
import { DegreeReportsPage } from '@/features/degree-coordination/degree-reports-page'
import { StudentDegreeTopicsPage } from '@/features/student-degree-topics/student-degree-topics-page'
import { StudentDegreeTrackingPage } from '@/features/student-degree-tracking/student-degree-tracking-page'
import { TutoringSubjectsPage } from '@/features/tutoring/subjects-page'
import { TutoringCurriculumPage } from '@/features/tutoring/curriculum-page'
import { TutoringTeachersPage } from '@/features/tutoring/teachers-page'
import { TutoringsPage } from '@/features/tutoring/tutorings-page'
import { TutoringStudentsPage } from '@/features/tutoring/students-page'
import { TutoringReportsPage } from '@/features/tutoring/reports-page'
import { canCoordinateTutorings, dashboardSection, type TutoringSection } from '@/features/tutoring/tutoring-navigation'
import type { StudentSection } from '@/features/student/student-navigation'
import { StudentTutoringsPage } from '@/features/student/student-tutorings-page'
import { StudentDegreeAssignmentsPage } from '@/features/student/student-degree-assignments-page'
import type { TeacherSection } from '@/features/teacher/teacher-navigation'
import { TeacherTutoringsPage } from '@/features/teacher/teacher-tutorings-page'
import { TeacherDegreeAssignmentsPage } from '@/features/teacher/teacher-degree-assignments-page'
import { TEACHER_TRACKING_TABS, TeacherDegreeTrackingPage } from '@/features/teacher/teacher-degree-tracking-page'
import { TeacherReportsStandalonePage } from '@/features/teacher/teacher-reports-standalone-page'
import { tutoringApi } from '@/lib/tutoring-api'

type NavItem = {
  readonly id: AdminSection | TutoringSection | DegreeSection | TeacherSection | StudentSection
  readonly label: string
  readonly icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'users', label: 'Usuarios', icon: UsersIcon },
  { id: 'periods', label: 'Períodos Académicos', icon: CalendarDaysIcon },
  { id: 'faculties', label: 'Facultades', icon: Building2Icon },
  { id: 'careers', label: 'Carreras', icon: BookOpenIcon },
]

const TUTORING_NAV_ITEMS: readonly NavItem[] = [
  { id: 'tutoring-subjects', label: 'Asignaturas', icon: BookOpenIcon },
  { id: 'tutoring-curriculum', label: 'Malla curricular', icon: NetworkIcon },
  { id: 'tutoring-teachers', label: 'Docentes', icon: UsersIcon },
  { id: 'tutoring-students', label: 'Estudiantes', icon: UserCheckIcon },
  { id: 'tutorings', label: 'Tutorías', icon: GraduationCapIcon },
  { id: 'tutoring-reports', label: 'Informes', icon: FileTextIcon },
]

const DEGREE_NAV_ITEMS: readonly NavItem[] = [
  { id: 'degree-students', label: 'Matrícula de estudiantes', icon: UserCheckIcon },
  { id: 'degree-topics', label: 'Propuestas de titulación', icon: ClipboardListIcon },
  { id: 'degree-tracking', label: 'Seguimiento', icon: TrendingUpIcon },
  { id: 'degree-reports', label: 'Reportes', icon: FileTextIcon },
]

const STUDENT_TUTORING_NAV_ITEMS: readonly NavItem[] = [
  { id: 'student-tutorings', label: 'Mis tutorías', icon: GraduationCapIcon },
]

const STUDENT_DEGREE_NAV_ITEMS: readonly NavItem[] = [
  { id: 'student-degree-topics', label: 'Mis propuestas', icon: FileTextIcon },
  { id: 'student-degree-tracking', label: 'Seguimiento', icon: TrendingUpIcon },
  { id: 'student-degree-assignments', label: 'Tutor y pares', icon: UsersIcon },
]

const TEACHER_TUTORING_NAV_ITEMS: readonly NavItem[] = [
  { id: 'teacher-tutorings', label: 'Mis tutorías', icon: GraduationCapIcon },
  { id: 'teacher-reports', label: 'Informes', icon: FileTextIcon },
]

const TEACHER_DEGREE_NAV_ITEMS: readonly NavItem[] = [
  { id: 'teacher-degree-assignments', label: 'Titulación', icon: BookOpenIcon },
  { id: 'teacher-degree-tracking', label: 'Seguimiento', icon: TrendingUpIcon },
]

function getRoleLabel(role?: string): string {
  switch (role) {
    case 'administrador':
      return 'Administrador del Sistema'
    case 'docente':
      return 'Docente'
    case 'estudiante':
      return 'Estudiante'
    case 'coordinador_carrera':
      return 'Coordinador de Carrera'
    case 'coordinador_titulacion':
      return 'Coordinador de Titulación'
    default:
      return role ?? 'Usuario'
  }
}

// Sub-apartado del sidebar bajo "Seguimiento" (docente): reemplaza al Tabs que antes
// aparecía dentro de la pantalla para no desplazar el contenido del tema al entrar.
function TeacherTrackingSubNav({ activeTab, onSelect }: Readonly<{ activeTab: string; onSelect: (tab: string) => void }>) {
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <SidebarMenuSub className="mt-1">
      {TEACHER_TRACKING_TABS.map((item) => (
        <SidebarMenuSubItem key={item.id}>
          <SidebarMenuSubButton asChild isActive={activeTab === item.id}>
            <button
              type="button"
              onClick={() => {
                onSelect(item.id)
                if (isMobile) setOpenMobile(false)
              }}
            >
              {item.label}
            </button>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ))}
    </SidebarMenuSub>
  )
}

// Aviso para el estudiante que aún no está matriculado en titulación.
function DegreeModuleUnavailable({ module }: Readonly<{ module: string }>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Módulo de Titulación no disponible</CardTitle>
        <CardDescription>
          Para acceder al módulo de {module} debes estar matriculado en titulación para el período académico actual. Consulta con tu coordinador de carrera.
        </CardDescription>
      </CardHeader>
    </Card>
  )
}

function getInitials(name?: string): string {
  if (!name) return 'US'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { section } = useParams<{ section: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [pending, setPending] = useState(false)
  const [accessibilityOpen, setAccessibilityOpen] = useState(false)
  const [pwaInstallOpen, setPwaInstallOpen] = useState(false)
  const [studentDegreeEnrolled, setStudentDegreeEnrolled] = useState<boolean | null>(null)

  useEffect(() => {
    if (user?.role !== 'estudiante') {
      setStudentDegreeEnrolled(null)
      return
    }

    let isCurrent = true
    tutoringApi
      .studentDegreeEnrollmentStatus()
      .then((status) => {
        if (isCurrent) {
          setStudentDegreeEnrolled(status.is_enrolled)
        }
      })
      .catch(() => {
        if (isCurrent) {
          setStudentDegreeEnrolled(false)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [user?.role])

  const studentStage = user?.role === 'estudiante' ? (user.academic_stage ?? null) : null
  const activeSection = dashboardSection(user?.role, section, studentStage)
  const navGroups = [
    ...(user?.role === 'administrador' ? [{ label: 'Administración', items: NAV_ITEMS }] : []),
    ...(canCoordinateTutorings(user?.role) ? [{ label: 'Coordinación de tutorías', items: TUTORING_NAV_ITEMS }] : []),
    ...(canCoordinateDegrees(user?.role) ? [{ label: 'Coordinación de titulación', items: DEGREE_NAV_ITEMS }] : []),
    // El último ciclo de la carrera es titulación; los anteriores, tutorías.
    // Sin ciclo registrado se conserva el comportamiento anterior (matrícula de titulación).
    ...(user?.role === 'estudiante'
      ? studentStage === 'titulacion'
        ? [{ label: 'Titulación', items: STUDENT_DEGREE_NAV_ITEMS }]
        : studentStage === 'tutorias'
          ? [{ label: 'Tutorías', items: STUDENT_TUTORING_NAV_ITEMS }]
          : [
              { label: 'Tutorías', items: STUDENT_TUTORING_NAV_ITEMS },
              ...(studentDegreeEnrolled ? [{ label: 'Titulación', items: STUDENT_DEGREE_NAV_ITEMS }] : []),
            ]
      : []),
    ...(user?.role === 'docente'
      ? [
          { label: 'Tutorías', items: TEACHER_TUTORING_NAV_ITEMS },
          { label: 'Titulación', items: TEACHER_DEGREE_NAV_ITEMS },
        ]
      : []),
  ]

  const activeGroup = navGroups.find((group) => group.items.some((item) => item.id === activeSection))
  const sectionLabel = activeGroup?.items.find((item) => item.id === activeSection)?.label
  const moduleIds = navGroups.flatMap((group) => group.items.map((item) => item.id))

  // Los estudiantes sin ciclo esperan a saber si están en titulación para tener el menú completo.
  const menuReady = user?.role !== 'estudiante' || studentStage !== null || studentDegreeEnrolled !== null
  const { openPageTour, openGeneralTour, openTeacherGuide } = useSystemTours({ section: activeSection, moduleIds, menuReady })

  const trackingTopicId = Number(searchParams.get('topic'))
  const showTrackingSubNav = activeSection === 'teacher-degree-tracking' && Number.isInteger(trackingTopicId) && trackingTopicId > 0
  const trackingTab = searchParams.get('tab') ?? TEACHER_TRACKING_TABS[0].id

  function selectTrackingTab(tab: string) {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    if (section !== activeSection) {
      navigate(`/panel/${activeSection}`, { replace: true })
    }
  }, [section, activeSection, navigate])

  useEffect(() => {
    if (
      user?.role === 'estudiante' &&
      (studentStage === 'tutorias' || (studentStage === null && studentDegreeEnrolled === false)) &&
      (activeSection === 'student-degree-topics' ||
        activeSection === 'student-degree-tracking' ||
        activeSection === 'student-degree-assignments')
    ) {
      navigate('/panel/student-tutorings', { replace: true })
    }
  }, [user?.role, studentStage, studentDegreeEnrolled, activeSection, navigate])

  async function signOut() {
    setPending(true)
    await logout()
  }

  const userRoleText = getRoleLabel(user?.role)
  const initials = getInitials(user?.name)

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <div className="flex items-center gap-2 rounded-md p-1">
            <img src="/ueb-logo.png" alt="" className="size-8 shrink-0 object-contain" width="32" height="32" />
            <div className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-semibold">Tutorías y Titulación</span>
              <span className="truncate text-xs text-muted-foreground">Universidad Estatal de Bolívar</span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          {navGroups.map((group) => <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon

                  // Con el sub-menú de "Seguimiento" abierto, quién está "activo" de verdad es la
                  // pestaña elegida ahí abajo: se le quita el relleno sólido al padre para que no
                  // compita visualmente con el hover/activo de sus sub-ítems.
                  const isTrackingParentWithSubNav = item.id === 'teacher-degree-tracking' && showTrackingSubNav

                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={activeSection === item.id}
                        tooltip={item.label}
                        onClick={() => navigate(`/panel/${item.id}`)}
                        data-tour={`nav-${item.id}`}
                        className={cn(
                          'data-[active=true]:font-medium',
                          isTrackingParentWithSubNav && 'data-[active=true]:bg-transparent data-[active=true]:text-sidebar-foreground',
                        )}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {isTrackingParentWithSubNav && (
                        <TeacherTrackingSubNav activeTab={trackingTab} onSelect={selectTrackingTab} />
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>)}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Instalar App"
                data-tour="install-app"
                onClick={() => setPwaInstallOpen(true)}
              >
                <MonitorDownIcon />
                <span>Instalar App</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <UserMenu
                name={user?.name ?? 'Usuario'}
                email={user?.email ?? ''}
                roleLabel={userRoleText}
                initials={initials}
                onSignOut={() => void signOut()}
                signingOut={pending}
              />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-3 sm:px-4 md:rounded-t-xl">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <SidebarTrigger className="-ml-1 shrink-0" data-tour="menu-trigger" />
            <nav aria-label="Ubicación" className="min-w-0 truncate text-sm text-muted-foreground" data-tour="breadcrumb">
              {activeGroup && <span className="max-md:sr-only">{activeGroup.label} <span aria-hidden="true">›</span> </span>}
              {sectionLabel && <span aria-current="page" className="truncate font-medium text-foreground">{sectionLabel}</span>}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <HelpButton onPageTour={openPageTour} onGeneralTour={openGeneralTour} onTeacherGuide={user?.role === 'docente' ? openTeacherGuide : undefined} />
            <AccessibilityButton onClick={() => setAccessibilityOpen(true)} />
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-1 flex-col p-4 sm:p-6">
          {user?.role === 'administrador' && isAdminSection(activeSection) ? (
            <AdminSectionContent section={activeSection} />
          ) : canCoordinateTutorings(user?.role) && activeSection === 'tutoring-subjects' ? (
            <TutoringSubjectsPage />
          ) : canCoordinateTutorings(user?.role) && activeSection === 'tutoring-curriculum' ? (
            <TutoringCurriculumPage />
          ) : canCoordinateTutorings(user?.role) && activeSection === 'tutoring-teachers' ? (
            <TutoringTeachersPage />
          ) : canCoordinateTutorings(user?.role) && activeSection === 'tutorings' ? (
            <TutoringsPage />
          ) : canCoordinateTutorings(user?.role) && activeSection === 'tutoring-students' ? (
            <TutoringStudentsPage />
          ) : canCoordinateTutorings(user?.role) && activeSection === 'tutoring-reports' ? (
            <TutoringReportsPage />
          ) : canCoordinateDegrees(user?.role) && activeSection === 'degree-students' ? (
            <DegreeStudentsPage />
          ) : canCoordinateDegrees(user?.role) && activeSection === 'degree-topics' ? (
            <DegreeTopicsPage />
          ) : canCoordinateDegrees(user?.role) && activeSection === 'degree-tracking' ? (
            <DegreeTrackingPage />
          ) : canCoordinateDegrees(user?.role) && activeSection === 'degree-reports' ? (
            <DegreeReportsPage />
          ) : user?.role === 'estudiante' && activeSection === 'student-tutorings' ? (
            <StudentTutoringsPage />
          ) : user?.role === 'estudiante' && activeSection === 'student-degree-topics' ? (
            studentDegreeEnrolled === false ? <DegreeModuleUnavailable module="propuestas de titulación" /> : (
              <StudentDegreeTopicsPage />
            )
          ) : user?.role === 'estudiante' && activeSection === 'student-degree-tracking' ? (
            studentDegreeEnrolled === false ? <DegreeModuleUnavailable module="seguimiento de titulación" /> : (
              <StudentDegreeTrackingPage />
            )
          ) : user?.role === 'estudiante' && activeSection === 'student-degree-assignments' ? (
            studentDegreeEnrolled === false ? <DegreeModuleUnavailable module="tutores y pares" /> : (
              <StudentDegreeAssignmentsPage />
            )
          ) : user?.role === 'docente' && activeSection === 'teacher-tutorings' ? (
            <TeacherTutoringsPage />
          ) : user?.role === 'docente' && activeSection === 'teacher-degree-assignments' ? (
            <TeacherDegreeAssignmentsPage />
          ) : user?.role === 'docente' && activeSection === 'teacher-degree-tracking' ? (
            <TeacherDegreeTrackingPage />
          ) : user?.role === 'docente' && activeSection === 'teacher-reports' ? (
            <TeacherReportsStandalonePage />
          ) : (
            <Card>
              <CardHeader><CardTitle>Bienvenido, {user?.name ?? 'usuario'}</CardTitle><CardDescription>No hay módulos disponibles para el rol actual de tu cuenta.</CardDescription></CardHeader>
            </Card>
          )}
        </div>
      </SidebarInset>

      <AccessibilityModal open={accessibilityOpen} onClose={() => setAccessibilityOpen(false)} />
      <PwaInstallDialog open={pwaInstallOpen} onClose={() => setPwaInstallOpen(false)} />
    </SidebarProvider>
  )
}

