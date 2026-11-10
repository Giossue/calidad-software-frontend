# Convenciones de interfaz

La interfaz sigue el sistema visual y de feedback del sistema de sílabos de la UEB.
Objetivo: pantallas sobrias, fáciles de entender a la primera, y que siempre digan qué
está pasando. Si una pantalla nueva no encaja en estas reglas, se cambia la regla aquí,
no se improvisa en la pantalla.

## Sistema visual

Referencia: `proyecto-grado-silabos-backend/proyecto-grado-silabos-frontend`
(`src/styles.css` y `src/components/ui`). Los valores se copian tal cual; si cambian
allá, se copian aquí.

- **Colores.** Azul institucional `#122c41` (`primary`, `button-primary`, menú lateral),
  fondo `#f5f6f8`, campos `bg-field`, bordes `#dbe3ec`. Usa siempre tokens
  (`bg-muted`, `text-muted-foreground`, `text-destructive`, `text-success`,
  `text-warning`, `border-border`); nunca colores crudos de Tailwind.
- **Tipografía.** Una sola fuente: Inter (variable). Título de pantalla
  `text-2xl font-semibold tracking-tight`; descripción `text-muted-foreground`;
  títulos de sección `text-xl font-semibold tracking-tight`.
- **Radio, bordes y sombras.** Botones, campos, tarjetas, tablas, menús y modales
  `rounded-md`. Las superficies usan `ring-1 ring-surface-ring` (no `border`) con
  `shadow-surface` (tarjetas, tablas), `shadow-menu` (menús, selects) o `shadow-modal`.
  Los campos llevan `border-border bg-field shadow-control`. Las sombras son azuladas.
- **Menú lateral.** Azul `#122c41` con texto blanco y el logo horizontal de la UEB
  (`src/assets/logo-ueb-horizontal.webp`; contraído, `logo-ueb-sidebar.png`).
- **Cabecera.** Blanca (`bg-card`), 4rem (3rem con el menú contraído): botón del menú a
  la izquierda; ayuda, notificaciones, tema, accesibilidad y la cuenta a la derecha.
- **Iconos.** Solo lucide, `size-4`, con el nombre en el control.
- **Todo control de solo icono lleva tooltip.** `Button` con `size="icon*"` y
  `aria-label` ya lo muestra solo; un botón propio sin texto usa `Tooltip` +
  `TooltipContent`. Nunca el atributo HTML `title`.
- **Sin decoración.** Nada de degradados (salvo el desvanecido de scroll de las tablas),
  brillos, desenfoques ni emoji.

## Quitar carga al usuario (criterios de diseño)

Cada pantalla se piensa para que la tarea habitual tome el menor esfuerzo, sin cambiar
las reglas de negocio que ya aplica el sistema.

- **Acciones del encabezado de una página de detalle**: editar, desactivar o cambiar
  van como botones de solo ícono (con su tooltip y nombre accesible). Las acciones del
  flujo de trabajo (aprobar, rechazar, registrar) llevan texto.
- **La fila abre el registro.** Si un registro tiene más de una cosa que ver o hacer
  (horario, supervisión, estudiantes…), la fila completa abre su pantalla con la
  información separada en pestañas y las acciones arriba (p. ej. "Editar"). No se
  ponen dos o más íconos sueltos en una columna "Acciones".
- **Modal o página según la cantidad de información.** Si el registro tiene poco que
  ver o editar (unos pocos campos), la fila abre un modal. Si tiene bastante
  (varias secciones, listas relacionadas, acciones propias como gestionar paralelos o
  desactivar), la fila abre su página con pestañas y las acciones arriba. No se
  bombardea al usuario con modales cargados de información.
- Una única acción extra que no es editar puede ir en `RowActionsMenu`.
- **Desplegable antes que fila de pestañas para elegir un valor.** Elegir ciclo,
  período o carrera se hace con un desplegable en la fila de filtros. Las pestañas
  son para secciones de un mismo registro, no para filtrar listas.
