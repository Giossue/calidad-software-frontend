/**
 * Guías por pantalla. Cada clave identifica una pantalla o sub-pantalla
 * («users», «tutorings/detail», «teacher-tutorings/content/topic»…) y lista los
 * elementos que se explican. Un paso cuyo elemento no está en pantalla (por
 * ejemplo, la paginación con una sola página) se omite al iniciar la guía.
 */

/** Dónde está el elemento: selector CSS, botón por su texto o nombre accesible, o acciones de la primera fila. */
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
const CAREER_BACK = '[data-tour="page-career-back"]'

const step = (target: PageTourStep['target'], title: string, description: string, side?: PageTourStep['side']): PageTourStep => ({ target, title, description, side })

const filters = (description: string) => step(FILTERS, 'Buscar y filtrar', description)
const table = (description: string) => step(TABLE, 'Listado', description, 'top')
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

/** Botón «Volver a …» de una pantalla de detalle. */
const back = (label: string, description: string) => step({ button: label }, 'Volver', description)
/** Activar o desactivar desde la cabecera de un detalle (botones de solo ícono). */
const toggle = (noun: string, description: string) => step([{ button: `Desactivar ${noun}` }, { button: `Habilitar ${noun}` }], 'Cambiar estado', description)
/** Pestañas de «Usuarios» del coordinador de carrera. */
const usersTabs = step('[data-tour="page-users-tabs"]', 'Docentes y estudiantes', 'Cambia entre los docentes y los estudiantes de tus carreras. Cada pestaña tiene su propia guía.')
const studentTutoringTabs = step('[aria-label="Secciones de la tutoría"]', 'Secciones de la tutoría', 'Cambia entre contenido, asistencia, calificaciones y horarios. Cada pestaña tiene su propia guía.')

