import { describe, expect, it } from 'vitest'

import { buildTourSteps, MODULE_HELP } from './tour-steps'

const titles = (moduleIds: readonly string[]) => buildTourSteps(moduleIds).map((step) => step.popover?.title)

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
      '¡Bienvenido!', 'Menú principal', '¿Dónde estoy?', 'Notificaciones', 'Modo claro u oscuro',
      'Tu cuenta', 'Accesibilidad', 'Instala la aplicación', '¿Necesitas ayuda?',
    ])
  })

  it('saluda por el primer nombre', () => {
    expect(buildTourSteps([], 'Ana María Torres')[0].popover?.title).toBe('¡Hola, Ana!')
  })

  it('tiene explicación para todos los módulos del menú', () => {
    for (const id of ['users', 'periods', 'faculties', 'careers', 'tutoring-subjects', 'tutoring-teachers', 'tutoring-students', 'tutorings',
      'tutoring-reports', 'degree-students', 'degree-topics', 'degree-tracking', 'degree-reports', 'teacher-tutorings', 'teacher-reports',
      'teacher-degree-assignments', 'teacher-degree-tracking', 'student-tutorings', 'student-degree-topics', 'student-degree-tracking',
      'student-degree-assignments']) {
      expect(MODULE_HELP[id], id).toBeDefined()
    }
  })
})
