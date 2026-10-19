/** Requisitos de contraseña alineados con `Password::defaults()` del backend en producción. */
export interface PasswordRequirement {
  readonly id: string
  readonly label: string
  readonly test: (password: string) => boolean
}

export const PASSWORD_MIN_LENGTH = 12

export const PASSWORD_REQUIREMENTS: readonly PasswordRequirement[] = [
  { id: 'length', label: `Al menos ${PASSWORD_MIN_LENGTH} caracteres`, test: (password) => password.length >= PASSWORD_MIN_LENGTH },
  { id: 'lowercase', label: 'Una letra minúscula', test: (password) => /\p{Ll}/u.test(password) },
  { id: 'uppercase', label: 'Una letra mayúscula', test: (password) => /\p{Lu}/u.test(password) },
  { id: 'number', label: 'Un número', test: (password) => /\d/.test(password) },
  { id: 'symbol', label: 'Un carácter especial (!@#$%…)', test: (password) => /[^\p{L}\p{N}\s]/u.test(password) },
]

export type PasswordStrength = 'empty' | 'weak' | 'medium' | 'strong'

export function getUnmetPasswordRequirements(password: string): PasswordRequirement[] {
  return PASSWORD_REQUIREMENTS.filter((requirement) => !requirement.test(password))
}

export function isPasswordValid(password: string): boolean {
  return getUnmetPasswordRequirements(password).length === 0
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (password === '') return 'empty'
  const met = PASSWORD_REQUIREMENTS.length - getUnmetPasswordRequirements(password).length
  if (met === PASSWORD_REQUIREMENTS.length) return 'strong'
  if (met >= 3) return 'medium'
  return 'weak'
}

/** Primer requisito pendiente redactado como mensaje de validación, o `null` si los cumple todos. */
export function getPasswordRequirementHint(password: string): string | null {
  const [first] = getUnmetPasswordRequirements(password)
  return first ? `La contraseña debe incluir: ${first.label.toLowerCase()}.` : null
}
