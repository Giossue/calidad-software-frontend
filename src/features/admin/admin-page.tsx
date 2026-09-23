import { useState, type ReactNode } from 'react'
import {
  BookOpenIcon,
  Building2Icon,
  CalendarDaysIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Card } from '@/components/ui/card'
import { AcademicPage } from '@/features/academic/academic-page'
import { cn } from '@/lib/utils'
import { AcademicPeriodsPage } from './academic-periods-page'
import { FacultiesPage } from './faculties-page'
import { UsersPage } from './users-page'

export type AdminSection = 'users' | 'periods' | 'faculties' | 'careers'

export type AdminTab = {
  readonly id: AdminSection
  readonly label: string
  readonly description: string
  readonly icon: LucideIcon
}

export const ADMIN_TABS: readonly AdminTab[] = [
  { id: 'users', label: 'Usuarios', description: 'Cuentas y roles', icon: UsersIcon },
  { id: 'periods', label: 'Períodos Académicos', description: 'Calendario académico', icon: CalendarDaysIcon },
  { id: 'faculties', label: 'Facultades', description: 'Estructura institucional', icon: Building2Icon },
  { id: 'careers', label: 'Carreras', description: 'Oferta académica y ciclos', icon: BookOpenIcon },
]

export function AdminPage({
  section,
}: Readonly<{
  section?: AdminSection
}>) {
  const [internalSection, setInternalSection] = useState<AdminSection>('users')
  const activeSection = section ?? internalSection

  return (
    <section className="flex flex-col gap-8" aria-labelledby="admin-title">
      {!section && (
        <>
          <AdminSectionHeader title="Administración" description="Configura las cuentas y catálogos que sostienen la operación académica del sistema." titleId="admin-title" />

          <Card className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 xl:grid-cols-6" role="tablist" aria-label="Secciones de administración">
            {ADMIN_TABS.map((tab) => <AdminTabButton key={tab.id} tab={tab} active={activeSection === tab.id} onSelect={setInternalSection} />)}
          </Card>
        </>
      )}

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

export function AdminSectionContent({ section }: Readonly<{ section: AdminSection }>): ReactNode {
  switch (section) {
    case 'users':
      return <UsersPage />
    case 'faculties':
      return <FacultiesPage />
    case 'careers':
      return <AcademicPage />
    case 'periods':
      return <AcademicPeriodsPage />
  }
}

