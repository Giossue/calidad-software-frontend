import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  BookOpenIcon,
  Building2Icon,
  CalendarDaysIcon,
  ClipboardListIcon,
  GraduationCapIcon,
  FileTextIcon,
  LogOutIcon,
  MonitorDownIcon,
  Settings2Icon,
  TrendingUpIcon,
  UserCheckIcon,
  UsersIcon,
} from 'lucide-react'

import uebLogo from '@/assets/ueb-logo.png'
import { PwaInstallDialog } from '@/components/pwa-install-dialog'
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
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Spinner } from '@/components/ui/spinner'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import {
  AdminSectionContent,
  isAdminSection,
  type AdminSection,
} from '@/features/admin/admin-page'
import { useAuth } from '@/features/auth/auth-context'
import { canCoordinateDegrees, type DegreeSection } from '@/features/degree-coordination/degree-navigation'
import { DegreeStudentsPage } from '@/features/degree-coordination/degree-students-page'
import { DegreeTopicsPage } from '@/features/degree-coordination/degree-topics-page'
import { DegreeTrackingPage } from '@/features/degree-coordination/degree-tracking-page'
import { DegreeReportsPage } from '@/features/degree-coordination/degree-reports-page'
import { StudentDegreeTopicsPage } from '@/features/student-degree-topics/student-degree-topics-page'
import { StudentDegreeTrackingPage } from '@/features/student-degree-tracking/student-degree-tracking-page'
import { TutoringSubjectsPage } from '@/features/tutoring/subjects-page'
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
import { TeacherDegreeTrackingPage } from '@/features/teacher/teacher-degree-tracking-page'
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

const TEACHER_NAV_ITEMS: readonly NavItem[] = [
  { id: 'teacher-tutorings', label: 'Mis tutorías', icon: GraduationCapIcon },
  { id: 'teacher-degree-assignments', label: 'Titulación', icon: BookOpenIcon },
  { id: 'teacher-degree-tracking', label: 'Seguimiento', icon: TrendingUpIcon },
  { id: 'teacher-reports', label: 'Informes', icon: FileTextIcon },
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
    ...(user?.role === 'docente' ? [{ label: 'Docencia', items: TEACHER_NAV_ITEMS }] : []),
  ]

  const sectionLabel = navGroups.flatMap((group) => group.items).find((item) => item.id === activeSection)?.label

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
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-1 py-1">
            <img
              src={uebLogo}
              alt="Universidad Estatal de Bolívar"
              className="h-7 w-auto shrink-0 group-data-[collapsible=icon]:hidden"
            />
            <SidebarTrigger className="ml-auto hidden text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:flex" />
          </div>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent>
          {navGroups.map((group) => <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon

                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={activeSection === item.id}
                        tooltip={item.label}
                        onClick={() => navigate(`/panel/${item.id}`)}
                        className="border-l-2 border-transparent data-[active=true]:border-sidebar-primary data-[active=true]:font-semibold"
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>)}
        </SidebarContent>

        <SidebarSeparator />

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={pending ? 'Cerrando sesión…' : 'Cerrar sesión'}
                onClick={() => void signOut()}
                disabled={pending}
              >
                {pending ? <Spinner /> : <LogOutIcon />}
                <span>{pending ? 'Cerrando sesión…' : 'Cerrar sesión'}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-background/95 px-3 py-2.5 backdrop-blur-xs sm:gap-3 sm:px-4 sm:py-3 md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <SidebarTrigger className="size-8 shrink-0 sm:size-9 md:hidden" />
            <span className="min-w-0 truncate text-xs font-medium text-muted-foreground md:text-sm">
              <span className="max-md:sr-only">{userRoleText} &rsaquo; Tutorías y Titulación{sectionLabel && <> &rsaquo; </>}</span>
              {sectionLabel && <span aria-current="page" className="truncate font-semibold text-foreground max-md:text-sm">{sectionLabel}</span>}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:gap-3">
            <button
              type="button"
              onClick={() => setPwaInstallOpen(true)}
              className="flex size-8 items-center justify-center rounded-full border border-border bg-card p-1.5 text-xs font-semibold text-foreground shadow-2xs transition-colors hover:bg-muted sm:size-9 sm:p-2 lg:h-9 lg:w-auto lg:px-3"
              title="Instalar acceso directo en el Escritorio"
            >
              <MonitorDownIcon className="size-4 shrink-0 text-brand-blue" />
              <span className="hidden lg:inline lg:ml-1.5">Instalar App</span>
            </button>

            <button
              type="button"
              onClick={() => setAccessibilityOpen(true)}
              className="flex size-8 items-center justify-center rounded-full border border-border bg-card p-1.5 text-xs font-semibold text-foreground shadow-2xs transition-colors hover:bg-muted sm:size-9 sm:p-2"
              title="Configuración de Accesibilidad"
            >
              <Settings2Icon className="size-4 shrink-0 text-muted-foreground" />
            </button>

            <ThemeToggle />

            <div className="flex items-center gap-2 rounded-full border border-border bg-card p-1 shadow-2xs max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:shadow-none sm:gap-3 sm:p-1.5 sm:pr-4">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-blue font-bold text-xs text-white sm:size-9">
                {initials}
              </div>
              <div className="hidden flex-col text-left sm:flex">
                <span className="max-w-[120px] truncate text-xs font-bold leading-tight text-foreground lg:max-w-none">
                  {user?.name ?? 'Usuario'}
                </span>
                <span className="max-w-[120px] truncate text-[11px] font-medium text-muted-foreground lg:max-w-none">
                  {user?.email ?? ''}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 lg:p-8">
          {user?.role === 'administrador' && isAdminSection(activeSection) ? (
            <AdminSectionContent section={activeSection} />
          ) : canCoordinateTutorings(user?.role) && activeSection === 'tutoring-subjects' ? (
            <TutoringSubjectsPage />
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
            studentDegreeEnrolled === false ? (
              <Card>
                <CardHeader>
                  <CardTitle>Módulo de Titulación no disponible</CardTitle>
                  <CardDescription>
                    Para acceder al módulo de propuestas de titulación debes estar matriculado en titulación para el período académico actual. Consulta con tu coordinador de carrera.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <StudentDegreeTopicsPage />
            )
          ) : user?.role === 'estudiante' && activeSection === 'student-degree-tracking' ? (
            studentDegreeEnrolled === false ? (
              <Card>
                <CardHeader>
                  <CardTitle>Módulo de Titulación no disponible</CardTitle>
                  <CardDescription>
                    Para acceder al módulo de seguimiento de titulación debes estar matriculado en titulación para el período académico actual. Consulta con tu coordinador de carrera.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <StudentDegreeTrackingPage />
            )
          ) : user?.role === 'estudiante' && activeSection === 'student-degree-assignments' ? (
            studentDegreeEnrolled === false ? (
              <Card>
                <CardHeader>
                  <CardTitle>Módulo de Titulación no disponible</CardTitle>
                  <CardDescription>
                    Para acceder al módulo de tutores y pares debes estar matriculado en titulación para el período académico actual. Consulta con tu coordinador de carrera.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
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

