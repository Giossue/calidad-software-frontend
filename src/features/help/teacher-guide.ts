import type { DriveStep } from 'driver.js'

/** Clave con la que se registra que el docente vio el tutorial práctico. */
export const TEACHER_GUIDE = 'teacher-guide'

function isVisible(element: Element | null): element is Element {
  return Boolean(element && element.getClientRects().length > 0 && !element.closest('[inert]'))
}

/** Pestaña de la tutoría abierta cuyo texto empieza por `label`, si está a la vista. */
function tutoringTab(label: string): Element | undefined {
  const tabs = document.querySelectorAll('[aria-label="Secciones de la tutoría"] [role="tab"]')
  return [...tabs].find((tab) => isVisible(tab) && (tab.textContent ?? '').trim().startsWith(label))
}

/** El primer elemento visible, o ninguno: sin elemento, el globo aparece centrado. */
function firstVisible(...candidates: readonly (Element | null | undefined)[]): Element | undefined {
  return candidates.find((candidate): candidate is Element => isVisible(candidate ?? null))
}

function step(title: string, description: string, element?: Element): DriveStep {
  return element
    ? { element, popover: { title, description, side: 'bottom', align: 'start' } }
    : { popover: { title, description } }
}

/**
 * Tutorial práctico del docente: el trabajo de cada clase en cuatro pasos. Se abre
 * desde el botón de ayuda; si hay una tutoría abierta, señala sus pestañas.
 */
export function buildTeacherGuideSteps(): DriveStep[] {
  const menu = firstVisible(document.querySelector('[data-tour="nav-teacher-tutorings"]'), document.querySelector('[data-tour="menu-trigger"]'))
  const sections = firstVisible(document.querySelector('[aria-label="Secciones de la tutoría"]'))

  return [
    step(
      'Tutorial práctico del docente',
      'Te mostramos, paso a paso, lo que haces en tus tutorías: 1) ver tus tutorías asignadas, 2) tomar asistencia, 3) registrar el contenido y 4) registrar calificaciones y configurar los horarios.',
    ),
    step(
      'Paso 1 · Ver tus tutorías asignadas',
      'Entra a «Mis tutorías» en el menú. Ahí están las tutorías que coordinación te asignó; busca por asignatura si tienes varias. Haz clic en una para abrirla: dentro tienes las pestañas Asistencia, Contenido, Horarios y Estudiantes y Calificaciones.',
      menu,
    ),
    step(
      'Paso 2 · Tomar asistencia',
      'En la pestaña «Asistencia», pulsa «Registrar asistencia». Solo se habilita el día de la clase y durante su horario. Marca a cada estudiante como presente o ausente (o usa «Marcar todos») y pulsa «Guardar asistencia». Mientras dure la clase puedes corregir la lista; después queda cerrada.',
      tutoringTab('Asistencia'),
    ),
    step(
      'Paso 3 · Registrar el contenido',
      'En la pestaña «Contenido», pulsa «Registrar tema» para planificar lo que vas a dictar. Adjunta recursos (PDF, Word, PowerPoint o Excel) para tus estudiantes y, dentro de cada tema, registra sus actividades y metodologías.',
      tutoringTab('Contenido'),
    ),
    step(
      'Paso 4 · Calificaciones y horarios',
      'En «Estudiantes y Calificaciones» abre «Calificaciones», elige la etapa, escribe las notas (de 0 a la nota máxima, con hasta dos decimales) y guarda. En «Horarios» revisa los días y horas de la clase y pulsa «Editar horarios» para configurarlos: sin horario no se puede tomar asistencia.',
      sections,
    ),
    step(
      '¡Listo!',
      'Cada pantalla tiene además su propia guía con más detalle. Ábrela desde el botón de ayuda › «Guía de esta pantalla», o repite este tutorial cuando quieras.',
      firstVisible(document.querySelector('[data-tour="help"]')),
    ),
  ]
}
