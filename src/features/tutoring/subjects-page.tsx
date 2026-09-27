import { useState, type FormEvent } from 'react'
import { LayersIcon } from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { tutoringApi, type Subject } from '@/lib/tutoring-api'
import { CatalogFilters, ErrorNotice, ModuleHeader, MutationDialog, RecordActions, RecordTable, ScopeNotice, SelectField } from './tutoring-shared'
import { useOperation, useTutoringCatalogs } from './tutoring-hooks'

const EMPTY_FORM = { career_id: '', code: '', name: '' }

export function TutoringSubjectsPage() {
  const catalogs = useTutoringCatalogs()
  const [careerFilter, setCareerFilter] = useState('')
  const list = usePaginatedCatalog((page, search) => tutoringApi.subjects({ page, search, career_id: Number(careerFilter) || undefined }), careerFilter)
  const operation = useOperation()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [initialForm, setInitialForm] = useState(EMPTY_FORM)
  const [deactivating, setDeactivating] = useState<Subject | null>(null)
  const [assigning, setAssigning] = useState<Subject | null>(null)
  const [cycleId, setCycleId] = useState('')

  function edit(subject: Subject | null) {
    const next = subject ? { career_id: String(subject.career_id), code: subject.code, name: subject.name } : { ...EMPTY_FORM, career_id: catalogs.careers.length === 1 ? String(catalogs.careers[0].id) : '' }
    setEditing(subject)
    setForm(next)
    setInitialForm(next)
    operation.clearError()
    setOpen(true)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = { code: form.code.trim(), name: form.name.trim() }
    void operation.run(() => editing ? tutoringApi.updateSubject(editing.id, input) : tutoringApi.createSubject({ ...input, career_id: Number(form.career_id) }), editing ? 'Asignatura actualizada.' : 'Asignatura registrada.', async () => { setOpen(false); await list.reload() })
  }

  const availableCycles = catalogs.cycles.filter((cycle) => cycle.career_id === assigning?.career_id && cycle.status && !assigning.cycle_ids.includes(cycle.id))

  return <section className="flex flex-col gap-6">
    <ModuleHeader title="Asignaturas" description="Gestiona las asignaturas de tus carreras y vincúlalas con los ciclos que recibirán tutorías." createLabel="Registrar asignatura" onCreate={() => edit(null)} disabled={operation.pending || catalogs.loading || !catalogs.careers.some((career) => career.status)} />
    <ScopeNotice catalogs={catalogs} />
    <CatalogFilters search={list.searchInput} onSearch={list.setSearchInput} careerId={careerFilter} onCareer={setCareerFilter} careers={catalogs.careers} />
    <ErrorNotice message={list.error} retry={list.reload} />
    <RecordTable rows={list.data} loading={list.isFetching || list.isInitialLoading} empty="No se encontraron asignaturas para esta búsqueda." columns={[
      { label: 'Asignatura', render: (subject) => <div className="flex flex-col gap-1"><span className="font-medium">{subject.name}</span><span className="text-xs text-muted-foreground">{subject.code}</span></div> },
      { label: 'Carrera y ciclos', render: (subject) => <div className="flex flex-col gap-1"><span>{subject.career_name}</span><span className="text-xs text-muted-foreground">{subject.cycle_ids.map((id) => catalogs.cycles.find((cycle) => cycle.id === id)?.name ?? `Ciclo #${id}`).join(', ') || 'Sin ciclos asignados'}</span></div> },
      { label: 'Estado', render: (subject) => <StatusBadge active={subject.is_active} activeLabel="Activa" inactiveLabel="Inactiva" /> },
      { label: 'Acciones', render: (subject) => <RecordActions name={subject.name} disabled={operation.pending} onEdit={subject.is_active ? () => edit(subject) : undefined} onDeactivate={subject.is_active ? () => { operation.clearError(); setDeactivating(subject) } : undefined}>{subject.is_active && <Button type="button" variant="outline" size="sm" disabled={operation.pending} onClick={() => { operation.clearError(); setCycleId(''); setAssigning(subject) }}><LayersIcon data-icon="inline-start" />Asignar ciclo</Button>}</RecordActions> },
    ]} />
    <CatalogPagination label="asignaturas" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
    <MutationDialog open={open} title={editing ? 'Editar asignatura' : 'Registrar asignatura'} pending={operation.pending} error={operation.error} dirty={JSON.stringify(form) !== JSON.stringify(initialForm)} onClose={() => setOpen(false)} onSubmit={submit} submitLabel={editing ? 'Guardar cambios' : 'Registrar asignatura'}>
      <SelectField id="subject-career" label="Carrera" value={form.career_id} onChange={(value) => setForm({ ...form, career_id: value })} disabled={Boolean(editing)}><option value="">Selecciona una carrera</option>{catalogs.careers.filter((career) => career.status || String(career.id) === form.career_id).map((career) => <option key={career.id} value={career.id}>{career.name}</option>)}</SelectField>
      <Field><FieldLabel htmlFor="subject-code">Código</FieldLabel><Input id="subject-code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required maxLength={30} /></Field>
      <Field><FieldLabel htmlFor="subject-name">Nombre</FieldLabel><Input id="subject-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={150} /></Field>
    </MutationDialog>
    <MutationDialog open={Boolean(assigning)} title="Asignar asignatura a un ciclo" description={assigning?.name} pending={operation.pending} error={operation.error} dirty={Boolean(cycleId)} onClose={() => setAssigning(null)} submitLabel="Asignar ciclo" onSubmit={(event) => { event.preventDefault(); if (assigning) void operation.run(() => tutoringApi.assignSubjectCycle(assigning.id, Number(cycleId)), 'Ciclo asignado.', async () => { setAssigning(null); await list.reload() }) }}>
      <SelectField id="subject-cycle" label="Ciclo de la carrera" value={cycleId} onChange={setCycleId}><option value="">Selecciona un ciclo</option>{availableCycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}{cycle.paralelo_name ? ` · ${cycle.paralelo_name}` : ''}</option>)}</SelectField>
      {availableCycles.length === 0 && <p className="text-sm text-muted-foreground">No hay ciclos activos pendientes de asignación en esta carrera.</p>}
    </MutationDialog>
    <ConfirmModal open={Boolean(deactivating)} title="¿Desactivar asignatura?" description={`La asignatura «${deactivating?.name ?? ''}» dejará de estar disponible para nuevas tutorías. Sus tutorías existentes se conservarán.`} confirmLabel="Desactivar asignatura" pending={operation.pending} onClose={() => { if (!operation.pending) setDeactivating(null) }} onConfirm={() => { if (deactivating) void operation.run(() => tutoringApi.deactivateSubject(deactivating.id), 'Asignatura desactivada.', async () => { setDeactivating(null); await list.reload() }) }} />
  </section>
}
