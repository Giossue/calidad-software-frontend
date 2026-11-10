import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowLeftIcon, Layers3Icon, PlusIcon, PowerIcon, PowerOffIcon } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { BulkImportButton } from '@/components/bulk-import-dialog'
import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Button } from '@/components/ui/button'
import { RefreshButton } from '@/components/ui/refresh-button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { getFriendlyError, type FriendlyErrorInfo } from '@/components/ui/error-modal'
import { ErrorNotice } from '@/components/ui/error-notice'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { IconAction } from '@/components/ui/icon-action'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { RowActionsMenu } from '@/components/ui/row-actions-menu'
import { StatusBadge } from '@/components/ui/status-badge'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { api, type Career, type Cycle, type Faculty, type Modality } from '@/lib/api'
import { sanitizeLetters } from '@/lib/sanitize'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { RecordTable } from '@/features/tutoring/tutoring-shared'


type CareerFormErrors = { facultyId?: string; name?: string }

function validateCareerForm(facultyId: string, name: string): CareerFormErrors {
  const errors: CareerFormErrors = {}
  if (!facultyId) errors.facultyId = 'Selecciona una facultad.'

  const trimmedName = name.trim()
  if (!trimmedName) errors.name = 'El nombre de la carrera es obligatorio.'
  else if (trimmedName.length > 150) errors.name = 'El nombre no puede superar 150 caracteres.'

  return errors
}

type CycleFormErrors = { name?: string }

function validateCycleForm(name: string): CycleFormErrors {
  const errors: CycleFormErrors = {}
  const trimmedName = name.trim()
  if (!trimmedName) errors.name = 'El nombre del ciclo es obligatorio.'
  else if (trimmedName.length > 100) errors.name = 'El nombre no puede superar 100 caracteres.'

  return errors
}

export function AcademicPage() {
  const [selectedCareer, setSelectedCareer] = useState<Career | null>(null)

  return selectedCareer ? (
    <CareerCyclesSection career={selectedCareer} onBack={() => setSelectedCareer(null)} />
  ) : (
    <CareersPage onSelectCareer={setSelectedCareer} />
  )
}

type CareerPendingAction = 'career' | 'toggle-career' | null
type CareerToggleTarget = { career: Career; action: 'activate' | 'deactivate' }

