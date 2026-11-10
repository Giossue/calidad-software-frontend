import { CheckIcon } from 'lucide-react'

import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

/**
 * Pasos de un formulario largo, como en sílabos: número (o visto si ya se completó),
 * título y una línea hasta el siguiente. En móvil solo se lee el título del paso actual.
 */
export function StepProgress({ steps, current, label }: Readonly<{ steps: readonly string[]; current: number; label: string }>) {
  return (
    <nav aria-label={label}>
      <ol className="flex items-center gap-2">
        {steps.map((title, index) => {
          const state = index < current ? 'done' : index === current ? 'current' : 'pending'
          return (
            <li key={title} className="flex min-w-0 items-center gap-2 not-last:flex-1" aria-current={state === 'current' ? 'step' : undefined}>
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                  state === 'done' && 'border-transparent bg-primary text-primary-foreground',
                  state === 'current' && 'border-border bg-card text-foreground',
                  state === 'pending' && 'border-ring/40 bg-ring/15 text-foreground',
                )}
              >
                {state === 'done' ? <CheckIcon className="size-3.5" aria-hidden="true" /> : index + 1}
              </span>
              <span className={cn('truncate text-sm', state === 'pending' ? 'text-muted-foreground' : 'font-medium', state !== 'current' && 'max-sm:sr-only')}>
                {title}
                <span className="sr-only">{state === 'done' ? ' (completado)' : state === 'current' ? ' (actual)' : ''}</span>
              </span>
              {index < steps.length - 1 && <Separator className="min-w-4 flex-1" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
