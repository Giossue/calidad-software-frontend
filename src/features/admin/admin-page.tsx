import type { ReactNode } from 'react'

import { AcademicPage } from '@/features/academic/academic-page'
import { AcademicPeriodsPage } from './academic-periods-page'
import { FacultiesPage } from './faculties-page'
import { UsersPage } from './users-page'

export type AdminSection = 'users' | 'periods' | 'faculties' | 'careers'

/** Secciones del administrador; el menú lateral lleva a cada una. */
const ADMIN_SECTION_IDS: readonly AdminSection[] = ['users', 'periods', 'faculties', 'careers']

export const DEFAULT_ADMIN_SECTION: AdminSection = ADMIN_SECTION_IDS[0]

export function isAdminSection(value: string | undefined): value is AdminSection {
  return value !== undefined && (ADMIN_SECTION_IDS as readonly string[]).includes(value)
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
