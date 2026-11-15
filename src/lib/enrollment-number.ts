/** Número de matrícula de una inscripción a la tutoría; desde la 2.ª la asistencia es obligatoria. */
export type EnrollmentNumber = 1 | 2 | 3

const ENROLLMENT_NUMBERS: readonly EnrollmentNumber[] = [1, 2, 3]

/** Al inscribir, el estudiante queda en 1.ª matrícula salvo que se elija otra. */
export const DEFAULT_ENROLLMENT_NUMBER: EnrollmentNumber = 1

export function enrollmentNumberLabel(value: EnrollmentNumber): string {
  return `${value}.ª matrícula`
}

/** Opciones del select «Matrícula» (el valor es el número como texto). */
export const ENROLLMENT_NUMBER_OPTIONS = ENROLLMENT_NUMBERS.map((value) => ({ value: String(value), label: enrollmentNumberLabel(value) }))

/** Lee el valor del select; un valor desconocido vuelve a la 1.ª matrícula. */
export function parseEnrollmentNumber(value: string): EnrollmentNumber {
  return ENROLLMENT_NUMBERS.find((number) => String(number) === value) ?? DEFAULT_ENROLLMENT_NUMBER
}

/** Ayuda del campo «Matrícula» en los formularios de inscripción. */
export const ENROLLMENT_NUMBER_TIP = 'Desde la 2.ª matrícula la asistencia a las tutorías es obligatoria.'
