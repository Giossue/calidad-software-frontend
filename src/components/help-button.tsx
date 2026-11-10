import { CircleHelpIcon, CompassIcon, GraduationCapIcon, MousePointerClickIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * Botón de la cabecera que abre la guía de la pantalla actual o el recorrido general.
 * Con `onTeacherGuide` (cuentas de docente) ofrece también el tutorial práctico.
 */
export function HelpButton({ onPageTour, onGeneralTour, onTeacherGuide }: Readonly<{ onPageTour: () => void; onGeneralTour: () => void; onTeacherGuide?: () => void }>) {
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
      <DropdownMenuContent align="end" className="w-64" onCloseAutoFocus={(event) => event.preventDefault()}>
        {onTeacherGuide && (
          <DropdownMenuItem onSelect={onTeacherGuide}>
            <GraduationCapIcon aria-hidden="true" />
            Tutorial práctico del docente
          </DropdownMenuItem>
        )}
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
