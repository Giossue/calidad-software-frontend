import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowLeftIcon, PencilIcon, PlusIcon, PowerIcon, PowerOffIcon } from 'lucide-react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { toast } from '@/lib/toast'

import { BulkImportButton } from '@/components/bulk-import-dialog'
import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { AdminActionsSkeleton, AdminCatalogSkeleton, AdminDetailHeaderSkeleton, AdminListSkeleton } from '@/components/admin/admin-skeletons'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Button } from '@/components/ui/button'
import { RefreshButton } from '@/components/ui/refresh-button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { getFriendlyError, type FriendlyErrorInfo } from '@/components/ui/error-modal'
import { ErrorNotice } from '@/components/ui/error-notice'
import { FormDialog, isFormDialogOpen } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { IconAction } from '@/components/ui/icon-action'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { SelectField } from '@/components/ui/select-field'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDetailParam } from '@/hooks/use-detail-param'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { api, type Career, type Cycle, type Faculty, type Modality } from '@/lib/api'
import { asSentence, sanitizeOfficialName, useTouchedFields, visibleFieldError } from '@/features/admin/form-helpers'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { TabsSkeleton } from '@/features/tutoring/tutoring-skeletons'


type CareerFormErrors = { facultyId?: string; name?: string; code?: string; modalityId?: string }

function validateCareerForm(facultyId: string, name: string, code: string, modalityId: string): CareerFormErrors {
  const errors: CareerFormErrors = {}
  if (!facultyId) errors.facultyId = 'Selecciona una facultad.'

  const trimmedName = name.trim()
  if (!trimmedName) errors.name = 'El nombre de la carrera es obligatorio.'
  else if (trimmedName.length > 150) errors.name = 'El nombre no puede superar 150 caracteres.'

  const trimmedCode = code.trim()
  if (!trimmedCode) errors.code = 'El código de carrera es obligatorio.'
  else if (trimmedCode.length > 30) errors.code = 'El código no puede superar 30 caracteres.'

  // Toda carrera tiene modalidad: no existe «Sin modalidad».
  if (!modalityId) errors.modalityId = 'Selecciona la modalidad.'

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

type SelectedCareer = { career: Career; siblings: readonly Career[] }
type CareerLookup = { id: number; career: Career | null; error: string | null }

/**
 * Busca una carrera por id (no hay ruta de detalle). Con el nombre y la facultad conocidos,
 * primero la busca por nombre; si no, entre las activas y luego en las inactivas.
 */
async function findCareer(id: number, hint?: Pick<Career, 'name' | 'faculty_id'>): Promise<Career | null> {
  if (hint) {
    const byName = (await api.listCareers({ search: hint.name, facultyId: hint.faculty_id })).data.find((career) => career.id === id)
    if (byName) return byName
  }
  const active = (await api.listActiveCareers()).find((career) => career.id === id)
  if (active) return active
  for (let page = 1, lastPage = 1; page <= lastPage; page += 1) {
    const response = await api.listCareers({ page, status: 'inactive' })
    const found = response.data.find((career) => career.id === id)
    if (found) return found
    lastPage = response.meta?.last_page ?? 1
  }
  return null
}

/**
 * Carreras: la lista y, al pulsar una fila, la pantalla de la carrera con sus acciones arriba
 * y sus ciclos y datos en pestañas. La carrera abierta vive en la URL (`?carrera=<id>`):
 * "Atrás" vuelve a donde se abrió y al recargar se vuelve a cargar.
 */
export function AcademicPage() {
  const detail = useDetailParam('carrera')
  const location = useLocation()
  // Quien abre la carrera desde otra pantalla (p. ej. la facultad) puede pasar el registro.
  const passed = (location.state as { record?: Career } | null)?.record
  const [selected, setSelected] = useState<SelectedCareer | null>(() => (passed ? { career: passed, siblings: [] } : null))
  const [lookup, setLookup] = useState<CareerLookup | null>(null)
  const [lookupVersion, setLookupVersion] = useState(0)
  const detailId = detail.id
  const selectedMatches = selected !== null && selected.career.id === detailId

  useEffect(() => {
    if (detailId === null || selectedMatches) return
    let cancelled = false
    findCareer(detailId)
      .then((career) => { if (!cancelled) setLookup({ id: detailId, career, error: null }) })
      .catch((error: unknown) => { if (!cancelled) setLookup({ id: detailId, career: null, error: getFriendlyError(error).description }) })
    return () => { cancelled = true }
  }, [detailId, selectedMatches, lookupVersion])

  if (detailId === null) {
    return (
      <CareersPage
        onSelectCareer={(career, siblings) => {
          setSelected({ career, siblings })
          detail.open(career.id)
        }}
      />
    )
  }

  const current = selectedMatches ? selected : lookup?.id === detailId && lookup.career ? { career: lookup.career, siblings: [] } : null
  if (current) {
    return (
      <CareerDetail
        career={current.career}
        siblings={current.siblings}
        onChange={(career) => setSelected({ ...current, career })}
        onBack={detail.close}
      />
    )
  }
  if (lookup?.id === detailId) {
    return (
      <section className="flex flex-col items-start gap-4">
        {lookup.error ? (
          <ErrorNotice title="No se pudo cargar la carrera" message={lookup.error} retry={() => { setLookup(null); setLookupVersion((version) => version + 1) }} />
        ) : (
          <p className="text-sm text-muted-foreground">No encontramos esta carrera.</p>
        )}
        <Button type="button" variant="secondary" onClick={detail.close}>
          <ArrowLeftIcon data-icon="inline-start" />
          Volver a carreras
        </Button>
      </section>
    )
  }
  return <CareerDetailSkeleton />
}

const CYCLE_HEADERS = ['Ciclo', 'Estado'] as const

/** Contenido de la pestaña «Ciclos» mientras carga: descripción, acciones, filtros y tabla. */
function CyclesBodySkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-hidden="true">
        <Skeleton className="h-4 w-64 max-w-full" />
        <AdminActionsSkeleton />
      </div>
      <AdminCatalogSkeleton headers={CYCLE_HEADERS} />
    </div>
  )
}

