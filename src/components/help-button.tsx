import { CircleHelpIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Botón de la cabecera que abre el tutorial del sistema. */
export function HelpButton({ onClick }: Readonly<{ onClick: () => void }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="tertiary" size="icon" onClick={onClick} aria-label="Ver tutorial del sistema" data-tour="help">
          <CircleHelpIcon aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Ayuda</TooltipContent>
    </Tooltip>
  )
}