- **Modales directos.** Sin tarjetas ni recuadros dentro del modal, sin repetir lo que
  ya dice el título, la descripción o los propios campos (nada de "Nombre, código y
  modalidad" sobre esos campos, ni "El nombre es obligatorio" junto al botón), sin
  íconos decorativos en los títulos de sección.
  Campos en orden de uso; casillas y radios simples en línea.
- **Sin títulos con ícono.** A diferencia de sílabos, los títulos de pantalla no llevan
  ícono.
- **Texto útil.** La descripción dice qué se hace en la pantalla, no repite el filtro
  elegido. Avisos con tokens `notice`/`warning`, nunca colores crudos.

## Estructura de una pantalla

1. `AdminSectionHeader` (o `ModuleHeader`): título `h1`, una descripción práctica de
   una línea y las acciones a la derecha.
   La acción principal lleva icono; las secundarias son `variant="secondary"`.
2. Filtros: búsqueda primero, luego filtros, y un botón terciario "Limpiar" que solo
   aparece con filtros activos. Un filtro nunca dice solo "Todos": su opción vacía
   nombra lo que agrupa ("Todos los ciclos", "Todos los estados"). Los desplegables
   de la fila de filtros no llevan una etiqueta visible al lado: su valor lo dice todo
   (la etiqueta va para lectores de pantalla). Un valor obligatorio, como el ciclo, va
   primero en la fila (`FilterBar leading`).
3. La tabla (`RecordTable`, `DataTable` o `Table` dentro de `Card`), y debajo la paginación.

## Tablas

- Contenedor `rounded-md ring-1 ring-surface-ring shadow-surface`, encabezado `bg-field`,
  divisiones verticales entre columnas y filas alternas; en móvil las tablas `stacked`
  pasan a tarjetas.
- Paginación siempre visible bajo la tabla: "1–15 de 42" a la izquierda y páginas a la derecha.
- **Acciones de fila:** la fila abre el registro (ver criterios arriba). Si aun así hace
  falta más de una acción, `RowActionsMenu` (un botón "⋯" con cada acción escrita; las
  destructivas al final). No pongas columnas de íconos sueltos.
- Las filas resaltan al pasar el cursor; las que abren algo llevan `cursor-pointer`.
- Fila vacía: `EmptyState` con una frase concreta que cambia con los filtros
  ("No hay asignaturas con estos filtros." vs. "Aún no hay asignaturas registradas.").
- **Solo los estados llevan badge** (activo/inactivo, aprobado, matriculado…), con
  `Badge`/`StatusBadge` y variantes semánticas. Código, ciclo, paralelos, rol, grupo o
  día van como texto simple.
- Solo los encabezados van en negrita; el contenido de las celdas, en peso normal, del
  mismo color de texto (nada de gris) y con la misma fuente (nada de monoespaciada).
- El estado de cada fila va siempre en badge, nunca como texto suelto.
- En filas compuestas (una celda que abarca varias filas), el color alterno y el
  resaltado al pasar el cursor van por grupo.

## Formularios

- Crear y editar desde una lista: `FormDialog` (modal centrado, título centrado, X con
  tooltip "Cerrar", pie con "Cancelar" + acción con ícono de visto). Fondo `bg-overlay/95`
  (negro). Clic fuera no cierra. No se usan paneles laterales (sheets).
- Confirmaciones: el mismo modal, título en pregunta ("¿Cerrar sesión?") y botón
  destructivo con ícono y verbo.
- Los campos van en el orden en que se piensan: primero lo que identifica (nombre,
  código), después lo demás.
- **Campos obligatorios con asterisco**: `FormField required` / `SelectField required`
  (asterisco rojo y "(obligatorio)" para lectores de pantalla).
- **Formularios largos por pasos**: `FormDialog steps` divide el formulario en pasos
  con su título, como la convocatoria de sílabos (una línea de ayuda solo si dice algo
  que los campos no dicen): "Cancelar /
  Siguiente" en el primero, "Atrás / Siguiente" en los intermedios y "Atrás / acción"
  en el último; "Siguiente" se bloquea mostrando qué falta. Úsalo cuando el formulario
  tiene grupos de campos distintos o más de unos cinco campos.
- La ayuda de un campo va visible bajo el campo (`FormField tip`), no en un tooltip, y
  solo si dice algo que no se entiende ya: nada de "Cédula de 10 dígitos", "Utiliza un
  correo @ueb.edu.ec", "solo letras y espacios" o "Mínimo 5 caracteres" (si el dato no
  sirve, lo dice el error del campo).
- El error de cada campo va en línea bajo el campo; el error del servidor una sola vez,
  dentro del modal. El motivo por el que "Guardar" o "Siguiente" está bloqueado no se
  repite en el modal (los obligatorios ya llevan asterisco): se lee en el tooltip del
  botón bloqueado.
- Etiquetas de botón con verbo concreto ("Crear tutoría", "Guardar cambios"); nunca
  "Aceptar" u "OK". Placeholders con ejemplo: "Ej. maria.perez@ueb.edu.ec".

## Feedback

- **Pendiente:** el botón se deshabilita y un `Spinner` reemplaza su icono
  ("Guardando…"). Nunca doble envío (`useOperation` ya lo evita).
- **Éxito:** un solo toast, arriba al centro, con colores invertidos, frase en participio
  ("Tutoría creada").
  No muestres toast por acciones que no cambian nada (p. ej. "Actualizar").
- **Error:** en un formulario abierto, en línea; fuera de un formulario, toast con
  título y detalle. No apiles modal de error encima.
- **Destructivo:** `ConfirmModal` cuya descripción dice exactamente qué pasará y cuyo
  botón es verbo + consecuencia ("Desactivar docente").
- **Carga:** esqueletos con brillo (`Skeleton`) con la forma del contenido o `Spinner`
  con texto ("Cargando…"); nunca una pantalla en blanco.
- **Fallo al cargar:** `ErrorNotice` con "Reintentar".

## Texto

- Español, trato de "tú" (como el resto del sistema), frases cortas y concretas.
- Los toasts no terminan en punto.

## Lo que no se toca al rediseñar

- Los nombres accesibles y textos que usan las pruebas y las guías (`data-tour`,
  `data-tour-view`, `aria-label`, textos de botón citados en
  `src/features/help/page-tours.ts`). Si cambian, se actualizan pruebas y guías en el
  mismo commit.
- Los documentos oficiales impresos (`src/features/reports`, `.print-root`).
