import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildPageTourSteps, currentPageTourKey, isPageLoading } from './page-tour-runtime'
import { PAGE_TOURS } from './page-tours'

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
      <button>Vincular docente existente</button>
      <div data-tour="page-filters"></div>
      <div data-slot="table-container"><table><tbody data-slot="table-body"><tr><td>Ana</td><td><button>Acciones para Ana</button></td></tr></tbody></table></div>
    </main>`

    expect(titles('tutoring-teachers')).toEqual(['Docentes', 'Vincular docente existente', 'Buscar y filtrar', 'Listado', 'Acciones de cada fila'])
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

describe('isPageLoading', () => {
  it('detecta indicadores de carga en el contenido', () => {
    document.body.innerHTML = '<main data-slot="sidebar-inset"><div role="status" aria-label="Cargando tutorías"></div></main>'
    expect(isPageLoading()).toBe(true)
    document.body.innerHTML = '<main data-slot="sidebar-inset"><div aria-busy="false"></div></main>'
    expect(isPageLoading()).toBe(false)
  })
})
