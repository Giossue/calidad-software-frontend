# Convenciones de interfaz

La interfaz sigue el sistema visual y de feedback del sistema de sílabos de la UEB.
Objetivo: pantallas sobrias, fáciles de entender a la primera, y que siempre digan qué
está pasando. Si una pantalla nueva no encaja en estas reglas, se cambia la regla aquí,
no se improvisa en la pantalla.

## Sistema visual

- **Colores.** Escala de grises neutra y un solo azul institucional (`primary`). Usa
  siempre tokens (`bg-muted`, `text-muted-foreground`, `text-destructive`,
  `text-success`, `text-warning`, `border-border`); nunca colores crudos de Tailwind
  (`amber-*`, `emerald-*`, `blue-*`, `slate-*`, `red-*`…).
- **Sin decoración.** Nada de degradados, brillos, desenfoques, cuadrículas de fondo,
  puntos parpadeantes, emoji ni iconos dentro de círculos o recuadros de color.
- **Tipografía.** Instrument Sans con pesos 400, 500 y 600. Títulos de pantalla
  `text-xl font-semibold tracking-tight`; texto secundario `text-sm text-muted-foreground`.
  No uses tamaños arbitrarios (`text-[11px]`); usa `text-xs` como mínimo.
- **Superficies.** `Card` ya trae `rounded-xl ring-1 ring-surface-ring shadow-surface`.
  No agregues `border` ni `shadow-*` propios. Menús: `shadow-menu`; modales: `shadow-modal`.
- **Tokens.** Los valores de `src/index.css` son los de
  `proyecto-grado-silabos/resources/css/app.css`; si cambian allá, se copian aquí.
- **Iconos.** Solo lucide, `size-4`, con `aria-hidden` y el nombre en el control.
- **Todo control de solo icono lleva tooltip.** `Button` con `size="icon"` y `aria-label`
  ya lo muestra solo; un botón propio sin texto debe usar `Tooltip` + `TooltipContent`.
  Nunca el atributo HTML `title`.
- **Radio y bordes.** Botones, campos y menús `rounded-md`; tarjetas `rounded-xl`;
  modales `rounded-lg border shadow-modal`. Campos con `border-input shadow-control`.

## Estructura de una pantalla

1. `AdminSectionHeader` (o `ModuleHeader`): título, una descripción práctica de una
   línea (qué se hace aquí y la consecuencia importante) y las acciones a la derecha.
   La acción principal lleva icono; las secundarias son `variant="secondary"`.
2. Filtros: búsqueda primero, luego filtros, y un botón terciario "Quitar filtros"
   que solo aparece con filtros activos. Un filtro nunca dice solo "Todos": su opción
   vacía nombra lo que agrupa ("Todos los ciclos", "Todos los estados").
3. La tabla (`RecordTable`, `DataTable` o `Table` dentro de `Card`), y debajo la paginación.

## Tablas

- Encabezado `bg-muted`, filas alternas; en móvil las tablas `stacked` pasan a tarjetas.
- **Acciones de fila: siempre `RowActionsMenu`** (un botón "⋯" con cada acción escrita;
  las destructivas al final). No pongas columnas de iconos sueltos.
- Fila vacía: `EmptyState` con una frase concreta que cambia con los filtros
  ("No hay asignaturas con estos filtros." vs. "Aún no hay asignaturas registradas.").
- Estado (activo/inactivo, aprobado…): `Badge`/`StatusBadge` con variantes semánticas,
  sin inventar colores por estado.

## Formularios

- Crear y editar desde una lista: `FormDialog` (modal centrado con pie fijo
  "Cancelar" + acción, fondo `bg-black/80`). No se usan paneles laterales (sheets).
  Flujos complejos: pantalla completa.
- La ayuda de un campo va visible bajo el campo (`FormField tip`), no en un tooltip.
- El error de cada campo va en línea bajo el campo; el error del servidor una sola vez,
  dentro del panel. El motivo por el que "Guardar" está bloqueado se lee junto al botón.
- Etiquetas de botón con verbo concreto ("Crear tutoría", "Guardar cambios"); nunca
  "Aceptar" u "OK". Placeholders con ejemplo: "Ej. maria.perez@ueb.edu.ec".

## Feedback

- **Pendiente:** el botón se deshabilita y un `Spinner` reemplaza su icono
  ("Guardando…"). Nunca doble envío (`useOperation` ya lo evita).
- **Éxito:** un solo toast, arriba al centro, frase en participio ("Tutoría creada").
  No muestres toast por acciones que no cambian nada (p. ej. "Actualizar").
- **Error:** en un formulario abierto, en línea; fuera de un formulario, toast con
  título y detalle. No apiles modal de error encima.
- **Destructivo:** `ConfirmModal` cuya descripción dice exactamente qué pasará y cuyo
  botón es verbo + consecuencia ("Desactivar docente").
- **Carga:** esqueletos con la forma del contenido o `Spinner` con texto
  ("Cargando…"); nunca una pantalla en blanco.
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
