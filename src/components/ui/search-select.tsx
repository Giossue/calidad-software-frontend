import { useEffect, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon, XIcon } from 'lucide-react'
import { Popover as PopoverPrimitive } from 'radix-ui'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

export type SearchSelectOption = { readonly value: string; readonly label: string; readonly description?: string }

type SearchSelectProps = Readonly<{
  id: string
  query: string
  onQueryChange: (query: string) => void
  options: readonly SearchSelectOption[]
  selected: SearchSelectOption | null
  onSelect: (option: SearchSelectOption | null) => void
  loading?: boolean
  disabled?: boolean
  placeholder?: string
  emptyMessage?: string
}>

// Selector con búsqueda: el campo parece un select; al hacer clic se despliega la lista
// (flotante, sobre el diálogo) y al escribir se filtra. Se elige con clic o teclado.
export function SearchSelect({ id, query, onQueryChange, options, selected, onSelect, loading = false, disabled = false, placeholder = 'Selecciona…', emptyMessage = 'Sin resultados.' }: SearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const anchorRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = `${id}-listbox`

  useEffect(() => {
    // Al cambiar los resultados, vuelve a resaltar el primero.
    setActive(0) // eslint-disable-line react-hooks/set-state-in-effect
  }, [options])

  function choose(option: SearchSelectOption) {
    onSelect(option)
    onQueryChange('')
    setOpen(false)
  }

  // Con una selección hecha el campo muestra su nombre; al escribir se descarta y se vuelve a buscar.
  const inputValue = selected && !open ? selected.label : query
  const canClear = (selected !== null || query !== '') && !disabled

  function clear() {
    onSelect(null)
    onQueryChange('')
    inputRef.current?.focus()
  }

  return (
    <PopoverPrimitive.Root open={open && !disabled} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div ref={anchorRef} className="relative flex items-center">
          <Input
            ref={inputRef}
            id={id}
            type="text"
            role="combobox"
            aria-expanded={open && !disabled}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && options[active] ? `${id}-option-${options[active].value}` : undefined}
            autoComplete="off"
            value={inputValue}
            disabled={disabled}
            placeholder={placeholder}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onChange={(event) => {
              if (selected) onSelect(null)
              onQueryChange(event.target.value)
              setOpen(true)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setOpen(true)
                setActive((current) => Math.min(current + 1, options.length - 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActive((current) => Math.max(current - 1, 0))
              } else if (event.key === 'Enter' && open && options[active]) {
                event.preventDefault()
                choose(options[active])
              } else if (event.key === 'Escape' && open) {
                event.stopPropagation()
                setOpen(false)
              }
            }}
            className={canClear ? 'pr-16' : 'pr-9'}
          />
          <span className={cn('pointer-events-none absolute flex items-center gap-2 text-muted-foreground', canClear ? 'right-10' : 'right-3')}>
            {loading && <Spinner className="size-4" />}
            {!canClear && <ChevronDownIcon className="size-4 opacity-50" aria-hidden="true" />}
          </span>
          {canClear && (
            <Button
              type="button"
              variant="tertiary"
              size="icon"
              className="absolute right-1 size-7 text-muted-foreground"
              aria-label="Borrar selección"
              onClick={clear}
            >
              <XIcon />
            </Button>
          )}
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (anchorRef.current?.contains(event.target as Node)) event.preventDefault()
          }}
          style={{ width: 'var(--radix-popover-trigger-width)' }}
          className="z-[100] rounded-lg border border-input bg-popover p-1 text-popover-foreground shadow-md"
        >
          <ul id={listId} role="listbox" className="max-h-56 overflow-y-auto">
            {options.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">{loading ? 'Buscando…' : emptyMessage}</li>
            ) : (
              options.map((option, index) => (
                <li key={option.value} role="presentation">
                  <button
                    id={`${id}-option-${option.value}`}
                    role="option"
                    aria-selected={selected?.value === option.value}
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(option)}
                    className={cn('flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2 text-left text-sm', index === active && 'bg-muted')}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{option.label}</span>
                      {option.description && <span className="truncate text-xs text-muted-foreground">{option.description}</span>}
                    </span>
                    {selected?.value === option.value && <CheckIcon className="size-4 shrink-0" aria-hidden="true" />}
                  </button>
                </li>
              ))
            )}
          </ul>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
