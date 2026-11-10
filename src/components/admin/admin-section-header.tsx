import type { ReactNode } from 'react'

import { usePageIcon } from '@/components/admin/page-icon-context'

/**
 * Encabezado de pantalla, como el de sílabos: ícono de la sección en un recuadro, título,
 * una descripción práctica y las acciones a la derecha (en móvil, debajo).
 */
export function AdminSectionHeader({ title, description, titleId, actions }: Readonly<{ title: string; description?: ReactNode; titleId?: string; actions?: ReactNode }>) {
  const Icon = usePageIcon()

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" data-tour="page-header">
      <div className="flex min-w-0 items-center gap-4">
        {Icon && (
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground" aria-hidden="true">
            <Icon className="size-5" />
          </div>
        )}
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
