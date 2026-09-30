export const STUDENT_SECTIONS = ['student-tutorings', 'student-grades', 'student-attendance', 'student-content', 'student-degree-topics', 'student-degree-assignments'] as const
export type StudentSection = typeof STUDENT_SECTIONS[number]
export function isStudentSection(section?: string): section is StudentSection {
  return STUDENT_SECTIONS.some((item) => item === section)
}
