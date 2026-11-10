import { useState } from 'react'

/**
 * Conserva los últimos datos recibidos mientras se vuelven a pedir: una recarga (tras guardar)
 * mantiene la pantalla visible en vez de volver al esqueleto de la primera carga.
 */
export function useKeptData<T>(data: T | null): T | null {
  const [kept, setKept] = useState<T | null>(data)
  // Estado derivado de una respuesta nueva: React lo admite durante el render.
  if (data !== null && data !== kept) setKept(data)
  return data ?? kept
}
