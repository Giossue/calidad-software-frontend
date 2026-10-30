import { Children, type ReactNode } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'

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
      {loading && !hasItems ? <div className="flex flex-col gap-3 px-5 py-6" role="status"><span className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner />{loadingMessage}</span><Skeleton className="h-10" /><Skeleton className="h-10" /></div> : hasItems ? children : <p className="px-5 py-8 text-sm text-muted-foreground">{emptyMessage}</p>}
    </CardContent>
  </Card>
}
