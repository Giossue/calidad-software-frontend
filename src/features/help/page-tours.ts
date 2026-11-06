/**
 * Guías por pantalla. Cada clave identifica una pantalla o sub-pantalla
 * («users», «tutorings/detail», «teacher-tutorings/grades»…) y lista los
 * elementos que se explican. Un paso cuyo elemento no está en pantalla (por
 * ejemplo, la paginación con una sola página) se omite al iniciar la guía.
 */

/** Dónde está el elemento: selector CSS o botón por su texto visible. */
export type TourTarget = string | { readonly button: string } | { readonly rowActions: true }

export type PageTourStep = Readonly<{
  /** Se usa el primer destino visible. */
  target: TourTarget | readonly TourTarget[]
  title: string
  description: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}>

const HEADER = '[data-tour="page-header"]'
const CREATE = '[data-tour="page-create"]'
const BULK = '[data-tour="page-bulk-import"]'
const FILTERS = '[data-tour="page-filters"]'
const TABLE = ['[data-tour="page-table"]', '[data-slot="table-container"]']
const PAGINATION = '[data-tour="page-pagination"]'
const REFRESH = 'button[aria-label="Actualizar"]'
/** Acciones de la primera fila de la tabla. */
const ROW_ACTIONS: TourTarget = { rowActions: true }
const CAREER_BACK = '[data-tour="page-career-back"]'

const step = (target: PageTourStep['target'], title: string, description: string, side?: PageTourStep['side']): PageTourStep => ({ target, title, description, side })

const filters = (description: string) => step(FILTERS, 'Buscar y filtrar', description)
const table = (description: string) => step(TABLE, 'Listado', description, 'top')
const rowActions = (description: string) => step(ROW_ACTIONS, 'Acciones de cada fila', description, 'left')
const pagination = step(PAGINATION, 'Páginas', 'Cuando hay muchos registros, avanza o retrocede entre páginas.', 'top')
const refresh = step(REFRESH, 'Actualizar', 'Vuelve a cargar la información por si alguien más hizo cambios.')
const bulk = (description: string) => step(BULK, 'Carga masiva', `${description} Descarga la plantilla CSV, complétala y súbela; al terminar te llega una notificación con el resultado.`)

/** Selección de carrera, común a los módulos del coordinador de carrera. */
const careerPicker = (module: string): readonly PageTourStep[] => [
  step(HEADER, module, `Primero elige la carrera con la que vas a trabajar.`),
  filters('Busca la carrera por su nombre.'),
  table('Haz clic en una carrera para entrar a su información.'),
  pagination,
]

const careerBack = step(CAREER_BACK, 'Cambiar de carrera', 'Vuelve a la lista de carreras para elegir otra.')

