import type { ReactNode } from 'react'
import { GraduationCapIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PageHeaderSkeleton } from '@/components/ui/loading-skeletons'
import { Skeleton } from '@/components/ui/skeleton'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { ErrorNotice } from '@/components/ui/error-notice'

export function StudentEmpty({ title, description }: Readonly<{ title: string; description?: string }>) {
  return <Empty><EmptyHeader><EmptyMedia variant="icon"><GraduationCapIcon /></EmptyMedia><EmptyTitle>{title}</EmptyTitle>{description && <EmptyDescription>{description}</EmptyDescription>}</EmptyHeader></Empty>
}

/** Página de solo lectura: carga un recurso y muestra esqueleto, error con reintento o estado vacío. */
export function StudentReadPage<T>({ title, description, label, loader, isEmpty, empty, children, skeleton }: Readonly<{
  title: string; description: string; label: string; loader: () => Promise<readonly T[]>
  /** Esqueleto con la forma del contenido; por defecto, dos bloques. */
  skeleton?: ReactNode
  isEmpty?: (rows: readonly T[]) => boolean; empty: ReactNode; children: (rows: readonly T[]) => ReactNode
}>) {
  const resource = useDegreeResource(loader)
  const rows = resource.data ?? []
  const blank = isEmpty ? isEmpty(rows) : rows.length === 0
  // Mientras carga, el encabezado también es esqueleto: un solo bloque con un solo aviso.
  if (resource.loading) {
    return <div role="status" aria-label={`Cargando ${label}`} className="flex min-w-0 flex-col gap-6">
      <PageHeaderSkeleton actions={0} />
      <div className="flex flex-col gap-4">{skeleton ?? <><Skeleton className="h-32 w-full" aria-hidden="true" /><Skeleton className="h-32 w-full" aria-hidden="true" /></>}</div>
    </div>
  }
  return <section className="flex min-w-0 flex-col gap-6">
    <AdminSectionHeader title={title} description={description} />
    <ErrorNotice message={resource.error} retry={resource.reload} />
    {!resource.error && (blank ? empty : children(rows))}
  </section>
}
