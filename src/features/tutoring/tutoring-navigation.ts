import { DEFAULT_ADMIN_SECTION, isAdminSection, type AdminSection } from '@/features/admin/admin-page'
import { canCoordinateDegrees, isDegreeSection, type DegreeSection } from '@/features/degree-coordination/degree-navigation'
import { isStudentSection, type StudentSection } from '@/features/student/student-navigation'
import { isTeacherSection, type TeacherSection } from '@/features/teacher/teacher-navigation'

export type TutoringSection = 'tutoring-subjects' | 'tutoring-teachers' | 'tutorings' | 'tutoring-students' | 'tutoring-reports'
export function canCoordinateTutorings(role?: string): boolean {
  return role === 'coordinador_carrera'
}
export function isTutoringSection(section?: string): section is TutoringSection {
  return (
    section === 'tutoring-subjects' ||
    section === 'tutoring-teachers' ||
    section === 'tutorings' ||
    section === 'tutoring-students' ||
    section === 'tutoring-reports'
  )
}
export function dashboardSection(
  role?: string,
  section?: string,
  studentStage: 'tutorias' | 'titulacion' | null = null,
): AdminSection | TutoringSection | DegreeSection | TeacherSection | StudentSection | 'home' {
  if (role === 'docente') return isTeacherSection(section) ? section : 'teacher-tutorings'
  if (role === 'estudiante') {
    // En el último ciclo de la carrera el estudiante solo tiene titulación.
    if (studentStage === 'titulacion') {
      return isStudentSection(section) && section !== 'student-tutorings' ? section : 'student-degree-topics'
    }
    return isStudentSection(section) ? section : 'student-tutorings'
  }
  if (role === 'administrador' && isAdminSection(section)) return section
  if (canCoordinateTutorings(role) && isTutoringSection(section)) return section
  if (canCoordinateDegrees(role) && isDegreeSection(section)) return section
  if (role === 'administrador') return DEFAULT_ADMIN_SECTION
  if (canCoordinateDegrees(role)) return 'degree-students'
  return canCoordinateTutorings(role) ? 'tutorings' : 'home'
}
