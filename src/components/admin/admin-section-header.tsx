import type { ReactNode } from 'react'

export function AdminSectionHeader({ title, description, titleId, actions }: Readonly<{ title: string; description: string; titleId?: string; actions?: ReactNode }>) {
  return <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div className="flex flex-col gap-2">
      <h2 id={titleId} className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{title}</h2>
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
    {actions}
  </div>
}
