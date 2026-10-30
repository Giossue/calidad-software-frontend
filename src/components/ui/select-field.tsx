import type { ReactNode } from 'react'

import { FormField } from '@/components/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface SelectOption {
  readonly value: string
  readonly label: ReactNode
  readonly disabled?: boolean
}

// Radix no admite opciones con valor vacío: la opción "todas/ninguna" usa este valor interno.
const EMPTY = '__empty__'

/**
 * Select de shadcn con API de opciones. `value` vacío muestra `placeholder`; con
 * `emptyLabel` hay además una opción que devuelve '' (p. ej. "Todas las carreras").
 */
export function SelectInput({
  id,
  name,
  value,
  onValueChange,
  options,
  placeholder = 'Selecciona una opción',
  emptyLabel,
  disabled = false,
  invalid = false,
  className,
  ariaLabel,
}: Readonly<{
  id?: string
  name?: string
  value: string
  onValueChange: (value: string) => void
  options: readonly SelectOption[]
  placeholder?: string
  emptyLabel?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
  ariaLabel?: string
}>) {
  return (
    <Select
      name={name}
      value={value === '' && emptyLabel ? EMPTY : value}
      onValueChange={(next) => onValueChange(next === EMPTY ? '' : next)}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} aria-invalid={invalid} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {emptyLabel && <SelectItem value={EMPTY}>{emptyLabel}</SelectItem>}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** `SelectInput` con la etiqueta, el tooltip y el error estándar de `FormField`. */
export function SelectField({
  id,
  label,
  tip,
  optional,
  error,
  className,
  ...select
}: Readonly<
  Omit<Parameters<typeof SelectInput>[0], 'invalid'> & {
    id: string
    label: ReactNode
    tip?: ReactNode
    optional?: boolean
    error?: string | null
  }
>) {
  return (
    <FormField id={id} label={label} tip={tip} optional={optional} error={error} className={className}>
      <SelectInput id={id} invalid={Boolean(error)} {...select} />
    </FormField>
  )
}
