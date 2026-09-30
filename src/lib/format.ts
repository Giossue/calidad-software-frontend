/** Devuelve las iniciales (hasta 2 letras) de un nombre, para mostrarlas en un avatar. */
export function getInitials(name?: string): string {
  if (!name) return 'US'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

/** Las fechas académicas se muestran sin desplazar el día por la zona horaria. */
export function formatDate(value: string, time = false): string {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', ...(time ? { timeStyle: 'short' as const } : {}) }).format(date)
}
