import type { ComponentType } from 'react'
import { BookOpenIcon, CheckIcon } from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { cn } from '@/lib/utils'

type IconType = ComponentType<{ className?: string; 'data-icon'?: string }>

/** Ícono de tutoría: cuadro con tinte azul suave. */
export function IconTile({ icon: Icon = BookOpenIcon, className }: Readonly<{ icon?: IconType; className?: string }>) {
  return <span aria-hidden="true" className={cn('flex size-14 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-primary/15 dark:text-blue-300', className)}><Icon className="size-5" /></span>
}

export function RedProgress({ value, label, className }: Readonly<{ value: number; label: string; className?: string }>) {
  const width = Math.max(0, Math.min(100, value))
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className={cn('h-2.5 w-full overflow-hidden rounded-full bg-muted', className)}>
    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${width}%` }} />
  </div>
}

export function FilterChips<T extends string>({ label, value, onChange, options }: Readonly<{ label: string; value: T; onChange: (value: T) => void; options: readonly { value: T; label: string; count: number; icon?: IconType }[] }>) {
  return <div role="group" aria-label={label} className="flex flex-wrap gap-2">
    {options.map((option) => {
      const active = value === option.value
      return <Button key={option.value} type="button" size="sm" variant={active ? 'primary' : 'secondary'} aria-pressed={active} onClick={() => onChange(option.value)}>{option.icon ? <option.icon data-icon="inline-start" /> : active && <CheckIcon data-icon="inline-start" />}{option.label} ({option.count})</Button>
    })}
  </div>
}

export function SearchField({ id, label, value, onChange, placeholder }: Readonly<{ id: string; label: string; value: string; onChange: (value: string) => void; placeholder: string }>) {
  return <div className="relative w-full lg:max-w-md">
    <label htmlFor={id} className="sr-only">{label}</label>
    <SearchInput id={id} icon placeholder={placeholder} value={value} onValueChange={onChange} />
  </div>
}

export function ListFooter({ noun, total, shown, page, lastPage, onPage }: Readonly<{ noun: string; total: number; start?: number; shown: number; page: number; lastPage: number; onPage: (page: number) => void }>) {
  if (total === 0) return null
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-sm text-muted-foreground">Mostrando {shown} de {total} {noun}</p>
    <CatalogPagination label={noun} page={page} lastPage={lastPage} disabled={false} onChange={onPage} />
  </div>
}