function CareersPage({ onSelectCareer }: Readonly<{ onSelectCareer: (career: Career) => void }>) {
  const [searchParams, setSearchParams] = useSearchParams()
  const facultyParam = Number(searchParams.get('faculty'))
  const facultyFilterId = Number.isInteger(facultyParam) && facultyParam > 0 ? facultyParam : undefined

  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('')
  const fetchCareers = useCallback(
    (page: number, search: string) => api.listCareers({ page, search, facultyId: facultyFilterId, status: statusFilter || undefined }),
    [facultyFilterId, statusFilter],
  )
  const {
    data: careers,
    meta,
    page,
    setPage,
    searchInput,
    setSearchInput,
    isInitialLoading,
    isFetching,
    error: pageError,
    reload,
  } = usePaginatedCatalog(fetchCareers, `${facultyFilterId ?? ''}|${statusFilter}`)

  const [activeFaculties, setActiveFaculties] = useState<readonly Faculty[]>([])
  const [modalities, setModalities] = useState<readonly Modality[]>([])

  async function refreshModalities() {
    const response = await api.listModalities()
    setModalities(response.data.filter((modality) => modality.is_active))
  }

  useEffect(() => {
    void api.listActiveFaculties().then(setActiveFaculties)
    void refreshModalities()
  }, [])

  // Error del servidor (o de validación al enviar): se muestra una vez, en línea, dentro del modal.
  const [formError, setFormError] = useState<FriendlyErrorInfo | null>(null)
  const [careerErrors, setCareerErrors] = useState<CareerFormErrors>({})
  const [pending, setPending] = useState<CareerPendingAction>(null)

  const [editingCareer, setEditingCareer] = useState<Career | null>(null)
  const [careerFacultyId, setCareerFacultyId] = useState('')
  const [careerName, setCareerName] = useState('')
  const [careerModalityId, setCareerModalityId] = useState('')
  const [careerCyclesCount, setCareerCyclesCount] = useState('8')
  const [initialCareerCyclesCount, setInitialCareerCyclesCount] = useState('8')
  const [initialCareerFacultyId, setInitialCareerFacultyId] = useState('')
  const [initialCareerName, setInitialCareerName] = useState('')
  const [initialCareerModalityId, setInitialCareerModalityId] = useState('')



  const [isCareerModalOpen, setIsCareerModalOpen] = useState(false)
  const [careerToToggle, setCareerToToggle] = useState<CareerToggleTarget | null>(null)

  function openCreateCareerModal() {
    setEditingCareer(null)
    setCareerFacultyId('')
    setCareerName('')
    setCareerModalityId('')
    setCareerCyclesCount('8')
    setInitialCareerCyclesCount('8')
    setInitialCareerFacultyId('')
    setInitialCareerName('')
    setInitialCareerModalityId('')
    setCareerErrors({})
    setFormError(null)
    void api.listActiveFaculties().then(setActiveFaculties)
    void refreshModalities()
    setIsCareerModalOpen(true)
  }

  function startCareerEdit(career: Career) {
    setEditingCareer(career)
    setCareerFacultyId(String(career.faculty_id))
    setCareerName(career.name)
    setCareerModalityId(career.modality_id ? String(career.modality_id) : '')
    setCareerCyclesCount(String(career.cycle_levels))
    setInitialCareerCyclesCount(String(career.cycle_levels))
    setInitialCareerFacultyId(String(career.faculty_id))
    setInitialCareerName(career.name)
    setInitialCareerModalityId(career.modality_id ? String(career.modality_id) : '')
    setCareerErrors({})
    setFormError(null)
    void api.listActiveFaculties().then(setActiveFaculties)
    void refreshModalities()
    setIsCareerModalOpen(true)
  }

  function closeCareerModal() {
    setIsCareerModalOpen(false)
    setEditingCareer(null)
    setCareerFacultyId('')
    setCareerName('')
    setCareerModalityId('')
    setCareerErrors({})
    setFormError(null)
  }



  async function submitCareer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending !== null) return

    const errors = validateCareerForm(careerFacultyId, careerName)
    setCareerErrors(errors)
    if (Object.keys(errors).length > 0) {
      setFormError({
        title: 'Revisa los campos requeridos',
        description: 'Verifica la facultad y el nombre de la carrera antes de guardar.',
      })
      return
    }

    const normalizedName = careerName.trim().toLowerCase()
    const duplicateLocally = careers.find(
      (c) => (!editingCareer || c.id !== editingCareer.id) && c.name.trim().toLowerCase() === normalizedName,
    )
    if (duplicateLocally) {
      setFormError({
        title: 'Carrera ya registrada',
        description:
          'Ya existe una carrera con este nombre en el sistema. El nombre de la carrera es único institucionalmente y no puede repetirse en ninguna facultad.',
      })
      setCareerErrors((prev) => ({
        ...prev,
        name: 'Ya existe una carrera con este nombre.',
      }))
      return
    }

    setPending('career')
    setFormError(null)
    try {
      const input = {
        faculty_id: Number(careerFacultyId),
        name: careerName.trim(),
        modality_id: careerModalityId ? Number(careerModalityId) : null,
      }
      if (editingCareer) {
        // Solo se envía la cantidad de ciclos si se aumentó: desde aquí no se quitan ciclos.
        const cyclesChanged = careerCyclesCount !== initialCareerCyclesCount
        await api.updateCareer(editingCareer.id, cyclesChanged ? { ...input, cycles_count: Number(careerCyclesCount) } : input)
        toast.success('Carrera actualizada', { description: `La carrera "${input.name}" fue modificada.` })
      } else {
        await api.createCareer({ ...input, cycles_count: Number(careerCyclesCount) })
        toast.success('Carrera creada', { description: `La carrera "${input.name}" ha sido agregada.` })
      }
      closeCareerModal()
      await reload()
    } catch (error: unknown) {
      const friendly = getFriendlyError(error)
      setFormError({
        title: friendly.title,
        description: friendly.description,
      })
      if (friendly.field === 'name') {
        setCareerErrors((prev) => ({ ...prev, name: friendly.description }))
      }
    } finally {
      setPending(null)
    }
  }

  async function handleConfirmToggleCareer() {
    if (!careerToToggle || pending !== null) return
    const { career, action } = careerToToggle
    setPending('toggle-career')
    try {
      if (action === 'activate') {
        await api.activateCareer(career.id)
        toast.success('Carrera habilitada', { description: `La carrera "${career.name}" fue habilitada.` })
      } else {
        await api.deactivateCareer(career.id)
        toast.info('Carrera deshabilitada', { description: `Se desactivó la carrera "${career.name}".` })
      }
      setCareerToToggle(null)
      closeCareerModal()
      await reload()
    } catch (error: unknown) {
      setCareerToToggle(null)
      const friendly = getFriendlyError(error)
      setFormError({
        title: friendly.title,
        description: friendly.description,
      })
    } finally {
      setPending(null)
    }
  }

  const formPending = pending === 'career'
  const isCareerFormDirty =
    careerFacultyId !== initialCareerFacultyId
    || careerName !== initialCareerName
    || careerModalityId !== initialCareerModalityId
    || (Boolean(editingCareer) && careerCyclesCount !== initialCareerCyclesCount)
  // "Guardar" se bloquea con el primer error de validación; sin cambios lo bloquea FormDialog.
  const careerBlockReason = Object.values(validateCareerForm(careerFacultyId, careerName))[0] ?? null
  const facultyOptions = activeFaculties.map((faculty) => ({ value: String(faculty.id), label: faculty.name }))
  const modalityOptions = modalities.map((modality) => ({ value: String(modality.id), label: modality.name }))
  const cycleCountOptions = [
    ...((!editingCareer || editingCareer.cycle_levels === 0) ? [{ value: '0', label: editingCareer ? 'Sin ciclos' : 'Ninguno' }] : []),
    ...Array.from({ length: 12 }, (_, index) => index + 1)
      .filter((count) => !editingCareer || count >= editingCareer.cycle_levels)
      .map((count) => ({ value: String(count), label: `${count} ${count === 1 ? 'ciclo' : 'ciclos'}` })),
  ]
  const hasFilters = searchInput.trim() !== '' || statusFilter !== ''
  const emptyMessage = hasFilters
    ? 'No hay carreras con estos filtros.'
    : facultyFilterId !== undefined ? 'Esta facultad aún no tiene carreras registradas.' : 'Aún no hay carreras registradas.'

  return (
    <section className="flex flex-col gap-6">
      <AdminSectionHeader
        title="Carreras"
        description="Registra las carreras de cada facultad y administra sus ciclos."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
            <RefreshButton onClick={() => void reload()} loading={isFetching} />
            <BulkImportButton type="careers" title="Carga masiva de carreras" onFinished={reload} className="flex-1 sm:flex-none" />
            <Button onClick={openCreateCareerModal} className="w-full sm:w-auto" data-tour="page-create">
              <PlusIcon data-icon="inline-start" />
              Nueva carrera
            </Button>
          </div>
        }
      />

      <ErrorNotice title="No se pudo cargar el catálogo" message={pageError} retry={reload} />

      <div className="flex flex-col gap-4">
        <FilterBar
          id="careers"
          search={searchInput}
          onSearch={setSearchInput}
          searchLabel="Buscar carrera"
          searchPlaceholder="Buscar carrera por nombre o facultad…"
          filters={[
            { id: 'faculty', label: 'Facultad', value: facultyFilterId ? String(facultyFilterId) : '', onChange: (value) => setSearchParams(value ? { faculty: value } : {}), allLabel: 'Todas las facultades', options: activeFaculties.map((faculty) => ({ value: String(faculty.id), label: faculty.name })) },
            { id: 'status', label: 'Estado', value: statusFilter, onChange: (value) => setStatusFilter(value as '' | 'active' | 'inactive'), allLabel: 'Todos los estados', options: [{ value: 'active', label: 'Activas' }, { value: 'inactive', label: 'Inactivas' }] },
          ]}
          onClear={() => { setSearchInput(''); setStatusFilter(''); setSearchParams({}) }}
        />

        <RecordTable
          rows={careers}
          loading={isInitialLoading}
          onRowClick={startCareerEdit}
          isRowSelected={(career) => editingCareer?.id === career.id}
          empty={emptyMessage}
          columns={[
            {
              label: 'Carrera',
              render: (career) => (
                <div className="flex flex-col">
                  <span className="font-medium">{career.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {career.cycles_count === 0
                      ? 'Sin ciclos'
                      : `${career.active_cycles_count} de ${career.cycles_count} ciclo${career.cycles_count === 1 ? '' : 's'} activo${career.active_cycles_count === 1 ? '' : 's'}`}
                  </span>
                </div>
              ),
            },
            { label: 'Facultad', render: (career) => <span className="text-muted-foreground">{career.faculty_name ?? `Facultad #${career.faculty_id}`}</span> },
            { label: 'Modalidad', render: (career) => <span className="text-muted-foreground">{career.modality_name ?? 'Sin modalidad'}</span> },
            { label: 'Estado', render: (career) => <StatusBadge active={career.status} activeLabel="Activa" inactiveLabel="Inactiva" /> },
            {
              label: 'Acciones',
              render: (career) => (
                <RowActionsMenu
                  name={career.name}
                  actions={[{ label: 'Ver ciclos', icon: Layers3Icon, onSelect: () => onSelectCareer(career) }]}
                />
              ),
            },
          ]}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {careers.length} de {meta?.total ?? careers.length} {(meta?.total ?? careers.length) === 1 ? 'carrera' : 'carreras'}
          </p>
          <CatalogPagination label="carreras" page={page} lastPage={meta?.last_page ?? 1} disabled={isFetching} onChange={setPage} />
        </div>
      </div>

      <FormDialog
        open={isCareerModalOpen}
        onClose={closeCareerModal}
        onSubmit={submitCareer}
        title={editingCareer ? 'Editar Carrera' : 'Registrar Carrera'}
        description={editingCareer ? undefined : 'Asigna la nueva carrera a una facultad activa.'}
        maxWidth="max-w-md"
        pending={formPending}
        error={formError?.description ?? null}
        errorModal={formError}
        dirty={isCareerFormDirty}
        blockReason={careerBlockReason}
        submitLabel={editingCareer ? 'Guardar Cambios' : 'Registrar Carrera'}
        submitIcon={editingCareer ? undefined : PlusIcon}
        headerActions={
          editingCareer ? (
            <>
              <StatusBadge active={editingCareer.status} activeLabel="Activa" inactiveLabel="Inactiva" />
              <IconAction
                label={editingCareer.status ? 'Desactivar carrera' : 'Habilitar carrera'}
                icon={editingCareer.status ? PowerOffIcon : PowerIcon}
                tone={editingCareer.status ? 'destructive' : 'default'}
                disabled={formPending}
                onClick={() => setCareerToToggle({ career: editingCareer, action: editingCareer.status ? 'deactivate' : 'activate' })}
              />
            </>
          ) : undefined
        }
      >
        <SelectField
          id="career-faculty"
          label="Facultad Perteneciente"
          value={careerFacultyId}
          onValueChange={(value) => {
            setCareerFacultyId(value)
            setCareerErrors((current) => ({ ...current, facultyId: undefined }))
          }}
          options={facultyOptions}
          placeholder="Selecciona una facultad"
          disabled={formPending}
          error={careerErrors.facultyId}
        />

        <FormField id="career-name" label="Nombre de la carrera" counter={{ current: careerName.length, max: 150 }} error={careerErrors.name}>
          <Input
            id="career-name"
            value={careerName}
            onChange={(e) => {
              setCareerName(sanitizeLetters(e.target.value, 150))
              setCareerErrors((current) => ({ ...current, name: undefined }))
            }}
            placeholder="Ej. Ingeniería en Software"
            disabled={formPending}
            maxLength={150}
            required
          />
        </FormField>

        <SelectField
          id="career-modality"
          label="Modalidad"
          value={careerModalityId}
          onValueChange={setCareerModalityId}
          options={modalityOptions}
          emptyLabel="Seleccionar"
          placeholder="Seleccionar"
          disabled={formPending}
        />

        <SelectField
          id="career-cycles-count"
          label={editingCareer ? 'Cantidad de ciclos' : 'Ciclos a crear'}
          tip={editingCareer
            ? 'Al aumentar la cantidad se crean los ciclos que faltan. Para quitar un ciclo, desactívalo desde la carrera.'
            : 'Se crean automáticamente los ciclos de la carrera.'}
          value={careerCyclesCount}
          onValueChange={setCareerCyclesCount}
          options={cycleCountOptions}
          disabled={formPending}
        />
      </FormDialog>

      <ConfirmModal
        open={Boolean(careerToToggle)}
        onClose={() => setCareerToToggle(null)}
        onConfirm={() => void handleConfirmToggleCareer()}
        title={careerToToggle?.action === 'activate' ? '¿Habilitar carrera?' : '¿Desactivar carrera?'}
        description={
          careerToToggle?.action === 'activate'
            ? `"${careerToToggle?.career.name}" volverá a estar disponible en el sistema.`
            : `"${careerToToggle?.career.name}" quedará inactiva en el sistema. Puedes volver a habilitarla después.`
        }
        confirmLabel={careerToToggle?.action === 'activate' ? 'Habilitar carrera' : 'Desactivar carrera'}
        confirmIcon={careerToToggle?.action === 'activate' ? PowerIcon : PowerOffIcon}
        cancelLabel="Cancelar"
        variant={careerToToggle?.action === 'activate' ? 'default' : 'destructive'}
        pending={pending === 'toggle-career'}
      />
    </section>
  )
}

