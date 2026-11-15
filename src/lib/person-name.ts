/**
 * Nombres y apellidos, con las mismas reglas que el backend (`PersonName` y
 * `PersonNameCount`): uno o dos nombres; dos apellidos por regla general y uno
 * solo como excepción. El sistema guarda un solo campo "apellidos nombres".
 */

export const NAME_PART_MAX_LENGTH = 70

/** Partículas que forman parte del nombre que acompañan ("De la Torre", "María de los Ángeles"). */
const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'lo', 'y', 'e', 'da', 'das', 'do', 'dos', 'di', 'du', 'van', 'von', 'der', 'den', 'san', 'santa', 'mac', 'mc'])

export const FIRST_NAMES_MESSAGE = 'Ingresa uno o dos nombres.'
export const LAST_NAMES_MESSAGE = 'Ingresa tus dos apellidos, o uno solo si tu registro civil tiene un único apellido.'

export function normalizeName(value: string): string {
  return value.replace(/\s+/gu, ' ').trim()
}

function words(value: string): string[] {
  const normalized = normalizeName(value)
  return normalized === '' ? [] : normalized.split(' ')
}

function isParticle(word: string): boolean {
  return PARTICLES.has(word.toLocaleLowerCase('es'))
}

/** Cuántos nombres (o apellidos) contiene el texto; las partículas no cuentan aparte. */
export function countNames(value: string): number {
  const all = words(value)
  const names = all.filter((word) => !isParticle(word))
  return names.length === 0 ? all.length : names.length
}

function isOneOrTwo(value: string): boolean {
  const count = countNames(value)
  return count >= 1 && count <= 2
}

/** Mensaje de error de los nombres ya escritos, o `null` si están bien o vacíos. */
export function firstNamesError(value: string): string | null {
  return normalizeName(value) === '' || isOneOrTwo(value) ? null : FIRST_NAMES_MESSAGE
}

/** Mensaje de error de los apellidos ya escritos, o `null` si están bien o vacíos. */
export function lastNamesError(value: string): string | null {
  return normalizeName(value) === '' || isOneOrTwo(value) ? null : LAST_NAMES_MESSAGE
}

export function areNamesValid(firstNames: string, lastNames: string): boolean {
  return isOneOrTwo(firstNames) && isOneOrTwo(lastNames)
}

/**
 * Separa un nombre guardado como "apellidos nombres" para precargar el formulario:
 * los dos primeros nombres (con sus partículas) son los apellidos y el resto, los
 * nombres. Con menos de tres partes no se puede saber cuál es cuál y quedan vacíos.
 */
export function splitStoredName(full: string | null | undefined): { lastNames: string; firstNames: string } {
  const units: string[] = []
  let pending: string[] = []
  for (const word of words(full ?? '')) {
    pending.push(word)
    if (!isParticle(word)) {
      units.push(pending.join(' '))
      pending = []
    }
  }
  if (pending.length > 0 && units.length > 0) units[units.length - 1] += ` ${pending.join(' ')}`

  if (units.length < 3) return { lastNames: '', firstNames: '' }
  return { lastNames: units.slice(0, 2).join(' '), firstNames: units.slice(2).join(' ') }
}
