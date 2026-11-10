import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildPageTourSteps, currentPageTourKey, isPageLoading } from './page-tour-runtime'
import { PAGE_TOURS, type TourTarget } from './page-tours'

// Código de las pantallas (sin pruebas ni guías), para comprobar que los destinos existen.
const SCREEN_SOURCES = Object.entries(import.meta.glob(['/src/**/*.tsx', '!/src/**/*.test.tsx', '!/src/features/help/**'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>)
  .map(([, source]) => source)
  .join('\n')

// jsdom no calcula cajas: todo lo que esté en el documento cuenta como visible.
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
})
afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

const titles = (key: string) => buildPageTourSteps(key).map((step) => step.popover?.title)

describe('currentPageTourKey', () => {
  it('usa la pestaña de la URL dentro de una tutoría o ficha', () => {
    expect(currentPageTourKey('teacher-tutorings', new URLSearchParams('tutoring=4&tab=grades'))).toBe('teacher-tutorings/grades')
    expect(currentPageTourKey('teacher-tutorings', new URLSearchParams('tutoring=4'))).toBe('teacher-tutorings/attendance')
    expect(currentPageTourKey('student-tutorings', new URLSearchParams('tutoring=4'))).toBe('student-tutorings/content')
    expect(currentPageTourKey('teacher-tutorings', new URLSearchParams())).toBe('teacher-tutorings')
  })

  it('usa el tema, la actividad o la sesión abiertos dentro de la pestaña', () => {
    expect(currentPageTourKey('teacher-tutorings', new URLSearchParams('tutoring=4&tab=content&topic=7'))).toBe('teacher-tutorings/content/topic')
    expect(currentPageTourKey('teacher-tutorings', new URLSearchParams('tutoring=4&tab=content&topic=7&activity=9'))).toBe('teacher-tutorings/content/activity')
    expect(currentPageTourKey('teacher-tutorings', new URLSearchParams('tutoring=4&session=2026-05-04'))).toBe('teacher-tutorings/attendance/session')
    // En la ficha de titulación, «topic» abre la ficha: no es una sub-vista.
    expect(currentPageTourKey('teacher-degree-tracking', new URLSearchParams('topic=3&tab=tareas'))).toBe('teacher-degree-tracking/tareas')
  })

  it('reconoce la sub-vista marcada dentro de una pestaña', () => {
    document.body.innerHTML = '<main data-slot="sidebar-inset"><div data-tour-view="register"></div></main>'
    expect(currentPageTourKey('teacher-tutorings', new URLSearchParams('tutoring=4&tab=attendance'))).toBe('teacher-tutorings/attendance/register')
    expect(currentPageTourKey('teacher-tutorings', new URLSearchParams('tutoring=4&tab=grades'))).toBe('teacher-tutorings/grades')
  })

  it('reconoce la sub-vista marcada en la pantalla', () => {
    document.body.innerHTML = '<main data-slot="sidebar-inset"><section data-tour-view="career-picker"></section></main>'
    expect(currentPageTourKey('tutorings', new URLSearchParams())).toBe('tutorings/career-picker')

    document.body.innerHTML = '<main data-slot="sidebar-inset"><div data-tour-view="detail"></div></main>'
    expect(currentPageTourKey('tutorings', new URLSearchParams())).toBe('tutorings/detail')
    // Una vista sin guía propia usa la de la sección.
    expect(currentPageTourKey('users', new URLSearchParams())).toBe('users')
  })
})

