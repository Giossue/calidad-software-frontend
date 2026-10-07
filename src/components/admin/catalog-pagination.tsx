import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function CatalogPagination({ page, lastPage, disabled, label, onChange }: Readonly<{ page: number; lastPage: number; disabled: boolean; label: string; onChange: (page: number) => void }>) {
  if (lastPage <= 1) return null

  return <nav className="flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-border/70 bg-card px-3 py-2.5 sm:justify-end sm:gap-3 sm:px-4 sm:py-3" aria-label={`Paginación de ${label}`}>
    <Button type="button" variant="ghost" size="sm" onClick={() => onChange(page - 1)} disabled={disabled || page <= 1} className="px-2 sm:px-3 text-xs sm:text-sm"><ChevronLeftIcon />Anterior</Button>
    <span className="text-xs text-muted-foreground whitespace-nowrap">Página {page} de {lastPage}</span>
    <Button type="button" variant="ghost" size="sm" onClick={() => onChange(page + 1)} disabled={disabled || page >= lastPage} className="px-2 sm:px-3 text-xs sm:text-sm">Siguiente<ChevronRightIcon /></Button>
  </nav>
}