/** Pantalla de la carrera mientras se busca: volver, encabezado, pestañas y la pestaña de ciclos. */
function CareerDetailSkeleton() {
  return (
    <section className="flex flex-col gap-6">
      <span role="status" aria-label="Cargando carrera" className="sr-only">Cargando carrera</span>
      <AdminDetailHeaderSkeleton />
      <div className="flex flex-col gap-2">
        <TabsSkeleton tabs={2} />
        <CyclesBodySkeleton />
      </div>
    </section>
  )
}

function cyclesSummary(career: Career): string {
  return career.cycles_count === 0
    ? 'Sin ciclos'
    : `${career.active_cycles_count} de ${career.cycles_count} ciclo${career.cycles_count === 1 ? '' : 's'} activo${career.active_cycles_count === 1 ? '' : 's'}`
}

/**
 * Modal para registrar una carrera o editarla. `siblings` son las carreras de la lista
 * cargada, contra las que se revisa el nombre duplicado antes de enviar.
 * Quien lo abre le cambia la `key` en cada apertura: así el formulario parte de los datos actuales.
 */
function CareerFormDialog({ open, career: editingCareer, siblings, onClose, onSaved }: Readonly<{
  open: boolean
  career: Career | null
  siblings: readonly Career[]
  onClose: () => void
  onSaved: (career: Career | null) => Promise<unknown> | void
}>) {
  const [activeFaculties, setActiveFaculties] = useState<readonly Faculty[]>([])
  const [modalities, setModalities] = useState<readonly Modality[]>([])
  // Error del servidor (o de validación al enviar): se muestra una vez, en línea, dentro del modal.
  const [formError, setFormError] = useState<FriendlyErrorInfo | null>(null)
  // Errores al enviar (o del servidor); los de validación se ven en cuanto se toca el campo.
  const [careerErrors, setCareerErrors] = useState<CareerFormErrors>({})
  const { touched, touch } = useTouchedFields<keyof CareerFormErrors>()
  const [pending, setPending] = useState(false)

  // El formulario parte de la carrera (o vacío al registrar).
  const initialCareerFacultyId = editingCareer ? String(editingCareer.faculty_id) : ''
  const initialCareerName = editingCareer?.name ?? ''
  const initialCareerCode = editingCareer?.code ?? ''
  const initialCareerModalityId = editingCareer?.modality_id ? String(editingCareer.modality_id) : ''
  const initialCareerCyclesCount = editingCareer ? String(editingCareer.cycle_levels) : '8'
  const [careerFacultyId, setCareerFacultyId] = useState(initialCareerFacultyId)
  const [careerName, setCareerName] = useState(initialCareerName)
  const [careerCode, setCareerCode] = useState(initialCareerCode)
  const [careerModalityId, setCareerModalityId] = useState(initialCareerModalityId)
  const [careerCyclesCount, setCareerCyclesCount] = useState(initialCareerCyclesCount)

  // Al abrir, recarga los catálogos de facultades y modalidades.
  useEffect(() => {
    if (!open) return
    void api.listActiveFaculties().then(setActiveFaculties)
    void api.listModalities().then((response) => setModalities(response.data.filter((modality) => modality.is_active)))
  }, [open])

  async function submitCareer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    // Los errores de validación van solo bajo cada campo, sin otro recuadro.
    const errors = validateCareerForm(careerFacultyId, careerName, careerCode, careerModalityId)
    setCareerErrors(errors)
    if (Object.keys(errors).length > 0) return

    // Otra malla de la misma carrera repite el nombre con otro código; el código no se repite.
    const normalizedCode = careerCode.trim().toLowerCase()
    const duplicateLocally = siblings.find(
      (c) => (!editingCareer || c.id !== editingCareer.id) && (c.code ?? '').trim().toLowerCase() === normalizedCode,
    )
    if (duplicateLocally) {
      setCareerErrors((prev) => ({
        ...prev,
        code: 'Ya existe una carrera con este código.',
      }))
      return
    }

    setPending(true)
    setFormError(null)
    try {
      const input = {
        faculty_id: Number(careerFacultyId),
        name: careerName.trim(),
        code: careerCode.trim(),
        modality_id: Number(careerModalityId),
      }
      let saved: Career | null = null
      if (editingCareer) {
        // Solo se envía la cantidad de ciclos si se aumentó: desde aquí no se quitan ciclos.
        const cyclesChanged = careerCyclesCount !== initialCareerCyclesCount
        saved = await api.updateCareer(editingCareer.id, cyclesChanged ? { ...input, cycles_count: Number(careerCyclesCount) } : input)
        toast.success('Carrera actualizada', { description: `La carrera "${input.name}" fue modificada.` })
      } else {
        await api.createCareer({ ...input, cycles_count: Number(careerCyclesCount) })
        toast.success('Carrera creada', { description: `La carrera "${input.name}" ha sido agregada.` })
      }
      onClose()
      await onSaved(saved)
    } catch (error: unknown) {
      const friendly = getFriendlyError(error)
      setFormError({
        title: friendly.title,
        description: friendly.description,
      })
      if (friendly.field === 'name' || friendly.field === 'code') {
        setCareerErrors((prev) => ({ ...prev, [friendly.field as 'name' | 'code']: friendly.description }))
      }
    } finally {
      setPending(false)
    }
  }

  const isCareerFormDirty =
    careerFacultyId !== initialCareerFacultyId
    || careerName !== initialCareerName
    || careerCode !== initialCareerCode
    || careerModalityId !== initialCareerModalityId
    || (Boolean(editingCareer) && careerCyclesCount !== initialCareerCyclesCount)
  // "Guardar" se bloquea con el primer error de validación; sin cambios lo bloquea FormDialog.
  const liveCareerErrors = validateCareerForm(careerFacultyId, careerName, careerCode, careerModalityId)
  const careerBlockReason = Object.values(liveCareerErrors)[0] ?? null
  const careerFieldError = (field: keyof CareerFormErrors) => visibleFieldError(field, careerErrors, liveCareerErrors, touched)
  const facultyOptions = activeFaculties.map((faculty) => ({ value: String(faculty.id), label: faculty.name }))
  const modalityOptions = modalities.map((modality) => ({ value: String(modality.id), label: modality.name }))
  const cycleCountOptions = [
    ...((!editingCareer || editingCareer.cycle_levels === 0) ? [{ value: '0', label: editingCareer ? 'Sin ciclos' : 'Ninguno' }] : []),
    ...Array.from({ length: 12 }, (_, index) => index + 1)
      .filter((count) => !editingCareer || count >= editingCareer.cycle_levels)
      .map((count) => ({ value: String(count), label: `${count} ${count === 1 ? 'ciclo' : 'ciclos'}` })),
  ]

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={submitCareer}
      title={editingCareer ? 'Editar carrera' : 'Registrar carrera'}
      maxWidth="max-w-md"
      pending={pending}
      error={formError?.description ?? null}
      errorModal={formError}
      dirty={isCareerFormDirty}
      blockReason={careerBlockReason}
      submitLabel={editingCareer ? 'Guardar cambios' : 'Registrar carrera'}
    >
      <FormField id="career-name" label="Nombre de la carrera" required counter={{ current: careerName.length, max: 150 }} error={careerFieldError('name')}>
        <Input
          id="career-name"
          value={careerName}
          onChange={(e) => {
            setCareerName(sanitizeOfficialName(e.target.value, 150))
            setCareerErrors((current) => ({ ...current, name: undefined }))
          }}
          onBlur={() => touch('name')}
          placeholder="Ej. Ingeniería en Software"
          disabled={pending}
          maxLength={150}
          required
        />
      </FormField>

      <FormField id="career-code" label="Código de carrera" required counter={{ current: careerCode.length, max: 30 }} error={careerFieldError('code')}>
        <Input
          id="career-code"
          value={careerCode}
          onChange={(e) => {
            setCareerCode(e.target.value.slice(0, 30))
            setCareerErrors((current) => ({ ...current, code: undefined }))
          }}
          onBlur={() => touch('code')}
          placeholder="Ej. SW-2024"
          disabled={pending}
          maxLength={30}
          required
        />
      </FormField>

      <SelectField
        id="career-faculty"
        label="Facultad"
        required
        value={careerFacultyId}
        onValueChange={(value) => {
          setCareerFacultyId(value)
          setCareerErrors((current) => ({ ...current, facultyId: undefined }))
          touch('facultyId')
        }}
        options={facultyOptions}
        placeholder="Selecciona una facultad"
        disabled={pending}
        error={careerFieldError('facultyId')}
      />

      <SelectField
        id="career-modality"
        label="Modalidad"
        required
        value={careerModalityId}
        onValueChange={(value) => {
          setCareerModalityId(value)
          setCareerErrors((current) => ({ ...current, modalityId: undefined }))
          touch('modalityId')
        }}
        options={modalityOptions}
        placeholder="Selecciona la modalidad"
        disabled={pending}
        error={careerFieldError('modalityId')}
      />

      <SelectField
        id="career-cycles-count"
        label={editingCareer ? 'Cantidad de ciclos' : 'Ciclos a crear'}
        tip={editingCareer
          ? 'Al aumentar la cantidad se crean los ciclos que faltan. Para quitar un ciclo, desactívalo desde la carrera.'
          : undefined}
        value={careerCyclesCount}
        onValueChange={setCareerCyclesCount}
        options={cycleCountOptions}
        disabled={pending}
      />
    </FormDialog>
  )
}

