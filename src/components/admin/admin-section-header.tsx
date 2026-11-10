import type { ReactNode } from 'react'

/**
 * Encabezado de pantalla: título, una descripción práctica y las acciones a la derecha
 * (en móvil, debajo). A diferencia de sílabos, sin ícono junto al título.
 */
export function AdminSectionHeader({ title, description, titleId, actions }: Readonly<{ title: string; description?: ReactNode; titleId?: string; actions?: ReactNode }>) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" data-tour="page-header">
      <div className="flex min-w-0 items-center">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 id={titleId} className="break-words text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          {description && <div className="max-w-3xl break-words text-muted-foreground">{description}</div>}
        </div>
      </div>
      {actions && (
        <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto sm:justify-end [&>div]:flex-wrap [&>div]:gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}
