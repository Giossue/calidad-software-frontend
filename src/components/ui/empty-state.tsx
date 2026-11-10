import type { ReactNode } from 'react'
import { InboxIcon, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Estado vacío de una lista o tabla: icono tenue y una frase concreta que explica qué
 * falta (y que cambia si hay filtros activos). `action` es el siguiente paso, si existe.
 */
export function EmptyState({ children, icon: Icon = InboxIcon, action, className }: Readonly<{ children: ReactNode; icon?: LucideIcon; action?: ReactNode; className?: string }>) {
  return (
    <div data-slot="empty-state" className={cn('flex min-h-40 flex-col items-center justify-center gap-3 px-4 py-8 text-center', className)}>
      <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground" aria-hidden="true">
        <Icon className="size-5" />
      </span>
      <div className="max-w-md text-sm text-muted-foreground">{children}</div>
      {action}
    </div>
  )
}
