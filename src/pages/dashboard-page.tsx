import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  BookOpenIcon,
  Building2Icon,
  CalendarDaysIcon,
  LogOutIcon,
  Settings2Icon,
  UsersIcon,
} from 'lucide-react'

import uebLogo from '@/assets/ueb-logo.png'
import { AccessibilityModal } from '@/components/ui/accessibility-modal'
import { Card } from '@/components/ui/card'
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
import {
  AdminSectionContent,
  DEFAULT_ADMIN_SECTION,
  isAdminSection,
  type AdminSection,
} from '@/features/admin/admin-page'
import { useAuth } from '@/features/auth/auth-context'

type NavItem = {
  readonly id: AdminSection
  readonly label: string
  readonly icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'users', label: 'Usuarios', icon: UsersIcon },
  { id: 'periods', label: 'Períodos Académicos', icon: CalendarDaysIcon },
  { id: 'faculties', label: 'Facultades', icon: Building2Icon },
  { id: 'careers', label: 'Carreras', icon: BookOpenIcon },
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

  const activeSection: AdminSection = isAdminSection(section) ? section : DEFAULT_ADMIN_SECTION

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
          <SidebarGroup>
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => {
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
          </SidebarGroup>
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
          {user?.role === 'administrador' ? (
            <AdminSectionContent section={activeSection} />
          ) : (
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">
                Tu cuenta no tiene permisos para administrar el catálogo académico.
              </p>
            </Card>
          )}
        </main>
      </SidebarInset>

      <AccessibilityModal open={accessibilityOpen} onClose={() => setAccessibilityOpen(false)} />
    </SidebarProvider>
  )
}
