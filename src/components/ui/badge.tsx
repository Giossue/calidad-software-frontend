// oxlint-disable react/only-export-components
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex w-fit items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium gap-1 shrink-0 [&>svg]:size-3 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-ring/40 bg-ring/15 text-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        neutral: 'border-border bg-muted text-muted-foreground',
        success: 'border-success/30 bg-success/10 text-success',
        warning: 'border-warning/30 bg-warning/10 text-warning',
        danger: 'border-destructive/30 bg-destructive/10 text-destructive',
        inactive: 'border-border bg-muted text-muted-foreground',
        outline: 'border-border text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({ className, variant = 'default', ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
