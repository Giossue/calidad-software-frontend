/** Elimina cualquier carácter que no sea letra (incluye tildes/ñ) o espacio. */
export function sanitizeLetters(value: string, maxLength: number): string {
  return value.replace(/[^\p{L}\s]/gu, '').slice(0, maxLength)
}

/**
 * Formats a normalized (lowercase, no-accent) subject name for display.
 * Capitalizes the first letter of each word (title case).
 * E.g. "matematicas y logica" → "Matematicas Y Logica"
 */
export function formatSubjectName(name: string): string {
  return name.replace(/\p{L}+/gu, (word) => word.charAt(0).toUpperCase() + word.slice(1))
}

/** Elimina cualquier carácter que no sea un dígito. */
export function sanitizeDigits(value: string, maxLength: number): string {
  return value.replace(/\D/g, '').slice(0, maxLength)
}

/** Elimina cualquier carácter que no sea letra, dígito o guion (para códigos como SW-B1-001). */
export function sanitizeCode(value: string, maxLength: number): string {
  return value.replace(/[^\p{L}\d-]/gu, '').slice(0, maxLength)
}
