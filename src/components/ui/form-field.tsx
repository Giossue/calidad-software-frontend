import type { ReactNode } from 'react'

import { Field, FieldCounter, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { cn } from '@/lib/utils'

/**
 * Campo de formulario estándar: etiqueta con "(Opcional)", ayuda visible bajo el
 * campo (`tip`), contador y mensaje de error en línea.
 */
export function FormField({
  id,
  label,
  tip,
  optional = false,
  counter,
  error,
  className,
  labelClassName,
  children,
}: Readonly<{
  id: string
  label: ReactNode
  /** Ayuda breve: se muestra siempre bajo el campo, no escondida en un tooltip. */
  tip?: ReactNode
  optional?: boolean
  counter?: { current: number; max: number }
  error?: string | null
  className?: string
  labelClassName?: string
  children: ReactNode
}>) {
  return (
    <Field data-invalid={Boolean(error)} className={cn(className)}>
      <div className={cn('flex items-center justify-between gap-2', labelClassName?.includes('sr-only') && !counter && 'sr-only')}>
        <FieldLabel htmlFor={id} className={labelClassName}>
          {label}
          {optional && <span className="text-xs font-normal text-muted-foreground">(Opcional)</span>}
        </FieldLabel>
        {counter && <FieldCounter current={counter.current} max={counter.max} />}
      </div>
      {children}
      {tip && <FieldDescription>{tip}</FieldDescription>}
      <FieldError>{error}</FieldError>
    </Field>
  )
}
