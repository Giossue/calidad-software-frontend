import { CircleHelpIcon, CompassIcon, MousePointerClickIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Botón de la cabecera que abre la guía de la pantalla actual o el recorrido general. */
export function HelpButton({ onPageTour, onGeneralTour }: Readonly<{ onPageTour: () => void; onGeneralTour: () => void }>) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="tertiary" size="icon" aria-label="Ayuda" data-tour="help">
              <CircleHelpIcon aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Ayuda</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onSelect={onPageTour}>
          <MousePointerClickIcon aria-hidden="true" />
          Guía de esta pantalla
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onGeneralTour}>
          <CompassIcon aria-hidden="true" />
          Recorrido general del sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
