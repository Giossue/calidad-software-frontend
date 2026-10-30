import { Fragment } from 'react'
import { FilterXIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { SelectInput } from '@/components/ui/select-field'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

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

// Buscador con los filtros como selects en la misma fila (se acomodan en varias líneas
// en pantallas angostas). "Limpiar" aparece solo cuando hay algún filtro activo.
export function FilterBar({ id, search, onSearch, searchPlaceholder, searchLabel = 'Buscar', disabled = false, filters, onClear }: FilterBarProps) {
  const hasActive = filters.some((filter) => filter.value !== '')

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <SearchInput
        id={`${id}-search`}
        icon
        aria-label={searchLabel}
        disabled={disabled}
        placeholder={searchPlaceholder}
        value={search}
        onValueChange={onSearch}
        className="min-w-56 basis-full flex-1 sm:basis-0"
      />
      {filters.map((filter) => {
        const select = (
          <SelectInput
            id={`${id}-filter-${filter.id}`}
            ariaLabel={`Filtrar por ${filter.label}`}
            value={filter.value}
            disabled={disabled || filter.disabled}
            onValueChange={filter.onChange}
            emptyLabel={filter.allLabel}
            options={filter.options}
            className="min-w-40 flex-1 sm:w-48 sm:flex-none"
          />
        )
        return filter.disabled && filter.disabledReason ? (
          <Tooltip key={filter.id}>
            <TooltipTrigger asChild>
              <div tabIndex={0} className="min-w-40 flex-1 cursor-not-allowed rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:w-48 sm:flex-none [&_button]:pointer-events-none">
                {select}
              </div>
            </TooltipTrigger>
            <TooltipContent>{filter.disabledReason}</TooltipContent>
          </Tooltip>
        ) : (
          <Fragment key={filter.id}>{select}</Fragment>
        )
      })}
      {hasActive && (
        <Button type="button" variant="tertiary" disabled={disabled} className="shrink-0" onClick={onClear}>
          <FilterXIcon data-icon="inline-start" />
          Limpiar
        </Button>
      )}
    </div>
  )
}
