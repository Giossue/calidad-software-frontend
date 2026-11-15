import { Badge } from '@/components/ui/badge'
import { enrollmentNumberLabel, type EnrollmentNumber } from '@/lib/enrollment-number'

/**
 * Etiqueta junto al estudiante en los listados de la tutoría: «Asistencia obligatoria»
 * cuando la inscripción la exige y la matrícula desde la 2.ª. En 1.ª matrícula no muestra nada.
 */
export function EnrollmentNumberTag({ enrollmentNumber, attendanceRequired }: Readonly<{ enrollmentNumber?: EnrollmentNumber | null; attendanceRequired?: boolean }>) {
  const showNumber = enrollmentNumber !== undefined && enrollmentNumber !== null && enrollmentNumber >= 2
  if (!attendanceRequired && !showNumber) return null
  return (
    <span className="flex flex-wrap items-center gap-1">
      {attendanceRequired && <Badge variant="secondary">Asistencia obligatoria</Badge>}
      {showNumber && <span className="text-xs text-muted-foreground">{enrollmentNumberLabel(enrollmentNumber)}</span>}
    </span>
  )
}
