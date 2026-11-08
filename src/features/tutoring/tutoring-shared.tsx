import type { ReactNode } from 'react'
import { PencilIcon, PlusIcon, PowerOffIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ErrorNotice } from '@/components/ui/error-notice'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import { FormField } from '@/components/ui/form-field'
import { IconAction } from '@/components/ui/icon-action'
import { SearchInput } from '@/components/ui/search-input'
import { SelectInput } from '@/components/ui/select-field'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Career } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { TutoringCatalogs } from './tutoring-hooks'

export function ScopeNotice({ catalogs }: Readonly<{ catalogs: TutoringCatalogs }>) {
  if (catalogs.error) return <ErrorNotice message={catalogs.error} retry={catalogs.reload} />
  if (catalogs.loading) return <div role="status" aria-label="Cargando carreras y catálogos" className="flex flex-col gap-2"><Skeleton className="h-5 w-64" /><Skeleton className="h-5 w-40" /></div>
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

function LoadingRows({ columns }: Readonly<{ columns: number }>) {
  return <TableRow><TableCell colSpan={columns} className="whitespace-normal"><div role="status" aria-label="Cargando" className="flex flex-col gap-3 py-2"><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-4/5" /><Skeleton className="h-5 w-3/5" /></div></TableCell></TableRow>
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
  return <Card className="overflow-hidden shadow-none max-md:overflow-visible max-md:border-0 max-md:bg-transparent" aria-busy={loading} data-tour="page-table">
    <Table stacked cardTitle><TableHeader><TableRow>{columns.map((column) => <TableHead key={column.label}>{column.label}</TableHead>)}</TableRow></TableHeader><TableBody {...(numbered ? { 'data-numbered': '', style: { counterReset: `row-number ${(numberFrom ?? 1) - 1}` } } : {})}>
      {loading ? <LoadingRows columns={columns.length} /> : rows.length === 0 ? <TableRow><TableCell colSpan={columns.length} className="py-8 whitespace-normal text-muted-foreground">{empty}</TableCell></TableRow> : rows.map((row) => <TableRow key={row.id} {...(onRowClick ? { tabIndex: 0, title: rowTitle?.(row), 'aria-selected': isRowSelected?.(row), className: cn('cursor-pointer', isRowSelected?.(row) && 'bg-muted/60'), onClick: () => onRowClick(row), onKeyDown: (event: React.KeyboardEvent) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onRowClick(row) } } } : {})}>{columns.map((column, index) => {
        // `span` agrupa filas: 0 omite la celda (la cubre la de arriba) y n > 1 la extiende n filas.
        const span = column.span?.(row) ?? 1
        return span === 0 ? null : <TableCell key={column.label} rowSpan={span > 1 ? span : undefined} className={cn('whitespace-normal', span > 1 && 'align-top')} data-row-number={numbered && index === 0 ? '' : undefined}>{column.render(row)}</TableCell>
      })}</TableRow>)}
    </TableBody></Table>
  </Card>
}

export function RecordActions({ name, onEdit, onDeactivate, disabled, children }: Readonly<{ name: string; onEdit?: () => void; onDeactivate?: () => void; disabled: boolean; children?: ReactNode }>) {
  return <div className="flex flex-wrap items-center gap-1">{children}{onEdit && <IconAction label={`Editar ${name}`} icon={PencilIcon} disabled={disabled} onClick={onEdit} />}{onDeactivate && <IconAction label={`Desactivar ${name}`} icon={PowerOffIcon} tone="destructive" disabled={disabled} onClick={onDeactivate} />}</div>
}
