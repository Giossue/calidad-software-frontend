import type { ReactNode } from 'react'

export function AdminSectionHeader({ title, description, titleId, actions }: Readonly<{ title: string; description: ReactNode; titleId?: string; actions?: ReactNode }>) {
  return (
    <div className="flex w-full min-w-0 flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="flex min-w-0 flex-col gap-2">
        <h2 id={titleId} className="break-words font-display text-2xl font-semibold tracking-[-0.03em] sm:text-3xl md:text-4xl">
          {title}
        </h2>
        <div className="max-w-2xl break-words text-sm leading-6 text-muted-foreground">{description}</div>
      </div>
      {actions && (
        <div className="w-full shrink-0 sm:w-auto [&>div]:flex-wrap [&>div]:gap-2 sm:[&>div]:gap-3">
          {actions}
        </div>
      )}
    </div>
  )
}