function CareersPage({ onSelectCareer }: Readonly<{ onSelectCareer: (career: Career, siblings: readonly Career[]) => void }>) {
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
  useEffect(() => {
    void api.listActiveFaculties().then(setActiveFaculties)
  }, [])

  const [isCareerModalOpen, setIsCareerModalOpen] = useState(false)
  const [careerFormKey, setCareerFormKey] = useState(0)

  function openCreateCareerModal() {
    setCareerFormKey((key) => key + 1)
    setIsCareerModalOpen(true)
  }

  const hasFilters = searchInput.trim() !== '' || statusFilter !== ''
  const emptyMessage = hasFilters
    ? 'No hay carreras con estos filtros.'
    : facultyFilterId !== undefined ? 'Esta facultad aún no tiene carreras registradas.' : 'Aún no hay carreras registradas.'

  // Primera carga: toda la pantalla en esqueleto; después, solo las filas al filtrar o paginar.
  if (isInitialLoading) {
    return <AdminListSkeleton label="Cargando carreras" filters={2} headers={['Carrera', 'Código', 'Facultad', 'Modalidad', 'Estado']} />
  }

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
          searchPlaceholder="Buscar carrera por nombre, código o facultad…"
          filters={[
            { id: 'faculty', label: 'Facultad', value: facultyFilterId ? String(facultyFilterId) : '', onChange: (value) => setSearchParams(value ? { faculty: value } : {}), allLabel: 'Todas las facultades', options: activeFaculties.map((faculty) => ({ value: String(faculty.id), label: faculty.name })) },
            { id: 'status', label: 'Estado', value: statusFilter, onChange: (value) => setStatusFilter(value as '' | 'active' | 'inactive'), allLabel: 'Todos los estados', options: [{ value: 'active', label: 'Activas' }, { value: 'inactive', label: 'Inactivas' }] },
          ]}
          onClear={() => { setSearchInput(''); setStatusFilter(''); setSearchParams({}) }}
        />

        <RecordTable
          rows={careers}
          loading={isInitialLoading}
          onRowClick={(career) => onSelectCareer(career, careers)}
          empty={emptyMessage}
          columns={[
            {
              label: 'Carrera',
              render: (career) => (
                <div className="flex flex-col">
                  <span>{career.name}</span>
                  <span className="text-sm text-muted-foreground">{cyclesSummary(career)}</span>
                </div>
              ),
            },
            { label: 'Código', render: (career) => career.code ?? <span className="text-muted-foreground">Sin código</span> },
            { label: 'Facultad', render: (career) => <span className="text-muted-foreground">{career.faculty_name ?? `Facultad #${career.faculty_id}`}</span> },
            { label: 'Modalidad', render: (career) => <span className="text-muted-foreground">{career.modality_name ?? '—'}</span> },
            { label: 'Estado', render: (career) => <StatusBadge active={career.status} activeLabel="Activa" inactiveLabel="Inactiva" /> },
          ]}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {careers.length} de {meta?.total ?? careers.length} {(meta?.total ?? careers.length) === 1 ? 'carrera' : 'carreras'}
          </p>
          <CatalogPagination label="carreras" page={page} lastPage={meta?.last_page ?? 1} disabled={isFetching} onChange={setPage} />
        </div>
      </div>

      <CareerFormDialog key={careerFormKey} open={isCareerModalOpen} career={null} siblings={careers} onClose={() => setIsCareerModalOpen(false)} onSaved={() => reload()} />
    </section>
  )
}

