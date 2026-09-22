import type { ComponentProps } from 'react'

import { Badge } from '@/components/ui/badge'

export function StatusBadge({ active, activeLabel = 'Activo', inactiveLabel = 'Inactivo', ...props }: Readonly<{ active: boolean; activeLabel?: string; inactiveLabel?: string } & Omit<ComponentProps<typeof Badge>, 'variant' | 'children'>>) {
  return <Badge variant={active ? 'success' : 'inactive'} {...props}>{active ? activeLabel : inactiveLabel}</Badge>
}