export const PAGE_TOURS: Readonly<Record<string, readonly PageTourStep[]>> = {
  // ---------- Administración ----------
  users: [
    step(HEADER, 'Gestión de usuarios', 'Aquí administras todas las cuentas del sistema.'),
    step({ button: 'Nuevo usuario' }, 'Nuevo usuario', 'Registra una cuenta en dos pasos: datos personales, y rol y carrera. La persona recibe una contraseña provisional por correo y la cambia al primer ingreso.'),
    bulk('Registra muchas cuentas a la vez.'),
    refresh,
    filters('Busca por nombre, correo o cédula, y filtra por rol, estado o carrera. «Pendientes de completar datos» muestra quienes aún no ingresan por primera vez.'),
    table('Haz clic en una cuenta para editar sus datos, rol o carreras, o para habilitarla o desactivarla.'),
    pagination,
  ],
  periods: [
    step(HEADER, 'Períodos académicos', 'Aquí defines el calendario académico.'),
    step({ button: 'Nuevo período' }, 'Nuevo período', 'Registra un período con su nombre y fechas de inicio y fin.'),
    bulk('Registra varios períodos a la vez.'),
    refresh,
    filters('Busca un período por su nombre o filtra por estado.'),
    table('Haz clic en un período para editarlo o habilitarlo como vigente. El vigente es el que usan las tutorías y la titulación; solo puede haber uno.'),
    pagination,
  ],
  faculties: [
    step(HEADER, 'Facultades', 'Aquí mantienes la estructura de facultades.'),
    step({ button: 'Nueva facultad' }, 'Nueva facultad', 'Registra una facultad nueva.'),
    bulk('Registra varias facultades a la vez.'),
    refresh,
    filters('Busca una facultad o filtra por estado.'),
    table('Haz clic en una facultad para abrirla.'),
    pagination,
  ],
  careers: [
    step(HEADER, 'Oferta de carreras', 'Aquí registras las carreras de cada facultad.'),
    step({ button: 'Nueva carrera' }, 'Nueva carrera', 'Registra una carrera con su facultad, modalidad y número de ciclos.'),
    bulk('Registra varias carreras a la vez.'),
    refresh,
    filters('Busca por nombre y filtra por facultad o estado.'),
    table('Haz clic en una carrera para abrirla.'),
    pagination,
  ],
  'faculties/detail': [
    back('Volver a facultades', 'Regresa a la lista de facultades.'),
    step(HEADER, 'Facultad', 'Su nombre, sus carreras y su estado.'),
    step({ button: 'Editar facultad' }, 'Editar facultad', 'Cambia el nombre de la facultad.'),
    toggle('facultad', 'Habilita o desactiva la facultad. Para desactivarla, primero desactiva sus carreras.'),
    step({ button: 'Administrar carreras' }, 'Administrar carreras', 'Abre la oferta de carreras filtrada por esta facultad.'),
    table('Carreras de la facultad.'),
  ],
  'careers/detail': [
    back('Volver a carreras', 'Regresa a la lista de carreras.'),
    step(HEADER, 'Carrera', 'Su facultad, modalidad y estado.'),
    step({ button: 'Editar carrera' }, 'Editar carrera', 'Cambia el nombre, la facultad, la modalidad o el número de ciclos.'),
    toggle('carrera', 'Habilita o desactiva la carrera.'),
    step('[aria-label="Secciones de la carrera"]', 'Ciclos y datos', '«Ciclos» muestra los ciclos o niveles de la carrera; «Datos», su información.'),
    step({ button: 'Nuevo ciclo' }, 'Nuevo ciclo', 'Agrega un ciclo a la carrera.'),
    bulk('Registra varios ciclos a la vez.'),
    filters('Busca un ciclo o filtra por estado.'),
    table('Haz clic en un ciclo para editarlo o cambiar su estado.'),
  ],

  // ---------- Coordinación de carrera ----------
  'tutoring-curriculum/career-picker': careerPicker('Malla curricular'),
  'tutoring-curriculum': [
    careerBack,
    step(HEADER, 'Malla curricular', 'La malla de la carrera como en la malla oficial: un carril por ciclo y las previas como flechas. Aquí la administras.'),
    step('[data-tour="curriculum-import"]', 'Importar malla', 'Sube la malla en Excel, CSV o PDF, revisa y corrige cada asignatura e impórtala: se crean las asignaturas con su ciclo y sus previas.'),
    step('[data-tour="curriculum-edit"]', 'Editar malla', 'Abre la malla a pantalla completa para agregar asignaturas en cada ciclo, editarlas y conectar sus previas.'),
    filters('Busca por nombre o código; elige «Inactivas» para ver las asignaturas desactivadas.'),
    step('[data-tour="curriculum-canvas"]', 'Malla', 'Cada flecha va de una previa a la asignatura que la requiere. Usa los controles de zoom o la leyenda de arriba y haz clic en una asignatura para abrirla.'),
  ],
  'tutoring-curriculum/editor': [
    step('[data-tour="curriculum-back"]', 'Volver a la vista', 'Termina de editar y regresa a la vista de la malla.'),
    step('[data-tour="curriculum-add"]', 'Agregar asignatura', 'Registra una asignatura directamente en ese ciclo.'),
    step('[data-tour="curriculum-canvas"]', 'Conectar previas', 'Arrastra desde el círculo verde de una asignatura hasta otra de un ciclo posterior para conectar su previa; pulsa una flecha para quitarla. El menú «⋯» de cada asignatura también la edita, conecta previas o la desactiva.'),
  ],
  'tutoring-curriculum/detail': [
    back('Volver a la malla', 'Regresa a la malla curricular.'),
    step(HEADER, 'Asignatura', 'Su código, ciclo y estado.'),
    step({ button: 'Editar asignatura' }, 'Editar asignatura', 'Cambia el nombre, el código o la modalidad.'),
    step({ button: 'Desactivar asignatura' }, 'Desactivar asignatura', 'Deja de ofrecer la asignatura.'),
    step('[aria-label="Secciones de la asignatura"]', 'Paralelos, malla y datos', '«Paralelos» asigna o quita paralelos; «Malla» muestra de cuál viene y en cuál continúa, y permite editar la secuencia; «Datos», su información.'),
  ],
  // «Usuarios»: una guía por pestaña (`?pestana=`) y por vista dentro de ella.
  'tutoring-users/docentes': [
    step(HEADER, 'Docentes', 'Aquí administras los docentes de tus carreras.'),
    usersTabs,
    step(CREATE, 'Registrar docente nuevo', 'Crea la cuenta de un docente. Recibe una contraseña provisional por correo.'),
    step({ button: 'Vincular docente existente' }, 'Vincular docente existente', 'Si el docente ya tiene cuenta (por ejemplo, en otra carrera), agrégalo a tu carrera sin crearle otra.'),
    bulk('Registra varios docentes a la vez.'),
    filters('Busca por nombre o correo y filtra por carrera o estado.'),
    table('Cada fila es un docente con sus asignaturas y paralelos. Haz clic en él para abrirlo.'),
    pagination,
  ],
  'tutoring-users/docentes/detail': [
    back('Volver a docentes', 'Regresa a la lista de docentes.'),
    step(HEADER, 'Docente', 'Su nombre, correo y estado.'),
    step({ button: 'Editar docente' }, 'Editar docente', 'Cambia los datos del docente.'),
    step('[aria-label="Secciones del docente"]', 'Asignaturas y datos', '«Asignaturas» muestra sus tutorías en tus carreras; «Datos», su cédula, correo y teléfono.'),
  ],
  // Las pestañas van bajo el encabezado de la lista de carreras.
  'tutoring-users/estudiantes/career-picker': ((steps) => [steps[0], usersTabs, ...steps.slice(1)])(careerPicker('Estudiantes')),
  'tutoring-users/estudiantes': [
    careerBack,
    step(HEADER, 'Estudiantes de la carrera', 'Aquí registras a los estudiantes y los ubicas en su ciclo.'),
    usersTabs,
    step(CREATE, 'Registrar estudiante', 'Registra un estudiante con su ciclo y, si quieres, inscríbelo en una tutoría.'),
    bulk('Registra muchos estudiantes a la vez. Los importados quedan en «Sin ciclo» hasta que les asignes uno.'),
    step('[aria-label="Ciclos de la carrera"]', 'Ciclo', 'Elige el ciclo cuyos estudiantes quieres ver. «Sin ciclo» reúne a quienes aún no tienen uno asignado.'),
    filters('Busca por nombre, cédula o correo y filtra según sus tutorías.'),
    table('Cada fila es un estudiante con sus tutorías. Haz clic en él para abrirlo; en el ciclo de titulación, desde ahí lo matriculas, le das de baja o lo cambias de ciclo.'),
    pagination,
  ],
  'tutoring-users/estudiantes/detail': [
    back('Volver a estudiantes', 'Regresa a la lista de estudiantes.'),
    step(HEADER, 'Estudiante', 'Su ciclo y su estado.'),
    step([{ button: 'Cambiar ciclo' }, { button: 'Asignar ciclo' }], 'Ciclo del estudiante', 'Asigna o cambia el ciclo que cursa.'),
    step('[aria-label="Secciones del estudiante"]', 'Tutorías y datos', '«Tutorías» muestra en cuáles está inscrito y permite inscribirlo en otra; «Datos», su información de contacto.'),
    step([{ button: 'Matricular en titulación' }, { button: 'Dar de baja de titulación' }], 'Matrícula en titulación', 'En el ciclo de titulación, matricula al estudiante en el período vigente o dale de baja.'),
  ],
  'tutorings/career-picker': careerPicker('Tutorías'),
  tutorings: [
    careerBack,
    step(HEADER, 'Tutorías de la carrera', 'Aquí organizas las tutorías de cada ciclo.'),
    step(CREATE, 'Crear tutoría', 'Elige el ciclo y la asignatura; después asigna el docente y el horario.'),
    step('[data-tour="tutorings-roster-import"]', 'Cargar listado PDF', 'Sube el listado de una asignatura que descargas del sistema académico. Antes de cargar ves qué se hará; al confirmar se crea la tutoría si no existe, se asigna el docente y se registran e inscriben sus estudiantes.'),
    filters('Busca por asignatura y filtra por ciclo o estado.'),
    table('Cada fila es una tutoría con su docente y paralelo. Haz clic en ella para abrirla.'),
    pagination,
  ],
  'tutorings/detail': [
    back('Volver a tutorías', 'Regresa a la lista de tutorías.'),
    step(HEADER, 'Tutoría', 'Su ciclo, paralelo, modalidad, período y estado.'),
    step({ button: 'Editar tutoría' }, 'Editar tutoría', 'Cambia el docente, el horario o el paralelo, o activa la tutoría si está inactiva.'),
    step('[aria-label="Secciones de la tutoría"]', 'Resumen, supervisión y estudiantes', '«Resumen» muestra el docente y el horario; «Supervisión», las sesiones con su asistencia; «Estudiantes», quiénes están inscritos.'),
  ],
  'tutoring-reports/career-picker': careerPicker('Informes'),
  'tutoring-reports': [
    careerBack,
    step(HEADER, 'Informes de tutorías', 'Aquí lees los informes que envían los docentes.'),
    filters('Busca por tipo, contenido, autor o asignatura y filtra por ciclo.'),
    table('Cada fila es un informe enviado por un docente. Haz clic en él para leerlo.'),
    pagination,
  ],

  // ---------- Coordinación de titulación ----------
  'degree-students': [
    step(HEADER, 'Matrícula en titulación', 'Aquí matriculas a los estudiantes en titulación para el período vigente.'),
    filters('Busca por nombre, cédula o correo y filtra por estado de matrícula.'),
    table('Haz clic en un estudiante para matricularlo en titulación o darle de baja. Al matricularlo se le habilita el módulo de titulación.'),
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
    back('Volver a propuestas', 'Regresa a la lista de propuestas.'),
    step(HEADER, 'Propuesta', 'Título, estudiante y estado de la propuesta.'),
    step({ button: 'Aprobar propuesta' }, 'Aprobar', 'Aprueba el tema y asigna el docente tutor y los pares académicos.'),
    step({ button: 'Rechazar propuesta' }, 'Rechazar', 'Rechaza el tema indicando el motivo; el estudiante podrá proponer otro.'),
    step({ button: 'Gestionar pares académicos' }, 'Pares académicos', 'Cambia los docentes que revisan la propuesta.'),
    step({ button: 'Registrar observación' }, 'Observaciones', 'Deja una observación al estudiante; le llega una notificación.'),
    step('[aria-label="Secciones de la propuesta"]', 'Propuesta, docentes y observaciones', '«Propuesta» muestra la descripción y los datos del estudiante; «Docentes», el tutor y los pares; «Observaciones», lo que se le ha indicado.'),
  ],
  'degree-tracking': [
    step(HEADER, 'Seguimiento de titulación', 'Aquí supervisas el avance de los temas aprobados.'),
    filters('Busca por título del tema, estudiante o cédula.'),
    table('Haz clic en un tema para ver su ficha de seguimiento.'),
    pagination,
  ],
  'degree-tracking/detail': [
    back('Volver a seguimiento', 'Regresa a la lista de temas.'),
    step({ button: 'Generar informe' }, 'Generar informe', 'Registra las observaciones y el dictamen sobre la evolución del tema.'),
    step({ button: 'Nueva actividad' }, 'Nueva actividad', 'Define un hito o entregable para la ficha de seguimiento.'),
    step('[aria-label="Avance del tema"]', 'Avance', 'Porcentaje de actividades completadas del tema.'),
    table('Cronograma de actividades. Marca «Completada» cuando el estudiante cumpla una actividad.'),
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
    table('Haz clic en una tutoría para gestionar su asistencia, contenido, horarios, estudiantes y calificaciones.'),
    pagination,
  ],
  'teacher-tutorings/attendance': [
    step('[aria-label="Secciones de la tutoría"]', 'Secciones de la tutoría', 'Cambia entre asistencia, contenido, horarios, estudiantes y calificaciones. Cada pestaña tiene su propia guía.'),
    step({ button: 'Registrar asistencia' }, 'Registrar asistencia', 'Toma lista de la clase de hoy. Se habilita solo durante el horario de la clase.'),
    table('Sesiones registradas con su fecha y asistencia. Haz clic en una para consultarla.'),
  ],
  'teacher-tutorings/attendance/register': [
    step([{ button: 'Marcar todos' }, { button: 'Desmarcar todos' }], 'Marcar todos', 'Marca a todos como presentes y luego corrige a quienes faltaron.'),
    table('Haz clic en un estudiante para marcarlo presente o ausente. Los avisos de inasistencia aparecen junto a su nombre.'),
    step({ button: 'Guardar asistencia' }, 'Guardar asistencia', 'Guarda la lista. Mientras dure la clase puedes corregirla; después queda cerrada.'),
    step({ button: 'Volver a las sesiones' }, 'Volver', 'Regresa a la lista de sesiones.'),
  ],
  'teacher-tutorings/attendance/session': [
    step({ button: 'Volver a las sesiones' }, 'Volver', 'Regresa a la lista de sesiones.'),
    table('Asistencia registrada en esta sesión. Es un registro histórico: solo consulta.'),
  ],
  'teacher-tutorings/content': [
    filters('Busca un tema, elige una sesión para ver lo que se trabajó en ella y filtra por estado.'),
    step({ button: 'Asignar temas a esta sesión' }, 'Asignar temas a la sesión', 'Marca los temas que trataste en la sesión elegida.'),
    step({ button: 'Registrar tema' }, 'Registrar tema', 'Planifica los temas de la tutoría y adjunta recursos (PDF, Word, PowerPoint, Excel) para tus estudiantes.'),
    table('Temas de la tutoría con sus recursos. Haz clic en uno para abrirlo y registrar sus actividades.'),
  ],
  'teacher-tutorings/content/topic': [
    step({ button: 'Temas' }, 'Volver', 'Regresa a la lista de temas.'),
    step({ button: 'Editar tema' }, 'Editar tema', 'Cambia el nombre o los recursos del tema.'),
    step({ button: 'Registrar actividad' }, 'Registrar actividad', 'Agrega una actividad del tema con su duración.'),
    table('Actividades del tema. Haz clic en una para registrar sus metodologías.'),
  ],
  'teacher-tutorings/content/activity': [
    step({ button: 'Actividades' }, 'Volver', 'Regresa a las actividades del tema.'),
    step({ button: 'Editar actividad' }, 'Editar actividad', 'Cambia el nombre o la duración de la actividad.'),
    step({ button: 'Registrar metodología' }, 'Registrar metodología', 'Describe cómo trabajas la actividad con tus estudiantes.'),
    table('Metodologías de la actividad. Haz clic en una para editarla.'),
  ],
  'teacher-tutorings/schedules': [
    step({ button: 'Editar horarios' }, 'Editar horarios', 'Configura los días y horas en que se dicta la tutoría. Sin horario no se puede tomar asistencia.'),
    table('Horarios actuales de la tutoría.'),
  ],
  'teacher-tutorings/students': [
    filters('Busca por nombre, cédula o correo y filtra por estado.'),
    step({ button: 'Registrar estudiante' }, 'Registrar estudiante', 'Inscribe a un estudiante de tu paralelo o registra uno nuevo; si es nuevo, recibe una contraseña provisional por correo.'),
    table('Estudiantes inscritos. Al cerrar el ciclo, elige en «Resultado final» si aprobó o reprobó: quien aprueba pasa a la tutoría de la asignatura siguiente. Haz clic en un estudiante para añadir sus notas o deshabilitar su inscripción; si está deshabilitado, para reinscribirlo.'),
    pagination,
  ],
  'teacher-tutorings/grades': [
    step('[aria-label="Etapa de calificación"]', 'Etapa de calificación', 'Elige qué nota vas a ingresar. Cada etapa indica si está completa o pendiente.'),
    table('Escribe las notas en la tabla, de 0 a la nota máxima y con hasta dos decimales.'),
  ],
  'teacher-reports': [
    step(HEADER, 'Informes', 'Aquí preparas los informes de tus tutorías.'),
    table('Haz clic en una tutoría para ver o enviar sus informes.'),
  ],
  'teacher-reports/tutoring': [
    step({ button: 'Elegir otra tutoría' }, 'Cambiar de tutoría', 'Vuelve a la lista de tutorías.'),
    step('[aria-label="Secciones de informes"]', 'Informes y actividades', '«Informes enviados» lista lo que ya enviaste; «Revisión de actividades» resume lo trabajado en cada sesión.'),
    step({ button: 'Reportes oficiales' }, 'Reportes oficiales', 'Genera el reporte de evaluación diagnóstica, las calificaciones diagnósticas, el seguimiento de tutorías o el informe final PAO en el formato institucional.'),
    table('Informes enviados. Haz clic en uno para leerlo.'),
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
    step({ button: 'Volver a mis temas' }, 'Volver', 'Regresa a la lista de temas.'),
    step('[data-slot="sidebar-container"] [data-slot="sidebar-menu-sub"]', 'Secciones de la ficha', 'Cambia entre el estado de la ficha, el equipo de titulación y las tareas.', 'right'),
    step(HEADER, 'Tema', 'El tema, el estudiante y tu participación.'),
    step('[aria-label="Progreso general"]', 'Estado de la ficha', 'Avance acumulado del tema según las tareas completadas.'),
  ],
  'teacher-degree-tracking/equipo-titulacion': [
    step('section[aria-label="Equipo de Titulación"]', 'Equipo de titulación', 'Estudiante, tutor y pares académicos del tema, con su correo.'),
  ],
  'teacher-degree-tracking/tareas': [
    step({ button: 'Asignar tarea' }, 'Asignar tarea', 'Asigna una tarea o avance al estudiante.'),
    filters('Busca por tarea o docente y filtra por estado.'),
    table('Tareas del tema con quién las asignó y su estado. Solo puedes marcar como completada una tarea que registraste tú.'),
  ],

  // ---------- Estudiante ----------
  'student-tutorings': [
    step(HEADER, 'Mis tutorías', 'Aquí están las tutorías en las que estás inscrito.'),
    filters('Busca por asignatura, ciclo o docente y filtra por estado.'),
    table('Haz clic en una tutoría para ver su contenido, tu asistencia, tus calificaciones y sus horarios.'),
    pagination,
  ],
  'student-tutorings/content': [
    back('Volver a mis tutorías', 'Regresa a la lista de tus tutorías.'),
    step(HEADER, 'Tutoría', 'Ciclo, paralelo y docente de la tutoría.'),
    studentTutoringTabs,
    step('[aria-label="Avance de temas"]', 'Avance', 'Cuántos temas ya se trabajaron en clase.'),
    step('button[aria-label^="Ver detalle de"]', 'Temas', 'Abre un tema para ver sus actividades y metodologías y descargar sus recursos.'),
  ],
  'student-tutorings/attendance': [
    step('[aria-label="Porcentaje de asistencia"]', 'Tu asistencia', 'Porcentaje de sesiones a las que asististe.'),
    step({ button: 'Ver avisos' }, 'Tus avisos', 'Consulta los avisos que enviaste y lo que registró tu docente.'),
    step({ button: 'Avisar inasistencia' }, 'Avisar inasistencia', 'Si vas a faltar, elige la clase y avisa a tu docente; lo verá al tomar lista.'),
    table('Tu asistencia en cada sesión.'),
  ],
  'student-tutorings/grades': [
    step('[aria-label="Diagnóstico"]', 'Tus calificaciones', 'Diagnóstico, Parcial 1 y Parcial 2 aparecen a medida que tu docente los registra. Tu grupo de conocimiento sale de la nota diagnóstica.', 'top'),
  ],
  'student-tutorings/schedules': [
    step('section[aria-label="Horario de clases"]', 'Horario', 'Días, horas y aula de cada sesión.'),
    step('[aria-label="Docente"]', 'Docente', 'Datos de contacto de tu docente.'),
  ],
  'student-degree-topics': [
    step(HEADER, 'Mis propuestas', 'Aquí presentas tu tema de titulación y sigues su estado.'),
    step([{ button: 'Nueva propuesta' }, { button: 'Proponer alternativa' }], 'Proponer un tema', 'Presenta tu tema. Si fue rechazado, puedes proponer una alternativa.'),
    step('[role="article"]', 'Tu propuesta', 'Su estado, la revisión, los docentes asignados y las observaciones de coordinación.'),
    step({ button: 'Cambiar propuesta' }, 'Cambiar propuesta', 'Corrige tu propuesta mientras está en revisión.'),
  ],
  'student-degree-tracking': [
    step(HEADER, 'Seguimiento', 'Aquí ves el avance de tu trabajo de titulación.'),
    step('[aria-label="Pestañas de seguimiento"]', 'Secciones', 'Cambia entre el estado de tu ficha, tu equipo de titulación y tus tareas.'),
  ],
  'student-degree-assignments': [
    step(HEADER, 'Tutor y pares', 'Aquí ves el docente tutor y los pares académicos de tu tema aprobado.'),
    step('[role="region"]', 'Tu equipo', 'Datos de contacto del tutor y de cada par académico.'),
  ],
}
