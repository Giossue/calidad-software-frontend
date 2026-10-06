import * as React from "react"

import { cn } from "@/lib/utils"

// Copia el texto de cada encabezado como etiqueta de su celda (data-label). En móvil, las
// tablas `stacked` se muestran como tarjetas y esa etiqueta nombra cada dato (ver index.css).
function labelCells(table: HTMLTableElement) {
  const labels = Array.from(table.querySelectorAll('thead th'), (th) => th.textContent?.trim() ?? '')
  table.querySelectorAll('tbody tr').forEach((row) => {
    let column = 0
    Array.from(row.children).forEach((cell) => {
      const span = (cell as HTMLTableCellElement).colSpan || 1
      const label = span === 1 ? labels[column] : undefined
      if (label) cell.setAttribute('data-label', label)
      else cell.removeAttribute('data-label')
      column += span
    })
  })
}

function Table({ className, stacked = false, cardTitle = false, ...props }: React.ComponentProps<"table"> & {
  // En pantallas pequeñas, cada fila se muestra como una tarjeta en lugar de una tabla.
  stacked?: boolean
  // Con `stacked`, la primera celda se usa como título de la tarjeta (ancho completo y sin etiqueta).
  cardTitle?: boolean
}) {
  const ref = React.useRef<HTMLTableElement>(null)

  // Sin dependencias: las filas llegan como `children` y cambian con cada render.
  React.useEffect(() => {
    if (stacked && ref.current) labelCells(ref.current)
  })

  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        ref={ref}
        data-slot="table"
        data-stacked={stacked ? "" : undefined}
        data-card-title={stacked && cardTitle ? "" : undefined}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "bg-table-header font-semibold [&_tr]:border-b [&_tr:hover]:bg-transparent",
        className
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
