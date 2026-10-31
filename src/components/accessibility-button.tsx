import { AccessibilityIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Botón flotante fijo abajo a la derecha que abre las opciones de accesibilidad. */
export function AccessibilityButton({ onClick }: Readonly<{ onClick: () => void }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          onClick={onClick}
          aria-label="Opciones de accesibilidad"
          className="fixed right-3 bottom-3 z-40 size-10 shadow-lg sm:right-6 sm:bottom-6 sm:size-12"
        >
          <AccessibilityIcon className="size-5 sm:size-6" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">Accesibilidad</TooltipContent>
    </Tooltip>
  )
}
