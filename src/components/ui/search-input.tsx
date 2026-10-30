import { useRef, type ComponentProps } from 'react'
import { SearchIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

/**
 * Campo de búsqueda con botón propio para borrar el texto (se oculta el botón
 * nativo del navegador). `icon` añade la lupa a la izquierda y `loading` un
 * spinner a la derecha.
 */
export function SearchInput({
  value,
  onValueChange,
  icon = false,
  loading = false,
  className,
  disabled,
  ...props
}: Readonly<
  Omit<ComponentProps<typeof Input>, 'type' | 'value' | 'onChange'> & {
    value: string
    onValueChange: (value: string) => void
    icon?: boolean
    loading?: boolean
  }
>) {
  const inputRef = useRef<HTMLInputElement>(null)
  const canClear = value !== '' && !disabled

  return (
    <div className={cn('relative flex w-full items-center', className)}>
      {icon && <SearchIcon className="pointer-events-none absolute left-3 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
      <Input
        ref={inputRef}
        type="search"
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn(icon && 'pl-9', canClear && 'pr-9')}
        {...props}
      />
      {loading && <Spinner aria-hidden="true" className={cn('absolute size-4', canClear ? 'right-10' : 'right-3')} />}
      {canClear && (
        <Button
          type="button"
          variant="tertiary"
          size="icon"
          className="absolute right-1 size-7 text-muted-foreground"
          aria-label="Borrar búsqueda"
          onClick={() => {
            onValueChange('')
            inputRef.current?.focus()
          }}
        >
          <XIcon />
        </Button>
      )}
    </div>
  )
}
