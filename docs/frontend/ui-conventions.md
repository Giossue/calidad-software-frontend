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

## Estructura de una pantalla

1. `AdminSectionHeader` (o `ModuleHeader`): ícono de la sección en un recuadro
   (`size-11 rounded-md bg-accent`), título `h1`, una descripción práctica de una línea
   y las acciones a la derecha.
   La acción principal lleva icono; las secundarias son `variant="secondary"`.
2. Filtros: búsqueda primero, luego filtros, y un botón terciario "Quitar filtros"
   que solo aparece con filtros activos. Un filtro nunca dice solo "Todos": su opción
   vacía nombra lo que agrupa ("Todos los ciclos", "Todos los estados").
3. La tabla (`RecordTable`, `DataTable` o `Table` dentro de `Card`), y debajo la paginación.

## Tablas

- Contenedor `rounded-md ring-1 ring-surface-ring shadow-surface`, encabezado `bg-field`,
  divisiones verticales entre columnas y filas alternas; en móvil las tablas `stacked`
  pasan a tarjetas.
- Paginación siempre visible bajo la tabla: "1–15 de 42" a la izquierda y páginas a la derecha.
- **Acciones de fila: siempre `RowActionsMenu`** (un botón "⋯" con cada acción escrita;
  las destructivas al final). No pongas columnas de iconos sueltos.
- Fila vacía: `EmptyState` con una frase concreta que cambia con los filtros
  ("No hay asignaturas con estos filtros." vs. "Aún no hay asignaturas registradas.").
- Estado (activo/inactivo, aprobado…): `Badge`/`StatusBadge` con variantes semánticas,
  sin inventar colores por estado.

## Formularios

- Crear y editar desde una lista: `FormDialog` (modal centrado, título centrado, X con
  tooltip "Cerrar", pie con "Cancelar" + acción con ícono de visto). Fondo `bg-overlay/95`
  (negro). Clic fuera no cierra. No se usan paneles laterales (sheets).
- Confirmaciones: el mismo modal, título en pregunta ("¿Cerrar sesión?") y botón
  destructivo con ícono y verbo.
- La ayuda de un campo va visible bajo el campo (`FormField tip`), no en un tooltip.
- El error de cada campo va en línea bajo el campo; el error del servidor una sola vez,
  dentro del panel. El motivo por el que "Guardar" está bloqueado se lee junto al botón.
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
