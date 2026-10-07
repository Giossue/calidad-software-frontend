import { useState } from 'react'
import { SearchIcon, SlidersHorizontalIcon, XIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'

export type FilterOption = { readonly value: string; readonly label: string }

export type FilterDefinition = Readonly<{
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly FilterOption[]
  // Texto de la opción "sin filtro" (ej. "Todas mis carreras").
  allLabel: string
  // Bloquea el filtro (ej. el ciclo hasta elegir una carrera); `allLabel` hace de pista.
  disabled?: boolean
  // Explica en un tooltip por qué el filtro está bloqueado.
  disabledReason?: string
}>

type FilterBarProps = Readonly<{
  id: string
  search: string
  onSearch: (value: string) => void
  searchPlaceholder: string
  searchLabel?: string
  disabled?: boolean
  filters: readonly FilterDefinition[]
  onClear: () => void
}>

// Barra de búsqueda a todo el ancho con un botón "Filtros" que abre un panel lateral
// (desde abajo en móvil). Los filtros activos se muestran como badges removibles.
export function FilterBar({ id, search, onSearch, searchPlaceholder, searchLabel = 'Buscar', disabled = false, filters, onClear }: FilterBarProps) {
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()
  const active = filters.filter((filter) => filter.value !== '')

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative flex min-w-0 flex-1 items-center">
          <SearchIcon className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <Input id={`${id}-search`} type="search" aria-label={searchLabel} disabled={disabled} placeholder={searchPlaceholder} value={search} onChange={(event) => onSearch(event.target.value)} className="h-10 w-full min-w-0 bg-white pl-10 text-xs sm:text-sm dark:bg-slate-900" />
        </div>
        {filters.length > 0 && (
          <Button type="button" variant="outline" disabled={disabled} className="h-10 shrink-0 bg-white px-3 text-xs sm:text-sm hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800" onClick={() => setOpen(true)}>
            <SlidersHorizontalIcon data-icon="inline-start" />
            Filtros
            {active.length > 0 && <Badge variant="secondary" className="ml-1 rounded-full px-1.5" aria-label={`${active.length} filtros activos`}>{active.length}</Badge>}
          </Button>
        )}
      </div>

      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Filtros activos">
          {active.map((filter) => {
            const optionLabel = filter.options.find((option) => option.value === filter.value)?.label ?? filter.value
            return (
              <span key={filter.id} className="inline-flex items-center gap-1.5 rounded-full border bg-background py-1 pl-3 pr-1.5 text-sm">
                {filter.label}: {optionLabel}
                <button type="button" aria-label={`Quitar filtro ${filter.label}`} onClick={() => filter.onChange('')} className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <XIcon className="size-3.5" />
                </button>
              </span>
            )
          })}
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={onClear}>Limpiar todo</Button>
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side={isMobile ? 'bottom' : 'right'} className={isMobile ? 'max-h-[85vh] rounded-t-2xl' : 'sm:max-w-md'}>
          <SheetHeader className="border-b">
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>Acota el listado. Los cambios se aplican al instante.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-2">
            {filters.map((filter) => {
              const select = (
                <NativeSelect id={`${id}-filter-${filter.id}`} value={filter.value} disabled={filter.disabled} onChange={(event) => filter.onChange(event.target.value)}>
                  <option value="">{filter.allLabel}</option>
                  {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </NativeSelect>
              )
              return (
              <Field key={filter.id}>
                <FieldLabel htmlFor={`${id}-filter-${filter.id}`}>{filter.label}</FieldLabel>
                {filter.disabled && filter.disabledReason ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div tabIndex={0} className="cursor-not-allowed rounded-md [&_select]:pointer-events-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
                          {select}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="z-[100]">{filter.disabledReason}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : select}
              </Field>
              )
            })}
          </div>
          <SheetFooter className="flex-row items-center justify-between border-t">
            <Button type="button" variant="ghost" disabled={active.length === 0} onClick={onClear}>Limpiar filtros</Button>
            <Button type="button" onClick={() => setOpen(false)}>Ver resultados</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
