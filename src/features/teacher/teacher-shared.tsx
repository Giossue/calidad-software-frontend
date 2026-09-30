import { GraduationCapIcon } from 'lucide-react'

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'

export function TeacherEmpty({ title, description }: Readonly<{ title: string; description?: string }>) {
  return <Empty><EmptyHeader><EmptyMedia variant="icon"><GraduationCapIcon /></EmptyMedia><EmptyTitle>{title}</EmptyTitle>{description && <EmptyDescription>{description}</EmptyDescription>}</EmptyHeader></Empty>
}

export function TeacherFilters({ id, search, onSearch, status, onStatus }: Readonly<{ id: string; search: string; onSearch: (value: string) => void; status?: '' | 'active' | 'inactive'; onStatus?: (value: '' | 'active' | 'inactive') => void }>) {
  return <FieldGroup className="flex flex-col gap-4 sm:flex-row sm:items-end">
    <Field className="flex-1"><FieldLabel htmlFor={`${id}-search`}>Buscar</FieldLabel><Input id={`${id}-search`} type="search" placeholder="Escribe para buscar…" value={search} onChange={(event) => onSearch(event.target.value)} /></Field>
    {onStatus && <Field className="sm:w-48"><FieldLabel htmlFor={`${id}-status`}>Estado</FieldLabel><NativeSelect id={`${id}-status`} value={status} onChange={(event) => onStatus(event.target.value as '' | 'active' | 'inactive')}><option value="">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></NativeSelect></Field>}
  </FieldGroup>
}
