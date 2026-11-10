import { AccessibilityIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Botón de la cabecera que abre las opciones de accesibilidad. */
export function AccessibilityButton({ onClick }: Readonly<{ onClick: () => void }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="tertiary"
          size="icon"
          onClick={onClick}
          aria-label="Opciones de accesibilidad"
          data-tour="accessibility"
        >
          <AccessibilityIcon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Accesibilidad</TooltipContent>
    </Tooltip>
  )
}
