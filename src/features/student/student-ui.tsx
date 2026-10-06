import type { ComponentType } from 'react'
import { BookOpenIcon, SearchIcon } from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type IconType = ComponentType<{ className?: string }>

/** Ícono de tutoría: cuadro con tinte azul suave. */
export function IconTile({ icon: Icon = BookOpenIcon, className }: Readonly<{ icon?: IconType; className?: string }>) {
  return <span aria-hidden="true" className={cn('flex size-14 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300', className)}><Icon className="size-5" /></span>
}

export function RedProgress({ value, label, className }: Readonly<{ value: number; label: string; className?: string }>) {
  const width = Math.max(0, Math.min(100, value))
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className={cn('h-2.5 w-full overflow-hidden rounded-full bg-muted', className)}>
    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${width}%` }} />
  </div>
}

export function FilterChips<T extends string>({ label, value, onChange, options }: Readonly<{ label: string; value: T; onChange: (value: T) => void; options: readonly { value: T; label: string; count: number; icon?: IconType }[] }>) {
  return <div role="group" aria-label={label} className="flex flex-wrap gap-2">
    {options.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={cn('inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50', value === option.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-muted')}>{option.icon && <option.icon className="size-4" />}{option.label} ({option.count})</button>)}
  </div>
}

export function SearchField({ id, label, value, onChange, placeholder }: Readonly<{ id: string; label: string; value: string; onChange: (value: string) => void; placeholder: string }>) {
  return <div className="relative w-full lg:max-w-md">
    <label htmlFor={id} className="sr-only">{label}</label>
    <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input id={id} type="search" className="pl-9" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
  </div>
}

export function ListFooter({ noun, total, shown, page, lastPage, onPage }: Readonly<{ noun: string; total: number; start?: number; shown: number; page: number; lastPage: number; onPage: (page: number) => void }>) {
  if (total === 0) return null
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-sm text-muted-foreground">Mostrando {shown} de {total} {noun}</p>
    <CatalogPagination label={noun} page={page} lastPage={lastPage} disabled={false} onChange={onPage} />
  </div>
}
