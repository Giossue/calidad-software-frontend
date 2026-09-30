import { DEFAULT_ADMIN_SECTION, isAdminSection, type AdminSection } from '@/features/admin/admin-page'
import { canCoordinateDegrees, isDegreeSection, type DegreeSection } from '@/features/degree-coordination/degree-navigation'
import { isTeacherSection, type TeacherSection } from '@/features/teacher/teacher-navigation'

export type TutoringSection = 'tutoring-subjects' | 'tutoring-teachers' | 'tutorings'
export function canCoordinateTutorings(role?: string): boolean {
  return role === 'administrador' || role === 'coordinador_carrera'
}
export function isTutoringSection(section?: string): section is TutoringSection {
  return section === 'tutoring-subjects' || section === 'tutoring-teachers' || section === 'tutorings'
}
export function dashboardSection(role?: string, section?: string): AdminSection | TutoringSection | DegreeSection | TeacherSection | 'student-degree-topics' | 'home' {
  if (role === 'docente') return isTeacherSection(section) ? section : 'teacher-tutorings'
  if (role === 'administrador' && isAdminSection(section)) return section
  if (canCoordinateTutorings(role) && isTutoringSection(section)) return section
  if (canCoordinateDegrees(role) && isDegreeSection(section)) return section
  if (role === 'administrador') return DEFAULT_ADMIN_SECTION
  if (canCoordinateDegrees(role)) return 'degree-topics'
  if (role === 'estudiante') return 'student-degree-topics'
  return canCoordinateTutorings(role) ? 'tutorings' : 'home'
}
