import { useState } from 'react'
import {
  BookOpenIcon,
  Building2Icon,
  CalendarDaysIcon,
  ChevronRightIcon,
  Layers3Icon,
  LogOutIcon,
  MenuIcon,
  PinIcon,
  PinOffIcon,
  Settings2Icon,
  UsersIcon,
  XIcon,
} from 'lucide-react'

import { AccessibilityModal } from '@/components/ui/accessibility-modal'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { AdminSectionContent, type AdminSection } from '@/features/admin/admin-page'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'

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
  const [pending, setPending] = useState(false)
  const [activeSection, setActiveSection] = useState<AdminSection>('users')
  const [mobileOpen, setMobileOpen] = useState(false)

  // Estado para la barra lateral emergente al pasar el cursor (Hover)
  const [isHovered, setIsHovered] = useState(false)
  const [isPinned, setIsPinned] = useState(false)

  // Estado para el modal de Accesibilidad
  const [accessibilityOpen, setAccessibilityOpen] = useState(false)

  async function signOut() {
    setPending(true)
    await logout()
  }

  const activeNavItem = NAV_ITEMS.find((item) => item.id === activeSection) ?? NAV_ITEMS[0]
  const userRoleText = getRoleLabel(user?.role)
  const initials = getInitials(user?.name)

  const isExpanded = isPinned || isHovered || mobileOpen

  return (
    <div className="relative flex min-h-svh w-full bg-slate-100/70 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Zona Sensible al Cursor en el borde izquierdo (16px) */}
      <div
        className="fixed inset-y-0 left-0 z-40 hidden w-4 cursor-pointer lg:block"
        onMouseEnter={() => setIsHovered(true)}
      />

      {/* Overlay para móvil */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Overlay con desfoque cuando la barra se despliega por hover */}
      {isHovered && !isPinned && (
        <div
          className="fixed inset-0 z-40 hidden bg-slate-950/20 backdrop-blur-[1px] transition-opacity duration-200 lg:block"
          onMouseEnter={() => setIsHovered(false)}
        />
      )}

      {/* Sidebar Lateral Auto-Emergente */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col justify-between bg-brand-blue text-slate-100 shadow-2xl transition-all duration-300 ease-in-out',
          isExpanded
            ? 'translate-x-0'
            : '-translate-x-[calc(100%-14px)] opacity-95 hover:opacity-100',
        )}
      >
        {/* Indicador cuando está contraído */}
        {!isExpanded && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded-full bg-brand-red text-white shadow-md">
            <ChevronRightIcon className="size-4 animate-pulse" />
          </div>
        )}

        <div className="flex flex-col gap-6 p-5">
          {/* Header del Sidebar */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-red text-white shadow-md">
                <Layers3Icon className="size-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold leading-snug tracking-tight text-white">
                  Tutorías y Titulación
                </span>
                <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">
                  Universidad Estatal de Bolívar
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Botón para Fijar/Desfijar */}
              <button
                type="button"
                onClick={() => setIsPinned(!isPinned)}
                className="hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:flex"
                title={isPinned ? 'Desfijar barra lateral' : 'Fijar barra lateral'}
              >
                {isPinned ? <PinOffIcon className="size-4" /> : <PinIcon className="size-4" />}
              </button>

              <button
                type="button"
                className="text-slate-400 hover:text-white lg:hidden"
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar menú"
              >
                <XIcon className="size-5" />
              </button>
            </div>
          </div>

          {/* Opciones de Navegación Lateral */}
          <nav className="flex flex-col gap-1.5" aria-label="Navegación principal">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active = activeSection === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveSection(item.id)
                    setMobileOpen(false)
                  }}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3.5 py-3 text-sm font-medium transition-all duration-150',
                    active
                      ? 'bg-white/10 font-semibold text-white shadow-sm border-l-4 border-brand-red'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white',
                  )}
                >
                  <Icon className={cn('size-5 shrink-0', active ? 'text-brand-red-contrast' : 'text-slate-400')} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Botón de Cerrar Sesión */}
        <div className="border-t border-slate-800/80 p-4">
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={pending}
            className="flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-brand-red-contrast disabled:opacity-50"
          >
            {pending ? (
              <Spinner className="size-4 shrink-0" />
            ) : (
              <LogOutIcon className="size-4 shrink-0" />
            )}
            <span>{pending ? 'Cerrando sesión…' : 'Cerrar sesión'}</span>
          </button>
        </div>
      </aside>

      {/* Área de Contenido Principal */}
      <div
        className={cn(
          'flex flex-1 flex-col min-w-0 transition-all duration-300',
          isPinned ? 'lg:ml-64' : 'lg:ml-4',
        )}
      >
        {/* Topbar Superior */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/95 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:border-slate-800 dark:text-slate-300"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
            >
              <MenuIcon className="size-5" />
            </button>

            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {userRoleText} &rsaquo; {activeNavItem.label}
              </span>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {activeNavItem.label}
              </h1>
            </div>
          </div>

          {/* Tarjeta de Información de Usuario y Botón de Accesibilidad */}
          <div className="flex items-center gap-3">
            {/* Botón de Accesibilidad con Engranaje de Configuración */}
            <button
              type="button"
              onClick={() => setAccessibilityOpen(true)}
              className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white p-2 px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 shadow-2xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              title="Configuración de Accesibilidad"
            >
              <Settings2Icon className="size-4 text-slate-600 dark:text-slate-300" />
            </button>

            {/* Tarjeta con Nombre Completo (1er Texto) y Correo Electrónico (2do Texto) */}
            <div className="flex items-center gap-3 rounded-full border border-slate-200/80 bg-white p-1.5 pr-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-blue font-bold text-xs text-white">
                {initials}
              </div>
              <div className="flex flex-col text-left">
                {/* 1er Texto: Nombre completo del usuario */}
                <span className="text-xs font-bold leading-tight text-slate-900 dark:text-white">
                  {user?.name ?? 'Usuario'}
                </span>
                {/* 2do Texto: Correo electrónico del usuario */}
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {user?.email ?? ''}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Cuerpo Principal del Módulo */}
        <main className="flex-1 p-6 lg:p-8">
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
      </div>

      {/* Modal de Configuración de Accesibilidad */}
      <AccessibilityModal
        open={accessibilityOpen}
        onClose={() => setAccessibilityOpen(false)}
      />
    </div>
  )
}
