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

/**
 * Pasos del tutorial: presentación general, el menú con los módulos que tiene la
 * cuenta y las herramientas de la cabecera. Recibe los ids de los módulos visibles
 * en el menú para explicar solo los que el usuario puede usar.
 */
export function buildTourSteps(moduleIds: readonly string[], userName?: string): DriveStep[] {
  const modules = moduleIds.filter((id) => id in MODULE_HELP)

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
          ? 'Aquí están los módulos de tu cuenta. En el celular, ábrelo con este botón.'
          : 'Aquí aparecerán los módulos de tu cuenta. En el celular, ábrelo con este botón.',
        side: 'right',
      },
    },
    ...modules.map((id): DriveStep => ({
      element: firstVisible([tour(`nav-${id}`), tour('menu-trigger')]),
      popover: { ...MODULE_HELP[id], side: 'right', align: 'start' },
    })),
    {
      element: tour('breadcrumb'),
      popover: {
        title: '¿Dónde estoy?',
        description: 'Aquí ves tu rol y el módulo en el que te encuentras.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: tour('notifications'),
      popover: {
        title: 'Notificaciones',
        description: 'Aquí te llegan los avisos del sistema, por ejemplo cuando termina una carga masiva, un estudiante avisa una inasistencia o hay novedades en tu titulación.',
        side: 'bottom',
        align: 'end',
      },
    },
    {
      element: tour('theme'),
      popover: {
        title: 'Modo claro u oscuro',
        description: 'Cambia la apariencia del sistema según tu preferencia.',
        side: 'bottom',
        align: 'end',
      },
    },
    {
      element: tour('user-menu'),
      popover: {
        title: 'Tu cuenta',
        description: 'Aquí ves tu nombre, correo y rol, y cierras sesión.',
        side: 'bottom',
        align: 'end',
      },
    },
    {
      element: tour('accessibility'),
      popover: {
        title: 'Accesibilidad',
        description: 'Agranda el texto, activa el alto contraste o reduce las animaciones para usar el sistema con comodidad.',
        side: 'left',
        align: 'end',
      },
    },
    {
      element: firstVisible([tour('install-app'), tour('menu-trigger')]),
      popover: {
        title: 'Instala la aplicación',
        description: 'Puedes instalar el sistema en tu computadora o celular para abrirlo como cualquier otra aplicación.',
        side: 'right',
        align: 'end',
      },
    },
    {
      element: tour('help'),
      popover: {
        title: '¿Necesitas ayuda?',
        description: 'Vuelve a ver este recorrido cuando quieras desde el botón de ayuda.',
        side: 'bottom',
        align: 'end',
      },
    },
  ]
}
