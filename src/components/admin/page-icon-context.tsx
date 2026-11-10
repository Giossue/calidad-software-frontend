import { createContext, useContext, type ComponentType } from 'react'

type PageIcon = ComponentType<{ className?: string }>

/** Ícono de la sección activa del menú; el encabezado de la pantalla lo muestra junto al título. */
export const PageIconContext = createContext<PageIcon | null>(null)

export function usePageIcon() {
  return useContext(PageIconContext)
}
