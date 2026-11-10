import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { SearchInput } from '@/components/ui/search-input'
import { getInitials } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Iniciales de una persona en un círculo neutro (sin tinte de color). */
export function Initials({ name, className }: Readonly<{ name: string; className?: string }>) {
  return <span aria-hidden="true" className={cn('flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground', className)}>{getInitials(name)}</span>
}

export function RedProgress({ value, label, className }: Readonly<{ value: number; label: string; className?: string }>) {
  const width = Math.max(0, Math.min(100, value))
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className={cn('h-2.5 w-full overflow-hidden rounded-full bg-muted', className)}>
    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${width}%` }} />
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
