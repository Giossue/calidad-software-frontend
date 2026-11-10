import { Skeleton } from '@/components/ui/skeleton'
import { TableCell, TableRow } from '@/components/ui/table'

// Esqueletos con la forma de lo que se está cargando (como en sílabos): el usuario ve dónde
// aparecerá cada cosa en vez de un bloque genérico. Todos anuncian "Cargando…" y la guía de
// ayuda espera a que desaparezcan (`role="status"` con nombre que empieza por "Cargando").

const CELL_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-2/5', 'w-1/3']

/** Filas de una tabla mientras carga: una barra por celda, con anchos variados. */
export function TableRowsSkeleton({ columns, rows = 5, label = 'Cargando' }: Readonly<{ columns: number; rows?: number; label?: string }>) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <TableRow key={row} className="hover:bg-transparent!">
          {Array.from({ length: columns }, (_, column) => (
            <TableCell key={column} className="py-3">
              {row === 0 && column === 0 && <span role="status" aria-label={label} className="sr-only">{label}</span>}
              <Skeleton className={`h-4 ${CELL_WIDTHS[(row + column) % CELL_WIDTHS.length]}`} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

/** Encabezado de pantalla: título, descripción y el lugar de las acciones. */
export function PageHeaderSkeleton({ actions = 1 }: Readonly<{ actions?: number }>) {
  return (
    <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      {actions > 0 && (
        <div className="flex gap-2">
          {Array.from({ length: actions }, (_, index) => <Skeleton key={index} className="h-9 w-36" />)}
        </div>
      )}
    </div>
  )
}

/** Fila de filtros: buscador y desplegables. */
export function FilterBarSkeleton({ filters = 1 }: Readonly<{ filters?: number }>) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3" aria-hidden="true">
      <Skeleton className="h-9 min-w-56 flex-1" />
      {Array.from({ length: filters }, (_, index) => <Skeleton key={index} className="h-9 w-48" />)}
    </div>
  )
}

/** Tabla completa mientras carga (contenedor, encabezado y filas). */
export function TableSkeleton({ columns = 4, rows = 5 }: Readonly<{ columns?: number; rows?: number }>) {
  return (
    <div className="overflow-hidden rounded-md bg-card shadow-surface ring-1 ring-surface-ring" aria-hidden="true">
      <div className="flex gap-4 border-b bg-field px-3 py-3 dark:bg-muted">
        {Array.from({ length: columns }, (_, index) => <Skeleton key={index} className="h-4 flex-1" />)}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-4 border-b px-3 py-3.5 last:border-0">
          {Array.from({ length: columns }, (_, column) => <Skeleton key={column} className={`h-4 flex-1 ${column > 0 ? 'max-w-40' : ''}`} />)}
        </div>
      ))}
    </div>
  )
}

/** Pantalla de lista completa: encabezado, filtros y tabla. */
export function ListPageSkeleton({ label = 'Cargando', actions = 1, filters = 1, columns = 4 }: Readonly<{ label?: string; actions?: number; filters?: number; columns?: number }>) {
  return (
    <div className="flex flex-col gap-6">
      <span role="status" aria-label={label} className="sr-only">{label}</span>
      <PageHeaderSkeleton actions={actions} />
      <FilterBarSkeleton filters={filters} />
      <TableSkeleton columns={columns} />
    </div>
  )
}

/** Pantalla de detalle: volver, encabezado con acciones de ícono, pestañas y contenido. */
export function DetailPageSkeleton({ label = 'Cargando', tabs = 3 }: Readonly<{ label?: string; tabs?: number }>) {
  return (
    <div className="flex flex-col gap-6">
      <span role="status" aria-label={label} className="sr-only">{label}</span>
      <Skeleton className="h-9 w-40" aria-hidden="true" />
      <div className="flex items-start justify-between gap-4" aria-hidden="true">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="size-9" />
          <Skeleton className="size-9" />
        </div>
      </div>
      <div className="flex gap-4" aria-hidden="true">
        {Array.from({ length: tabs }, (_, index) => <Skeleton key={index} className="h-6 w-24" />)}
      </div>
      <TableSkeleton columns={3} rows={3} />
    </div>
  )
}
