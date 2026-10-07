const CHECK_DIGIT_COEFFICIENTS = [2, 1, 2, 1, 2, 1, 2, 1, 2]

/** Verifica el dígito de control de una cédula ecuatoriana (algoritmo módulo 10). */
export function isValidEcuadorianCedula(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false

  const province = Number(value.slice(0, 2))
  if (province < 1 || (province > 24 && province !== 30)) return false

  if (Number(value[2]) > 6) return false

  let sum = 0
  for (let i = 0; i < CHECK_DIGIT_COEFFICIENTS.length; i++) {
    const digit = Number(value[i]) * CHECK_DIGIT_COEFFICIENTS[i]
    sum += digit >= 10 ? digit - 9 : digit
  }

  const checkDigit = (10 - (sum % 10)) % 10
  return checkDigit === Number(value[9])
}

const PASSPORT_PATTERN = /^[A-Z0-9]{6,9}$/

/** Normaliza una cédula o pasaporte: mayúsculas, solo letras A-Z y dígitos; 10 caracteres para cédula y 9 si contiene letras. */
export function sanitizeIdentification(value: string): string {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return /[A-Z]/.test(clean) ? clean.slice(0, 9) : clean.slice(0, 10)
}

/** Acepta una cédula ecuatoriana válida (10 dígitos) o un pasaporte de 6 a 9 caracteres alfanuméricos. */
export function isValidIdentification(value: string): boolean {
  return /^\d{10}$/.test(value) ? isValidEcuadorianCedula(value) : PASSPORT_PATTERN.test(value)
}

/** Indica si ya se puede mostrar el resultado de la validación sin interrumpir al usuario mientras escribe una cédula. */
export function shouldShowIdentificationStatus(value: string): boolean {
  return value.length === 10 || (/[A-Z]/.test(value) && value.length >= 6)
}

/** Longitud máxima según el tipo de documento que se está escribiendo. */
export function identificationMaxLength(value: string): number {
  return /[A-Z]/.test(value) ? 9 : 10
}
