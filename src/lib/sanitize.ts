/** Elimina cualquier carácter que no sea letra (incluye tildes/ñ) o espacio. */
export function sanitizeLetters(value: string, maxLength: number): string {
  return value.replace(/[^\p{L}\s]/gu, '').slice(0, maxLength)
}

/** Elimina cualquier carácter que no sea un dígito. */
export function sanitizeDigits(value: string, maxLength: number): string {
  return value.replace(/\D/g, '').slice(0, maxLength)
}
