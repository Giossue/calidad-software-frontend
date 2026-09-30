import type { ReactNode } from 'react'
import { GraduationCapIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { ErrorNotice } from '@/features/tutoring/tutoring-shared'

export function StudentEmpty({ title, description }: Readonly<{ title: string; description?: string }>) {
  return <Empty><EmptyHeader><EmptyMedia variant="icon"><GraduationCapIcon /></EmptyMedia><EmptyTitle>{title}</EmptyTitle>{description && <EmptyDescription>{description}</EmptyDescription>}</EmptyHeader></Empty>
}

/** Página de solo lectura: carga un recurso y muestra esqueleto, error con reintento o estado vacío. */
export function StudentReadPage<T>({ title, description, label, loader, isEmpty, empty, children }: Readonly<{
  title: string; description: string; label: string; loader: () => Promise<readonly T[]>
  isEmpty?: (rows: readonly T[]) => boolean; empty: ReactNode; children: (rows: readonly T[]) => ReactNode
}>) {
  const resource = useDegreeResource(loader)
  const rows = resource.data ?? []
  const blank = isEmpty ? isEmpty(rows) : rows.length === 0
  return <section className="flex min-w-0 flex-col gap-6" aria-busy={resource.loading}>
    <AdminSectionHeader title={title} description={description} />
    <ErrorNotice message={resource.error} retry={resource.reload} />
    {resource.loading ? <div role="status" aria-label={`Cargando ${label}`} className="flex flex-col gap-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div> : !resource.error && (blank ? empty : children(rows))}
  </section>
}
