import type { DriveStep } from 'driver.js'

import { PAGE_TOURS, type TourTarget } from './page-tours'

/** Contenido de la pantalla (sin menú lateral ni cabecera). */
const CONTENT = 'main[data-slot="sidebar-inset"]'

function isVisible(element: Element): boolean {
  return element.getClientRects().length > 0 && !element.closest('[inert]')
}

function resolveTarget(target: TourTarget, root: ParentNode): Element | null {
  if (typeof target === 'string') {
    // Los selectores del menú lateral se buscan en todo el documento.
    const scope = target.includes('sidebar-container') ? document : root
    return [...scope.querySelectorAll(target)].find(isVisible) ?? null
  }
  if ('button' in target) {
    return [...root.querySelectorAll('button')].find((button) => isVisible(button) && (button.textContent ?? '').includes(target.button)) ?? null
  }
  // Acciones de la primera fila: la última celda, si tiene botones.
  const cell = root.querySelector('[data-slot="table-body"] > tr:first-child > td:last-child')
  return cell && isVisible(cell) && cell.querySelector('button') ? cell : null
}

/**
 * Identificador de la pantalla actual. Las pestañas internas de una tutoría o de
 * una ficha de titulación se leen de la URL; las demás sub-vistas, del atributo
 * `data-tour-view` de su contenedor.
 */
export function currentPageTourKey(section: string, params: URLSearchParams): string {
  const tabbed: Record<string, readonly [param: string, defaultTab: string]> = {
    'teacher-tutorings': ['tutoring', 'attendance'],
    'student-tutorings': ['tutoring', 'content'],
    'teacher-degree-tracking': ['topic', 'estado-ficha'],
  }
  const tabs = tabbed[section]
  if (tabs && params.get(tabs[0])) return `${section}/${params.get('tab') ?? tabs[1]}`

  const root = document.querySelector(CONTENT) ?? document
  const views = [...root.querySelectorAll('[data-tour-view]')].filter(isVisible)
  const view = views.at(-1)?.getAttribute('data-tour-view')
  return view && PAGE_TOURS[`${section}/${view}`] ? `${section}/${view}` : section
}

/** La pantalla todavía está cargando datos. */
export function isPageLoading(): boolean {
  const root = document.querySelector(CONTENT)
  return Boolean(root?.querySelector('[aria-busy="true"], [role="status"][aria-label^="Cargando"]'))
}

/** Pasos de la guía de la pantalla, solo con los elementos que están a la vista. */
export function buildPageTourSteps(key: string): DriveStep[] {
  const root = document.querySelector(CONTENT) ?? document
  return (PAGE_TOURS[key] ?? []).flatMap((step): DriveStep[] => {
    const targets = Array.isArray(step.target) ? step.target : [step.target as TourTarget]
    const element = targets.map((target) => resolveTarget(target, root)).find(Boolean)
    return element ? [{ element, popover: { title: step.title, description: step.description, side: step.side, align: 'start' } }] : []
  })
}
