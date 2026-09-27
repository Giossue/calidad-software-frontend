import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  BookOpenIcon,
  Building2Icon,
  CalendarDaysIcon,
  ClipboardListIcon,
  GraduationCapIcon,
  LogOutIcon,
  Settings2Icon,
  UsersIcon,
} from 'lucide-react'

import uebLogo from '@/assets/ueb-logo.png'
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
import { DegreeSectionsPage } from '@/features/degree-coordination/degree-sections-page'
import { DegreeTeachersPage } from '@/features/degree-coordination/degree-teachers-page'
import { DegreeTopicsPage } from '@/features/degree-coordination/degree-topics-page'
import { StudentDegreeTopicsPage } from '@/features/student-degree-topics/student-degree-topics-page'
import { TutoringSubjectsPage } from '@/features/tutoring/subjects-page'
import { TutoringTeachersPage } from '@/features/tutoring/teachers-page'
import { TutoringsPage } from '@/features/tutoring/tutorings-page'
import { canCoordinateTutorings, dashboardSection, type TutoringSection } from '@/features/tutoring/tutoring-navigation'

type NavItem = {
  readonly id: AdminSection | TutoringSection | DegreeSection | 'student-degree-topics'
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
  { id: 'tutorings', label: 'Tutorías', icon: GraduationCapIcon },
]

const DEGREE_NAV_ITEMS: readonly NavItem[] = [
  { id: 'degree-topics', label: 'Propuestas de titulación', icon: ClipboardListIcon },
  { id: 'degree-sections', label: 'Período y paralelos', icon: CalendarDaysIcon },
  { id: 'degree-teachers', label: 'Docentes de titulación', icon: UsersIcon },
]

const STUDENT_NAV_ITEMS: readonly NavItem[] = [
  { id: 'student-degree-topics', label: 'Mis propuestas', icon: ClipboardListIcon },
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

  const activeSection = dashboardSection(user?.role, section)
  const navGroups = [
    ...(user?.role === 'administrador' ? [{ label: 'Administración', items: NAV_ITEMS }] : []),
    ...(canCoordinateTutorings(user?.role) ? [{ label: 'Coordinación de tutorías', items: TUTORING_NAV_ITEMS }] : []),
    ...(canCoordinateDegrees(user?.role) ? [{ label: 'Coordinación de titulación', items: DEGREE_NAV_ITEMS }] : []),
    ...(user?.role === 'estudiante' ? [{ label: 'Titulación', items: STUDENT_NAV_ITEMS }] : []),
  ]

  useEffect(() => {
    if (section !== activeSection) {
      navigate(`/panel/${activeSection}`, { replace: true })
    }
  }, [section, activeSection, navigate])

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
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-xs md:px-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="md:hidden" />
            <span className="text-xs font-medium text-muted-foreground md:text-sm">
              {userRoleText} &rsaquo; Tutorías y Titulación
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAccessibilityOpen(true)}
              className="flex items-center gap-2 rounded-full border border-border bg-card p-2 px-3 text-xs font-semibold text-foreground shadow-2xs transition-colors hover:bg-muted"
              title="Configuración de Accesibilidad"
            >
              <Settings2Icon className="size-4 text-muted-foreground" />
            </button>

            <ThemeToggle />

            <div className="flex items-center gap-3 rounded-full border border-border bg-card p-1.5 pr-4 shadow-2xs">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-blue font-bold text-xs text-white">
                {initials}
              </div>
              <div className="hidden flex-col text-left sm:flex">
                <span className="text-xs font-bold leading-tight text-foreground">
                  {user?.name ?? 'Usuario'}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {user?.email ?? ''}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {user?.role === 'administrador' && isAdminSection(activeSection) ? (
            <AdminSectionContent section={activeSection} />
          ) : canCoordinateTutorings(user?.role) && activeSection === 'tutoring-subjects' ? (
            <TutoringSubjectsPage />
          ) : canCoordinateTutorings(user?.role) && activeSection === 'tutoring-teachers' ? (
            <TutoringTeachersPage />
          ) : canCoordinateTutorings(user?.role) && activeSection === 'tutorings' ? (
            <TutoringsPage />
          ) : canCoordinateDegrees(user?.role) && activeSection === 'degree-topics' ? (
            <DegreeTopicsPage />
          ) : canCoordinateDegrees(user?.role) && activeSection === 'degree-sections' ? (
            <DegreeSectionsPage />
          ) : canCoordinateDegrees(user?.role) && activeSection === 'degree-teachers' ? (
            <DegreeTeachersPage />
          ) : user?.role === 'estudiante' && activeSection === 'student-degree-topics' ? (
            <StudentDegreeTopicsPage />
          ) : (
            <Card>
              <CardHeader><CardTitle>Bienvenido, {user?.name ?? 'usuario'}</CardTitle><CardDescription>No hay módulos disponibles para el rol actual de tu cuenta.</CardDescription></CardHeader>
            </Card>
          )}
        </main>
      </SidebarInset>

      <AccessibilityModal open={accessibilityOpen} onClose={() => setAccessibilityOpen(false)} />
    </SidebarProvider>
  )
}
