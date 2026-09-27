import { useState, type FormEvent } from 'react'
import { LayersIcon, MoreVerticalIcon, PencilIcon, PowerOffIcon, RotateCcwIcon, XIcon } from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { StatusBadge } from '@/components/ui/status-badge'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { tutoringApi, type Subject } from '@/lib/tutoring-api'
import { ErrorNotice, ModuleHeader, MutationDialog, RecordTable, ScopeNotice, SelectField } from './tutoring-shared'
import { useOperation, useTutoringCatalogs } from './tutoring-hooks'

const EMPTY_FORM = { career_id: '', code: '', name: '' }

export function TutoringSubjectsPage() {
  const catalogs = useTutoringCatalogs()
  const [careerFilter, setCareerFilter] = useState('')
  const [cycleFilter, setCycleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('')
  const list = usePaginatedCatalog(
    (page, search) => tutoringApi.subjects({
      page,
      search,
      career_id: Number(careerFilter) || undefined,
      cycle_id: Number(cycleFilter) || undefined,
      status: statusFilter || undefined,
    }),
    `${careerFilter}|${cycleFilter}|${statusFilter}`,
  )
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

  function onCareerFilterChange(value: string) {
    setCareerFilter(value)
    const current = cycleFilter ? catalogs.cycles.find((cycle) => String(cycle.id) === cycleFilter) : null
    if (cycleFilter && (!current || (value && current.career_id !== Number(value)))) setCycleFilter('')
  }

  const hasActiveFilters = Boolean(list.searchInput || careerFilter || cycleFilter || statusFilter)
  function clearFilters() {
    list.setSearchInput('')
    setCareerFilter('')
    setCycleFilter('')
    setStatusFilter('')
  }

  const cycleFilterOptions = catalogs.cycles.filter((cycle) => !careerFilter || cycle.career_id === Number(careerFilter))
  const availableCycles = catalogs.cycles.filter((cycle) => cycle.career_id === assigning?.career_id && cycle.status && !assigning.cycle_ids.includes(cycle.id))

  function addCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!assigning || !cycleId) return
    const subjectId = assigning.id
    const targetCycleId = Number(cycleId)
    void operation.run(async () => {
      setAssigning(await tutoringApi.assignSubjectCycle(subjectId, targetCycleId))
      setCycleId('')
    }, 'Ciclo asignado.', () => { void list.reload() })
  }

  function removeCycle(targetCycleId: number) {
    if (!assigning) return
    const subjectId = assigning.id
    void operation.run(async () => {
      setAssigning(await tutoringApi.unassignSubjectCycle(subjectId, targetCycleId))
    }, 'Ciclo desasignado.', () => { void list.reload() })
  }

  return <section className="flex flex-col gap-6">
    <ModuleHeader title="Asignaturas" description="Gestiona las asignaturas de tus carreras y vincúlalas con los ciclos que recibirán tutorías." createLabel="Registrar asignatura" onCreate={() => edit(null)} disabled={operation.pending || catalogs.loading || !catalogs.careers.some((career) => career.status)} />
    <ScopeNotice catalogs={catalogs} />
    <Card>
      <CardContent className="pt-6">
        <FieldGroup className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <Field className="flex-1 lg:min-w-[220px]"><FieldLabel htmlFor="subjects-search">Buscar</FieldLabel><Input id="subjects-search" type="search" placeholder="Busca por nombre o código…" value={list.searchInput} onChange={(event) => list.setSearchInput(event.target.value)} /></Field>
          <Field className="lg:w-52"><FieldLabel htmlFor="subjects-career-filter">Carrera</FieldLabel><NativeSelect id="subjects-career-filter" value={careerFilter} onChange={(event) => onCareerFilterChange(event.target.value)}><option value="">Todas mis carreras</option>{catalogs.careers.map((career) => <option key={career.id} value={career.id}>{career.name}</option>)}</NativeSelect></Field>
          <Field className="lg:w-52"><FieldLabel htmlFor="subjects-cycle-filter">Ciclo</FieldLabel><NativeSelect id="subjects-cycle-filter" value={cycleFilter} onChange={(event) => setCycleFilter(event.target.value)}><option value="">Todos los ciclos</option>{cycleFilterOptions.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}{cycle.paralelo_name ? ` · ${cycle.paralelo_name}` : ''}</option>)}</NativeSelect></Field>
          <Field className="lg:w-40"><FieldLabel htmlFor="subjects-status-filter">Estado</FieldLabel><NativeSelect id="subjects-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as '' | 'active' | 'inactive')}><option value="">Todos</option><option value="active">Activas</option><option value="inactive">Inactivas</option></NativeSelect></Field>
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" disabled={!hasActiveFilters} onClick={clearFilters}><RotateCcwIcon data-icon="inline-start" />Limpiar filtros</Button>
        </FieldGroup>
      </CardContent>
    </Card>
    <ErrorNotice message={list.error} retry={list.reload} />
    <RecordTable rows={list.data} loading={list.isFetching || list.isInitialLoading} empty="No se encontraron asignaturas para esta búsqueda." columns={[
      { label: 'Código', render: (subject) => <Badge variant="secondary">{subject.code}</Badge> },
      { label: 'Asignatura', render: (subject) => subject.name },
      { label: 'Carrera', render: (subject) => subject.career_name },
      { label: 'Ciclo(s)', render: (subject) => <span className="text-sm text-muted-foreground">{subject.cycle_ids.map((id) => catalogs.cycles.find((cycle) => cycle.id === id)?.name ?? `Ciclo #${id}`).join(', ') || 'Sin ciclos asignados'}</span> },
      { label: 'Estado', render: (subject) => <StatusBadge active={subject.is_active} activeLabel="Activa" inactiveLabel="Inactiva" /> },
      {
        label: 'Acciones', render: (subject) => subject.is_active ? <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon-sm" title="Gestionar ciclos" aria-label={`Gestionar ciclos de ${subject.name}`} disabled={operation.pending} onClick={() => { operation.clearError(); setCycleId(''); setAssigning(subject) }}><LayersIcon /></Button>
          <Button type="button" variant="ghost" size="icon-sm" title="Editar" aria-label={`Editar ${subject.name}`} disabled={operation.pending} onClick={() => edit(subject)}><PencilIcon /></Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon-sm" aria-label={`Más acciones para ${subject.name}`} disabled={operation.pending}><MoreVerticalIcon /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onSelect={() => { operation.clearError(); setDeactivating(subject) }}><PowerOffIcon />Desactivar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div> : <span className="text-muted-foreground">—</span>,
      },
    ]} />
    <CatalogPagination label="asignaturas" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
    <MutationDialog open={open} title={editing ? 'Editar asignatura' : 'Registrar asignatura'} pending={operation.pending} error={operation.error} dirty={JSON.stringify(form) !== JSON.stringify(initialForm)} onClose={() => setOpen(false)} onSubmit={submit} submitLabel={editing ? 'Guardar cambios' : 'Registrar asignatura'}>
      <SelectField id="subject-career" label="Carrera" value={form.career_id} onChange={(value) => setForm({ ...form, career_id: value })} disabled={Boolean(editing)}><option value="">Selecciona una carrera</option>{catalogs.careers.filter((career) => career.status || String(career.id) === form.career_id).map((career) => <option key={career.id} value={career.id}>{career.name}</option>)}</SelectField>
      <Field><FieldLabel htmlFor="subject-code">Código</FieldLabel><Input id="subject-code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required maxLength={30} placeholder="Ej. SW-B1-001" /></Field>
      <Field><FieldLabel htmlFor="subject-name">Nombre</FieldLabel><Input id="subject-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={150} placeholder="Ej. Algoritmos y lógica de programación" /></Field>
    </MutationDialog>
    <MutationDialog open={Boolean(assigning)} title="Ciclos de la asignatura" description={assigning?.name} pending={operation.pending} error={operation.error} dirty={Boolean(cycleId)} onClose={() => setAssigning(null)} submitLabel="Agregar ciclo" submitDisabled={!cycleId} onSubmit={addCycle}>
      {assigning && assigning.cycle_ids.length > 0 && <div className="flex flex-col gap-2">
        <FieldLabel>Ciclos asignados actualmente</FieldLabel>
        <ul className="flex flex-col gap-2">
          {assigning.cycle_ids.map((id) => {
            const cycle = catalogs.cycles.find((item) => item.id === id)
            const label = cycle ? `${cycle.name}${cycle.paralelo_name ? ` · ${cycle.paralelo_name}` : ''}` : `Ciclo #${id}`
            return <li key={id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <span>{label}</span>
              <Button type="button" variant="ghost" size="icon-xs" disabled={operation.pending} aria-label={`Quitar ${label}`} onClick={() => removeCycle(id)}><XIcon /></Button>
            </li>
          })}
        </ul>
      </div>}
      <SelectField id="subject-cycle" label="Agregar un ciclo" value={cycleId} onChange={setCycleId}><option value="">Selecciona un ciclo</option>{availableCycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}{cycle.paralelo_name ? ` · ${cycle.paralelo_name}` : ''}</option>)}</SelectField>
      {availableCycles.length === 0 && <p className="text-sm text-muted-foreground">No hay ciclos activos pendientes de asignación en esta carrera.</p>}
    </MutationDialog>
    <ConfirmModal open={Boolean(deactivating)} title="¿Desactivar asignatura?" description={`La asignatura «${deactivating?.name ?? ''}» dejará de estar disponible para nuevas tutorías. Sus tutorías existentes se conservarán.`} confirmLabel="Desactivar asignatura" pending={operation.pending} onClose={() => { if (!operation.pending) setDeactivating(null) }} onConfirm={() => { if (deactivating) void operation.run(() => tutoringApi.deactivateSubject(deactivating.id), 'Asignatura desactivada.', async () => { setDeactivating(null); await list.reload() }) }} />
  </section>
}
