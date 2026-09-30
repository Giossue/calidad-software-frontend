export const GRADE_MAX = 10

// Limpia lo que se escribe en una casilla de nota: solo dígitos y un punto, máximo dos decimales
// (ej. 9.42), sin pasar del máximo de la escala. Si el valor escrito no es válido, conserva el anterior.
export function sanitizeGradeInput(next: string, previous: string, maximum: number = GRADE_MAX): string {
  const value = next.replace(',', '.')
  if (value === '') return ''
  if (!/^\d{1,2}(\.\d{0,2})?$/.test(value)) return previous
  if (Number(value) > maximum) return previous
  return value
}

// Una nota está completa cuando es un número válido dentro de la escala (no basta con "9.").
export function isValidGrade(value: string | undefined, maximum: number = GRADE_MAX): boolean {
  if (!value || !/^\d{1,2}(\.\d{1,2})?$/.test(value)) return false
  const number = Number(value)
  return number >= 0 && number <= maximum
}