describe('buildPageTourSteps', () => {
  it('explica solo los elementos que están en pantalla, encontrando botones por su texto', () => {
    document.body.innerHTML = `<main data-slot="sidebar-inset">
      <div data-tour="page-header"></div>
      <button data-tour="page-create">Nuevo estudiante</button>
      <div data-tour="page-filters"></div>
      <div data-slot="table-container"><table><tbody data-slot="table-body"><tr><td>Ana</td><td><button>Acciones para Ana</button></td></tr></tbody></table></div>
    </main>`

    expect(titles('tutoring-students')).toEqual(['Estudiantes de la carrera', 'Nuevo estudiante', 'Buscar y filtrar', 'Listado', 'Acciones de cada fila'])
  })

  it('omite las acciones de fila si la última celda no tiene botones', () => {
    document.body.innerHTML = '<main data-slot="sidebar-inset"><div data-slot="table-container"><table><tbody data-slot="table-body"><tr><td>Ana</td></tr></tbody></table></div></main>'
    expect(titles('users')).toEqual(['Listado'])
  })

  it('devuelve una guía vacía para pantallas sin guía', () => {
    expect(buildPageTourSteps('inexistente')).toEqual([])
  })

  it('todas las pantallas del menú tienen guía', () => {
    for (const key of ['users', 'periods', 'faculties', 'careers', 'tutoring-subjects', 'tutoring-curriculum/curriculum', 'tutoring-teachers', 'tutoring-students', 'tutorings', 'tutoring-reports',
      'degree-students', 'degree-topics', 'degree-tracking', 'degree-reports', 'teacher-tutorings', 'teacher-reports', 'teacher-degree-assignments',
      'teacher-degree-tracking', 'student-tutorings', 'student-degree-topics', 'student-degree-tracking', 'student-degree-assignments']) {
      expect(PAGE_TOURS[key]?.length, key).toBeGreaterThan(0)
    }
  })
})

/** Texto con el que el destino aparece en el código de las pantallas, si se puede comprobar. */
function sourceName(target: TourTarget): string | null {
  if (typeof target !== 'string') return 'button' in target ? target.button : null
  return /data-tour="([^"]+)"/.exec(target)?.[1] ?? /aria-label="([^"]+)"/.exec(target)?.[1] ?? null
}

describe('PAGE_TOURS', () => {
  const detailKeys = Object.keys(PAGE_TOURS).filter((key) => /\/(detail|tutoring|topic|activity|session|register)$/.test(key))

  it('incluye una guía para cada detalle que se abre desde una fila', () => {
    expect(detailKeys).toEqual(expect.arrayContaining([
      'faculties/detail', 'careers/detail', 'tutoring-subjects/detail', 'tutoring-teachers/detail', 'tutoring-students/detail', 'tutorings/detail',
      'degree-topics/detail', 'degree-tracking/detail', 'teacher-reports/tutoring', 'teacher-tutorings/content/topic', 'teacher-tutorings/attendance/session',
    ]))
  })

  it('cada guía de detalle señala al menos un elemento que existe en las pantallas', () => {
    for (const key of detailKeys) {
      const names = PAGE_TOURS[key].flatMap((step) => (Array.isArray(step.target) ? step.target : [step.target as TourTarget]).map(sourceName))
      expect(names.some((name) => name !== null && SCREEN_SOURCES.includes(name)), key).toBe(true)
    }
  })

  it('los atributos data-tour que usan las guías existen en las pantallas', () => {
    const ids = Object.values(PAGE_TOURS).flat().flatMap((step) => (Array.isArray(step.target) ? step.target : [step.target as TourTarget]))
      .flatMap((target) => (typeof target === 'string' ? [...target.matchAll(/data-tour="([^"]+)"/g)].map((match) => match[1]) : []))
    for (const id of new Set(ids)) expect(SCREEN_SOURCES, id).toContain(`data-tour="${id}"`)
  })
})

describe('isPageLoading', () => {
  it('detecta indicadores de carga en el contenido', () => {
    document.body.innerHTML = '<main data-slot="sidebar-inset"><div role="status" aria-label="Cargando tutorías"></div></main>'
    expect(isPageLoading()).toBe(true)
    document.body.innerHTML = '<main data-slot="sidebar-inset"><div aria-busy="false"></div></main>'
    expect(isPageLoading()).toBe(false)
  })

  it('detecta un aviso «Cargando…» sin nombre accesible, pero no otros estados', () => {
    document.body.innerHTML = '<main data-slot="sidebar-inset"><p role="status">Cargando asignatura…</p></main>'
    expect(isPageLoading()).toBe(true)
    document.body.innerHTML = '<main data-slot="sidebar-inset"><span role="status" aria-label="Guardando actividad"></span></main>'
    expect(isPageLoading()).toBe(false)
  })
})
