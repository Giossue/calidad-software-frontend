import { RefreshCwIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Botón terciario de solo icono para volver a cargar datos; el texto va en el tooltip. */
export function RefreshButton({
  onClick,
  loading = false,
  disabled = false,
  label = 'Actualizar',
}: Readonly<{ onClick: () => void; loading?: boolean; disabled?: boolean; label?: string }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="tertiary" size="icon" onClick={onClick} disabled={disabled || loading} aria-label={label}>
          {loading ? <Spinner /> : <RefreshCwIcon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
