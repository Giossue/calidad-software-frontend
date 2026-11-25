import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { SelectInput } from '@/components/ui/select-field'
import type { CareerMalla } from '@/lib/tutoring-api'
import type { MallaSelection } from './tutoring-hooks'

const mallaOptionLabel = (malla: CareerMalla) => `${malla.name}${malla.is_current ? ' · Vigente' : ''}`

/**
 * Selector de la malla junto a la carrera. Con una sola malla no hay nada que elegir: se muestra
 * como texto, salvo con `onlyWhenChoice`, que lo oculta (las pantallas que solo filtran por malla).
 * `children` son acciones sobre la malla elegida.
 */
export function MallaPicker({ selection, label = 'Malla', onlyWhenChoice = false, disabled = false, children }: Readonly<{
  selection: MallaSelection
  label?: string
  onlyWhenChoice?: boolean
  disabled?: boolean
  children?: ReactNode
}>) {
  const { malla, mallas } = selection
  if (!malla || (onlyWhenChoice && !selection.canChange)) return null
  return (
    <div className="flex flex-wrap items-center gap-2" data-tour="page-malla">
      <span className="text-sm text-muted-foreground">{label}</span>
      {selection.canChange ? (
        <SelectInput
          id="tutoring-malla"
          ariaLabel="Malla"
          value={String(malla.id)}
          onValueChange={(value) => selection.select(Number(value))}
          disabled={disabled}
          className="w-64"
          options={mallas.map((item) => ({ value: String(item.id), label: mallaOptionLabel(item) }))}
        />
      ) : (
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          {malla.name}
          {malla.is_current && <Badge variant="secondary">Vigente</Badge>}
        </span>
      )}
      {children}
    </div>
  )
}
