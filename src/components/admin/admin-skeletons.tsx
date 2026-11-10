import { FilterBarSkeleton } from '@/components/ui/loading-skeletons'
import { Skeleton } from '@/components/ui/skeleton'
import { HeadedTableSkeleton } from '@/features/tutoring/tutoring-skeletons'

// Esqueletos de las pantallas de administración: copian la forma real (encabezado con el botón
// de actualizar y los botones de acción, filtros, tabla con sus columnas y paginación) para que
// nada salte al llegar los datos. Solo el contenedor de la pantalla lleva el `role="status"`.

/** Botones de una barra de acciones: actualizar (ícono) y luego los botones con texto. */
export function AdminActionsSkeleton({ refresh = true, actions = 2 }: Readonly<{ refresh?: boolean; actions?: number }>) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3" aria-hidden="true">
      {refresh && <Skeleton className="size-9 shrink-0" />}
      {Array.from({ length: actions }, (_, index) => <Skeleton key={index} className="h-9 w-36 flex-1 sm:flex-none" />)}
    </div>
  )
}

/** Título y descripción de la pantalla, con sus acciones a la derecha. */
export function AdminHeaderSkeleton({ refresh = true, actions = 2 }: Readonly<{ refresh?: boolean; actions?: number }>) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" aria-hidden="true">
      <div className="flex min-w-0 flex-col gap-2">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <AdminActionsSkeleton refresh={refresh} actions={actions} />
    </div>
  )
}

/** Encabezado de una pantalla de detalle: volver, nombre, contexto, estado y acciones de ícono. */
export function AdminDetailHeaderSkeleton({ iconActions = 2 }: Readonly<{ iconActions?: number }>) {
  return (
    <>
      <div aria-hidden="true"><Skeleton className="h-9 w-44" /></div>
      <div className="flex w-full min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" aria-hidden="true">
        <div className="flex min-w-0 flex-col gap-2">
          <Skeleton className="h-8 w-72 max-w-full" />
          <Skeleton className="h-5 w-56 max-w-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          {Array.from({ length: iconActions }, (_, index) => <Skeleton key={index} className="size-9" />)}
        </div>
      </div>
    </>
  )
}

/** Filtros, tabla con sus columnas reales y la fila "Mostrando … / paginación". */
export function AdminCatalogSkeleton({ filters = 1, headers, footer = true }: Readonly<{ filters?: number; headers: readonly string[]; footer?: boolean }>) {
  return (
    <div className="flex flex-col gap-4">
      <FilterBarSkeleton filters={filters} />
      <HeadedTableSkeleton headers={headers} />
      {footer && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-hidden="true">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-64" />
        </div>
      )}
    </div>
  )
}

/** Pantalla de catálogo completa mientras llega la primera página. */
export function AdminListSkeleton({ label, refresh = true, actions = 2, filters = 1, headers }: Readonly<{ label: string; refresh?: boolean; actions?: number; filters?: number; headers: readonly string[] }>) {
  return (
    <section className="flex flex-col gap-6">
      <span role="status" aria-label={label} className="sr-only">{label}</span>
      <AdminHeaderSkeleton refresh={refresh} actions={actions} />
      <AdminCatalogSkeleton filters={filters} headers={headers} />
    </section>
  )
}