export const PAGE_TOURS: Readonly<Record<string, readonly PageTourStep[]>> = {
  // ---------- Administración ----------
  users: [
    step(HEADER, 'Gestión de usuarios', 'Aquí administras todas las cuentas del sistema.'),
    step({ button: 'Nuevo usuario' }, 'Nuevo usuario', 'Registra una cuenta con su rol y carrera. La persona recibe una contraseña provisional por correo y la cambia al primer ingreso.'),
    bulk('Registra muchas cuentas a la vez.'),
    refresh,
    filters('Busca por nombre, correo o cédula, y filtra por rol, estado o carrera. «Pendientes de completar datos» muestra quienes aún no ingresan por primera vez.'),
    table('Cada fila es una cuenta con su rol, carrera y estado. Haz clic en ella para editar sus datos, rol, carreras o estado.'),
    rowActions('Edita los datos de la cuenta.'),
    pagination,
  ],
  periods: [
    step(HEADER, 'Períodos académicos', 'Aquí defines el calendario académico.'),
    step({ button: 'Nuevo período' }, 'Nuevo período', 'Registra un período con su nombre y fechas de inicio y fin.'),
    bulk('Registra varios períodos a la vez.'),
    refresh,
    filters('Busca un período por su nombre o filtra por estado.'),
    table('Haz clic en un período para editarlo o marcarlo como vigente. El vigente es el que usan las tutorías y la titulación; solo puede haber uno.'),
    pagination,
  ],
  faculties: [
    step(HEADER, 'Facultades', 'Aquí mantienes la estructura de facultades.'),
    step({ button: 'Nueva facultad' }, 'Nueva facultad', 'Registra una facultad nueva.'),
    bulk('Registra varias facultades a la vez.'),
    refresh,
    filters('Busca una facultad o filtra por estado.'),
    table('Haz clic en una facultad para editarla o cambiar su estado.'),
    rowActions('Consulta las carreras de la facultad.'),
    pagination,
  ],
  careers: [
    step(HEADER, 'Oferta de carreras', 'Aquí registras las carreras de cada facultad.'),
    step({ button: 'Nueva carrera' }, 'Nueva carrera', 'Registra una carrera con su facultad, modalidad y número de ciclos.'),
    bulk('Registra varias carreras a la vez.'),
    refresh,
    filters('Busca por nombre o facultad, y filtra por facultad o estado.'),
    table('Cada fila es una carrera con su facultad y estado. Haz clic en ella para editarla.'),
    rowActions('Consulta y administra los ciclos de la carrera.'),
    pagination,
  ],
  'careers/cycles': [
    step({ button: 'Volver a Carreras' }, 'Volver', 'Regresa a la lista de carreras.'),
    step(HEADER, 'Ciclos de la carrera', 'Aquí defines los ciclos o niveles de la carrera.'),
    step({ button: 'Nuevo ciclo' }, 'Nuevo ciclo', 'Agrega un ciclo a la carrera.'),
    bulk('Registra varios ciclos a la vez.'),
    filters('Busca un ciclo o filtra por estado.'),
    table('Haz clic en un ciclo para editarlo o cambiar su estado.'),
  ],

  // ---------- Coordinación de carrera ----------
  'tutoring-subjects/career-picker': careerPicker('Asignaturas'),
  'tutoring-subjects': [
    careerBack,
    step(HEADER, 'Asignaturas de la carrera', 'Aquí administras las asignaturas de cada ciclo.'),
    step(CREATE, 'Registrar asignatura', 'Agrega una asignatura indicando su ciclo.'),
    bulk('Registra varias asignaturas a la vez.'),
    filters('Busca por nombre o código y filtra por ciclo o estado.'),
    table('Cada fila es una asignatura con su ciclo y sus paralelos. Haz clic en ella para editarla.'),
    rowActions('Gestiona los paralelos de la asignatura o desactívala.'),
    pagination,
  ],
  'tutoring-teachers': [
    step(HEADER, 'Docentes', 'Aquí administras los docentes de tus carreras.'),
    step(CREATE, 'Registrar docente nuevo', 'Crea la cuenta de un docente. Recibe una contraseña provisional por correo.'),
    step({ button: 'Vincular docente existente' }, 'Vincular docente existente', 'Si el docente ya tiene cuenta (por ejemplo, en otra carrera), agrégalo a tu carrera sin crearle otra.'),
    bulk('Registra varios docentes a la vez.'),
    filters('Busca por nombre o correo y filtra por carrera o estado.'),
    table('Cada fila es un docente con sus carreras. Haz clic en él para editar sus datos.'),
    rowActions('Consulta sus carreras o desactiva al docente.'),
    pagination,
  ],
  'tutoring-students/career-picker': careerPicker('Estudiantes'),
  'tutoring-students': [
    careerBack,
    step(HEADER, 'Estudiantes de la carrera', 'Aquí registras a los estudiantes y los ubicas en su ciclo.'),
    step(CREATE, 'Nuevo estudiante', 'Registra un estudiante con su ciclo y, si quieres, inscríbelo en una tutoría.'),
    bulk('Registra muchos estudiantes a la vez. Los importados quedan en «Sin ciclo» hasta que les asignes uno.'),
    step('[aria-label="Ciclos de la carrera"]', 'Ciclos', 'Cambia de ciclo para ver a sus estudiantes. «Sin ciclo» reúne a quienes aún no tienen uno asignado.'),
    filters('Busca por nombre, cédula o correo y filtra según sus tutorías.'),
    table('Cada fila es un estudiante con las tutorías en las que está inscrito.'),
    rowActions('Gestiona las tutorías del estudiante.'),
    pagination,
  ],
  'tutorings/career-picker': careerPicker('Tutorías'),
  tutorings: [
    careerBack,
    step(HEADER, 'Tutorías de la carrera', 'Aquí organizas las tutorías de cada ciclo.'),
    step(CREATE, 'Crear tutoría', 'Elige el ciclo y la asignatura; después asigna el docente y el horario.'),
    filters('Busca por asignatura y filtra por ciclo o estado.'),
    table('Cada fila es una tutoría con su docente y paralelo. Haz clic en ella para editarla.'),
    rowActions('Consulta el horario o entra a supervisar la tutoría.'),
    pagination,
  ],
  'tutorings/detail': [
    step({ button: 'Volver a tutorías' }, 'Volver', 'Regresa a la lista de tutorías.'),
    step('[aria-label="Secciones de la tutoría"]', 'Supervisión y estudiantes', '«Supervisión» muestra la planificación y el avance de la tutoría; «Estudiantes», quiénes están inscritos.'),
    table('Información de la pestaña elegida.'),
  ],
  'tutoring-reports/career-picker': careerPicker('Informes'),
  'tutoring-reports': [
    careerBack,
    step(HEADER, 'Informes de tutorías', 'Aquí lees los informes que envían los docentes.'),
    filters('Busca por tipo, contenido, autor o asignatura y filtra por ciclo.'),
    table('Cada fila es un informe enviado por un docente. Haz clic en él para leerlo.'),
    rowActions('Abre el informe para leerlo completo.'),
    pagination,
  ],

  // ---------- Coordinación de titulación ----------
  'degree-students': [
    step(HEADER, 'Matrícula en titulación', 'Aquí matriculas a los estudiantes en titulación para el período vigente.'),
    filters('Busca por nombre, cédula o correo y filtra por estado de matrícula.'),
    table('Cada fila es un estudiante con su estado de matrícula.'),
    rowActions('Matricula al estudiante en titulación o dale de baja. Al matricularlo se le habilita el módulo de titulación.'),
    pagination,
  ],
  'degree-topics': [
    step(HEADER, 'Propuestas de titulación', 'Aquí revisas los temas que proponen los estudiantes.'),
    refresh,
    filters('Busca por título, estudiante o cédula y filtra por estado o paralelo.'),
    table('Haz clic en una propuesta para revisarla.'),
    pagination,
  ],
  'degree-topics/detail': [
    step({ button: 'Volver a propuestas' }, 'Volver', 'Regresa a la lista de propuestas.'),
    step(HEADER, 'Propuesta', 'Título, estudiante y estado de la propuesta.'),
    step({ button: 'Aprobar propuesta' }, 'Aprobar', 'Aprueba el tema y asigna el docente tutor y los pares académicos.'),
    step({ button: 'Rechazar propuesta' }, 'Rechazar', 'Rechaza el tema indicando el motivo; el estudiante podrá proponer otro.'),
    step({ button: 'Gestionar pares académicos' }, 'Pares académicos', 'Cambia los docentes que revisan la propuesta.'),
    step({ button: 'Registrar observación' }, 'Observaciones', 'Deja una observación al estudiante; le llega una notificación.'),
  ],
  'degree-tracking': [
    step(HEADER, 'Seguimiento de titulación', 'Aquí supervisas el avance de los temas aprobados.'),
    filters('Busca por título del tema, estudiante o cédula.'),
    table('Haz clic en un tema para ver su ficha de seguimiento.'),
    pagination,
  ],
  'degree-tracking/detail': [
    step({ button: 'Generar Informe' }, 'Generar informe', 'Registra las observaciones y el dictamen sobre la evolución del tema.'),
    step({ button: 'Nueva actividad' }, 'Nueva actividad', 'Define un hito o entregable para la ficha de seguimiento.'),
    table('Cronograma de actividades del estudiante y su estado.'),
  ],
  'degree-reports': [
    step(HEADER, 'Reportes de titulación', 'Aquí consultas los informes de seguimiento emitidos.'),
    filters('Busca por tema, estudiante o palabras clave.'),
    table('Haz clic en un informe para verlo e imprimirlo.'),
    pagination,
  ],

  // ---------- Docente ----------
  'teacher-tutorings': [
    step(HEADER, 'Mis tutorías', 'Aquí están las tutorías que tienes asignadas.'),
    filters('Busca por asignatura y filtra por estado.'),
    table('Haz clic en una tutoría para gestionar sus estudiantes, contenido, asistencia, calificaciones y horarios.'),
    pagination,
  ],
  'teacher-tutorings/students': [
    step('[aria-label="Secciones de la tutoría"]', 'Secciones de la tutoría', 'Cambia entre estudiantes, contenido, asistencia, calificaciones y horarios. Cada pestaña tiene su propia guía.'),
    filters('Busca por nombre, cédula o correo y filtra por estado.'),
    step({ button: 'Registrar estudiante' }, 'Registrar estudiante', 'Inscribe a un estudiante de tu paralelo o registra uno nuevo; si es nuevo, recibe una contraseña provisional por correo.'),
    table('Estudiantes inscritos en la tutoría.'),
    rowActions('Añade notas sobre el estudiante, deshabilita su inscripción o reinscríbelo.'),
    pagination,
  ],
  'teacher-tutorings/content': [
    filters('Busca un tema y filtra por estado.'),
    step({ button: 'Registrar tema' }, 'Registrar tema', 'Planifica los temas de la tutoría y adjunta recursos (PDF, Word, PowerPoint, Excel) para tus estudiantes. Dentro de cada tema registras sus actividades y metodologías.'),
    table('Temas de la tutoría y sus recursos. Haz clic en uno para editarlo o adjuntarle archivos.'),
    rowActions('Entra a las actividades del tema; dentro de cada actividad están sus metodologías.'),
  ],
  'teacher-tutorings/attendance': [
    step('[aria-label="Secciones de asistencia"]', 'Consultar o registrar', '«Consultar» muestra las sesiones ya registradas; «Registrar» abre la toma de asistencia.'),
    step({ button: 'Registrar asistencia' }, 'Registrar asistencia', 'Toma lista de una sesión y marca los temas que se trabajaron.'),
    table('Sesiones registradas con su fecha y asistentes. Los avisos de inasistencia de los estudiantes aparecen al tomar lista.'),
  ],
  'teacher-tutorings/grades': [
    step('[aria-label="Etapa de calificación"]', 'Etapa de calificación', 'Elige qué nota vas a ingresar. Cada etapa indica si está completa o pendiente.'),
    table('Escribe las notas en la tabla, de 0 a la nota máxima y con hasta dos decimales.'),
  ],
  'teacher-tutorings/schedules': [
    step({ button: 'Editar horarios' }, 'Editar horarios', 'Configura los días y horas en que se dicta la tutoría.'),
    table('Horarios actuales de la tutoría.'),
  ],
  'teacher-reports': [
    step(HEADER, 'Informes', 'Aquí preparas los informes de tus tutorías.'),
    step('ul button[aria-label^="Ver informes de"]', 'Elige una tutoría', 'Entra a la tutoría para ver o enviar sus informes.'),
  ],
  'teacher-reports/tutoring': [
    step({ button: 'Elegir otra tutoría' }, 'Cambiar de tutoría', 'Vuelve a la lista de tutorías.'),
    step('[aria-label="Secciones de informes"]', 'Informes y actividades', '«Informes enviados» lista lo que ya enviaste; «Revisión de actividades» resume lo trabajado en la tutoría.'),
    step({ button: 'Reportes oficiales' }, 'Reportes oficiales', 'Genera la evaluación diagnóstica, el seguimiento o el informe final PAO en el formato institucional.'),
    step({ button: 'Enviar informe' }, 'Enviar informe', 'Envía un informe al Coordinador de Carrera.'),
    table('Informes enviados.'),
  ],
  'teacher-degree-assignments': [
    step(HEADER, 'Mis asignaciones de titulación', 'Aquí ves los temas donde eres tutor o par académico.'),
    filters('Busca un tema o estudiante y filtra por tu participación.'),
    table('Haz clic en un tema para ver su detalle.'),
    pagination,
  ],
  'teacher-degree-tracking': [
    step(HEADER, 'Seguimiento', 'Aquí supervisas el avance de los estudiantes que tienes asignados.'),
    filters('Busca un tema o estudiante y filtra por tu participación.'),
    table('Haz clic en un tema para abrir su ficha. Sus secciones aparecen en el menú lateral, bajo «Seguimiento».'),
    pagination,
  ],
  'teacher-degree-tracking/estado-ficha': [
    step('[data-slot="sidebar-container"] [data-slot="sidebar-menu-sub"]', 'Secciones de la ficha', 'Cambia entre el estado de la ficha, el equipo de titulación y las tareas.', 'right'),
    step(HEADER, 'Estado de la ficha', 'Resumen del avance acumulado del tema y su estado general.'),
  ],
  'teacher-degree-tracking/equipo-titulacion': [
    step(HEADER, 'Equipo de titulación', 'Estudiante, tutor y pares académicos del tema.'),
  ],
  'teacher-degree-tracking/tareas': [
    step({ button: 'Asignar tarea' }, 'Asignar tarea', 'Asigna una tarea o avance al estudiante.'),
    filters('Filtra las tareas por estado.'),
    table('Tareas del tema con quién las asignó y su estado.'),
  ],

  // ---------- Estudiante ----------
  'student-tutorings': [
    step(HEADER, 'Mis tutorías', 'Aquí están las tutorías en las que estás inscrito.'),
    filters('Busca por asignatura, ciclo o docente y filtra por estado.'),
    table('Haz clic en una tutoría para ver su contenido, tu asistencia, tus calificaciones y sus horarios.'),
    pagination,
  ],
  'student-tutorings/content': [
    step('[aria-label="Secciones de la tutoría"]', 'Secciones de la tutoría', 'Cambia entre contenido, asistencia, calificaciones y horarios. Cada pestaña tiene su propia guía.'),
    table('Temas, actividades y metodologías que publica tu docente. Abre un tema para ver sus detalles y descargar sus recursos.'),
  ],
  'student-tutorings/attendance': [
    table('Tu récord de asistencia por sesión.'),
    step({ button: 'Avisar inasistencia' }, 'Avisar inasistencia', 'Si vas a faltar, avisa a tu docente; lo verá al tomar lista.'),
  ],
  'student-tutorings/grades': [
    table('Tus calificaciones en la tutoría, a medida que tu docente las registra.'),
  ],
  'student-tutorings/schedules': [
    table('Días y horarios de las sesiones de tutoría.'),
  ],
  'student-degree-topics': [
    step(HEADER, 'Mis propuestas', 'Aquí presentas tu tema de titulación y sigues su estado.'),
    step([{ button: 'Nueva propuesta' }, { button: 'Proponer alternativa' }], 'Proponer un tema', 'Presenta tu tema. Si fue rechazado, puedes proponer una alternativa.'),
    step({ button: 'Editar' }, 'Editar propuesta', 'Corrige tu propuesta mientras está en revisión.'),
  ],
  'student-degree-tracking': [
    step(HEADER, 'Seguimiento', 'Aquí ves el avance de tu trabajo de titulación.'),
    step('[aria-label="Pestañas de seguimiento"]', 'Secciones', 'Cambia entre el estado de tu ficha, tu equipo de titulación y tus tareas.'),
  ],
  'student-degree-assignments': [
    step(HEADER, 'Tutor y pares', 'Aquí ves el docente tutor y los pares académicos de tu tema aprobado, con sus datos de contacto.'),
  ],
}
