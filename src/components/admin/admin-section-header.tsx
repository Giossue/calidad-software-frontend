import type { ReactNode } from 'react'

/**
 * Encabezado de pantalla: título, una descripción práctica en una línea y las acciones
 * a la derecha (en móvil, debajo).
 */
export function AdminSectionHeader({ title, description, titleId, actions }: Readonly<{ title: string; description?: ReactNode; titleId?: string; actions?: ReactNode }>) {
  return (
    <div className="flex w-full min-w-0 flex-col justify-between gap-4 sm:flex-row sm:items-start" data-tour="page-header">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id={titleId} className="break-words text-xl font-semibold leading-tight tracking-tight">
          {title}
        </h2>
        {description && <div className="max-w-3xl break-words text-sm text-muted-foreground">{description}</div>}
      </div>
      {actions && (
        <div className="w-full shrink-0 sm:w-auto [&>div]:flex-wrap [&>div]:gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}
