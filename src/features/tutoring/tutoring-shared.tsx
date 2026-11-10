import { useState, type ReactNode } from 'react'
import { PencilIcon, PlusIcon, PowerOffIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ErrorNotice } from '@/components/ui/error-notice'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { FormField } from '@/components/ui/form-field'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterBarSkeleton, TableRowsSkeleton, TableSkeleton } from '@/components/ui/loading-skeletons'
import { RowActionsMenu } from '@/components/ui/row-actions-menu'
import { SearchInput } from '@/components/ui/search-input'
import { SelectInput } from '@/components/ui/select-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Career } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { TutoringCatalogs } from './tutoring-hooks'

export function ScopeNotice({ catalogs }: Readonly<{ catalogs: TutoringCatalogs }>) {
  if (catalogs.error) return <ErrorNotice message={catalogs.error} retry={catalogs.reload} />
  if (catalogs.loading) return <div className="flex flex-col gap-6"><span role="status" aria-label="Cargando carreras y catálogos" className="sr-only">Cargando carreras y catálogos</span><FilterBarSkeleton /><TableSkeleton /></div>
  if (catalogs.careers.length === 0) return <Alert><AlertDescription>No tienes carreras disponibles para coordinar. Solicita al administrador que asigne una carrera activa a tu cuenta.</AlertDescription></Alert>
  return null
}

export function ModuleHeader({ title, description, createLabel, onCreate, disabled, extraActions }: Readonly<{ title: string; description?: string; createLabel?: string; onCreate?: () => void; disabled?: boolean; extraActions?: ReactNode }>) {
  return <AdminSectionHeader title={title} description={description} actions={<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">{extraActions}{onCreate && createLabel && <Button type="button" disabled={disabled} onClick={onCreate} className="w-full sm:w-auto" data-tour="page-create"><PlusIcon data-icon="inline-start" />{createLabel}</Button>}</div>} />
}

export function CatalogFilters({ search, onSearch, careerId, onCareer, careers }: Readonly<{ search: string; onSearch: (value: string) => void; careerId?: string; onCareer?: (value: string) => void; careers?: readonly Career[] }>) {
  return <FieldGroup className="flex flex-col gap-4 sm:flex-row" data-tour="page-filters">
    <FormField id="tutoring-search" label="Buscar" className="flex-1"><SearchInput id="tutoring-search" placeholder="Escribe para buscar…" value={search} onValueChange={onSearch} /></FormField>
    {onCareer && <FormField id="tutoring-career-filter" label="Carrera" className="flex-1"><SelectInput id="tutoring-career-filter" value={careerId ?? ''} onValueChange={onCareer} emptyLabel="Todas mis carreras" options={(careers ?? []).map((career) => ({ value: String(career.id), label: career.name }))} /></FormField>}
  </FieldGroup>
}


/**
 * Una columna puede agrupar filas con `span` (p. ej. un docente con varias asignaturas).
 * `numberFrom` agrega al inicio la columna «#» con la numeración de las filas, empezando
 * en ese número (en listas paginadas, el `from` de la página) para que siga entre páginas.
 */
export function RecordTable<T extends { readonly id: number | string }>({ rows, columns: baseColumns, loading, empty, onRowClick, rowTitle, isRowSelected, numberFrom }: Readonly<{ rows: readonly T[]; columns: readonly { label: string; render: (row: T) => ReactNode; span?: (row: T) => number }[]; loading: boolean; empty: ReactNode; onRowClick?: (row: T) => void; rowTitle?: (row: T) => string; isRowSelected?: (row: T) => boolean; numberFrom?: number | null }>) {
  const numbered = numberFrom !== undefined
  const columns: readonly { label: string; render: (row: T) => ReactNode; span?: (row: T) => number }[] = !numbered ? baseColumns : [
    { label: '#', render: (row: T) => <span className="text-sm tabular-nums text-muted-foreground">{(numberFrom ?? 1) + rows.indexOf(row)}</span> },
    ...baseColumns,
  ]
  // Filas agrupadas (una celda con `span` cubre varias): el color alterno va por grupo, no por fila.
  const grouped = columns.some((column) => column.span)
  // Al pasar el cursor por una fila de un grupo se resalta el grupo completo.
  const [hoveredGroup, setHoveredGroup] = useState<number | null>(null)
  const groupIndex: number[] = []
  rows.forEach((row, index) => {
    const startsGroup = index === 0 || !columns.some((column) => column.span?.(row) === 0)
    groupIndex.push(index === 0 ? 0 : groupIndex[index - 1] + (startsGroup ? 1 : 0))
  })
  return <div aria-busy={loading} data-tour="page-table">
    <Table stacked cardTitle><TableHeader><TableRow>{columns.map((column) => <TableHead key={column.label}>{column.label}</TableHead>)}</TableRow></TableHeader><TableBody {...(numbered ? { 'data-numbered': '', style: { counterReset: `row-number ${(numberFrom ?? 1) - 1}` } } : {})}>
      {loading ? <TableRowsSkeleton columns={columns.length} /> : rows.length === 0 ? <TableRow className="hover:bg-transparent"><TableCell colSpan={columns.length} className="whitespace-normal p-0">{typeof empty === 'string' ? <EmptyState>{empty}</EmptyState> : <div className="flex min-h-40 flex-col items-center justify-center px-4 py-8 text-center">{empty}</div>}</TableCell></TableRow> : rows.map((row, rowIndex) => <TableRow key={row.id} data-group={grouped ? (groupIndex[rowIndex] % 2 === 0 ? 'odd' : 'even') : undefined} data-hovered={grouped && hoveredGroup === groupIndex[rowIndex] ? '' : undefined} onMouseEnter={grouped ? () => setHoveredGroup(groupIndex[rowIndex]) : undefined} onMouseLeave={grouped ? () => setHoveredGroup(null) : undefined} {...(onRowClick ? { tabIndex: 0, title: rowTitle?.(row), 'aria-selected': isRowSelected?.(row), className: cn('cursor-pointer', isRowSelected?.(row) && 'bg-muted/60'), onClick: () => onRowClick(row), onKeyDown: (event: React.KeyboardEvent) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onRowClick(row) } } } : {})}>{columns.map((column, index) => {
        // `span` agrupa filas: 0 omite la celda (la cubre la de arriba) y n > 1 la extiende n filas.
        // En las filas de un grupo la primera celda del DOM no es la primera columna: conserva su borde izquierdo.
        const span = column.span?.(row) ?? 1
        return span === 0 ? null : <TableCell key={column.label} rowSpan={span > 1 ? span : undefined} className={cn('whitespace-normal', span > 1 && 'align-top', index > 0 && 'first:border-l!')} data-row-number={numbered && index === 0 ? '' : undefined}>{column.render(row)}</TableCell>
      })}</TableRow>)}
    </TableBody></Table>
  </div>
}

