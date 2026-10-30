import type { ReactNode } from 'react'

/**
 * Contenedor de acciones de una fila clicable: evita que pulsar un icono (o elegir una opción de
 * su menú, que se renderiza en un portal) dispare además el clic de la fila.
 */
export function RowActions({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
      {children}
    </div>
  )
}
