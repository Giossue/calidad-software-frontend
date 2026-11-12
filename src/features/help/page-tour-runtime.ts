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
    // Por su texto o, si es un botón de solo ícono, por su nombre accesible.
    return [...root.querySelectorAll('button')].find((button) => isVisible(button) && ((button.textContent ?? '').includes(target.button) || (button.getAttribute('aria-label') ?? '').includes(target.button))) ?? null
  }
  // Acciones de la primera fila: la última celda, si tiene botones.
  const cell = root.querySelector('[data-slot="table-body"] > tr:first-child > td:last-child')
  return cell && isVisible(cell) && cell.querySelector('button') ? cell : null
}

/** Pantallas con pestañas en la URL: parámetro que abre el registro y pestaña por defecto. */
const TABBED: Readonly<Record<string, readonly [param: string, defaultTab: string]>> = {
  'teacher-tutorings': ['tutoring', 'attendance'],
  'student-tutorings': ['tutoring', 'content'],
  'teacher-degree-tracking': ['topic', 'estado-ficha'],
}

/** Pantallas con pestañas siempre visibles en la URL: parámetro de la pestaña y pestaña por defecto. */
const URL_TABS: Readonly<Record<string, readonly [param: string, defaultTab: string, tabs: readonly string[]]>> = {
  'tutoring-users': ['pestana', 'docentes', ['docentes', 'estudiantes']],
}

/** Sub-vistas que se abren con un parámetro de la URL dentro de una pestaña, de la más interna a la más externa. */
// Parámetro de la URL → sub-vista de la guía (p. ej. `consult` abre el detalle de una sesión).
const URL_SUB_VIEWS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'teacher-tutorings': { activity: 'activity', topic: 'topic', consult: 'session' },
}

/** La última sub-vista visible marcada con `data-tour-view`. */
function visibleView(): string | null {
  const root = document.querySelector(CONTENT) ?? document
  const views = [...root.querySelectorAll('[data-tour-view]')].filter(isVisible)
  return views.at(-1)?.getAttribute('data-tour-view') ?? null
}

/**
 * Identificador de la pantalla actual. Las pestañas de una tutoría o de una ficha
 * de titulación se leen de la URL, igual que el tema o la sesión abiertos dentro
 * de ellas; las demás sub-vistas (detalle, selección de carrera…), del atributo
 * `data-tour-view` de su contenedor. Si la sub-vista no tiene guía propia, se usa
 * la de la pantalla que la contiene.
 */
export function currentPageTourKey(section: string, params: URLSearchParams): string {
  const tabs = TABBED[section]
  const urlTabs = URL_TABS[section]
  const urlTab = urlTabs && (urlTabs[2].find((tab) => tab === params.get(urlTabs[0])) ?? urlTabs[1])
  const base = urlTab ? `${section}/${urlTab}` : tabs && params.get(tabs[0]) ? `${section}/${params.get('tab') ?? tabs[1]}` : section
  const subViews = URL_SUB_VIEWS[section] ?? {}
  const subParam = Object.keys(subViews).find((param) => base !== section && params.get(param))
  const subView = subParam ? subViews[subParam] : undefined
  const view = visibleView()
  const candidates = [subView && `${base}/${subView}`, view && `${base}/${view}`]
  return candidates.find((key): key is string => Boolean(key && PAGE_TOURS[key])) ?? base
}

/** La pantalla todavía está cargando datos: algo ocupado o un aviso «Cargando…». */
export function isPageLoading(): boolean {
  const root = document.querySelector(CONTENT)
  if (!root) return false
  if (root.querySelector('[aria-busy="true"]')) return true
  return [...root.querySelectorAll('[role="status"]')].some((status) => (status.getAttribute('aria-label') ?? status.textContent ?? '').trim().startsWith('Cargando'))
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
