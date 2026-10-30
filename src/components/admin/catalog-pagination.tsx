import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function CatalogPagination({ page, lastPage, disabled, label, onChange }: Readonly<{ page: number; lastPage: number; disabled: boolean; label: string; onChange: (page: number) => void }>) {
  if (lastPage <= 1) return null

  return <nav className="flex min-w-0 shrink-0 items-center justify-between gap-2 sm:justify-end sm:gap-3" aria-label={`Paginación de ${label}`}>
    <Button type="button" variant="tertiary" size="sm" onClick={() => onChange(page - 1)} disabled={disabled || page <= 1}><ChevronLeftIcon />Anterior</Button>
    <span className="text-xs text-muted-foreground whitespace-nowrap">Página {page} de {lastPage}</span>
    <Button type="button" variant="tertiary" size="sm" onClick={() => onChange(page + 1)} disabled={disabled || page >= lastPage}>Siguiente<ChevronRightIcon /></Button>
  </nav>
}
