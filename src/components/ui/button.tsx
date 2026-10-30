// oxlint-disable react/only-export-components
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

// Solo hay 3 tipos de botón: primary (acción principal, siempre con icono a la
// izquierda), secondary (acción alternativa) y tertiary (baja énfasis, enlaces
// e iconos). `tone="destructive"` solo tiñe la acción de peligro.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary:
          "border border-input bg-card hover:bg-accent hover:text-accent-foreground",
        tertiary:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
      },
      tone: {
        default: "",
        destructive: "",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        icon: "size-9",
      },
    },
    compoundVariants: [
      { variant: "primary", tone: "destructive", className: "bg-destructive text-destructive-foreground hover:bg-destructive/90" },
      { variant: ["secondary", "tertiary"], tone: "destructive", className: "text-destructive hover:bg-destructive/10 hover:text-destructive" },
    ],
    defaultVariants: {
      variant: "primary",
      tone: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "primary",
  tone = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-tone={tone}
      data-size={size}
      className={cn(buttonVariants({ variant, tone, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
