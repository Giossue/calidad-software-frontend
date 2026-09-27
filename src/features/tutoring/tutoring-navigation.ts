import { DEFAULT_ADMIN_SECTION, isAdminSection, type AdminSection } from '@/features/admin/admin-page'

export type TutoringSection = 'tutoring-subjects' | 'tutoring-teachers' | 'tutorings'
export function canCoordinateTutorings(role?: string): boolean {
  return role === 'administrador' || role === 'coordinador_carrera'
}
export function isTutoringSection(section?: string): section is TutoringSection {
  return section === 'tutoring-subjects' || section === 'tutoring-teachers' || section === 'tutorings'
}
export function dashboardSection(role?: string, section?: string): AdminSection | TutoringSection | 'home' {
  if (role === 'administrador' && isAdminSection(section)) return section
  if (canCoordinateTutorings(role) && isTutoringSection(section)) return section
  if (role === 'administrador') return DEFAULT_ADMIN_SECTION
  return canCoordinateTutorings(role) ? 'tutorings' : 'home'
}
