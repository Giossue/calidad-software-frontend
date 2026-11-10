"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Label as LabelPrimitive } from "radix-ui"

function Label({
  className,
  required = false,
  children,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & {
  // Marca el campo como obligatorio: asterisco visible y texto para lectores de pantalla.
  required?: boolean
}) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      {required ? (
        <>
          <span className="-ml-1 text-destructive" aria-hidden="true">*</span>
          <span className="sr-only">(obligatorio)</span>
        </>
      ) : null}
    </LabelPrimitive.Root>
  )
}

export { Label }
