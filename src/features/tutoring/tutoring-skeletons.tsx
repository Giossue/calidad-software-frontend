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
    <div className="flex h-9 items-center gap-4" aria-hidden="true">
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
export function ListScreenSkeleton({ label, actions = 1, filters = 1, headers }: Readonly<{ label: string; actions?: number; filters?: number; headers: readonly string[] }>) {
  return (
    <div className="flex flex-col gap-6">
      <span role="status" aria-label={label} className="sr-only">{label}</span>
      <PageHeaderSkeleton actions={actions} />
      <FilterBarSkeleton filters={filters} />
      <HeadedTableSkeleton headers={headers} />
    </div>
  )
}

/** Tarjetas de la malla por ciclo (sin el encabezado de la pantalla). */
export function CurriculumCardsSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden="true">
      {[5, 4, 3].map((count) => (
        <div key={count} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-20" />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: count }, (_, index) => <Skeleton key={index} className="h-24" />)}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Pantalla de la malla mientras carga: encabezado, filtros y tarjetas, como la pantalla real. */
export function CurriculumScreenSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <span role="status" aria-label="Cargando malla curricular" className="sr-only">Cargando malla curricular</span>
      <PageHeaderSkeleton actions={2} />
      <FilterBarSkeleton filters={1} />
      <CurriculumCardsSkeleton />
    </div>
  )
}
