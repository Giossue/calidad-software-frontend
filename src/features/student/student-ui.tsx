import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { getInitials } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Iniciales de una persona en un círculo neutro (sin tinte de color). */
export function Initials({ name, className }: Readonly<{ name: string; className?: string }>) {
  return <span aria-hidden="true" className={cn('flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground', className)}>{getInitials(name)}</span>
}

export function RedProgress({ value, label, className }: Readonly<{ value: number; label: string; className?: string }>) {
  // Avance entero (66.67 → 67), igual que el número que se muestra junto a la barra.
  const width = Math.round(Math.max(0, Math.min(100, value)))
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={width} className={cn('h-2.5 w-full overflow-hidden rounded-full bg-muted', className)}>
    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${width}%` }} />
  </div>
}

export function ListFooter({ noun, total, shown, page, lastPage, onPage }: Readonly<{ noun: string; total: number; start?: number; shown: number; page: number; lastPage: number; onPage: (page: number) => void }>) {
  if (total === 0) return null
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-sm text-muted-foreground">Mostrando {shown} de {total} {noun}</p>
    <CatalogPagination label={noun} page={page} lastPage={lastPage} disabled={false} onChange={onPage} />
  </div>
}