type CareerToggleTarget = { career: Career; action: 'activate' | 'deactivate' }

/** Pantalla de una carrera: arriba su estado y acciones; debajo, sus ciclos y datos en pestañas. */
function CareerDetail({ career, siblings, onChange, onBack }: Readonly<{
  career: Career
  siblings: readonly Career[]
  onChange: (career: Career) => void
  onBack: () => void
}>) {
  const [isCareerModalOpen, setIsCareerModalOpen] = useState(false)
  const [careerFormKey, setCareerFormKey] = useState(0)
  const [careerToToggle, setCareerToToggle] = useState<CareerToggleTarget | null>(null)
  const [pending, setPending] = useState(false)
  // Al guardar la carrera (p. ej. con más ciclos), la lista de ciclos se vuelve a cargar.
  const [cyclesVersion, setCyclesVersion] = useState(0)

  /**
   * Vuelve a leer la carrera después de un cambio: la respuesta de editar no trae la modalidad,
   * la facultad ni los conteos de ciclos, y crear o desactivar un ciclo cambia esos conteos.
   */
  async function refreshCareer(fallback: Career) {
    try {
      onChange((await findCareer(fallback.id, fallback)) ?? fallback)
    } catch {
      onChange(fallback)
    }
  }

  async function handleConfirmToggleCareer() {
    if (!careerToToggle || pending) return
    const { action } = careerToToggle
    setPending(true)
    try {
      if (action === 'activate') {
        await api.activateCareer(career.id)
        toast.success('Carrera habilitada', { description: `La carrera "${career.name}" fue habilitada.` })
      } else {
        await api.deactivateCareer(career.id)
        toast.info('Carrera desactivada', { description: `Se desactivó la carrera "${career.name}".` })
      }
      setCareerToToggle(null)
      onChange({ ...career, status: action === 'activate' })
    } catch (error: unknown) {
      setCareerToToggle(null)
      // Fuera de un formulario, el error va en un toast.
      const friendly = getFriendlyError(error)
      if (!isFormDialogOpen()) toast.error(friendly.title, { description: asSentence(friendly.description) })
    } finally {
      setPending(false)
    }
  }

  const context = [career.faculty_name, career.modality_name].filter(Boolean).join(' · ')

  return (
    <section className="flex flex-col gap-6" data-tour-view="detail">
      <div>
        <Button type="button" variant="tertiary" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" />
          Volver a carreras
        </Button>
      </div>

      <AdminSectionHeader
        title={career.name}
        description={context || undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge active={career.status} activeLabel="Activa" inactiveLabel="Inactiva" />
            <Button
              type="button"
              variant="tertiary" size="icon" aria-label="Editar carrera"
              disabled={pending}
              onClick={() => {
                setCareerFormKey((key) => key + 1)
                setIsCareerModalOpen(true)
              }}
            >
              <PencilIcon />
            </Button>
            {career.status ? (
              <Button type="button" variant="tertiary" size="icon" tone="destructive" aria-label="Desactivar carrera" disabled={pending} onClick={() => setCareerToToggle({ career, action: 'deactivate' })}>
                <PowerOffIcon />
              </Button>
            ) : (
              <Button type="button" variant="tertiary" size="icon" aria-label="Habilitar carrera" disabled={pending} onClick={() => setCareerToToggle({ career, action: 'activate' })}>
                <PowerIcon />
              </Button>
            )}
          </div>
        }
      />

      <Tabs defaultValue="cycles">
        <TabsList aria-label="Secciones de la carrera">
          <TabsTrigger value="cycles">Ciclos</TabsTrigger>
          <TabsTrigger value="data">Datos</TabsTrigger>
        </TabsList>
        <TabsContent value="cycles">
          <CareerCyclesSection key={cyclesVersion} career={career} onCyclesChanged={() => refreshCareer(career)} />
        </TabsContent>
        <TabsContent value="data">
          <dl className="grid max-w-2xl gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <CareerDatum label="Código de carrera" value={career.code ?? 'Sin código'} />
            <CareerDatum label="Facultad" value={career.faculty_name ?? `Facultad #${career.faculty_id}`} />
            <CareerDatum label="Modalidad" value={career.modality_name ?? '—'} />
            <CareerDatum label="Cantidad de ciclos" value={career.cycle_levels === 0 ? 'Sin ciclos' : `${career.cycle_levels} ${career.cycle_levels === 1 ? 'ciclo' : 'ciclos'}`} />
            <CareerDatum label="Ciclos activos" value={cyclesSummary(career)} />
          </dl>
        </TabsContent>
      </Tabs>

      <CareerFormDialog
        key={careerFormKey}
        open={isCareerModalOpen}
        career={career}
        siblings={siblings}
        onClose={() => setIsCareerModalOpen(false)}
        onSaved={async (saved) => {
          setCyclesVersion((version) => version + 1)
          // Mientras se vuelve a leer, se muestra lo guardado sin perder los datos que la respuesta no trae.
          const merged: Career = saved
            ? { ...career, faculty_id: saved.faculty_id, name: saved.name, code: saved.code, modality_id: saved.modality_id, status: saved.status }
            : career
          await refreshCareer(merged)
        }}
      />

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
        pending={pending}
      />
    </section>
  )
}

