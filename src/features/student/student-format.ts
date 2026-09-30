import type { StudentTutoringSummary } from '@/lib/student-api'

export function tutoringContext(tutoring: StudentTutoringSummary | null): string {
  if (!tutoring) return 'Tutoría sin registrar'
  return [tutoring.academic_period?.name, tutoring.cycle?.name, tutoring.section ? `Paralelo ${tutoring.section.name}` : null].filter(Boolean).join(' · ')
}
