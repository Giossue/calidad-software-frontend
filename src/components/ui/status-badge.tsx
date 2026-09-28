import type { ComponentProps } from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function StatusBadge({ active, activeLabel = 'Activo', inactiveLabel = 'Inactivo', ...props }: Readonly<{ active: boolean; activeLabel?: string; inactiveLabel?: string } & Omit<ComponentProps<typeof Badge>, 'variant' | 'children'>>) {
  return <Badge variant={active ? 'success' : 'inactive'} className="gap-1.5" {...props}>
    <span className={cn('size-1.5 rounded-full', active ? 'bg-success animate-pulse' : 'bg-muted-foreground')} aria-hidden="true" />
    {active ? activeLabel : inactiveLabel}
  </Badge>
}
