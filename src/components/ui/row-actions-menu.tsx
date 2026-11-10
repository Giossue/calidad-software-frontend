import type { LucideIcon } from 'lucide-react'
import { MoreHorizontalIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'

export interface RowAction {
  readonly label: string
  readonly icon: LucideIcon
  readonly onSelect: () => void
  /** `destructive` va al final, separada y en rojo. */
  readonly tone?: 'default' | 'destructive'
  readonly disabled?: boolean
  readonly loading?: boolean
  /** En `false` la acción no se muestra (p. ej. sin permiso). */
  readonly visible?: boolean
}

/**
 * Acciones de una fila: un único botón "⋯" que abre un menú con cada acción escrita.
 * Evita columnas de iconos sueltos cuyo significado hay que adivinar.
 * `name` nombra la fila para el lector de pantalla: "Acciones para {name}".
 */
export function RowActionsMenu({ name, actions, disabled = false }: Readonly<{ name: string; actions: readonly RowAction[]; disabled?: boolean }>) {
  const shown = actions.filter((action) => action.visible !== false)
  if (shown.length === 0) return null
  const regular = shown.filter((action) => action.tone !== 'destructive')
  const destructive = shown.filter((action) => action.tone === 'destructive')
  const busy = shown.some((action) => action.loading)

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="tertiary" size="icon-sm" aria-label={`Acciones para ${name}`} disabled={disabled || busy} onClick={(event) => event.stopPropagation()}>
          {busy ? <Spinner aria-hidden="true" /> : <MoreHorizontalIcon aria-hidden="true" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48" onClick={(event) => event.stopPropagation()}>
        {regular.map((action) => <RowActionItem key={action.label} action={action} />)}
        {regular.length > 0 && destructive.length > 0 && <DropdownMenuSeparator />}
        {destructive.map((action) => <RowActionItem key={action.label} action={action} />)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function RowActionItem({ action }: Readonly<{ action: RowAction }>) {
  const Icon = action.icon
  return (
    <DropdownMenuItem
      variant={action.tone === 'destructive' ? 'destructive' : 'default'}
      disabled={action.disabled || action.loading}
      onSelect={action.onSelect}
    >
      {action.loading ? <Spinner aria-hidden="true" /> : <Icon aria-hidden="true" />}
      {action.label}
    </DropdownMenuItem>
  )
}
