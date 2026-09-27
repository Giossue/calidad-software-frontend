import { useState, type FormEvent } from 'react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { tutoringApi, type Teacher } from '@/lib/tutoring-api'
import { CatalogFilters, ErrorNotice, ModuleHeader, MutationDialog, RecordActions, RecordTable, ScopeNotice, SelectField } from './tutoring-shared'
import { useOperation, useTutoringCatalogs } from './tutoring-hooks'

const EMPTY_FORM = { career_id: '', identification: '', name: '', email: '', phone: '' }

export function TutoringTeachersPage() {
  const catalogs = useTutoringCatalogs()
  const [careerFilter, setCareerFilter] = useState('')
  const list = usePaginatedCatalog((page, search) => tutoringApi.teachers({ page, search, career_id: Number(careerFilter) || undefined }), careerFilter)
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

  return <section className="flex flex-col gap-6">
    <ModuleHeader title="Docentes" description="Registra y consulta los docentes vinculados con las carreras que coordinas." createLabel="Registrar docente" onCreate={() => edit(null)} disabled={operation.pending || catalogs.loading || !catalogs.careers.some((career) => career.status)} />
    <ScopeNotice catalogs={catalogs} />
    <CatalogFilters search={list.searchInput} onSearch={list.setSearchInput} careerId={careerFilter} onCareer={setCareerFilter} careers={catalogs.careers} />
    <ErrorNotice message={list.error} retry={list.reload} />
    <RecordTable rows={list.data} loading={list.isFetching || list.isInitialLoading} empty="No se encontraron docentes para esta búsqueda." columns={[
      { label: 'Docente', render: (teacher) => <div className="flex flex-col gap-1"><span className="font-medium">{teacher.name}</span><span className="text-xs text-muted-foreground">{teacher.identification}</span></div> },
      { label: 'Contacto', render: (teacher) => <div className="flex flex-col gap-1"><span>{teacher.email}</span><span className="text-xs text-muted-foreground">{teacher.phone || 'Sin teléfono'}</span></div> },
      { label: 'Carreras', render: (teacher) => teacher.career_ids.map((id) => catalogs.careers.find((career) => career.id === id)?.name ?? `Carrera #${id}`).join(', ') || 'Sin carrera vinculada' },
      { label: 'Estado', render: (teacher) => <StatusBadge active={teacher.is_active} /> },
      { label: 'Acciones', render: (teacher) => teacher.can_manage ? <RecordActions name={teacher.name} disabled={operation.pending} onEdit={teacher.is_active ? () => edit(teacher) : undefined} onDeactivate={teacher.is_active ? () => { operation.clearError(); setDeactivating(teacher) } : undefined} /> : <span className="text-xs text-muted-foreground">Consulta · cambios a cargo de administración</span> },
    ]} />
    <CatalogPagination label="docentes" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
    <MutationDialog open={open} title={editing ? 'Editar docente' : 'Registrar docente'} pending={operation.pending} error={operation.error} dirty={JSON.stringify(form) !== JSON.stringify(initialForm)} onClose={() => setOpen(false)} onSubmit={submit} submitLabel={editing ? 'Guardar cambios' : 'Registrar docente'}>
      {!editing && <SelectField id="teacher-career" label="Carrera" value={form.career_id} onChange={(value) => setForm({ ...form, career_id: value })}><option value="">Selecciona una carrera</option>{catalogs.careers.filter((career) => career.status).map((career) => <option key={career.id} value={career.id}>{career.name}</option>)}</SelectField>}
      <Field><FieldLabel htmlFor="teacher-identification">Cédula</FieldLabel><Input id="teacher-identification" inputMode="numeric" value={form.identification} onChange={(event) => setForm({ ...form, identification: event.target.value })} required maxLength={10} minLength={10} pattern="[0-9]{10}" /></Field>
      <Field><FieldLabel htmlFor="teacher-name">Nombre completo</FieldLabel><Input id="teacher-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={150} /></Field>
      <Field><FieldLabel htmlFor="teacher-email">Correo institucional</FieldLabel><Input id="teacher-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required maxLength={150} placeholder="docente@ueb.edu.ec" /><FieldDescription>Utiliza una dirección de la Universidad Estatal de Bolívar (@ueb.edu.ec).</FieldDescription></Field>
      <Field><FieldLabel htmlFor="teacher-phone">Teléfono</FieldLabel><Input id="teacher-phone" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required minLength={10} maxLength={10} pattern="[0-9]{10}" /></Field>
      {!editing && <p className="text-sm text-muted-foreground">Se enviará una contraseña provisional al correo institucional.</p>}
    </MutationDialog>
    <ConfirmModal open={Boolean(deactivating)} title="¿Desactivar docente?" description={`La cuenta de «${deactivating?.name ?? ''}» perderá el acceso y no podrá recibir nuevas asignaciones de tutorías.`} confirmLabel="Desactivar docente" pending={operation.pending} onClose={() => { if (!operation.pending) setDeactivating(null) }} onConfirm={() => { if (deactivating) void operation.run(() => tutoringApi.deactivateTeacher(deactivating.id), 'Docente desactivado.', async () => { setDeactivating(null); await list.reload() }) }} />
  </section>
}