/** Acciones habituales de un registro (editar, desactivar) en el menú "⋯" de la fila. */
export function RecordActions({ name, onEdit, onDeactivate, disabled }: Readonly<{ name: string; onEdit?: () => void; onDeactivate?: () => void; disabled: boolean }>) {
  return <RowActionsMenu name={name} disabled={disabled} actions={[
    { label: 'Editar', icon: PencilIcon, onSelect: () => onEdit?.(), visible: Boolean(onEdit) },
    { label: 'Desactivar', icon: PowerOffIcon, onSelect: () => onDeactivate?.(), tone: 'destructive', visible: Boolean(onDeactivate) },
  ]} />
}

/**
 * Elige el ciclo de la carrera con un desplegable (en lugar de una fila de pestañas que no
 * cabe cuando la carrera tiene muchos ciclos). El último ciclo se marca como titulación.
 * `extraOptions` agrega opciones al final (p. ej. "Sin ciclo").
 */
export function CycleSelect({ id, levels, value, onChange, degreeCycleNumber, extraOptions = [] }: Readonly<{
  id: string
  levels: readonly { readonly number: number }[]
  value: string
  onChange: (value: string) => void
  degreeCycleNumber: number | null
  extraOptions?: readonly { value: string; label: string }[]
}>) {
  const options = [
    ...levels.map((level) => ({ value: String(level.number), label: `${level.number}° ciclo${level.number === degreeCycleNumber ? ' · Titulación' : ''}` })),
    ...extraOptions,
  ]
  return (
    <div role="group" aria-label="Ciclos de la carrera" className="shrink-0">
      <SelectInput id={id} ariaLabel="Ciclo" value={value} onValueChange={onChange} options={options} className="w-52" />
    </div>
  )
}
