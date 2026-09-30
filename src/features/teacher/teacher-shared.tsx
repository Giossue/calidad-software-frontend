import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GraduationCapIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorNotice } from '@/features/tutoring/tutoring-shared'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { teacherApi, type TeacherTutoring } from '@/lib/teacher-api'

export function TeacherEmpty({ title, description }: Readonly<{ title: string; description?: string }>) {
  return <Empty><EmptyHeader><EmptyMedia variant="icon"><GraduationCapIcon /></EmptyMedia><EmptyTitle>{title}</EmptyTitle>{description && <EmptyDescription>{description}</EmptyDescription>}</EmptyHeader></Empty>
}

export function TeacherWorkspacePage({ title, description, children }: Readonly<{ title: string; description: string; children: (tutoring: TeacherTutoring) => ReactNode }>) {
  const resource = useDegreeResource(() => teacherApi.allTutorings())
  const [params, setParams] = useSearchParams()
  const tutorings = resource.data ?? []
  const requested = params.get('tutoring')
  const selected = requested ? tutorings.find((item) => String(item.id) === requested) : tutorings.find((item) => item.can_manage) ?? tutorings[0]

  return <section className="flex flex-col gap-6">
    <AdminSectionHeader title={title} description={description} />
    <ErrorNotice message={resource.error} retry={resource.reload} />
    {resource.loading ? <div role="status" aria-label="Cargando tutorías" className="flex flex-col gap-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-48 w-full" /></div> : !resource.error && tutorings.length === 0 ? <TeacherEmpty title="Aún no tienes tutorías asignadas" description="El Coordinador de Carrera asignará las tutorías que tendrás a tu cargo." /> : tutorings.length > 0 ? <>
      <Card>
        <CardHeader><CardTitle>Tutoría seleccionada</CardTitle><CardDescription>Elige la asignatura y el período con los que vas a trabajar.</CardDescription></CardHeader>
        <CardContent>
          <Field className="max-w-2xl"><FieldLabel htmlFor="teacher-tutoring">Tutoría</FieldLabel><NativeSelect id="teacher-tutoring" value={selected?.id ?? ''} onChange={(event) => setParams({ tutoring: event.target.value })}>
            {!selected && <option value="">Selecciona una tutoría asignada</option>}
            {tutorings.map((item) => <option key={item.id} value={item.id}>{item.subject_name} · {item.period_name} · {item.cycle_name}{item.section_name ? ` ${item.section_name}` : ''}{item.can_manage ? '' : ' (solo consulta)'}</option>)}
          </NativeSelect>{selected && <FieldDescription>{selected.career_name} · {selected.modality_name}</FieldDescription>}</Field>
        </CardContent>
      </Card>
      {!selected ? <Alert><AlertDescription>Esta tutoría ya no está asignada a tu cuenta. Selecciona otra tutoría.</AlertDescription></Alert> : <>
        {!selected.can_manage && <Alert><AlertDescription>Esta tutoría o su período están inactivos. Puedes consultar su historial.</AlertDescription></Alert>}
        <div key={selected.id}>{children(selected)}</div>
      </>}
    </> : null}
  </section>
}

export function TeacherFilters({ id, search, onSearch, status, onStatus }: Readonly<{ id: string; search: string; onSearch: (value: string) => void; status?: '' | 'active' | 'inactive'; onStatus?: (value: '' | 'active' | 'inactive') => void }>) {
  return <FieldGroup className="flex flex-col gap-4 sm:flex-row sm:items-end">
    <Field className="flex-1"><FieldLabel htmlFor={`${id}-search`}>Buscar</FieldLabel><Input id={`${id}-search`} type="search" placeholder="Escribe para buscar…" value={search} onChange={(event) => onSearch(event.target.value)} /></Field>
    {onStatus && <Field className="sm:w-48"><FieldLabel htmlFor={`${id}-status`}>Estado</FieldLabel><NativeSelect id={`${id}-status`} value={status} onChange={(event) => onStatus(event.target.value as '' | 'active' | 'inactive')}><option value="">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></NativeSelect></Field>}
  </FieldGroup>
}