type CyclePendingAction = 'cycle' | 'toggle-cycle' | null
type CycleToggleTarget = { cycle: Cycle; action: 'activate' | 'deactivate' }

function CareerCyclesSection({ career, onBack }: Readonly<{ career: Career; onBack: () => void }>) {
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('')
  const fetchCycles = useCallback(
    (page: number, search: string) => api.listCycles({ page, search, careerId: career.id, status: statusFilter || undefined }),
    [career.id, statusFilter],
  )
  const {
    data: cycles,
    meta,
    page,
    setPage,
    searchInput,
    setSearchInput,
    isInitialLoading,
    isFetching,
    error: pageError,
    reload,
  } = usePaginatedCatalog(fetchCycles, statusFilter)

  // Error del servidor (o de validación al enviar): se muestra una vez, en línea, dentro del modal.
  const [formError, setFormError] = useState<FriendlyErrorInfo | null>(null)
  const [cycleErrors, setCycleErrors] = useState<CycleFormErrors>({})
  const [pending, setPending] = useState<CyclePendingAction>(null)

  const [editingCycle, setEditingCycle] = useState<Cycle | null>(null)
  const [cycleName, setCycleName] = useState('')
  const [cycleNumber, setCycleNumber] = useState('')
  const [initialCycleName, setInitialCycleName] = useState('')

  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false)
  const [cycleToToggle, setCycleToToggle] = useState<CycleToggleTarget | null>(null)

  function openCreateCycleModal() {
    setEditingCycle(null)
    setCycleName('')
    const nextNumber = cycles.length > 0 ? Math.max(...cycles.map((c) => c.number)) + 1 : 1
    setCycleNumber(String(nextNumber))
    setInitialCycleName('')
    setCycleErrors({})
    setFormError(null)
    setIsCycleModalOpen(true)
  }

  function startCycleEdit(cycle: Cycle) {
    setEditingCycle(cycle)
    setCycleName(cycle.name)
    setCycleNumber(String(cycle.number))
    setInitialCycleName(cycle.name)
    setCycleErrors({})
    setFormError(null)
    setIsCycleModalOpen(true)
  }

  function closeCycleModal() {
    setIsCycleModalOpen(false)
    setEditingCycle(null)
    setCycleName('')
    setCycleNumber('')
    setCycleErrors({})
    setFormError(null)
  }

  async function submitCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending !== null) return

    const errors = validateCycleForm(cycleName)
    setCycleErrors(errors)
    if (Object.keys(errors).length > 0) {
      setFormError({
        title: 'Revisa los campos requeridos',
        description: 'Ingresa el nombre del ciclo antes de continuar.',
      })
      return
    }

    setPending('cycle')
    setFormError(null)
    try {
      const calculatedNumber = editingCycle
        ? editingCycle.number
        : (Number(cycleNumber) || (cycles.length > 0 ? Math.max(...cycles.map((c) => c.number)) + 1 : 1))

      const input = {
        career_id: career.id,
        name: cycleName.trim(),
        number: calculatedNumber,
      }
      if (editingCycle) {
        await api.updateCycle(editingCycle.id, input)
        toast.success('Ciclo actualizado', { description: `El ciclo "${input.name}" fue modificado.` })
      } else {
        await api.createCycle(input)
        toast.success('Ciclo creado', { description: `El ciclo "${input.name}" fue registrado.` })
      }
      closeCycleModal()
      await reload()
    } catch (error: unknown) {
      const friendly = getFriendlyError(error)
      setFormError({
        title: friendly.title,
        description: friendly.description,
      })
      if (friendly.field === 'name') {
        setCycleErrors((prev) => ({ ...prev, name: friendly.description }))
      }
    } finally {
      setPending(null)
    }
  }

  async function handleConfirmToggleCycle() {
    if (!cycleToToggle || pending !== null) return
    const { cycle, action } = cycleToToggle
    setPending('toggle-cycle')
    try {
      if (action === 'activate') {
        await api.activateCycle(cycle.id)
        toast.success('Ciclo habilitado', { description: `El ciclo "${cycle.name}" fue habilitado.` })
      } else {
        await api.deactivateCycle(cycle.id)
        toast.info('Ciclo deshabilitado', { description: `Se desactivó el ciclo "${cycle.name}".` })
      }
      setCycleToToggle(null)
      closeCycleModal()
      await reload()
    } catch (error: unknown) {
      setCycleToToggle(null)
      const friendly = getFriendlyError(error)
      setFormError({
        title: friendly.title,
        description: friendly.description,
      })
    } finally {
      setPending(null)
    }
  }

  const formPending = pending === 'cycle'
  const isCycleFormDirty = cycleName !== initialCycleName
  const cycleBlockReason = Object.values(validateCycleForm(cycleName))[0] ?? null
  const hasFilters = searchInput.trim() !== '' || statusFilter !== ''

  return (
    <section className="flex flex-col gap-6" data-tour-view="cycles">
      <div>
        <Button type="button" variant="tertiary" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" />
          Volver a Carreras
        </Button>
      </div>

      <AdminSectionHeader
        title={`Ciclos de ${career.name}`}
        description="Define los ciclos o niveles de la carrera."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
            <RefreshButton onClick={() => void reload()} loading={isFetching} />
            <BulkImportButton type="cycles" title="Carga masiva de ciclos" onFinished={reload} className="flex-1 sm:flex-none" />
            <Button onClick={openCreateCycleModal} className="w-full sm:w-auto" data-tour="page-create">
              <PlusIcon data-icon="inline-start" />
              Nuevo ciclo
            </Button>
          </div>
        }
      />

      <ErrorNotice title="No se pudo cargar el catálogo" message={pageError} retry={reload} />

      <div className="flex flex-col gap-4">
        <FilterBar
          id="cycles"
          search={searchInput}
          onSearch={setSearchInput}
          searchLabel="Buscar ciclo"
          searchPlaceholder="Buscar ciclo por nombre…"
          filters={[
            { id: 'status', label: 'Estado', value: statusFilter, onChange: (value) => setStatusFilter(value as '' | 'active' | 'inactive'), allLabel: 'Todos los estados', options: [{ value: 'active', label: 'Activos' }, { value: 'inactive', label: 'Inactivos' }] },
          ]}
          onClear={() => { setSearchInput(''); setStatusFilter('') }}
        />

        <RecordTable
          rows={cycles}
          loading={isInitialLoading}
          onRowClick={startCycleEdit}
          isRowSelected={(cycle) => editingCycle?.id === cycle.id}
          empty={hasFilters ? 'No hay ciclos con estos filtros.' : 'Aún no hay ciclos registrados para esta carrera.'}
          columns={[
            { label: 'Ciclo', render: (cycle) => <span className="font-medium">{cycle.name}</span> },
            { label: 'Estado', render: (cycle) => <StatusBadge active={cycle.status} /> },
          ]}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {cycles.length} de {meta?.total ?? cycles.length} {(meta?.total ?? cycles.length) === 1 ? 'ciclo' : 'ciclos'}
          </p>
          <CatalogPagination label="ciclos" page={page} lastPage={meta?.last_page ?? 1} disabled={isFetching} onChange={setPage} />
        </div>
      </div>

      <FormDialog
        open={isCycleModalOpen}
        onClose={closeCycleModal}
        onSubmit={submitCycle}
        title={editingCycle ? 'Editar Ciclo Académico' : 'Registrar Ciclo Académico'}
        description={editingCycle ? career.name : `Se agregará a la carrera "${career.name}".`}
        maxWidth="max-w-md"
        pending={formPending}
        error={formError?.description ?? null}
        errorModal={formError}
        dirty={isCycleFormDirty}
        blockReason={cycleBlockReason}
        submitLabel={editingCycle ? 'Guardar Cambios' : 'Registrar Ciclo'}
        submitIcon={editingCycle ? undefined : PlusIcon}
        headerActions={
          editingCycle ? (
            <>
              <StatusBadge active={editingCycle.status} />
              <IconAction
                label={editingCycle.status ? 'Desactivar ciclo' : 'Habilitar ciclo'}
                icon={editingCycle.status ? PowerOffIcon : PowerIcon}
                tone={editingCycle.status ? 'destructive' : 'default'}
                disabled={formPending}
                onClick={() => setCycleToToggle({ cycle: editingCycle, action: editingCycle.status ? 'deactivate' : 'activate' })}
              />
            </>
          ) : undefined
        }
      >
        <FormField id="cycle-name" label="Nombre del ciclo" counter={{ current: cycleName.length, max: 100 }} error={cycleErrors.name}>
          <Input
            id="cycle-name"
            value={cycleName}
            onChange={(e) => {
              setCycleName(sanitizeLetters(e.target.value, 100))
              setCycleErrors((current) => ({ ...current, name: undefined }))
            }}
            placeholder="Ej. Primer Ciclo"
            disabled={formPending}
            maxLength={100}
            required
          />
        </FormField>
      </FormDialog>

      <ConfirmModal
        open={Boolean(cycleToToggle)}
        onClose={() => setCycleToToggle(null)}
        onConfirm={() => void handleConfirmToggleCycle()}
        title={cycleToToggle?.action === 'activate' ? '¿Habilitar ciclo?' : '¿Desactivar ciclo?'}
        description={
          cycleToToggle?.action === 'activate'
            ? `"${cycleToToggle?.cycle.name}" volverá a estar disponible en el sistema.`
            : `"${cycleToToggle?.cycle.name}" quedará inactivo en el sistema. Puedes volver a habilitarlo después.`
        }
        confirmLabel={cycleToToggle?.action === 'activate' ? 'Habilitar ciclo' : 'Desactivar ciclo'}
        confirmIcon={cycleToToggle?.action === 'activate' ? PowerIcon : PowerOffIcon}
        cancelLabel="Cancelar"
        variant={cycleToToggle?.action === 'activate' ? 'default' : 'destructive'}
        pending={pending === 'toggle-cycle'}
      />
    </section>
  )
}
