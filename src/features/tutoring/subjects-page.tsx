import { useEffect, useState, type FormEvent } from 'react'
import { GitBranchIcon, PlusIcon, SaveIcon } from 'lucide-react'
import { toast } from 'sonner'

import { BulkImportButton } from '@/components/bulk-import-dialog'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { FormDialog, type FormStep } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { Spinner } from '@/components/ui/spinner'
import { DetailPageSkeleton } from '@/components/ui/loading-skeletons'
import { StatusBadge } from '@/components/ui/status-badge'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { maxCycleNumber } from '@/lib/academic-stage'
import { sanitizeCode, sanitizeLetters, formatSubjectName } from '@/lib/sanitize'
import { tutoringApi, type Subject } from '@/lib/tutoring-api'
import { CareerBreadcrumb, CareerPicker, useSelectedCareer } from './career-picker'
import { FilterBar } from './filter-bar'
import { ErrorNotice } from '@/components/ui/error-notice'
import { SubjectDetail } from './subject-detail'
import { useDetailParam } from '@/hooks/use-detail-param'
import { CycleSelect, ModuleHeader, RecordTable } from './tutoring-shared'
import { CheckboxListSkeleton } from './tutoring-skeletons'
import { useOperation, useTutoringCatalogs } from './tutoring-hooks'

const ALL_CYCLES = 'all'
const EMPTY_FORM = { career_id: '', cycle_id: '', parallel_ids: [] as string[], modality_id: '', period_id: '', code: '', name: '', next_subject_ids: [] as string[] }

