import { useState, type FormEvent } from 'react'
import { BookOpenIcon, CheckIcon, ChevronDownIcon, LayersIcon, MoreVerticalIcon, PencilIcon, PlusIcon, PowerOffIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Dialog } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Field, FieldCounter, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { sanitizeCode, sanitizeLetters } from '@/lib/sanitize'
import { tutoringApi, type Subject } from '@/lib/tutoring-api'
import { cn } from '@/lib/utils'
import { FilterBar } from './filter-bar'
import { ErrorNotice, ModuleHeader, MutationDialog, RecordTable, ScopeNotice, SelectField } from './tutoring-shared'
import { useOperation, useTutoringCatalogs } from './tutoring-hooks'

const EMPTY_FORM = { career_id: '', cycle_id: '', parallel_ids: [] as string[], modality_id: '', period_id: '', code: '', name: '' }

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
  const [parallelId, setParallelId] = useState('')
  const [isAddingParallelInModal, setIsAddingParallelInModal] = useState(false)
  const [newModalParallelName, setNewModalParallelName] = useState('')
  const [modalParallelError, setModalParallelError] = useState<string | null>(null)
  const [viewingParallelsSubject, setViewingParallelsSubject] = useState<{ subject: Subject; cycleIds?: number[] } | null>(null)
  const [expandedCycles, setExpandedCycles] = useState<Record<string, boolean>>({})

  const [isAddingSection, setIsAddingSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [creatingSection, setCreatingSection] = useState(false)
  const [sectionError, setSectionError] = useState<string | null>(null)

  function edit(subject: Subject | null, preselectedCycleId?: number | string) {
    const defaultCareerId = (careerFilter && catalogs.careers.some((c) => String(c.id) === careerFilter))
      ? careerFilter
      : (catalogs.careers[0] ? String(catalogs.careers[0].id) : '')
    const activePeriod = catalogs.periods.find((p) => p.is_active) ?? catalogs.periods[0]
    const next = subject
      ? { career_id: String(subject.career_id), cycle_id: '', parallel_ids: [] as string[], modality_id: subject.modality_id ? String(subject.modality_id) : '', period_id: subject.period_id ? String(subject.period_id) : (activePeriod ? String(activePeriod.id) : ''), code: subject.code ?? '', name: subject.name }
      : { ...EMPTY_FORM, career_id: defaultCareerId, cycle_id: preselectedCycleId ? String(preselectedCycleId) : '', period_id: activePeriod ? String(activePeriod.id) : '' }
    setEditing(subject)
    setForm(next)
    setInitialForm(next)
    setIsAddingSection(false)
    setNewSectionName('')
    setSectionError(null)
    operation.clearError()
    setOpen(true)
  }

  function isExpanded(cycleKey: string) {
    return expandedCycles[cycleKey] ?? true
  }

  function toggleExpand(cycleKey: string) {
    setExpandedCycles((prev) => ({
      ...prev,
      [cycleKey]: !(prev[cycleKey] ?? true),
    }))
  }

  function expandAll() {
    const next: Record<string, boolean> = {}
    uniqueCycleLevels.forEach((c) => {
      next[String(c.number || c.name)] = true
    })
    next['unassigned'] = true
    setExpandedCycles(next)
  }

  function collapseAll() {
    const next: Record<string, boolean> = {}
    uniqueCycleLevels.forEach((c) => {
      next[String(c.number || c.name)] = false
    })
    next['unassigned'] = false
    setExpandedCycles(next)
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
    const careerId = Number(form.career_id) || Number(careerFilter) || (catalogs.careers[0]?.id ?? 0)
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
        if (chosenCycleId) {
          const chosen = catalogs.cycles.find((c) => c.id === chosenCycleId)
          if (chosen) {
            const key = String(chosen.number || chosen.name)
            setExpandedCycles((prev) => ({ ...prev, [key]: true }))
          }
        }
        await list.reload()
        catalogs.reload()
      },
    )
  }

  function onCareerFilterChange(value: string) {
    setCareerFilter(value)
    const current = cycleFilter ? catalogs.cycles.find((cycle) => String(cycle.id) === cycleFilter) : null
    if (cycleFilter && (!value || !current || current.career_id !== Number(value))) setCycleFilter('')
  }

  function clearFilters() {
    setCareerFilter('')
    setCycleFilter('')
    setStatusFilter('')
  }

  const cycleFilterOptions = careerFilter ? catalogs.cycles.filter((cycle) => cycle.career_id === Number(careerFilter)) : []

  const currentCareerId = Number(form.career_id || careerFilter || catalogs.careers[0]?.id)
  const currentCareer = catalogs.careers.find((c) => c.id === currentCareerId)
  const currentPeriod = catalogs.periods.find((p) => p.is_active) ?? catalogs.periods[0]
  const careerCycles = catalogs.cycles.filter(
    (cycle) => cycle.status && cycle.career_id === currentCareerId,
  )
  const uniqueCycleLevels = Array.from(
    new Map(careerCycles.map((c) => [c.number || c.name, c])).values(),
  ).sort((a, b) => a.number - b.number)

  const cycleGroups = uniqueCycleLevels.map((cycleLevel) => {
    const cycleIdsForLevel = catalogs.cycles
      .filter(
        (c) =>
          c.career_id === currentCareerId &&
          (c.number === cycleLevel.number || c.name === cycleLevel.name),
      )
      .map((c) => c.id)

    const subjectsInCycle = list.data.filter(
      (subj) => subj.cycle_ids && subj.cycle_ids.some((id) => cycleIdsForLevel.includes(id)),
    )

    const parallelsInLevel = Array.from(
      new Map(
        catalogs.cycles
          .filter(
            (c) =>
              c.career_id === currentCareerId &&
              (c.number === cycleLevel.number || c.name === cycleLevel.name) &&
              c.paralelo_id &&
              c.paralelo_name,
          )
          .map((c) => [c.paralelo_id!, c.paralelo_name!]),
      ).values(),
    )

    return {
      cycle: cycleLevel,
      cycleKey: String(cycleLevel.number || cycleLevel.name),
      cycleIds: cycleIdsForLevel,
      subjects: subjectsInCycle,
      parallels: parallelsInLevel,
    }
  })

  const allLevelCycleIds = new Set(cycleGroups.flatMap((g) => g.cycleIds))
  const unassignedSubjects = list.data.filter(
    (subj) => !subj.cycle_ids || !subj.cycle_ids.some((id) => allLevelCycleIds.has(id)),
  )

  const displayedGroups = cycleFilter
    ? cycleGroups.filter((g) => g.cycleIds.includes(Number(cycleFilter)))
    : cycleGroups

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

  const renderSubjectColumns = (groupCycleIds?: number[]) => [
    { label: 'Código', render: (subject: Subject) => subject.code ? <Badge variant="secondary">{subject.code}</Badge> : <span className="text-muted-foreground">—</span> },
    {
      label: 'Asignatura',
      render: (subject: Subject) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">{subject.name}</span>
          {subject.modality_name && (
            <span className="text-xs text-muted-foreground">{subject.modality_name}</span>
          )}
        </div>
      ),
    },
    { label: 'Carrera', render: (subject: Subject) => subject.career_name },
    {
      label: 'Paralelo(s)',
      render: (subject: Subject) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setViewingParallelsSubject({ subject, cycleIds: groupCycleIds })}
          aria-label={`Ver paralelos de ${subject.name}`}
          className="h-7 text-xs font-medium text-primary border-primary/30 hover:bg-primary/10"
        >
          Ver Paralelos
        </Button>
      ),
    },
    { label: 'Estado', render: (subject: Subject) => <StatusBadge active={subject.is_active} activeLabel="Activa" inactiveLabel="Inactiva" /> },
    {
      label: 'Acciones',
      render: (subject: Subject) => subject.is_active ? (
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon-sm" title="Gestionar paralelos" aria-label={`Gestionar paralelos de ${subject.name}`} disabled={operation.pending} onClick={() => { operation.clearError(); setParallelId(''); setIsAddingParallelInModal(false); setNewModalParallelName(''); setModalParallelError(null); setAssigning(subject) }}><LayersIcon /></Button>
          <Button type="button" variant="ghost" size="icon-sm" title="Editar" aria-label={`Editar ${subject.name}`} disabled={operation.pending} onClick={() => edit(subject)}><PencilIcon /></Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon-sm" aria-label={`Más acciones para ${subject.name}`} disabled={operation.pending}><MoreVerticalIcon /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onSelect={() => { operation.clearError(); setDeactivating(subject) }}><PowerOffIcon />Desactivar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : <span className="text-muted-foreground">—</span>,
    },
  ]

  return <section className="flex flex-col gap-6">
    <ModuleHeader title="Asignaturas" description="Gestiona las asignaturas de tus carreras organizadas por ciclos académicos y vincúlalas con los grupos que recibirán tutorías." createLabel="Registrar asignatura" onCreate={() => edit(null)} disabled={operation.pending || catalogs.loading || !catalogs.careers.some((career) => career.status)} />
    <ScopeNotice catalogs={catalogs} />
    <FilterBar
      id="subjects"
      search={list.searchInput}
      onSearch={list.setSearchInput}
      searchPlaceholder="Busca por nombre o código…"
      onClear={clearFilters}
      filters={[
        { id: 'career', label: 'Carrera', value: careerFilter, onChange: onCareerFilterChange, allLabel: 'Todas mis carreras', options: catalogs.careers.map((career) => ({ value: String(career.id), label: career.name })) },
        { id: 'cycle', label: 'Ciclo', value: cycleFilter, onChange: setCycleFilter, allLabel: careerFilter ? 'Todos los ciclos' : 'Primero selecciona una carrera', disabled: !careerFilter, disabledReason: 'Selecciona primero una carrera para filtrar por ciclo.', options: cycleFilterOptions.map((cycle) => ({ value: String(cycle.id), label: `${cycle.name}${cycle.paralelo_name ? ` · ${cycle.paralelo_name}` : ''}` })) },
        { id: 'status', label: 'Estado', value: statusFilter, onChange: (value) => setStatusFilter(value as '' | 'active' | 'inactive'), allLabel: 'Todos', options: [{ value: 'active', label: 'Activas' }, { value: 'inactive', label: 'Inactivas' }] },
      ]}
    />
    <ErrorNotice message={list.error} retry={list.reload} />

    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-muted-foreground">
      <div>
        Mostrando <strong className="text-foreground">{list.data.length}</strong> {list.data.length === 1 ? 'asignatura' : 'asignaturas'} distribuidas en <strong className="text-foreground">{displayedGroups.length}</strong> {displayedGroups.length === 1 ? 'ciclo' : 'ciclos'}
      </div>
      {displayedGroups.length > 0 && (
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <Button type="button" variant="outline" size="sm" onClick={expandAll} className="text-xs h-7 px-2.5">
            Expandir todos
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={collapseAll} className="text-xs h-7 px-2.5">
            Colapsar todos
          </Button>
        </div>
      )}
    </div>

    {displayedGroups.length > 0 ? (
      <div className="flex flex-col gap-4">
        {displayedGroups.map((group) => (
          <div key={group.cycleKey} className="rounded-xl border bg-card shadow-xs overflow-hidden transition-all duration-200">
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleExpand(group.cycleKey)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(group.cycleKey) } }}
              className="flex items-center justify-between p-4 sm:p-5 bg-card hover:bg-accent/40 cursor-pointer select-none transition-colors border-b last:border-b-0"
              aria-expanded={isExpanded(group.cycleKey)}
            >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={cn(
                    'size-8 rounded-lg flex items-center justify-center text-muted-foreground transition-transform duration-200',
                    isExpanded(group.cycleKey) && 'rotate-180 text-foreground',
                  )}>
                    <ChevronDownIcon className="size-4" />
                  </div>
                  <h3 className="font-display font-semibold text-base sm:text-lg tracking-tight text-foreground">
                    {group.cycle.name}
                  </h3>
                </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Registrar asignatura en ${group.cycle.name}`}
                  onClick={() => edit(null, group.cycle.id)}
                  className="text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1.5 h-8 font-medium"
                >
                  <PlusIcon className="size-3.5" /> Añadir asignatura
                </Button>
              </div>
            </div>

            {isExpanded(group.cycleKey) && (
              <div className="p-3 sm:p-4 bg-muted/10">
                {group.subjects.length > 0 ? (
                  <RecordTable
                    rows={group.subjects}
                    loading={list.isFetching || list.isInitialLoading}
                    empty="No hay asignaturas en este ciclo para la búsqueda actual."
                    columns={renderSubjectColumns(group.cycleIds)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center rounded-lg border border-dashed bg-card/60">
                    <div className="size-10 rounded-full bg-muted flex items-center justify-center mb-2 text-muted-foreground">
                      <BookOpenIcon className="size-5" />
                    </div>
                    <p className="text-sm font-medium text-foreground">No hay asignaturas registradas en {group.cycle.name}</p>
                    <p className="text-xs text-muted-foreground max-w-sm mt-0.5 mb-3">
                      Registra las materias de este ciclo para poder asignar tutorías y paralelos.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => edit(null, group.cycle.id)}
                      className="gap-1.5 text-xs"
                    >
                      <PlusIcon className="size-3.5" /> Registrar primera asignatura en este ciclo
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {unassignedSubjects.length > 0 && (
          <div className="rounded-xl border bg-card shadow-xs overflow-hidden transition-all duration-200">
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleExpand('unassigned')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand('unassigned') } }}
              className="flex items-center justify-between p-4 sm:p-5 bg-card hover:bg-accent/40 cursor-pointer select-none transition-colors border-b last:border-b-0"
              aria-expanded={isExpanded('unassigned')}
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className={cn(
                  'size-8 rounded-lg flex items-center justify-center text-muted-foreground transition-transform duration-200',
                  isExpanded('unassigned') && 'rotate-180 text-foreground',
                )}>
                  <ChevronDownIcon className="size-4" />
                </div>
                <div className="flex items-center gap-2.5">
                  <h3 className="font-display font-semibold text-base sm:text-lg tracking-tight text-foreground">
                    Otras asignaturas / Sin ciclo asignado
                  </h3>
                </div>
                <Badge variant="outline" className="text-xs">
                  {unassignedSubjects.length} {unassignedSubjects.length === 1 ? 'asignatura' : 'asignaturas'}
                </Badge>
              </div>
            </div>

            {isExpanded('unassigned') && (
              <div className="p-3 sm:p-4 bg-muted/10">
                <RecordTable
                  rows={unassignedSubjects}
                  loading={list.isFetching || list.isInitialLoading}
                  empty="No hay asignaturas sin ciclo asignado."
                  columns={renderSubjectColumns()}
                />
              </div>
            )}
          </div>
        )}
      </div>
    ) : (
      <RecordTable
        rows={list.data}
        loading={list.isFetching || list.isInitialLoading}
        empty="No se encontraron asignaturas para esta búsqueda."
        columns={renderSubjectColumns()}
      />
    )}
    <CatalogPagination label="asignaturas" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
    <MutationDialog
      open={open}
      title={editing ? 'Editar asignatura' : 'Registrar asignatura'}
      description={
        editing
          ? `Modifica los datos de ${editing.name}.`
          : currentCareer ? `Carrera: ${currentCareer.name}` : undefined
      }
      pending={operation.pending}
      error={operation.error}
      dirty={JSON.stringify(form) !== JSON.stringify(initialForm) || Boolean(newSectionName)}
      onClose={() => setOpen(false)}
      onSubmit={submit}
      submitLabel={editing ? 'Guardar cambios' : 'Registrar asignatura'}
    >
      {!editing && (
        <>
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="subject-period">Período académico</FieldLabel>
              <Badge variant="outline" className="text-xs font-semibold text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                PAO actual
              </Badge>
            </div>
            <Input
              id="subject-period"
              value={currentPeriod ? currentPeriod.name : 'Sin período académico activo'}
              disabled
              readOnly
              className="bg-muted text-foreground font-medium cursor-not-allowed select-none"
              aria-readonly="true"
            />
            <FieldDescription className="text-xs">
              Todas las asignaturas corresponden automáticamente al período académico vigente ({currentPeriod?.name ?? 'sin período'}).
            </FieldDescription>
          </Field>
          <SelectField
            id="subject-new-cycle"
            label="Ciclo"
            value={form.cycle_id}
            onChange={(value) => setForm({ ...form, cycle_id: value })}
            required={false}
          >
            <option value="">Seleccionar</option>
            {uniqueCycleLevels.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.name}
              </option>
            ))}
          </SelectField>
          <Field data-invalid={Boolean(sectionError)}>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="subject-parallels">
                Paralelo(s) <span className="text-xs font-normal text-muted-foreground">(puedes seleccionar varios)</span>
              </FieldLabel>
              {!isAddingSection && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsAddingSection(true)
                    setNewSectionName('')
                    setSectionError(null)
                  }}
                  disabled={operation.pending}
                  className="text-xs h-7 text-primary hover:text-primary gap-1"
                >
                  <PlusIcon className="size-3.5" /> Crear nuevo paralelo
                </Button>
              )}
            </div>
            {isAddingSection ? (
              <div className="flex items-center gap-2">
                <Input
                  id="new-parallel-name"
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
                  className="bg-brand-red hover:bg-brand-red/90 text-white font-semibold shrink-0"
                >
                  {creatingSection && <Spinner data-icon="inline-start" />}
                  Guardar
                </Button>
                <Button
                  type="button"
                  variant="outline"
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
              <div id="subject-parallels" className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Paralelos">
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
              </div>
            )}
            {sectionError && <FieldError>{sectionError}</FieldError>}
          </Field>
        </>
      )}
      <SelectField
        id="subject-modality"
        label="Modalidad"
        value={form.modality_id}
        onChange={(value) => setForm({ ...form, modality_id: value })}
        required={false}
      >
        <option value="">Seleccionar</option>
        {catalogs.modalities
          .filter((modality) => modality.is_active || String(modality.id) === form.modality_id)
          .map((modality) => (
            <option key={modality.id} value={modality.id}>
              {modality.name}{modality.is_active ? '' : ' (inactiva)'}
            </option>
          ))}
      </SelectField>
      <Field>
        <div className="flex items-center justify-between">
          <FieldLabel htmlFor="subject-code">
            Código <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
          </FieldLabel>
          {form.code.length > 0 && <FieldCounter current={form.code.length} max={30} />}
        </div>
        <Input id="subject-code" value={form.code} onChange={(event) => setForm({ ...form, code: sanitizeCode(event.target.value, 30) })} maxLength={30} placeholder="Ej. SW-B1-001 (opcional)" />
      </Field>
      <Field>
        <div className="flex items-center justify-between"><FieldLabel htmlFor="subject-name">Nombre</FieldLabel><FieldCounter current={form.name.length} max={150} /></div>
        <Input id="subject-name" value={form.name} onChange={(event) => setForm({ ...form, name: sanitizeLetters(event.target.value, 150) })} required maxLength={150} placeholder="Ej. Algoritmos y lógica de programación" />
      </Field>
    </MutationDialog>
    <MutationDialog
      open={Boolean(assigning)}
      title="Paralelos de la asignatura"
      description={assigning ? `${assigning.name}${assignedCycleName ? ` · ${assignedCycleName}` : ''}` : ''}
      pending={operation.pending}
      error={operation.error}
      dirty={Boolean(parallelId || newModalParallelName.trim())}
      onClose={() => {
        setAssigning(null)
        setParallelId('')
        setIsAddingParallelInModal(false)
        setNewModalParallelName('')
        setModalParallelError(null)
      }}
      submitLabel="Agregar paralelo"
      submitDisabled={!parallelId && !newModalParallelName.trim()}
      onSubmit={addParallel}
    >
      {assignedParallels.length > 0 ? (
        <div className="flex flex-col gap-2">
          <FieldLabel>Paralelos asignados actualmente</FieldLabel>
          <ul className="flex flex-col gap-2">
            {assignedParallels.map((item) => (
              <li
                key={item.key}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm bg-card"
              >
                <span className="font-medium text-foreground">{item.label}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={operation.pending}
                  aria-label={`Quitar ${item.label}`}
                  onClick={() => removeParallel(item.cycleId, item.parallelId)}
                >
                  <XIcon />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Esta asignatura no tiene paralelos asignados en su ciclo.</p>
      )}

      <div className="flex flex-col gap-3 pt-2 border-t">
        <div className="flex items-center justify-between">
          <FieldLabel htmlFor="subject-parallel-select">
            Agregar un paralelo
          </FieldLabel>
          {!isAddingParallelInModal && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsAddingParallelInModal(true)
                setNewModalParallelName('')
                setModalParallelError(null)
              }}
              disabled={operation.pending}
              className="text-xs h-7 text-primary hover:text-primary gap-1"
            >
              <PlusIcon className="size-3.5" /> Crear nuevo paralelo
            </Button>
          )}
        </div>

        {isAddingParallelInModal ? (
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
              variant="outline"
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
        ) : (
          <SelectField
            id="subject-parallel-select"
            label="Seleccionar paralelo"
            value={parallelId}
            onChange={(v) => {
              setParallelId(v)
              setModalParallelError(null)
            }}
          >
            <option value="">Selecciona un paralelo</option>
            {availableParallelsForModal.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name.startsWith('Paralelo') ? p.name : `Paralelo ${p.name}`}
              </option>
            ))}
          </SelectField>
        )}
        {modalParallelError && <FieldError>{modalParallelError}</FieldError>}
        {!isAddingParallelInModal && availableParallelsForModal.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Todos los paralelos registrados ya están asignados a esta asignatura. Puedes crear uno nuevo si lo requieres.
          </p>
        )}
      </div>
    </MutationDialog>
    <Dialog
      open={Boolean(viewingParallelsSubject)}
      title="Paralelos de la asignatura"
      description={viewingParallelsSubject ? viewingParallelsSubject.subject.name : ''}
      confirmClose={false}
      onClose={() => setViewingParallelsSubject(null)}
      maxWidth="max-w-md"
    >
      {viewingParallelsSubject && (() => {
        const { subject, cycleIds } = viewingParallelsSubject
        const parallels = cycleIds && cycleIds.length > 0
          ? catalogs.cycles
              .filter((c) => cycleIds.includes(c.id) && subject.cycle_ids.includes(c.id) && c.paralelo_name)
              .map((c) => c.paralelo_name!)
          : catalogs.cycles
              .filter((c) => subject.cycle_ids.includes(c.id) && c.paralelo_name)
              .map((c) => c.paralelo_name!)

        const uniqueParallels = Array.from(new Set(parallels)).sort()

        return (
          <div className="flex flex-col gap-4">
            {uniqueParallels.length > 0 ? (
              <div className="grid grid-cols-2 gap-2" role="list" aria-label="Lista de paralelos">
                {uniqueParallels.map((p) => (
                  <div
                    key={p}
                    role="listitem"
                    className="flex items-center gap-2.5 p-3 rounded-lg border bg-card text-card-foreground shadow-xs hover:border-primary/40 transition-colors"
                  >
                    <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                      {p}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-foreground truncate">Paralelo {p}</span>
                      <span className="text-xs text-muted-foreground">Activo en este ciclo</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-muted/30 border border-dashed text-center">
                <p className="text-sm text-muted-foreground">Esta asignatura no tiene paralelos asignados en este ciclo.</p>
              </div>
            )}

            <div className="flex items-center justify-end pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setViewingParallelsSubject(null)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        )
      })()}
    </Dialog>
    <ConfirmModal open={Boolean(deactivating)} title="¿Desactivar asignatura?" description={`La asignatura «${deactivating?.name ?? ''}» dejará de estar disponible para nuevas tutorías. Sus tutorías existentes se conservarán.`} confirmLabel="Desactivar asignatura" pending={operation.pending} onClose={() => { if (!operation.pending) setDeactivating(null) }} onConfirm={() => { if (deactivating) void operation.run(() => tutoringApi.deactivateSubject(deactivating.id), 'Asignatura desactivada.', async () => { setDeactivating(null); await list.reload() }) }} />
  </section>
}
