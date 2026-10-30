import type { ReactNode } from 'react'
import { InfoIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Icono de ayuda junto a una etiqueta: la información extra va en un tooltip, no bajo el campo. */
export function InfoTip({ children, label = 'Más información' }: Readonly<{ children: ReactNode; label?: string }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="tertiary" className="size-5 rounded-full p-0 text-muted-foreground" aria-label={label}>
          <InfoIcon className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-balance">{children}</TooltipContent>
    </Tooltip>
  )
}