/** Formulario abierto: registrar, editar los datos o editar la secuencia en la malla. */
type FormMode = 'create' | 'edit' | 'sequence'

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
  // La asignatura abierta vive en la URL (?asignatura=<id>) para que "Atrás" vuelva a la lista.
  const detail = useDetailParam('asignatura')
  const [openedSubject, setOpenedSubject] = useState<Subject | null>(null)
  const [mode, setMode] = useState<FormMode | null>(null)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  // Asignaturas de la carrera: para elegir cuáles continúan a la abierta (y para abrirla desde la URL).
  const [careerSubjects, setCareerSubjects] = useState<readonly Subject[] | null>(null)
  const [initialForm, setInitialForm] = useState(EMPTY_FORM)
  const [deactivating, setDeactivating] = useState<Subject | null>(null)

  const [isAddingSection, setIsAddingSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [creatingSection, setCreatingSection] = useState(false)
  const [sectionError, setSectionError] = useState<string | null>(null)

  useEffect(() => {
    if (detail.id === null) return
    let cancelled = false
    tutoringApi.subjects({ career_id: careerId, per_page: 100 })
      .then((response) => { if (!cancelled) setCareerSubjects(response.data) })
      .catch(() => { if (!cancelled) setCareerSubjects([]) })
    return () => { cancelled = true }
  }, [detail.id, careerId])

  const detailSubject = detail.id === null
    ? null
    : (openedSubject?.id === detail.id ? openedSubject : null)
      ?? list.data.find((item) => item.id === detail.id)
      ?? careerSubjects?.find((item) => item.id === detail.id)
      ?? null

  function openSubject(subject: Subject) {
    setOpenedSubject(subject)
    detail.open(subject.id)
  }

  function openForm(nextMode: FormMode, subject: Subject | null, preselectedCycleId?: number | string) {
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
    setIsAddingSection(false)
    setNewSectionName('')
    setSectionError(null)
    operation.clearError()
    setMode(nextMode)
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
    let updated: Subject | null = null

    void operation.run(
      async () => {
        if (editing) {
          updated = await tutoringApi.updateSubject(editing.id, {
            code: trimmedCode ? trimmedCode : null,
            name: form.name.trim(),
            ...(form.modality_id ? { modality_id: Number(form.modality_id) } : {}),
            next_subject_ids: form.next_subject_ids.map(Number),
          })
          return
        }
        await tutoringApi.createSubject({
          ...input,
          career_id: careerId,
          ...(chosenCycleId ? { cycle_id: chosenCycleId } : {}),
          ...(selectedParallelIds.length > 0 ? { parallel_ids: selectedParallelIds } : {}),
          ...(newParallel ? { new_parallel_name: newParallel } : {}),
          ...(form.modality_id ? { modality_id: Number(form.modality_id) } : {}),
          ...(periodId ? { period_id: periodId } : {}),
        })
      },
      editing ? 'Asignatura actualizada.' : 'Asignatura registrada.',
      async () => {
        setMode(null)
        if (updated) setOpenedSubject(updated)
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

  const currentCareerName = catalogs.careers.find((career) => career.id === careerId)?.name ?? 'Asignaturas'
  const selectedLevel = cycleLevels.find((level) => String(level.number) === activeCycle)
  const selectedCycleIds = activeCycle === ALL_CYCLES
    ? []
    : catalogs.cycles.filter((cycle) => cycle.career_id === Number(activeCareerId) && cycle.number === Number(activeCycle)).map((cycle) => cycle.id)

  const renderSubjectColumns = () => [
    { label: 'Código', render: (subject: Subject) => subject.code ?? <span className="text-muted-foreground">—</span> },
    {
      label: 'Asignatura',
      render: (subject: Subject) => (
        <div className="flex flex-col gap-0.5">
          <span>{formatSubjectName(subject.name)}</span>
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
        return level ? `${level.number}°` : <span className="text-muted-foreground">—</span>
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
          ? names.join(', ')
          : <span className="text-muted-foreground">—</span>
      },
    },
    { label: 'Estado', render: (subject: Subject) => <StatusBadge active={subject.is_active} activeLabel="Activa" inactiveLabel="Inactiva" /> },
  ]

  const nameReason = form.name.trim() ? null : 'El nombre de la asignatura es obligatorio.'

  // Lo que identifica a la asignatura va primero; el ciclo y los paralelos, después.
  const dataFields = (
    <>
      <FormField id="subject-name" label="Nombre" required counter={{ current: form.name.length, max: 150 }}>
        <Input id="subject-name" value={form.name} onChange={(event) => setForm({ ...form, name: sanitizeLetters(event.target.value, 150).toLocaleUpperCase('es') })} required maxLength={150} placeholder="Ej. ALGORITMOS Y LÓGICA DE PROGRAMACIÓN" />
      </FormField>
      <FormField id="subject-code" label="Código" optional counter={form.code.length > 0 ? { current: form.code.length, max: 30 } : undefined}>
        <Input id="subject-code" value={form.code} onChange={(event) => setForm({ ...form, code: sanitizeCode(event.target.value, 30) })} maxLength={30} placeholder="Ej. SW-B1-001" />
      </FormField>
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
    </>
  )

  const placementFields = (
    <>
      <FormField id="subject-period" label="Período académico">
        <div className="relative flex items-center">
          <Input
            id="subject-period"
            value={currentPeriod ? currentPeriod.name : 'Sin período académico activo'}
            disabled
            readOnly
            className="pr-24"
            aria-readonly="true"
          />
          <span className="absolute right-2 text-xs text-muted-foreground">PAO actual</span>
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
      <FormField id="subject-parallels" label="Paralelo(s)" optional error={sectionError}>
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
            {allParallels.map((parallel) => (
              <label key={parallel.id} htmlFor={`subject-parallel-${parallel.id}`} className="inline-flex cursor-pointer items-center gap-2 pr-2 text-sm">
                <Checkbox
                  id={`subject-parallel-${parallel.id}`}
                  checked={form.parallel_ids.includes(String(parallel.id))}
                  onCheckedChange={() => toggleParallel(String(parallel.id))}
                />
                {parallel.name.startsWith('Paralelo') ? parallel.name : `Paralelo ${parallel.name}`}
              </label>
            ))}
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
  )

  const createSteps: readonly FormStep[] = [
    { title: 'Datos de la asignatura', blockReason: nameReason, fields: ['name', 'code', 'modality_id'], content: dataFields },
    { title: 'Ciclo y paralelos', fields: ['cycle_ids', 'section_ids'], content: placementFields },
  ]

  const formTitle = mode === 'sequence' ? 'Secuencia en la malla' : editing ? 'Editar asignatura' : 'Registrar asignatura'
  const formDescription = editing
    ? (mode === 'sequence' ? formatSubjectName(editing.name) : `Modifica los datos de ${formatSubjectName(editing.name)}.`)
    : currentCareer ? `Carrera: ${currentCareer.name}` : undefined

  const subjectNotFound = detail.id !== null && !detailSubject && careerSubjects !== null && !list.isFetching && !list.isInitialLoading

  return <section className="flex flex-col gap-6">
    {detailSubject ? (
      <SubjectDetail
        subject={detailSubject}
        cycles={catalogs.cycles}
        parallels={allParallels}
        operation={operation}
        onBack={detail.close}
        onEdit={() => openForm('edit', detailSubject)}
        onEditSequence={() => openForm('sequence', detailSubject)}
        onDeactivate={() => { operation.clearError(); setDeactivating(detailSubject) }}
        onChanged={async (updated) => {
          setOpenedSubject(updated)
          await list.reload()
          catalogs.reload()
        }}
      />
    ) : subjectNotFound ? (
      <div className="flex flex-col items-start gap-4">
        <p className="text-sm text-muted-foreground">No encontramos esta asignatura en la carrera.</p>
        <Button type="button" variant="secondary" onClick={detail.close}>Volver a asignaturas</Button>
      </div>
    ) : detail.id !== null ? (
      <DetailPageSkeleton label="Cargando asignatura" />
    ) : (
      <>
        <CareerBreadcrumb root="Asignaturas" career={currentCareerName} onBack={onBack} />
        <ModuleHeader title={currentCareerName} description="Registra las asignaturas de cada ciclo y sus paralelos. Haz clic en una para abrirla." createLabel="Registrar asignatura" onCreate={() => openForm('create', null, selectedCycleIds[0])} extraActions={<BulkImportButton type="subjects" title="Carga masiva de asignaturas" onFinished={() => Promise.all([list.reload(), catalogs.reload()])} />} disabled={operation.pending || catalogs.loading || !catalogs.careers.some((career) => career.status)} />
        <FilterBar
          id="subjects"
          leading={cycleLevels.length > 0 ? <CycleSelect id="subjects-cycle" levels={cycleLevels} value={activeCycle} onChange={setCycleSelection} degreeCycleNumber={careerMaxCycle} /> : undefined}
          search={list.searchInput}
          onSearch={list.setSearchInput}
          searchPlaceholder="Busca por nombre o código…"
          onClear={clearFilters}
          filters={[
            { id: 'status', label: 'Estado', value: statusFilter, onChange: (value) => setStatusFilter(value as '' | 'active' | 'inactive'), allLabel: 'Todos los estados', options: [{ value: 'active', label: 'Activas' }, { value: 'inactive', label: 'Inactivas' }] },
          ]}
        />
        <ErrorNotice message={list.error} retry={list.reload} />

        <RecordTable
          rows={list.data}
          loading={list.isFetching || list.isInitialLoading}
          empty={list.searchInput || statusFilter ? 'No hay asignaturas con estos filtros.' : activeCycle === ALL_CYCLES ? 'Aún no hay asignaturas registradas en esta carrera.' : 'Aún no hay asignaturas en este ciclo.'}
          columns={renderSubjectColumns()}
          onRowClick={openSubject}
          rowTitle={(subject) => `Abrir ${formatSubjectName(subject.name)}`}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {list.data.length} de {list.meta?.total ?? list.data.length} {(list.meta?.total ?? list.data.length) === 1 ? 'asignatura' : 'asignaturas'}{activeCycle === ALL_CYCLES ? '' : ` del ${selectedLevel?.name ?? 'ciclo seleccionado'}`}
          </p>
          <CatalogPagination label="asignaturas" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
        </div>
      </>
    )}
    <FormDialog
      open={mode !== null}
      title={formTitle}
      description={formDescription}
      pending={operation.pending}
      error={operation.error}
      errorModal={operation.errorModal}
      dirty={JSON.stringify(form) !== JSON.stringify(initialForm) || Boolean(newSectionName)}
      blockReason={nameReason}
      onClose={() => setMode(null)}
      onSubmit={submit}
      submitIcon={mode === 'create' ? PlusIcon : mode === 'sequence' ? GitBranchIcon : SaveIcon}
      submitLabel={mode === 'create' ? 'Registrar asignatura' : mode === 'sequence' ? 'Guardar secuencia' : 'Guardar cambios'}
      steps={mode === 'create' ? createSteps : undefined}
    >
      {mode === 'edit' && dataFields}
      {mode === 'sequence' && editing && (
        <NextSubjectsField
          subject={editing}
          options={careerSubjects?.filter((subject) => subject.curriculum_id === editing.curriculum_id) ?? null}
          cycleNumber={(id) => catalogs.cycles.find((cycle) => cycle.id === id)?.number}
          value={form.next_subject_ids}
          onChange={(ids) => setForm({ ...form, next_subject_ids: ids })}
          disabled={operation.pending}
        />
      )}
    </FormDialog>
    <ConfirmModal
      open={Boolean(deactivating)}
      title="¿Desactivar asignatura?"
      description={`La asignatura «${deactivating?.name ?? ''}» dejará de estar disponible para nuevas tutorías. Sus tutorías existentes se conservarán.`}
      confirmLabel="Desactivar asignatura"
      pending={operation.pending}
      onClose={() => { if (!operation.pending) setDeactivating(null) }}
      onConfirm={() => {
        if (!deactivating) return
        let updated: Subject | null = null
        void operation.run(
          async () => { updated = await tutoringApi.deactivateSubject(deactivating.id) },
          'Asignatura desactivada.',
          async () => {
            setDeactivating(null)
            setMode(null)
            if (updated) setOpenedSubject(updated)
            await list.reload()
          },
        )
      }}
    />
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
          <div role="status" aria-label="Cargando asignaturas"><CheckboxListSkeleton /></div>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay asignaturas de ciclos posteriores en esta carrera.</p>
        ) : (
          <div role="group" aria-label="Asignaturas que continúan" className="flex max-h-56 flex-col gap-2 overflow-y-auto py-1">
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
