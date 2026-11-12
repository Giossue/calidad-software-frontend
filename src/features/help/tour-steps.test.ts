import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildTourSteps, MODULE_HELP } from './tour-steps'

const titles = (moduleIds: readonly string[]) => buildTourSteps(moduleIds).map((step) => step.popover?.title)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('buildTourSteps', () => {
  it('explica solo los módulos del menú de la cuenta, en su orden', () => {
    const steps = titles(['teacher-tutorings', 'teacher-reports'])

    expect(steps).toContain('Mis tutorías')
    expect(steps).toContain('Informes')
    expect(steps).not.toContain('Usuarios')
    expect(steps.indexOf('Mis tutorías')).toBeLessThan(steps.indexOf('Informes'))
  })

  it('omite módulos sin explicación y siempre incluye las herramientas comunes', () => {
    const steps = titles(['home'])

    expect(steps).toEqual([
      '¡Bienvenido!', 'Menú principal', 'Notificaciones', 'Modo claro u oscuro',
      'Accesibilidad', 'Tu cuenta', '¿Necesitas ayuda?',
    ])
  })

  it('ofrece instalar la aplicación solo en el celular', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(max-width: 767px)' }))
    expect(titles([])).toContain('Instala la aplicación')

    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    expect(titles([])).not.toContain('Instala la aplicación')
  })

  it('saluda con el nombre completo, sin títulos académicos (los apellidos pueden ir primero)', () => {
    expect(buildTourSteps([], 'Ana María Torres')[0].popover?.title).toBe('¡Hola, Ana María Torres!')
    expect(buildTourSteps([], 'Mgtr. Gabriela Naranjo Paredes')[0].popover?.title).toBe('¡Hola, Gabriela Naranjo Paredes!')
    expect(buildTourSteps([], 'Andrade Loor Sofía')[0].popover?.title).toBe('¡Hola, Andrade Loor Sofía!')
  })

  it('tiene explicación para todos los módulos del menú', () => {
    for (const id of ['users', 'periods', 'faculties', 'careers', 'tutoring-curriculum', 'tutoring-teachers', 'tutoring-students', 'tutorings',
      'tutoring-reports', 'degree-students', 'degree-topics', 'degree-tracking', 'degree-reports', 'teacher-tutorings', 'teacher-reports',
      'teacher-degree-assignments', 'teacher-degree-tracking', 'student-tutorings', 'student-degree-topics', 'student-degree-tracking',
      'student-degree-assignments']) {
      expect(MODULE_HELP[id], id).toBeDefined()
    }
  })
})
