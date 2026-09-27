import type { FormEvent, ReactNode } from 'react'
import { PencilIcon, PlusIcon, PowerOffIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Career } from '@/lib/api'
import type { TutoringCatalogs } from './tutoring-hooks'

export function ErrorNotice({ message, retry }: Readonly<{ message?: string | null; retry?: () => unknown }>) {
  if (!message) return null
  return <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>{message}</span>{retry && <Button type="button" variant="outline" size="sm" onClick={() => void retry()}>Reintentar</Button>}</AlertDescription></Alert>
}

export function ScopeNotice({ catalogs }: Readonly<{ catalogs: TutoringCatalogs }>) {
  if (catalogs.error) return <ErrorNotice message={catalogs.error} retry={catalogs.reload} />
  if (catalogs.loading) return <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner aria-hidden="true" />Cargando carreras y catálogos…</p>
  if (catalogs.careers.length === 0) return <Alert><AlertDescription>No tienes carreras disponibles para coordinar. Solicita al administrador que asigne una carrera activa a tu cuenta.</AlertDescription></Alert>
  return null
}

export function ModuleHeader({ title, description, createLabel, onCreate, disabled }: Readonly<{ title: string; description: string; createLabel: string; onCreate: () => void; disabled: boolean }>) {
  return <AdminSectionHeader title={title} description={description} actions={<Button type="button" disabled={disabled} onClick={onCreate} className="bg-brand-red hover:bg-brand-red/90 text-white font-semibold"><PlusIcon data-icon="inline-start" />{createLabel}</Button>} />
}

export function CatalogFilters({ search, onSearch, careerId, onCareer, careers }: Readonly<{ search: string; onSearch: (value: string) => void; careerId?: string; onCareer?: (value: string) => void; careers?: readonly Career[] }>) {
  return <FieldGroup className="flex flex-col gap-4 sm:flex-row">
    <Field className="flex-1"><FieldLabel htmlFor="tutoring-search">Buscar</FieldLabel><Input id="tutoring-search" type="search" placeholder="Escribe para buscar…" value={search} onChange={(event) => onSearch(event.target.value)} /></Field>
    {onCareer && <Field className="flex-1"><FieldLabel htmlFor="tutoring-career-filter">Carrera</FieldLabel><NativeSelect id="tutoring-career-filter" value={careerId} onChange={(event) => onCareer(event.target.value)}><option value="">Todas mis carreras</option>{careers?.map((career) => <option key={career.id} value={career.id}>{career.name}</option>)}</NativeSelect></Field>}
  </FieldGroup>
}

export function RecordTable<T extends { readonly id: number }>({ rows, columns, loading, empty }: Readonly<{ rows: readonly T[]; columns: readonly { label: string; render: (row: T) => ReactNode }[]; loading: boolean; empty: string }>) {
  return <div className="rounded-xl border bg-card" aria-busy={loading}>
    <Table><TableHeader><TableRow>{columns.map((column) => <TableHead key={column.label}>{column.label}</TableHead>)}</TableRow></TableHeader><TableBody>
      {loading ? <TableRow><TableCell colSpan={columns.length}><span role="status" className="flex items-center gap-2 py-5"><Spinner aria-hidden="true" />Cargando…</span></TableCell></TableRow> : rows.length === 0 ? <TableRow><TableCell colSpan={columns.length} className="py-8 whitespace-normal text-muted-foreground">{empty}</TableCell></TableRow> : rows.map((row) => <TableRow key={row.id}>{columns.map((column) => <TableCell key={column.label} className="whitespace-normal">{column.render(row)}</TableCell>)}</TableRow>)}
    </TableBody></Table>
  </div>
}

export function RecordActions({ name, onEdit, onDeactivate, disabled, children }: Readonly<{ name: string; onEdit?: () => void; onDeactivate?: () => void; disabled: boolean; children?: ReactNode }>) {
  return <div className="flex flex-wrap items-center gap-2">{children}{onEdit && <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onEdit} aria-label={`Editar ${name}`}><PencilIcon data-icon="inline-start" />Editar</Button>}{onDeactivate && <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onDeactivate} aria-label={`Desactivar ${name}`}><PowerOffIcon data-icon="inline-start" />Desactivar</Button>}</div>
}

export function MutationDialog({ open, title, description, pending, error, dirty, onClose, onSubmit, children, submitLabel = 'Guardar cambios', submitDisabled = false }: Readonly<{ open: boolean; title: string; description?: string; pending: boolean; error: string | null; dirty: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; children: ReactNode; submitLabel?: string; submitDisabled?: boolean }>) {
  return <Dialog open={open} title={title} description={description} confirmClose={dirty} onClose={() => { if (!pending) onClose() }} maxWidth="max-w-xl">
    <form onSubmit={onSubmit} aria-label={title} className="max-h-[65vh] overflow-y-auto p-1">
      <fieldset disabled={pending}><FieldGroup>{children}<ErrorNotice message={error} /><div className="flex flex-wrap justify-end gap-3"><DialogCancelButton disabled={pending}>Cancelar</DialogCancelButton><Button type="submit" disabled={pending || submitDisabled}>{pending && <Spinner data-icon="inline-start" aria-hidden="true" />}{pending ? 'Guardando…' : submitLabel}</Button></div></FieldGroup></fieldset>
    </form>
  </Dialog>
}

export function SelectField({ id, label, value, onChange, children, disabled = false, required = true }: Readonly<{ id: string; label: string; value: string; onChange: (value: string) => void; children: ReactNode; disabled?: boolean; required?: boolean }>) {
  return <Field><FieldLabel htmlFor={id}>{label}</FieldLabel><NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} required={required}>{children}</NativeSelect></Field>
}
