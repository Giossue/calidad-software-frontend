import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type TableMeta } from '@tanstack/react-table'

import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type DataTableProps<TData, TValue> = Readonly<{
  columns: ColumnDef<TData, TValue>[]
  data: readonly TData[]
  getRowId?: (row: TData) => string
  emptyMessage?: string
  // Clases del contenedor (ej. altura máxima con scroll interno).
  className?: string
  // Hace clicable toda la fila (el control interactivo de la fila debe frenar la propagación).
  onRowClick?: (row: TData) => void
  // Filas más bajas, para listas largas.
  dense?: boolean
  // Estado compartido con las celdas (table.options.meta). Permite que `columns` sea estable:
  // si cambiaran en cada render, React remontaría las celdas y se perdería el foco del teclado.
  meta?: TableMeta<TData>
}>

// Data Table de shadcn/ui (TanStack Table): tabla declarativa a partir de la definición de columnas.
export function DataTable<TData, TValue>({ columns, data, getRowId, emptyMessage = 'Sin resultados.', className, onRowClick, dense, meta }: DataTableProps<TData, TValue>) {
  const table = useReactTable({ data: data as TData[], columns, getCoreRowModel: getCoreRowModel(), getRowId, meta })

  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card', className)}>
      <Table stacked>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className={cn(onRowClick && 'cursor-pointer')} onClick={onRowClick ? () => onRowClick(row.original) : undefined}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className={cn('whitespace-normal', dense && 'py-2')}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">{emptyMessage}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
