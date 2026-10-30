import type { ReactNode } from 'react'

import { Field, FieldCounter, FieldError, FieldLabel } from '@/components/ui/field'
import { InfoTip } from '@/components/ui/info-tip'
import { cn } from '@/lib/utils'

/**
 * Campo de formulario estándar: etiqueta en negrita con "(Opcional)", tooltip de
 * ayuda (`tip`, en vez de texto bajo el campo), contador y mensaje de error.
 */
export function FormField({
  id,
  label,
  tip,
  optional = false,
  counter,
  error,
  className,
  children,
}: Readonly<{
  id: string
  label: ReactNode
  /** Información extra: va en un tooltip junto a la etiqueta. */
  tip?: ReactNode
  optional?: boolean
  counter?: { current: number; max: number }
  error?: string | null
  className?: string
  children: ReactNode
}>) {
  return (
    <Field data-invalid={Boolean(error)} className={cn(className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <FieldLabel htmlFor={id}>
            {label}
            {optional && <span className="text-xs font-normal text-muted-foreground">(Opcional)</span>}
          </FieldLabel>
          {tip && <InfoTip>{tip}</InfoTip>}
        </div>
        {counter && <FieldCounter current={counter.current} max={counter.max} />}
      </div>
      {children}
      <FieldError>{error}</FieldError>
    </Field>
  )
}
