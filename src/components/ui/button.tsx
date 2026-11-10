// oxlint-disable react/only-export-components
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"
import { Tooltip, TooltipContent, TooltipTrigger, useInsideTooltip } from "@/components/ui/tooltip"

// Solo hay 3 tipos de botón: primary (acción principal, siempre con icono a la
// izquierda), secondary (acción alternativa) y tertiary (baja énfasis, enlaces
// e iconos). `tone="destructive"` solo tiñe la acción de peligro.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all outline-hidden disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-button-primary text-button-primary-foreground hover:bg-button-primary/90",
        secondary: "border border-border bg-field shadow-control hover:bg-accent hover:text-accent-foreground",
        tertiary: "hover:bg-accent hover:text-accent-foreground",
      },
      tone: {
        default: "",
        destructive: "",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    compoundVariants: [
      { variant: "primary", tone: "destructive", className: "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/30" },
      { variant: ["secondary", "tertiary"], tone: "destructive", className: "text-destructive hover:bg-destructive/10 hover:text-destructive" },
    ],
    defaultVariants: {
      variant: "primary",
      tone: "default",
      size: "default",
    },
  }
)

const ICON_SIZES = new Set(["icon", "icon-sm", "icon-lg"])

function Button({
  className,
  variant = "primary",
  tone = "default",
  size = "default",
  asChild = false,
  tooltip,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /**
     * Texto del tooltip. Todo botón de solo icono muestra uno: por defecto su `aria-label`.
     * `false` lo desactiva (solo si el botón ya está dentro de otro tooltip o lo explica su contexto).
     */
    tooltip?: string | false
  }) {
  const Comp = asChild ? Slot.Root : "button"
  const insideTooltip = useInsideTooltip()
  const label = tooltip === false ? null : (tooltip ?? (ICON_SIZES.has(size ?? "") ? props["aria-label"] : undefined))

  const button = (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-tone={tone}
      data-size={size}
      className={cn(buttonVariants({ variant, tone, size, className }))}
      {...props}
    />
  )

  if (!label || insideTooltip) return button

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export { Button, buttonVariants }
