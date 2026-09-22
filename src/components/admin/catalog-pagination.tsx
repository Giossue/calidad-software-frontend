import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function CatalogPagination({ page, lastPage, disabled, label, onChange }: Readonly<{ page: number; lastPage: number; disabled: boolean; label: string; onChange: (page: number) => void }>) {
  if (lastPage <= 1) return null

  return <nav className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-3" aria-label={`Paginación de ${label}`}>
    <Button type="button" variant="ghost" size="sm" onClick={() => onChange(page - 1)} disabled={disabled || page <= 1}><ChevronLeftIcon />Anterior</Button>
    <span className="text-xs text-muted-foreground">Página {page} de {lastPage}</span>
    <Button type="button" variant="ghost" size="sm" onClick={() => onChange(page + 1)} disabled={disabled || page >= lastPage}>Siguiente<ChevronRightIcon /></Button>
  </nav>
}
