import { FilterBarSkeleton, PageHeaderSkeleton } from '@/components/ui/loading-skeletons'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// Piezas de esqueleto que se repiten entre roles (coordinación, docente, estudiante) y que aún
// no están en `components/ui/loading-skeletons`. Ninguna se anuncia sola: quien la usa pone el
// `role="status"` con su nombre ("Cargando…"), que es lo que espera la guía de ayuda.

const CELL_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-2/5', 'w-1/3']

/** Tabla con sus encabezados reales y filas con brillo: al cargar ya se ven las columnas. */
export function HeadedTableSkeleton({ headers, rows = 5 }: Readonly<{ headers: readonly string[]; rows?: number }>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>{headers.map((header) => <TableHead key={header}>{header}</TableHead>)}</TableRow>
      </TableHeader>
      <TableBody aria-hidden="true">
        {Array.from({ length: rows }, (_, row) => (
          <TableRow key={row} className="hover:bg-transparent!">
            {headers.map((header, column) => (
              <TableCell key={header} className="py-3">
                <Skeleton className={`h-4 ${CELL_WIDTHS[(row + column) % CELL_WIDTHS.length]}`} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** Fila de pestañas (mismo alto que `TabsList`). */
export function TabsSkeleton({ tabs }: Readonly<{ tabs: number }>) {
  return (
    <div className="flex h-9 items-center gap-4" aria-hidden="true" data-slot="tabs-skeleton">
      {Array.from({ length: tabs }, (_, index) => <Skeleton key={index} className="h-5 w-24" />)}
    </div>
  )
}

/** Título y descripción de una pantalla; a la derecha, la insignia de estado y los botones. */
export function HeaderSkeleton({ badge = false, actions = 0 }: Readonly<{ badge?: boolean; actions?: number }>) {
  return (
    <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" aria-hidden="true">
      <div className="flex min-w-0 flex-col gap-2">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      {(badge || actions > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {badge && <Skeleton className="h-5 w-20 rounded-full" />}
          {Array.from({ length: actions }, (_, index) => <Skeleton key={index} className="h-9 w-40" />)}
        </div>
      )}
    </div>
  )
}

/** Lista de casillas (opciones que se marcan en un formulario). */
export function CheckboxListSkeleton({ rows = 3 }: Readonly<{ rows?: number }>) {
  return (
    <div className="flex flex-col gap-3 py-1" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-2.5">
          <Skeleton className="size-4 shrink-0 rounded-sm" />
          <Skeleton className={`h-4 ${CELL_WIDTHS[index % CELL_WIDTHS.length]}`} />
        </div>
      ))}
    </div>
  )
}

/** Una persona: iniciales en círculo, nombre y correo. */
export function PersonSkeleton() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-48 max-w-full" />
        <Skeleton className="h-3 w-56 max-w-full" />
      </div>
    </div>
  )
}

/**
 * Pantalla de lista de un módulo mientras carga: encabezado, filtros y la tabla con sus
 * columnas reales. La misma pieza se muestra mientras cargan las carreras y mientras carga
 * la primera página, para que se vea un solo esqueleto continuo.
 */
export function ListScreenSkeleton({ label, actions = 1, filters = 1, tabs = 0, headers }: Readonly<{ label: string; actions?: number; filters?: number; /** Pestañas bajo el encabezado (p. ej. Docentes y Estudiantes). */ tabs?: number; headers: readonly string[] }>) {
  return (
    <div className="flex flex-col gap-6">
      <span role="status" aria-label={label} className="sr-only">{label}</span>
      <PageHeaderSkeleton actions={actions} />
      {tabs > 0 && <TabsSkeleton tabs={tabs} />}
      <FilterBarSkeleton filters={filters} />
      <HeadedTableSkeleton headers={headers} />
    </div>
  )
}

/**
 * Lienzo de la malla (sin el encabezado de la pantalla): los controles de zoom arriba y un
 * carril por ciclo con su franja del ciclo y las tarjetas de las asignaturas.
 */
export function CurriculumCanvasSkeleton() {
  return (
    <div className="flex h-(--curriculum-canvas-height) min-h-96 flex-col gap-4 overflow-hidden rounded-md bg-background p-3 ring-1 ring-surface-ring [--curriculum-canvas-height:76vh]" aria-hidden="true">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="size-8" />
        <Skeleton className="size-8" />
      </div>
      {[4, 3, 2].map((count) => (
        <div key={count} className="flex h-40 shrink-0 gap-4 overflow-hidden rounded-md ring-1 ring-surface-ring">
          <Skeleton className="h-full w-20 shrink-0 rounded-none" />
          <div className="flex flex-1 items-center gap-8">
            {Array.from({ length: count }, (_, index) => <Skeleton key={index} className="h-24 w-64 shrink-0" />)}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Pantalla de la malla mientras carga: encabezado, filtros y el lienzo, como la pantalla real. */
export function CurriculumScreenSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <span role="status" aria-label="Cargando malla curricular" className="sr-only">Cargando malla curricular</span>
      <PageHeaderSkeleton actions={3} />
      <FilterBarSkeleton filters={1} />
      <CurriculumCanvasSkeleton />
    </div>
  )
}

/** Pestaña «Notas» del detalle de la tutoría mientras carga: título, descripción y la tabla. */
export function TutoringGradesSkeleton({ headers }: Readonly<{ headers: readonly string[] }>) {
  return (
    <div className="flex flex-col gap-4">
      <span role="status" aria-label="Cargando notas…" className="sr-only">Cargando notas…</span>
      <div className="flex flex-col gap-2" aria-hidden="true">
        <Skeleton className="h-6 w-56 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <HeadedTableSkeleton headers={headers} rows={6} />
    </div>
  )
}
