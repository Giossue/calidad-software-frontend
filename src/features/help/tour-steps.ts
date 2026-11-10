import type { DriveStep } from 'driver.js'

/** Explicación de cada módulo del menú lateral, por id de sección. */
export const MODULE_HELP: Readonly<Record<string, { readonly title: string; readonly description: string }>> = {
  // Administración
  users: {
    title: 'Usuarios',
    description: 'Registra cuentas, asigna roles y carreras, y habilita o deshabilita usuarios. Con la carga masiva registras muchas cuentas a la vez desde un CSV; cada usuario recibe su contraseña provisional por correo.',
  },
  periods: {
    title: 'Períodos académicos',
    description: 'Crea los períodos académicos y define cuál está vigente. Solo puede haber un período activo a la vez.',
  },
  faculties: {
    title: 'Facultades',
    description: 'Mantén el catálogo de facultades de la universidad.',
  },
  careers: {
    title: 'Carreras',
    description: 'Registra las carreras de cada facultad y define su estructura de ciclos.',
  },
  // Coordinación de carrera (tutorías)
  'tutoring-subjects': {
    title: 'Asignaturas',
    description: 'Elige una carrera y administra sus asignaturas por ciclo. También puedes cargarlas de forma masiva.',
  },
  'tutoring-curriculum': {
    title: 'Malla curricular',
    description: 'Consulta las asignaturas de cada ciclo y su secuencia: de cuál viene cada una y en cuál continúa. Quien aprueba una asignatura pasa a la siguiente en el nuevo período.',
  },
  'tutoring-teachers': {
    title: 'Docentes',
    description: 'Registra docentes nuevos o vincula docentes ya registrados a tus carreras. Cada docente nuevo recibe una contraseña provisional por correo.',
  },
  'tutoring-students': {
    title: 'Estudiantes',
    description: 'Registra estudiantes, asígnales su ciclo y revisa en qué tutorías están inscritos.',
  },
  tutorings: {
    title: 'Tutorías',
    description: 'Crea tutorías eligiendo ciclo y asignatura, y asigna el docente y los horarios.',
  },
  'tutoring-reports': {
    title: 'Informes',
    description: 'Lee los informes que los docentes envían sobre el desarrollo de sus tutorías.',
  },
  // Coordinación de titulación
  'degree-students': {
    title: 'Matrícula de estudiantes',
    description: 'Matricula a los estudiantes en titulación para el período vigente o retira su matrícula.',
  },
  'degree-topics': {
    title: 'Propuestas de titulación',
    description: 'Revisa los temas que proponen los estudiantes: apruébalos o recházalos con observaciones y asigna el tutor y los pares académicos.',
  },
  'degree-tracking': {
    title: 'Seguimiento',
    description: 'Registra actividades de avance y genera el informe de evolución de cada tema de titulación.',
  },
  'degree-reports': {
    title: 'Reportes',
    description: 'Emite los informes oficiales de seguimiento del trabajo de titulación.',
  },
  // Docente
  'teacher-tutorings': {
    title: 'Mis tutorías',
    description: 'Elige una tutoría para gestionar sus estudiantes, calificaciones, asistencia, contenido y horarios.',
  },
  'teacher-reports': {
    title: 'Informes',
    description: 'Prepara y envía al Coordinador de Carrera los informes de tus tutorías: diagnóstico, seguimiento e informe final.',
  },
  'teacher-degree-assignments': {
    title: 'Titulación',
    description: 'Consulta los estudiantes y temas en los que participas como tutor o par académico.',
  },
  'teacher-degree-tracking': {
    title: 'Seguimiento',
    description: 'Supervisa el avance de los estudiantes que tienes asignados y registra tareas de seguimiento.',
  },
  // Estudiante
  'student-tutorings': {
    title: 'Mis tutorías',
    description: 'Elige una tutoría para ver su contenido, tu asistencia, tus calificaciones y sus horarios. Desde aquí también puedes avisar a tu docente si vas a faltar.',
  },
  'student-degree-topics': {
    title: 'Mis propuestas',
    description: 'Presenta tu tema de titulación y consulta el estado de tus propuestas y las observaciones de coordinación.',
  },
  'student-degree-tracking': {
    title: 'Seguimiento',
    description: 'Consulta las tareas, avances y actividades que registran tu tutor y tus pares académicos.',
  },
  'student-degree-assignments': {
    title: 'Tutor y pares',
    description: 'Consulta el docente tutor y los pares académicos asignados a tu tema aprobado.',
  },
}