function CareerDatum({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

type CyclePendingAction = 'cycle' | 'toggle-cycle' | null
type CycleToggleTarget = { cycle: Cycle; action: 'activate' | 'deactivate' }

/** Ciclos de la carrera (pestaña «Ciclos»): cada fila abre un modal corto para editarlo. */
function CareerCyclesSection({ career, onCyclesChanged }: Readonly<{ career: Career; onCyclesChanged: () => Promise<unknown> | void }>) {
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
  const { touched: cycleTouched, touch: touchCycle, reset: resetCycleTouched } = useTouchedFields<keyof CycleFormErrors>()
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
    resetCycleTouched()
    setFormError(null)
    setIsCycleModalOpen(true)
  }

  function startCycleEdit(cycle: Cycle) {
    setEditingCycle(cycle)
    setCycleName(cycle.name)
    setCycleNumber(String(cycle.number))
    setInitialCycleName(cycle.name)
    setCycleErrors({})
    resetCycleTouched()
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

    // Los errores de validación van solo bajo el campo, sin otro recuadro.
    const errors = validateCycleForm(cycleName)
    setCycleErrors(errors)
    if (Object.keys(errors).length > 0) return

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
      await Promise.all([reload(), onCyclesChanged()])
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
        toast.info('Ciclo desactivado', { description: `Se desactivó el ciclo "${cycle.name}".` })
      }
      setCycleToToggle(null)
      closeCycleModal()
      await Promise.all([reload(), onCyclesChanged()])
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
  const liveCycleErrors = validateCycleForm(cycleName)
  const cycleBlockReason = Object.values(liveCycleErrors)[0] ?? null
  const hasFilters = searchInput.trim() !== '' || statusFilter !== ''

  // Primera carga de la pestaña: su contenido en esqueleto; después, solo las filas.
  if (isInitialLoading) {
    return (
      <>
        <span role="status" aria-label="Cargando ciclos" className="sr-only">Cargando ciclos</span>
        <CyclesBodySkeleton />
      </>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Define los ciclos o niveles de la carrera.</p>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
          <RefreshButton onClick={() => void reload()} loading={isFetching} />
          <BulkImportButton type="cycles" title="Carga masiva de ciclos" onFinished={reload} className="flex-1 sm:flex-none" />
          <Button onClick={openCreateCycleModal} className="w-full sm:w-auto" data-tour="page-create">
            <PlusIcon data-icon="inline-start" />
            Nuevo ciclo
          </Button>
        </div>
      </div>

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
            { label: 'Ciclo', render: (cycle) => cycle.name },
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
        title={editingCycle ? 'Editar ciclo' : 'Registrar ciclo'}
        description={editingCycle ? undefined : `Se agregará a la carrera "${career.name}".`}
        maxWidth="max-w-md"
        pending={formPending}
        error={formError?.description ?? null}
        errorModal={formError}
        dirty={isCycleFormDirty}
        blockReason={cycleBlockReason}
        submitLabel={editingCycle ? 'Guardar cambios' : 'Registrar ciclo'}
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
        <FormField id="cycle-name" label="Nombre del ciclo" required counter={{ current: cycleName.length, max: 100 }} error={visibleFieldError('name', cycleErrors, liveCycleErrors, cycleTouched)}>
          <Input
            id="cycle-name"
            value={cycleName}
            onChange={(e) => {
              setCycleName(sanitizeOfficialName(e.target.value, 100))
              setCycleErrors((current) => ({ ...current, name: undefined }))
            }}
            onBlur={() => touchCycle('name')}
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
    </div>
  )
}
