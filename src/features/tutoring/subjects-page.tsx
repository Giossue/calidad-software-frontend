import { useState, type FormEvent } from 'react'
import { BookOpenIcon, CheckIcon, GraduationCapIcon, LayersIcon, PlusIcon, PowerOffIcon, SaveIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'

import { BulkImportButton } from '@/components/bulk-import-dialog'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { FieldLabel } from '@/components/ui/field'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { IconAction } from '@/components/ui/icon-action'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { isDegreeCycleNumber, maxCycleNumber } from '@/lib/academic-stage'
import { sanitizeCode, sanitizeLetters, formatSubjectName } from '@/lib/sanitize'
import { tutoringApi, type Subject } from '@/lib/tutoring-api'
import { cn } from '@/lib/utils'
import { CareerBreadcrumb, CareerPicker, useSelectedCareer } from './career-picker'
import { FilterBar } from './filter-bar'
import { RowActions } from './row-actions'
import { ErrorNotice } from '@/components/ui/error-notice'
import { ModuleHeader, RecordTable } from './tutoring-shared'
import { useOperation, useTutoringCatalogs } from './tutoring-hooks'

const ALL_CYCLES = 'all'
const EMPTY_FORM = { career_id: '', cycle_id: '', parallel_ids: [] as string[], modality_id: '', period_id: '', code: '', name: '', next_subject_ids: [] as string[] }

export function TutoringSubjectsPage() {
  const catalogs = useTutoringCatalogs()
  const selection = useSelectedCareer(catalogs.careers)

  if (selection.career) {
    return <SubjectsWorkspace catalogs={catalogs} careerId={selection.career.id} onBack={selection.canChange ? selection.clear : undefined} />
  }

  return <CareerPicker catalogs={catalogs} title="Asignaturas" rowTitle={(career) => `Ver asignaturas de ${career.name}`} onSelect={(career) => selection.select(career.id)} />
}

type TutoringCatalogsState = ReturnType<typeof useTutoringCatalogs>

function SubjectsWorkspace({ catalogs, careerId, onBack }: Readonly<{ catalogs: TutoringCatalogsState; careerId: number; onBack?: () => void }>) {
  const [cycleSelection, setCycleSelection] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('')
  const activeCareerId = String(careerId)
  const cycleLevels = Array.from(
    new Map(catalogs.cycles.filter((cycle) => cycle.status && cycle.career_id === Number(activeCareerId)).map((cycle) => [cycle.number, cycle])).values(),
  ).sort((a, b) => a.number - b.number)
  // Como en Estudiantes, se trabaja por ciclo y se abre en el primero. Sin ciclos registrados se listan todas.
  const activeCycle = cycleLevels.length === 0
    ? ALL_CYCLES
    : cycleLevels.some((level) => String(level.number) === cycleSelection) ? cycleSelection : String(cycleLevels[0].number)
  const careerMaxCycle = maxCycleNumber(catalogs.cycles.filter((cycle) => cycle.career_id === Number(activeCareerId)))
  const list = usePaginatedCatalog(
    (page, search) => tutoringApi.subjects({
      page,
      search,
      career_id: Number(activeCareerId) || undefined,
      cycle_number: activeCycle === ALL_CYCLES ? undefined : Number(activeCycle),
      status: statusFilter || undefined,
    }),
    `${activeCareerId}|${activeCycle}|${statusFilter}`,
  )
  const operation = useOperation()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  // Asignaturas de la carrera, para elegir cuáles continúan a la que se edita.
  const [careerSubjects, setCareerSubjects] = useState<readonly Subject[] | null>(null)
  const [initialForm, setInitialForm] = useState(EMPTY_FORM)
  const [deactivating, setDeactivating] = useState<Subject | null>(null)
  const [assigning, setAssigning] = useState<Subject | null>(null)
  const [parallelId, setParallelId] = useState('')
  const [isAddingParallelInModal, setIsAddingParallelInModal] = useState(false)
  const [newModalParallelName, setNewModalParallelName] = useState('')
  const [modalParallelError, setModalParallelError] = useState<string | null>(null)

  const [isAddingSection, setIsAddingSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [creatingSection, setCreatingSection] = useState(false)
  const [sectionError, setSectionError] = useState<string | null>(null)

  function edit(subject: Subject | null, preselectedCycleId?: number | string) {
    const defaultCareerId = (activeCareerId && catalogs.careers.some((c) => String(c.id) === activeCareerId))
      ? activeCareerId
      : (catalogs.careers[0] ? String(catalogs.careers[0].id) : '')
    const activePeriod = catalogs.periods.find((p) => p.is_active) ?? catalogs.periods[0]
    const next = subject
      ? { next_subject_ids: (subject.next_subjects ?? []).map((item) => String(item.id)), career_id: String(subject.career_id), cycle_id: '', parallel_ids: [] as string[], modality_id: subject.modality_id ? String(subject.modality_id) : '', period_id: subject.period_id ? String(subject.period_id) : (activePeriod ? String(activePeriod.id) : ''), code: subject.code ?? '', name: subject.name }
      : { ...EMPTY_FORM, career_id: defaultCareerId, cycle_id: preselectedCycleId ? String(preselectedCycleId) : '', period_id: activePeriod ? String(activePeriod.id) : '' }
    setEditing(subject)
    setForm(next)
    setInitialForm(next)
    setCareerSubjects(null)
    if (subject) {
      tutoringApi.subjects({ career_id: subject.career_id, per_page: 100 })
        .then((response) => setCareerSubjects(response.data))
        .catch(() => setCareerSubjects([]))
    }
    setIsAddingSection(false)
    setNewSectionName('')
    setSectionError(null)
    operation.clearError()
    setOpen(true)
  }

  function toggleParallel(id: string) {
    setForm((prev) => ({
      ...prev,
      parallel_ids: prev.parallel_ids.includes(id)
        ? prev.parallel_ids.filter((item) => item !== id)
        : [...prev.parallel_ids, id],
    }))
  }

  async function handleCreateSection() {
    const trimmed = newSectionName.trim()
    if (!trimmed) {
      setSectionError('El nombre del paralelo es obligatorio.')
      return
    }
    setCreatingSection(true)
    setSectionError(null)
    try {
      const created = await tutoringApi.createSection(trimmed)
      await catalogs.reload()
      setForm((prev) => ({
        ...prev,
        parallel_ids: prev.parallel_ids.includes(String(created.id))
          ? prev.parallel_ids
          : [...prev.parallel_ids, String(created.id)],
      }))
      setIsAddingSection(false)
      setNewSectionName('')
      toast.success('Paralelo creado', { description: `Se agregó "${created.name}" al catálogo de paralelos.` })
    } catch {
      setSectionError('No fue posible crear el paralelo. Intenta nuevamente.')
    } finally {
      setCreatingSection(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedCode = form.code.trim()
    const input = {
      code: trimmedCode || undefined,
      name: form.name.trim(),
    }
    const careerId = Number(form.career_id) || Number(activeCareerId) || (catalogs.careers[0]?.id ?? 0)
    const newParallel = isAddingSection && newSectionName.trim() ? newSectionName.trim() : undefined
    const selectedParallelIds = form.parallel_ids.map(Number).filter(Boolean)
    const chosenCycleId = form.cycle_id ? Number(form.cycle_id) : undefined

    const currentPeriod = catalogs.periods.find((p) => p.is_active) ?? catalogs.periods[0]
    const periodId = Number(form.period_id || currentPeriod?.id) || undefined

    void operation.run(
      () => editing
        ? tutoringApi.updateSubject(editing.id, {
            code: trimmedCode ? trimmedCode : null,
            name: form.name.trim(),
            ...(form.modality_id ? { modality_id: Number(form.modality_id) } : {}),
            next_subject_ids: form.next_subject_ids.map(Number),
          })
        : tutoringApi.createSubject({
            ...input,
            career_id: careerId,
            ...(chosenCycleId ? { cycle_id: chosenCycleId } : {}),
            ...(selectedParallelIds.length > 0 ? { parallel_ids: selectedParallelIds } : {}),
            ...(newParallel ? { new_parallel_name: newParallel } : {}),
            ...(form.modality_id ? { modality_id: Number(form.modality_id) } : {}),
            ...(periodId ? { period_id: periodId } : {}),
          }),
      editing ? 'Asignatura actualizada.' : 'Asignatura registrada.',
      async () => {
        setOpen(false)
        await list.reload()
        catalogs.reload()
      },
    )
  }

  function clearFilters() {
    setStatusFilter('')
  }

  const currentCareerId = Number(form.career_id || activeCareerId || catalogs.careers[0]?.id)
  const currentCareer = catalogs.careers.find((c) => c.id === currentCareerId)
  const currentPeriod = catalogs.periods.find((p) => p.is_active) ?? catalogs.periods[0]
  const careerCycles = catalogs.cycles.filter(
    (cycle) => cycle.status && cycle.career_id === currentCareerId,
  )
  const uniqueCycleLevels = Array.from(
    new Map(careerCycles.map((c) => [c.number || c.name, c])).values(),
  ).sort((a, b) => a.number - b.number)

  const allParallels = catalogs.sections.length > 0
    ? catalogs.sections.filter((s) => s.is_active)
    : Array.from(
        new Map(
          catalogs.cycles
            .filter((c) => c.paralelo_id && c.paralelo_name)
            .map((c) => [c.paralelo_id!, { id: c.paralelo_id!, name: c.paralelo_name!, is_active: true }]),
        ).values(),
      )

  const assignedCycle = assigning
    ? catalogs.cycles.find((c) => assigning.cycle_ids.includes(c.id))
    : null
  const assignedCycleName = assignedCycle?.name

  const assignedParallels = assigning
    ? assigning.cycle_ids.map((id) => {
        const c = catalogs.cycles.find((item) => item.id === id)
        const parallelName = c?.paralelo_name || (c?.paralelo_id ? `Paralelo #${c.paralelo_id}` : null)
        const label = parallelName
          ? (parallelName.startsWith('Paralelo') ? parallelName : `Paralelo ${parallelName}`)
          : (c ? `${c.name} (General)` : `Ciclo #${id}`)
        return {
          key: id,
          cycleId: id,
          parallelId: c?.paralelo_id ?? null,
          label,
        }
      })
    : []

  const assignedParallelIds = new Set(
    assignedParallels.map((p) => p.parallelId).filter((id): id is number => id !== null),
  )
  const assignedParallelNames = new Set(
    assignedParallels.map((p) => p.label.replace(/^Paralelo\s+/, '').trim().toLowerCase()),
  )
  const availableParallelsForModal = allParallels.filter(
    (p) =>
      !assignedParallelIds.has(p.id) &&
      !assignedParallelNames.has(p.name.replace(/^Paralelo\s+/, '').trim().toLowerCase()),
  )

  function addParallel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!assigning) return
    const subjectId = assigning.id
    const newName = isAddingParallelInModal ? newModalParallelName.trim() : ''
    const chosenParallelId = parallelId ? Number(parallelId) : undefined

    if (!newName && !chosenParallelId) return

    const subjectCycle = catalogs.cycles.find((c) => assigning.cycle_ids.includes(c.id))

    void operation.run(
      async () => {
        let updated: Subject
        if (tutoringApi.assignSubjectParallel) {
          updated = await tutoringApi.assignSubjectParallel(subjectId, {
            parallel_id: chosenParallelId,
            new_parallel_name: newName || undefined,
            cycle_id: subjectCycle?.id,
          })
        } else {
          updated = await tutoringApi.assignSubjectCycle(subjectId, chosenParallelId ?? 0)
        }
        setAssigning(updated)
        setParallelId('')
        setNewModalParallelName('')
        setIsAddingParallelInModal(false)
        setModalParallelError(null)
      },
      'Paralelo asignado.',
      async () => {
        await list.reload()
        catalogs.reload()
      },
    )
  }

  function removeParallel(targetCycleId: number, targetParallelId?: number | null) {
    if (!assigning) return
    const subjectId = assigning.id
    void operation.run(
      async () => {
        let updated: Subject
        if (targetParallelId && tutoringApi.unassignSubjectParallel) {
          updated = await tutoringApi.unassignSubjectParallel(subjectId, targetParallelId)
        } else {
          updated = await tutoringApi.unassignSubjectCycle(subjectId, targetCycleId)
        }
        setAssigning(updated)
      },
      'Paralelo desasignado.',
      async () => {
        await list.reload()
        catalogs.reload()
      },
    )
  }

  const currentCareerName = catalogs.careers.find((career) => career.id === careerId)?.name ?? 'Asignaturas'
  const selectedLevel = cycleLevels.find((level) => String(level.number) === activeCycle)
  const selectedCycleIds = activeCycle === ALL_CYCLES
    ? []
    : catalogs.cycles.filter((cycle) => cycle.career_id === Number(activeCareerId) && cycle.number === Number(activeCycle)).map((cycle) => cycle.id)

  const renderSubjectColumns = () => [
    { label: 'Código', render: (subject: Subject) => subject.code ? <Badge variant="secondary">{subject.code}</Badge> : <span className="text-muted-foreground">—</span> },
    {
      label: 'Asignatura',
      render: (subject: Subject) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">{formatSubjectName(subject.name)}</span>
          {subject.modality_name && (
            <span className="text-xs text-muted-foreground">{subject.modality_name}</span>
          )}
        </div>
      ),
    },
    ...(activeCycle === ALL_CYCLES ? [{
      label: 'Ciclo',
      render: (subject: Subject) => {
        const level = cycleLevels.find((item) => catalogs.cycles.some((cycle) => cycle.number === item.number && cycle.career_id === item.career_id && subject.cycle_ids.includes(cycle.id)))
        return level ? <Badge variant="outline">{level.number}°</Badge> : <span className="text-muted-foreground">—</span>
      },
    }] : []),
    {
      label: 'Continúa en',
      render: (subject: Subject) => (subject.next_subjects ?? []).length > 0
        ? <span className="text-sm">{(subject.next_subjects ?? []).map((next) => formatSubjectName(next.name)).join(', ')}</span>
        : <span className="text-muted-foreground">—</span>,
    },
    {
      label: 'Paralelo(s)',
      render: (subject: Subject) => {
        const names = Array.from(new Set(catalogs.cycles.filter((cycle) => subject.cycle_ids.includes(cycle.id) && cycle.paralelo_name).map((cycle) => cycle.paralelo_name!.replace(/^Paralelo\s+/i, '')))).sort()
        return names.length > 0
          ? <div className="flex flex-wrap gap-1.5">{names.map((name) => <Badge key={name} variant="outline" title={`Paralelo ${name}`}>{name}</Badge>)}</div>
          : <span className="text-muted-foreground">—</span>
      },
    },
    { label: 'Estado', render: (subject: Subject) => <StatusBadge active={subject.is_active} activeLabel="Activa" inactiveLabel="Inactiva" /> },
    {
      label: 'Acciones',
      render: (subject: Subject) => subject.is_active ? (
        <RowActions>
          <IconAction label={`Gestionar paralelos de ${formatSubjectName(subject.name)}`} icon={LayersIcon} disabled={operation.pending} onClick={() => { operation.clearError(); setParallelId(''); setIsAddingParallelInModal(false); setNewModalParallelName(''); setModalParallelError(null); setAssigning(subject) }} />
        </RowActions>
      ) : <span className="text-muted-foreground">—</span>,
    },
  ]

  return <section className="flex flex-col gap-6">
    <CareerBreadcrumb root="Asignaturas" career={currentCareerName} onBack={onBack} />
    <ModuleHeader title={currentCareerName} createLabel="Registrar asignatura" onCreate={() => edit(null, selectedCycleIds[0])} extraActions={<BulkImportButton type="subjects" title="Carga masiva de asignaturas" onFinished={() => Promise.all([list.reload(), catalogs.reload()])} />} disabled={operation.pending || catalogs.loading || !catalogs.careers.some((career) => career.status)} />
    {cycleLevels.length > 0 && <Tabs value={activeCycle} onValueChange={setCycleSelection} className="w-full">
      <div className="overflow-x-auto pb-1">
        <TabsList aria-label="Ciclos de la carrera" className="w-max">
          {cycleLevels.map((level) => (
            <TabsTrigger key={level.number} value={String(level.number)} className="gap-2">
              {isDegreeCycleNumber(level.number, careerMaxCycle) ? <GraduationCapIcon className="size-4" /> : <BookOpenIcon className="size-4" />}
              <span>{level.number}° ciclo{isDegreeCycleNumber(level.number, careerMaxCycle) ? ' · Titulación' : ''}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>}
    <FilterBar
      id="subjects"
      search={list.searchInput}
      onSearch={list.setSearchInput}
      searchPlaceholder="Busca por nombre o código…"
      onClear={clearFilters}
      filters={[
        { id: 'status', label: 'Estado', value: statusFilter, onChange: (value) => setStatusFilter(value as '' | 'active' | 'inactive'), allLabel: 'Todos', options: [{ value: 'active', label: 'Activas' }, { value: 'inactive', label: 'Inactivas' }] },
      ]}
    />
    <ErrorNotice message={list.error} retry={list.reload} />

    <RecordTable
      rows={list.data}
      loading={list.isFetching || list.isInitialLoading}
      empty={activeCycle === ALL_CYCLES ? 'No se encontraron asignaturas para esta carrera.' : 'No hay asignaturas en este ciclo para la búsqueda actual.'}
      columns={renderSubjectColumns()}
      onRowClick={(subject) => { if (subject.is_active && !operation.pending) edit(subject) }}
      rowTitle={(subject) => subject.is_active ? `Editar ${formatSubjectName(subject.name)}` : ''}
    />
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Mostrando {list.data.length} de {list.meta?.total ?? list.data.length} {(list.meta?.total ?? list.data.length) === 1 ? 'asignatura' : 'asignaturas'}{activeCycle === ALL_CYCLES ? '' : ` del ${selectedLevel?.name ?? 'ciclo seleccionado'}`}
      </p>
      <CatalogPagination label="asignaturas" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
    </div>
    <FormDialog
      open={open}
      title={editing ? 'Editar asignatura' : 'Registrar asignatura'}
      description={
        editing
          ? `Modifica los datos de ${formatSubjectName(editing.name)}.`
          : currentCareer ? `Carrera: ${currentCareer.name}` : undefined
      }
      pending={operation.pending}
      error={operation.error}
      dirty={JSON.stringify(form) !== JSON.stringify(initialForm) || Boolean(newSectionName)}
      blockReason={form.name.trim() ? null : 'El nombre de la asignatura es obligatorio.'}
      headerActions={editing ? <IconAction label="Desactivar asignatura" icon={PowerOffIcon} tone="destructive" disabled={operation.pending} onClick={() => { operation.clearError(); setDeactivating(editing) }} /> : undefined}
      onClose={() => setOpen(false)}
      onSubmit={submit}
      submitIcon={editing ? SaveIcon : PlusIcon} submitLabel={editing ? 'Guardar cambios' : 'Registrar asignatura'}
    >
      {!editing && (
        <>
          <FormField id="subject-period" label="Período académico" tip={`Todas las asignaturas corresponden automáticamente al período académico vigente (${currentPeriod?.name ?? 'sin período'}).`}>
            <div className="relative flex items-center">
              <Input
                id="subject-period"
                value={currentPeriod ? currentPeriod.name : 'Sin período académico activo'}
                disabled
                readOnly
                className="bg-muted pr-24 text-foreground cursor-not-allowed select-none"
                aria-readonly="true"
              />
              <Badge variant="outline" className="absolute right-2 text-xs text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                PAO actual
              </Badge>
            </div>
          </FormField>
          <SelectField
            id="subject-new-cycle"
            label="Ciclo"
            optional
            value={form.cycle_id}
            onValueChange={(value) => setForm({ ...form, cycle_id: value })}
            emptyLabel="Sin ciclo"
            placeholder="Selecciona un ciclo"
            options={uniqueCycleLevels.map((cycle) => ({ value: String(cycle.id), label: cycle.name }))}
          />
          <FormField id="subject-parallels" label="Paralelo(s)" tip="Puedes seleccionar varios paralelos." error={sectionError}>
            {isAddingSection ? (
              <div className="flex items-center gap-2">
                <Input
                  id="new-parallel-name"
                  aria-label="Nombre del nuevo paralelo"
                  value={newSectionName}
                  onChange={(e) => {
                    setNewSectionName(sanitizeLetters(e.target.value, 50))
                    setSectionError(null)
                  }}
                  placeholder="Ej. B"
                  maxLength={50}
                  disabled={creatingSection}
                  autoFocus
                />
                <Button
                  type="button"
                  onClick={() => void handleCreateSection()}
                  disabled={creatingSection || !newSectionName.trim()}
                  className="shrink-0"
                >
                  {creatingSection ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
                  Guardar
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsAddingSection(false)
                    setNewSectionName('')
                    setSectionError(null)
                  }}
                  disabled={creatingSection}
                  className="shrink-0"
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <div id="subject-parallels" className="flex flex-wrap items-center gap-2 pt-1" role="group" aria-label="Paralelos">
                {allParallels.map((parallel) => {
                  const isChecked = form.parallel_ids.includes(String(parallel.id))
                  return (
                    <label
                      key={parallel.id}
                      className={cn(
                        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium cursor-pointer transition-colors select-none',
                        isChecked
                          ? 'bg-primary/10 border-primary text-primary dark:bg-primary/20'
                          : 'bg-background hover:bg-accent text-foreground border-input',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleParallel(String(parallel.id))}
                        className="sr-only"
                        aria-label={`Paralelo ${parallel.name}`}
                      />
                      <span
                        className={cn(
                          'size-4 rounded border flex items-center justify-center transition-colors',
                          isChecked ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-background',
                        )}
                      >
                        {isChecked && <CheckIcon className="size-3 stroke-[3]" />}
                      </span>
                      <span>{parallel.name.startsWith('Paralelo') ? parallel.name : `Paralelo ${parallel.name}`}</span>
                    </label>
                  )
                })}
                {allParallels.length === 0 && (
                  <p className="text-xs text-muted-foreground">No hay paralelos activos registrados aún.</p>
                )}
                <Button
                  type="button"
                  variant="tertiary"
                  size="sm"
                  onClick={() => {
                    setIsAddingSection(true)
                    setNewSectionName('')
                    setSectionError(null)
                  }}
                  disabled={operation.pending}
                >
                  <PlusIcon data-icon="inline-start" /> Crear nuevo paralelo
                </Button>
              </div>
            )}
          </FormField>
        </>
      )}
      <SelectField
        id="subject-modality"
        label="Modalidad"
        optional
        value={form.modality_id}
        onValueChange={(value) => setForm({ ...form, modality_id: value })}
        emptyLabel="Sin modalidad"
        placeholder="Selecciona una modalidad"
        options={catalogs.modalities
          .filter((modality) => modality.is_active || String(modality.id) === form.modality_id)
          .map((modality) => ({ value: String(modality.id), label: `${modality.name}${modality.is_active ? '' : ' (inactiva)'}` }))}
      />
      <FormField id="subject-code" label="Código" optional counter={form.code.length > 0 ? { current: form.code.length, max: 30 } : undefined}>
        <Input id="subject-code" value={form.code} onChange={(event) => setForm({ ...form, code: sanitizeCode(event.target.value, 30) })} maxLength={30} placeholder="Ej. SW-B1-001" />
      </FormField>
      <FormField id="subject-name" label="Nombre" counter={{ current: form.name.length, max: 150 }}>
        <Input id="subject-name" value={form.name} onChange={(event) => setForm({ ...form, name: sanitizeLetters(event.target.value, 150).toLocaleUpperCase('es') })} required maxLength={150} placeholder="Ej. ALGORITMOS Y LÓGICA DE PROGRAMACIÓN" />
      </FormField>
      {editing && (
        <NextSubjectsField
          subject={editing}
          options={careerSubjects}
          cycleNumber={(id) => catalogs.cycles.find((cycle) => cycle.id === id)?.number}
          value={form.next_subject_ids}
          onChange={(ids) => setForm({ ...form, next_subject_ids: ids })}
          disabled={operation.pending}
        />
      )}
    </FormDialog>
    <FormDialog
      open={Boolean(assigning)}
      title="Paralelos de la asignatura"
      description={assigning ? `${formatSubjectName(assigning.name)}${assignedCycleName ? ` · ${assignedCycleName}` : ''}` : ''}
      pending={operation.pending}
      error={operation.error}
      dirty={Boolean(parallelId || newModalParallelName.trim())}
      noChangesReason="Selecciona o crea un paralelo para agregarlo."
      onClose={() => {
        setAssigning(null)
        setParallelId('')
        setIsAddingParallelInModal(false)
        setNewModalParallelName('')
        setModalParallelError(null)
      }}
      submitIcon={PlusIcon} submitLabel="Agregar paralelo"
      onSubmit={addParallel}
    >
      {assignedParallels.length > 0 ? (
        <div className="flex flex-col gap-2">
          <FieldLabel>Paralelos asignados actualmente</FieldLabel>
          <ul className="flex flex-col gap-2">
            {assignedParallels.map((item) => (
              <li
                key={item.key}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm bg-card"
              >
                <span className="text-foreground">{item.label}</span>
                <IconAction
                  label={`Quitar ${item.label}`}
                  icon={XIcon}
                  tone="destructive"
                  disabled={operation.pending}
                  onClick={() => removeParallel(item.cycleId, item.parallelId)}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Esta asignatura no tiene paralelos asignados en su ciclo.</p>
      )}

      <div className="flex flex-col gap-3 pt-2 border-t">
        {isAddingParallelInModal ? (
          <FormField id="new-modal-parallel-name" label="Nuevo paralelo" error={modalParallelError}>
            <div className="flex items-center gap-2">
              <Input
                id="new-modal-parallel-name"
                value={newModalParallelName}
                onChange={(e) => {
                  setNewModalParallelName(sanitizeLetters(e.target.value, 50))
                  setModalParallelError(null)
                }}
                placeholder="Ej. C"
                maxLength={50}
                disabled={operation.pending}
                autoFocus
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsAddingParallelInModal(false)
                  setNewModalParallelName('')
                  setModalParallelError(null)
                }}
                disabled={operation.pending}
                className="shrink-0"
              >
                Cancelar
              </Button>
            </div>
          </FormField>
        ) : (
          <>
            <SelectField
              id="subject-parallel-select"
              label="Agregar un paralelo"
              value={parallelId}
              onValueChange={(v) => {
                setParallelId(v)
                setModalParallelError(null)
              }}
              placeholder="Selecciona un paralelo"
              error={modalParallelError}
              options={availableParallelsForModal.map((p) => ({ value: String(p.id), label: p.name.startsWith('Paralelo') ? p.name : `Paralelo ${p.name}` }))}
            />
            {availableParallelsForModal.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Todos los paralelos registrados ya están asignados a esta asignatura. Puedes crear uno nuevo si lo requieres.
              </p>
            )}
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              className="self-start"
              onClick={() => {
                setIsAddingParallelInModal(true)
                setNewModalParallelName('')
                setModalParallelError(null)
              }}
              disabled={operation.pending}
            >
              <PlusIcon data-icon="inline-start" /> Crear nuevo paralelo
            </Button>
          </>
        )}
      </div>
    </FormDialog>
    <ConfirmModal open={Boolean(deactivating)} title="¿Desactivar asignatura?" description={`La asignatura «${deactivating?.name ?? ''}» dejará de estar disponible para nuevas tutorías. Sus tutorías existentes se conservarán.`} confirmLabel="Desactivar asignatura" pending={operation.pending} onClose={() => { if (!operation.pending) setDeactivating(null) }} onConfirm={() => { if (deactivating) void operation.run(() => tutoringApi.deactivateSubject(deactivating.id), 'Asignatura desactivada.', async () => { setDeactivating(null); setOpen(false); await list.reload() }) }} />
  </section>
}

/**
 * Asignaturas que continúan a `subject` en la malla: el estudiante que aprueba todas
 * sus previas pasa a ellas. Se ofrecen las de ciclos posteriores de la misma carrera.
 */
function NextSubjectsField({ subject, options, cycleNumber, value, onChange, disabled }: Readonly<{
  subject: Subject
  options: readonly Subject[] | null
  cycleNumber: (cycleId: number) => number | undefined
  value: readonly string[]
  onChange: (ids: string[]) => void
  disabled: boolean
}>) {
  const levelOf = (item: Subject) => Math.min(...item.cycle_ids.map((id) => cycleNumber(id) ?? Infinity))
  const ownLevel = levelOf(subject)
  const candidates = (options ?? [])
    .filter((item) => item.id !== subject.id && (value.includes(String(item.id)) || !Number.isFinite(ownLevel) || levelOf(item) > ownLevel))
    .sort((a, b) => levelOf(a) - levelOf(b) || a.name.localeCompare(b.name))
  const previous = subject.previous_subjects ?? []

  return (
    <FormField
      id="subject-next"
      label="Continúa en"
      optional
      tip="Quien aprueba esta asignatura (y las demás previas de la siguiente) queda inscrito en la tutoría de la siguiente en el nuevo período."
    >
      <div className="flex flex-col gap-2">
        {previous.length > 0 && (
          <p className="text-xs text-muted-foreground">Viene de: {previous.map((item) => formatSubjectName(item.name)).join(', ')}</p>
        )}
        {options === null ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner />Cargando asignaturas…</p>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay asignaturas de ciclos posteriores en esta carrera.</p>
        ) : (
          <div role="group" aria-label="Asignaturas que continúan" className="flex max-h-56 flex-col gap-2 overflow-y-auto rounded-lg border p-3">
            {candidates.map((item) => {
              const id = String(item.id)
              const level = levelOf(item)
              return (
                <label key={item.id} htmlFor={`subject-next-${item.id}`} className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <Checkbox
                    id={`subject-next-${item.id}`}
                    checked={value.includes(id)}
                    disabled={disabled}
                    onCheckedChange={(checked) => onChange(checked === true ? [...value, id] : value.filter((current) => current !== id))}
                  />
                  <span>{formatSubjectName(item.name)}{Number.isFinite(level) && <span className="text-xs text-muted-foreground"> · {level}° ciclo</span>}</span>
                </label>
              )
            })}
          </div>
        )}
        {value.length === 0 && options !== null && <p className="text-xs text-muted-foreground">Sin asignatura siguiente: aquí termina la secuencia.</p>}
      </div>
    </FormField>
  )
}