/** Devuelve el primer elemento visible entre los selectores, o el último selector si ninguno lo está. */
function firstVisible(selectors: readonly string[]): () => Element {
  return () => {
    for (const selector of selectors) {
      const element = document.querySelector(selector)
      if (element && element.getClientRects().length > 0) return element
    }
    // driver.js centra el globo cuando el elemento no tiene caja visible.
    return document.querySelector(selectors[selectors.length - 1]) ?? document.body
  }
}

const tour = (id: string) => `[data-tour="${id}"]`

/** Mismo corte que el menú lateral (`useIsMobile`): en el celular el menú se abre como panel. */
function isMobileViewport(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches
}

const headerStep = (id: string, title: string, description: string): DriveStep => ({
  element: tour(id),
  popover: { title, description, side: 'bottom', align: 'end' },
})

/**
 * Pasos del tutorial: presentación general, el menú con los módulos que tiene la
 * cuenta y las herramientas de la cabecera, en el orden en que aparecen. Recibe
 * los ids de los módulos visibles en el menú para explicar solo los que el usuario
 * puede usar. Instalar la aplicación solo se ofrece en el celular.
 */
export function buildTourSteps(moduleIds: readonly string[], userName?: string): DriveStep[] {
  const modules = moduleIds.filter((id) => id in MODULE_HELP)
  const mobile = isMobileViewport()

  return [
    {
      popover: {
        title: userName ? `¡Hola, ${userName.split(/\s+/)[0]}!` : '¡Bienvenido!',
        description: 'Este es el Sistema de Tutorías y Titulación de la Universidad Estatal de Bolívar. Te mostramos en pocos pasos dónde está cada cosa.',
      },
    },
    {
      element: firstVisible(['[data-slot="sidebar-container"]', tour('menu-trigger')]),
      popover: {
        title: 'Menú principal',
        description: modules.length > 0
          ? 'Aquí están los módulos de tu cuenta. Con el botón de la cabecera muestras u ocultas el menú.'
          : 'Aquí aparecerán los módulos de tu cuenta. Con el botón de la cabecera muestras u ocultas el menú.',
        side: 'right',
      },
    },
    ...modules.map((id): DriveStep => ({
      element: firstVisible([tour(`nav-${id}`), tour('menu-trigger')]),
      popover: { ...MODULE_HELP[id], side: 'right', align: 'start' },
    })),
    headerStep('notifications', 'Notificaciones', 'Aquí te llegan los avisos del sistema, por ejemplo cuando termina una carga masiva, un estudiante avisa una inasistencia o hay novedades en tu titulación.'),
    headerStep('theme', 'Modo claro u oscuro', 'Cambia la apariencia del sistema según tu preferencia.'),
    headerStep('accessibility', 'Accesibilidad', 'Agranda el texto, activa el alto contraste o reduce las animaciones para usar el sistema con comodidad.'),
    headerStep('user-menu', 'Tu cuenta', 'Aquí ves tu nombre, correo y rol, y cierras sesión.'),
    ...(mobile
      ? [{
          element: firstVisible([tour('install-app'), tour('menu-trigger')]),
          popover: {
            title: 'Instala la aplicación',
            description: 'Instala el sistema en tu celular para abrirlo como cualquier otra aplicación. Lo encuentras al final del menú.',
            side: 'bottom',
            align: 'start',
          },
        } satisfies DriveStep]
      : []),
    headerStep('help', '¿Necesitas ayuda?', 'Cada pantalla tiene su propia guía, que verás la primera vez que entres. Desde este botón puedes volver a abrirla, o repetir este recorrido, cuando quieras.'),
  ]
}
