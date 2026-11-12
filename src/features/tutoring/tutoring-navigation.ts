import { DEFAULT_ADMIN_SECTION, isAdminSection, type AdminSection } from '@/features/admin/admin-page'
import { canCoordinateDegrees, isDegreeSection, type DegreeSection } from '@/features/degree-coordination/degree-navigation'
import { isStudentSection, type StudentSection } from '@/features/student/student-navigation'
import { isTeacherSection, type TeacherSection } from '@/features/teacher/teacher-navigation'

/** Sección anterior de Asignaturas: ahora es parte de la malla curricular. */
export const LEGACY_SUBJECTS_SECTION = 'tutoring-subjects'

/** Carrera elegida en la URL (`?carrera=`): Docentes y Estudiantes la comparten. */
export const CAREER_PARAM = 'carrera'

/** Pestañas de «Usuarios»; viven en la URL como `?pestana=`. */
export const USERS_TAB_PARAM = 'pestana'
export type UsersTab = 'docentes' | 'estudiantes'
export const DEFAULT_USERS_TAB: UsersTab = 'docentes'

/** Secciones anteriores de Docentes y Estudiantes: ahora son pestañas de «Usuarios». */
export const LEGACY_USER_SECTIONS: Readonly<Record<string, UsersTab>> = {
  'tutoring-teachers': 'docentes',
  'tutoring-students': 'estudiantes',
}

/** Pestaña de «Usuarios» a la que lleva una sección antigua, si lo es. */
export function legacyUsersTab(section?: string): UsersTab | undefined {
  return section && Object.hasOwn(LEGACY_USER_SECTIONS, section) ? LEGACY_USER_SECTIONS[section] : undefined
}

export function usersTab(params: URLSearchParams): UsersTab {
  return params.get(USERS_TAB_PARAM) === 'estudiantes' ? 'estudiantes' : DEFAULT_USERS_TAB
}

export type TutoringSection = 'tutoring-curriculum' | 'tutoring-users' | 'tutorings' | 'tutoring-reports'
export function canCoordinateTutorings(role?: string): boolean {
  return role === 'coordinador_carrera'
}
export function isTutoringSection(section?: string): section is TutoringSection {
  return (
    section === 'tutoring-curriculum' ||
    section === 'tutoring-users' ||
    section === 'tutorings' ||
    section === 'tutoring-reports'
  )
}
/**
 * Ruta a la que se corrige una sección no válida o antigua. Los enlaces a la antigua
 * sección de Asignaturas conservan sus parámetros (p. ej. la asignatura abierta); los de
 * Docentes y Estudiantes, también, y abren su pestaña de «Usuarios».
 */
export function sectionRedirectPath(section: string | undefined, activeSection: string, params: URLSearchParams): string {
  const legacyTab = legacyUsersTab(section)
  if (legacyTab && activeSection === 'tutoring-users') {
    const next = new URLSearchParams(params)
    next.set(USERS_TAB_PARAM, legacyTab)
    return `/panel/${activeSection}?${next.toString()}`
  }
  const search = section === LEGACY_SUBJECTS_SECTION && params.size > 0 ? `?${params.toString()}` : ''
  return `/panel/${activeSection}${search}`
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
  if (canCoordinateTutorings(role) && section === LEGACY_SUBJECTS_SECTION) return 'tutoring-curriculum'
  if (canCoordinateTutorings(role) && legacyUsersTab(section)) return 'tutoring-users'
  if (canCoordinateTutorings(role) && isTutoringSection(section)) return section
  if (canCoordinateDegrees(role) && isDegreeSection(section)) return section
  if (role === 'administrador') return DEFAULT_ADMIN_SECTION
  if (canCoordinateDegrees(role)) return 'degree-students'
  return canCoordinateTutorings(role) ? 'tutorings' : 'home'
}
