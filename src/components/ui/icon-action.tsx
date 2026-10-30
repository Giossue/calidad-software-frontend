import type { LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Acción de solo icono (botón terciario) con su nombre en un tooltip; el nombre es también el `aria-label`. */
export function IconAction({
  label,
  icon: Icon,
  onClick,
  tone = 'default',
  disabled = false,
  loading = false,
  side,
}: Readonly<{
  label: string
  icon: LucideIcon
  onClick: () => void
  tone?: 'default' | 'destructive'
  disabled?: boolean
  loading?: boolean
  side?: 'top' | 'right' | 'bottom' | 'left'
}>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="tertiary" size="icon" tone={tone} onClick={onClick} disabled={disabled || loading} aria-label={label}>
          {loading ? <Spinner /> : <Icon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
