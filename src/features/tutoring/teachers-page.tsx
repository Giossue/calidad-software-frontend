import { useState, type FormEvent } from 'react'
import { CheckCircle2Icon, MoreVerticalIcon, PencilIcon, PowerOffIcon, RotateCcwIcon, XCircleIcon } from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Field, FieldCounter, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { StatusBadge } from '@/components/ui/status-badge'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { isValidEcuadorianCedula } from '@/lib/cedula'
import { sanitizeDigits, sanitizeLetters } from '@/lib/sanitize'
import { tutoringApi, type Teacher } from '@/lib/tutoring-api'
import { cn } from '@/lib/utils'
import { ErrorNotice, ModuleHeader, MutationDialog, RecordTable, ScopeNotice, SelectField } from './tutoring-shared'
import { useOperation, useTutoringCatalogs } from './tutoring-hooks'

const EMPTY_FORM = { career_id: '', identification: '', name: '', email: '', phone: '' }

export function TutoringTeachersPage() {
  const catalogs = useTutoringCatalogs()
  const [careerFilter, setCareerFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('')
  const list = usePaginatedCatalog(
    (page, search) => tutoringApi.teachers({
      page,
      search,
      career_id: Number(careerFilter) || undefined,
      status: statusFilter || undefined,
    }),
    `${careerFilter}|${statusFilter}`,
  )
  const operation = useOperation()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [initialForm, setInitialForm] = useState(EMPTY_FORM)
  const [deactivating, setDeactivating] = useState<Teacher | null>(null)

  function edit(teacher: Teacher | null) {
    const next = teacher ? { career_id: String(teacher.career_ids[0] ?? ''), identification: teacher.identification, name: teacher.name, email: teacher.email, phone: teacher.phone ?? '' } : { ...EMPTY_FORM, career_id: catalogs.careers.length === 1 ? String(catalogs.careers[0].id) : '' }
    setEditing(teacher)
    setForm(next)
    setInitialForm(next)
    operation.clearError()
    setOpen(true)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = { identification: form.identification.trim(), name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim() }
    void operation.run(() => editing ? tutoringApi.updateTeacher(editing.id, input) : tutoringApi.createTeacher({ ...input, career_id: Number(form.career_id) }), editing ? 'Docente actualizado.' : 'Docente registrado.', async () => { setOpen(false); await list.reload() })
  }

  const hasActiveFilters = Boolean(list.searchInput || careerFilter || statusFilter)
  function clearFilters() {
    list.setSearchInput('')
    setCareerFilter('')
    setStatusFilter('')
  }

  return <section className="flex flex-col gap-6">
    <ModuleHeader title="Docentes" description="Registra y consulta los docentes vinculados con las carreras que coordinas." createLabel="Registrar docente" onCreate={() => edit(null)} disabled={operation.pending || catalogs.loading || !catalogs.careers.some((career) => career.status)} />
    <ScopeNotice catalogs={catalogs} />
    <Card>
      <CardContent className="pt-6">
        <FieldGroup className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <Field className="flex-1 lg:min-w-[220px]"><FieldLabel htmlFor="teachers-search">Buscar</FieldLabel><Input id="teachers-search" type="search" placeholder="Busca por nombre o correo…" value={list.searchInput} onChange={(event) => list.setSearchInput(event.target.value)} /></Field>
          <Field className="lg:w-52"><FieldLabel htmlFor="teachers-career-filter">Carrera</FieldLabel><NativeSelect id="teachers-career-filter" value={careerFilter} onChange={(event) => setCareerFilter(event.target.value)}><option value="">Todas mis carreras</option>{catalogs.careers.map((career) => <option key={career.id} value={career.id}>{career.name}</option>)}</NativeSelect></Field>
          <Field className="lg:w-40"><FieldLabel htmlFor="teachers-status-filter">Estado</FieldLabel><NativeSelect id="teachers-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as '' | 'active' | 'inactive')}><option value="">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></NativeSelect></Field>
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" disabled={!hasActiveFilters} onClick={clearFilters}><RotateCcwIcon data-icon="inline-start" />Limpiar filtros</Button>
        </FieldGroup>
      </CardContent>
    </Card>
    <ErrorNotice message={list.error} retry={list.reload} />
    <RecordTable rows={list.data} loading={list.isFetching || list.isInitialLoading} empty="No se encontraron docentes para esta búsqueda." columns={[
      { label: 'Docente', render: (teacher) => <div className="flex flex-col gap-1"><span className="font-medium">{teacher.name}</span><span className="text-xs text-muted-foreground">{teacher.identification}</span></div> },
      { label: 'Contacto', render: (teacher) => <div className="flex flex-col gap-1"><span>{teacher.email}</span><span className="text-xs text-muted-foreground">{teacher.phone || 'Sin teléfono'}</span></div> },
      { label: 'Carreras', render: (teacher) => teacher.career_ids.map((id) => catalogs.careers.find((career) => career.id === id)?.name ?? `Carrera #${id}`).join(', ') || 'Sin carrera vinculada' },
      { label: 'Estado', render: (teacher) => <StatusBadge active={teacher.is_active} /> },
      {
        label: 'Acciones', render: (teacher) => {
          if (!teacher.can_manage) return <span className="text-xs text-muted-foreground">Consulta · cambios a cargo de administración</span>
          if (!teacher.is_active) return <span className="text-muted-foreground">—</span>
          return <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon-sm" title="Editar" aria-label={`Editar ${teacher.name}`} disabled={operation.pending} onClick={() => edit(teacher)}><PencilIcon /></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon-sm" aria-label={`Más acciones para ${teacher.name}`} disabled={operation.pending}><MoreVerticalIcon /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onSelect={() => { operation.clearError(); setDeactivating(teacher) }}><PowerOffIcon />Desactivar</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        },
      },
    ]} />
    <CatalogPagination label="docentes" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
    <MutationDialog open={open} title={editing ? 'Editar docente' : 'Registrar docente'} pending={operation.pending} error={operation.error} dirty={JSON.stringify(form) !== JSON.stringify(initialForm)} onClose={() => setOpen(false)} onSubmit={submit} submitLabel={editing ? 'Guardar cambios' : 'Registrar docente'}>
      {!editing && <SelectField id="teacher-career" label="Carrera" value={form.career_id} onChange={(value) => setForm({ ...form, career_id: value })}><option value="">Selecciona una carrera</option>{catalogs.careers.filter((career) => career.status).map((career) => <option key={career.id} value={career.id}>{career.name}</option>)}</SelectField>}
      <Field>
        <div className="flex items-center justify-between"><FieldLabel htmlFor="teacher-identification">Cédula</FieldLabel><FieldCounter current={form.identification.length} max={10} /></div>
        <div className="relative flex items-center">
          <Input id="teacher-identification" inputMode="numeric" value={form.identification} onChange={(event) => setForm({ ...form, identification: sanitizeDigits(event.target.value, 10) })} required maxLength={10} autoComplete="off" placeholder="0102030405" className={cn(form.identification.length === 10 && 'pr-9')} />
          {form.identification.length === 10 && (
            isValidEcuadorianCedula(form.identification)
              ? <CheckCircle2Icon className="absolute right-3 size-4 text-emerald-500" aria-label="Cédula válida" />
              : <XCircleIcon className="absolute right-3 size-4 text-destructive" aria-label="Cédula inválida" />
          )}
        </div>
      </Field>
      <Field>
        <div className="flex items-center justify-between"><FieldLabel htmlFor="teacher-name">Nombre completo</FieldLabel><FieldCounter current={form.name.length} max={150} /></div>
        <Input id="teacher-name" value={form.name} onChange={(event) => setForm({ ...form, name: sanitizeLetters(event.target.value, 150) })} required maxLength={150} autoComplete="name" placeholder="Nombre y apellido del docente" />
      </Field>
      <Field>
        <div className="flex items-center justify-between"><FieldLabel htmlFor="teacher-email">Correo institucional</FieldLabel><FieldCounter current={form.email.length} max={150} /></div>
        <Input id="teacher-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value.slice(0, 150) })} required maxLength={150} placeholder="docente@ueb.edu.ec" />
        <FieldDescription>Utiliza una dirección de la Universidad Estatal de Bolívar (@ueb.edu.ec).</FieldDescription>
      </Field>
      <Field>
        <div className="flex items-center justify-between"><FieldLabel htmlFor="teacher-phone">Teléfono</FieldLabel><FieldCounter current={form.phone.length} max={10} /></div>
        <Input id="teacher-phone" type="tel" inputMode="numeric" value={form.phone} onChange={(event) => setForm({ ...form, phone: sanitizeDigits(event.target.value, 10) })} required maxLength={10} placeholder="0991234567" />
      </Field>
      {!editing && <p className="text-sm text-muted-foreground">Se enviará una contraseña provisional al correo institucional.</p>}
    </MutationDialog>
    <ConfirmModal open={Boolean(deactivating)} title="¿Desactivar docente?" description={`La cuenta de «${deactivating?.name ?? ''}» perderá el acceso y no podrá recibir nuevas asignaciones de tutorías.`} confirmLabel="Desactivar docente" pending={operation.pending} onClose={() => { if (!operation.pending) setDeactivating(null) }} onConfirm={() => { if (deactivating) void operation.run(() => tutoringApi.deactivateTeacher(deactivating.id), 'Docente desactivado.', async () => { setDeactivating(null); await list.reload() }) }} />
  </section>
}
