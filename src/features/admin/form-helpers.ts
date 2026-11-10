import { useCallback, useState } from 'react'

/**
 * Nombres oficiales (facultades, carreras, ciclos): letras (con tildes/ñ), espacios, comas,
 * puntos, guiones y paréntesis. Ej. "Facultad de Ciencias Administrativas, Gestión Empresarial e Informática".
 */
export function sanitizeOfficialName(value: string, maxLength: number): string {
  return value.replace(/[^\p{L}\s.,()-]/gu, '').slice(0, maxLength)
}

/**
 * Campos que el usuario ya tocó (salió del campo o eligió una opción): su error de validación
 * se muestra en línea bajo el campo desde ese momento, sin esperar a enviar.
 */
export function useTouchedFields<K extends string>() {
  const [touched, setTouched] = useState<ReadonlySet<K>>(() => new Set())

  const touch = useCallback((field: K) => {
    setTouched((current) => (current.has(field) ? current : new Set(current).add(field)))
  }, [])
  const reset = useCallback(() => setTouched(new Set()), [])

  return { touched, touch, reset }
}

/** Error visible de un campo: el del envío o del servidor; si no hay, el de validación una vez tocado. */
export function visibleFieldError<K extends string>(
  field: K,
  submitted: Partial<Record<K, string | undefined>>,
  live: Partial<Record<K, string | undefined>>,
  touched: ReadonlySet<K>,
): string | undefined {
  return submitted[field] ?? (touched.has(field) ? live[field] : undefined)
}

/** Las descripciones de los toasts terminan en punto (los mensajes del servidor a veces no lo traen). */
/** El texto tal cual (los toasts quitan el punto final en `@/lib/toast`). */
export function asSentence(text: string): string {
  return text.trim()
}
