import { useState, type ReactNode } from 'react'
import {
  BookOpenIcon,
  Building2Icon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  Layers3Icon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react'

import { AcademicPage } from '@/features/academic/academic-page'
import { cn } from '@/lib/utils'
import { AcademicPeriodsPage } from './academic-periods-page'
import { FacultiesPage } from './faculties-page'
import { ModalitiesPage } from './modalities-page'
import { UsersPage } from './users-page'

type AdminSection = 'users' | 'faculties' | 'careers' | 'cycles' | 'periods' | 'modalities'

type AdminTab = {
  readonly id: AdminSection
  readonly label: string
  readonly description: string
  readonly icon: LucideIcon
}

const ADMIN_TABS: readonly AdminTab[] = [
  { id: 'users', label: 'Usuarios', description: 'Cuentas y roles', icon: UsersIcon },
  { id: 'faculties', label: 'Facultades', description: 'Estructura institucional', icon: Building2Icon },
  { id: 'careers', label: 'Carreras', description: 'Oferta académica', icon: BookOpenIcon },
  { id: 'cycles', label: 'Ciclos', description: 'Niveles por carrera', icon: Layers3Icon },
  { id: 'periods', label: 'Períodos', description: 'Calendario académico', icon: CalendarDaysIcon },
  { id: 'modalities', label: 'Modalidades', description: 'Formas de estudio', icon: CheckCircle2Icon },
]

export function AdminPage() {
  const [activeSection, setActiveSection] = useState<AdminSection>('users')

  return (
    <section className="flex flex-col gap-8" aria-labelledby="admin-title">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-[0.16em] text-brand-red uppercase">Catálogo institucional</p>
        <h2 id="admin-title" className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Administración</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Configura las cuentas y catálogos que sostienen la operación académica del sistema.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border/70 bg-card p-2 shadow-sm sm:grid-cols-3 xl:grid-cols-6" role="tablist" aria-label="Secciones de administración">
        {ADMIN_TABS.map((tab) => <AdminTabButton key={tab.id} tab={tab} active={activeSection === tab.id} onSelect={setActiveSection} />)}
      </div>

      <div id={`admin-panel-${activeSection}`} role="tabpanel" aria-labelledby={`admin-tab-${activeSection}`} tabIndex={0}>
        <AdminSectionContent section={activeSection} />
      </div>
    </section>
  )
}

function AdminTabButton({ tab, active, onSelect }: Readonly<{ tab: AdminTab; active: boolean; onSelect: (section: AdminSection) => void }>) {
  const Icon = tab.icon

  return <button
    id={`admin-tab-${tab.id}`}
    type="button"
    role="tab"
    aria-selected={active}
    aria-controls={`admin-panel-${tab.id}`}
    onClick={() => onSelect(tab.id)}
    className={cn(
      'flex min-h-20 flex-col items-start justify-between gap-2 rounded-xl border px-3 py-3 text-left transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:px-4',
      active ? 'border-brand-red/30 bg-brand-red/5 text-foreground shadow-sm' : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground',
    )}
  >
    <Icon className={cn('size-5', active ? 'text-brand-red' : 'text-muted-foreground')} aria-hidden="true" />
    <span className="flex flex-col gap-0.5">
      <span className="text-sm font-semibold">{tab.label}</span>
      <span className="hidden text-xs font-normal text-muted-foreground sm:block">{tab.description}</span>
    </span>
  </button>
}

function AdminSectionContent({ section }: Readonly<{ section: AdminSection }>): ReactNode {
  switch (section) {
    case 'users':
      return <UsersPage />
    case 'faculties':
      return <FacultiesPage />
    case 'careers':
      return <AcademicPage section="careers" />
    case 'cycles':
      return <AcademicPage section="cycles" />
    case 'periods':
      return <AcademicPeriodsPage />
    case 'modalities':
      return <ModalitiesPage />
  }
}
