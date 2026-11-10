import { Children, type ReactNode } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function CatalogList({ title, icon, loading, loadingMessage, emptyMessage, children }: Readonly<{ title: string; icon: ReactNode; loading: boolean; loadingMessage: string; emptyMessage: string; children: ReactNode }>) {
  const hasItems = Children.count(children) > 0

  return <Card>
    <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="text-primary" aria-hidden="true">{icon}</span>
        <CardTitle className="text-base">{title}</CardTitle>
      </div>
    </CardHeader>
    <CardContent className="p-0" aria-live="polite">
      {loading && !hasItems ? <CatalogRowsSkeleton label={loadingMessage} /> : hasItems ? children : <p className="px-5 py-8 text-sm text-muted-foreground">{emptyMessage}</p>}
    </CardContent>
  </Card>
}

/** Filas del catálogo mientras cargan, con la forma de `CatalogRow` (nombre, detalle, estado y acciones). */
function CatalogRowsSkeleton({ label }: Readonly<{ label: string }>) {
  return <div role="status" aria-label={label}>
    {['w-2/3', 'w-1/2', 'w-3/4'].map((width) => <div key={width} className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-4 last:border-b-0" aria-hidden="true">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className={`h-4 ${width}`} />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="size-9" />
        <Skeleton className="size-9" />
      </div>
    </div>)}
  </div>
}
