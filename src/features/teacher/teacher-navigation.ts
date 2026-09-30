export const TEACHER_SECTIONS = ['teacher-tutorings', 'teacher-students', 'teacher-grades', 'teacher-attendance', 'teacher-content', 'teacher-reports', 'teacher-degree-assignments'] as const
export type TeacherSection = typeof TEACHER_SECTIONS[number]
export function isTeacherSection(section?: string): section is TeacherSection {
  return TEACHER_SECTIONS.some((item) => item === section)
}
