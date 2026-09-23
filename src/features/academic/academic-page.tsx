import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  ArrowLeftIcon,
  BookOpenIcon,
  Edit2Icon,
  Layers3Icon,
  PlusIcon,
  PowerIcon,
  PowerOffIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldAlertIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { Field, FieldCounter, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { ApiError, api, type Career, type Cycle, type Faculty, type Modality } from '@/lib/api'
import { sanitizeDigits, sanitizeLetters } from '@/lib/sanitize'
import { cn } from '@/lib/utils'

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.firstValidationMessage ?? error.message
  return 'No fue posible conectar con el servidor.'
}

type CareerFormErrors = { facultyId?: string; name?: string }

function validateCareerForm(facultyId: string, name: string): CareerFormErrors {
  const errors: CareerFormErrors = {}
  if (!facultyId) errors.facultyId = 'Selecciona una facultad.'

  const trimmedName = name.trim()
  if (!trimmedName) errors.name = 'El nombre de la carrera es obligatorio.'
  else if (trimmedName.length > 150) errors.name = 'El nombre no puede superar 150 caracteres.'

  return errors
}

type CycleFormErrors = { name?: string; number?: string }

function validateCycleForm(name: string, number: string): CycleFormErrors {
  const errors: CycleFormErrors = {}
  const trimmedName = name.trim()
  if (!trimmedName) errors.name = 'El nombre del ciclo es obligatorio.'
  else if (trimmedName.length > 100) errors.name = 'El nombre no puede superar 100 caracteres.'

  if (!number) errors.number = 'El número del ciclo es obligatorio.'
  else if (Number(number) < 1) errors.number = 'El número debe ser mayor o igual a 1.'

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
  const fetchCareers = useCallback((page: number, search: string) => api.listCareers({ page, search }), [])
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
  } = usePaginatedCatalog(fetchCareers)

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

  const [formError, setFormError] = useState<string | null>(null)
  const [careerErrors, setCareerErrors] = useState<CareerFormErrors>({})
  const [pending, setPending] = useState<CareerPendingAction>(null)

  const [editingCareer, setEditingCareer] = useState<Career | null>(null)
  const [careerFacultyId, setCareerFacultyId] = useState('')
  const [careerName, setCareerName] = useState('')
  const [careerModalityId, setCareerModalityId] = useState('')
  const [initialCareerFacultyId, setInitialCareerFacultyId] = useState('')
  const [initialCareerName, setInitialCareerName] = useState('')
  const [initialCareerModalityId, setInitialCareerModalityId] = useState('')

  const [isAddingModality, setIsAddingModality] = useState(false)
  const [newModalityName, setNewModalityName] = useState('')
  const [modalityNameError, setModalityNameError] = useState<string | null>(null)
  const [creatingModality, setCreatingModality] = useState(false)

  const [isCareerModalOpen, setIsCareerModalOpen] = useState(false)
  const [careerToToggle, setCareerToToggle] = useState<CareerToggleTarget | null>(null)

  async function handleRefresh() {
    const ok = await reload()
    if (ok) toast.success('Carreras actualizadas', { description: 'El listado se actualizó correctamente.' })
  }

  function openCreateCareerModal() {
    setEditingCareer(null)
    setCareerFacultyId('')
    setCareerName('')
    setCareerModalityId('')
    setInitialCareerFacultyId('')
    setInitialCareerName('')
    setInitialCareerModalityId('')
    setIsAddingModality(false)
    setNewModalityName('')
    setModalityNameError(null)
    setFormError(null)
    setCareerErrors({})
    void api.listActiveFaculties().then(setActiveFaculties)
    void refreshModalities()
    setIsCareerModalOpen(true)
  }

  function startCareerEdit(career: Career) {
    setEditingCareer(career)
    setCareerFacultyId(String(career.faculty_id))
    setCareerName(career.name)
    setCareerModalityId(career.modality_id ? String(career.modality_id) : '')
    setInitialCareerFacultyId(String(career.faculty_id))
    setInitialCareerName(career.name)
    setInitialCareerModalityId(career.modality_id ? String(career.modality_id) : '')
    setIsAddingModality(false)
    setNewModalityName('')
    setModalityNameError(null)
    setFormError(null)
    setCareerErrors({})
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
    setIsAddingModality(false)
    setNewModalityName('')
    setModalityNameError(null)
    setFormError(null)
    setCareerErrors({})
  }

  async function handleCreateModality() {
    const trimmedName = newModalityName.trim()
    if (!trimmedName) {
      setModalityNameError('El nombre de la modalidad es obligatorio.')
      return
    }
    if (creatingModality) return

    setModalityNameError(null)
    setCreatingModality(true)
    try {
      const created = await api.createModality({ name: trimmedName })
      await refreshModalities()
      setCareerModalityId(String(created.id))
      setIsAddingModality(false)
      setNewModalityName('')
      toast.success('Modalidad creada', { description: `Se agregó "${created.name}" al catálogo de modalidades.` })
    } catch (error: unknown) {
      setModalityNameError(getErrorMessage(error))
    } finally {
      setCreatingModality(false)
    }
  }

  async function submitCareer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending !== null) return

    const errors = validateCareerForm(careerFacultyId, careerName)
    setCareerErrors(errors)
    if (Object.keys(errors).length > 0) {
      setFormError('Revisa los campos marcados antes de guardar.')
      return
    }

    setFormError(null)
    setPending('career')
    try {
      const input = {
        faculty_id: Number(careerFacultyId),
        name: careerName.trim(),
        modality_id: careerModalityId ? Number(careerModalityId) : null,
      }
      if (editingCareer) {
        await api.updateCareer(editingCareer.id, input)
        toast.success('Carrera actualizada', { description: `La carrera "${input.name}" fue modificada.` })
      } else {
        await api.createCareer(input)
        toast.success('Carrera creada', { description: `La carrera "${input.name}" ha sido agregada.` })
      }
      closeCareerModal()
      await reload()
    } catch (error: unknown) {
      setFormError(getErrorMessage(error))
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
      await reload()
    } catch (error: unknown) {
      setCareerToToggle(null)
      toast.error('No se pudo completar la acción', { description: getErrorMessage(error) })
    } finally {
      setPending(null)
    }
  }

  const formPending = pending === 'career'
  const isCareerFormDirty =
    careerFacultyId !== initialCareerFacultyId
    || careerName !== initialCareerName
    || careerModalityId !== initialCareerModalityId

  return (
    <section className="flex flex-col gap-8">
      <AdminSectionHeader
        title="Oferta de Carreras"
        description="Gestiona las carreras profesionales ofertadas por cada facultad. Entra a una carrera para administrar sus ciclos."
        eyebrow="Estructura Académica"
        actions={
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => void handleRefresh()} disabled={isFetching}>
              {isFetching ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
              Actualizar
            </Button>
            <Button onClick={openCreateCareerModal} className="bg-brand-red hover:bg-brand-red/90 text-white font-semibold">
              <PlusIcon data-icon="inline-start" />
              Nueva carrera
            </Button>
          </div>
        }
      />

      {pageError && (
        <Alert variant="destructive">
          <ShieldAlertIcon />
          <AlertTitle>No se pudo cargar el catálogo</AlertTitle>
          <AlertDescription>{pageError}</AlertDescription>
        </Alert>
      )}

      {/* Tabla de Carreras */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="relative flex flex-1 items-center max-w-md">
            <SearchIcon className="absolute left-3.5 size-4 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar carrera por nombre o facultad…"
              className="pl-10"
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Mostrando {careers.length} de {meta?.total ?? 0} carreras
        </p>

        <div
          className={cn(
            'overflow-x-auto rounded-xl border border-slate-100 transition-opacity dark:border-slate-800',
            isFetching && !isInitialLoading && 'opacity-60',
          )}
        >
          <Table>
            <TableHeader className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-5 py-3.5 whitespace-normal">Carrera Universitaria</TableHead>
                <TableHead className="px-5 py-3.5 whitespace-normal">Facultad Perteneciente</TableHead>
                <TableHead className="px-5 py-3.5 whitespace-normal">Modalidad</TableHead>
                <TableHead className="px-5 py-3.5">Estado</TableHead>
                <TableHead className="px-5 py-3.5 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isInitialLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell className="px-5 py-4"><div className="h-5 w-48 rounded-md bg-slate-200 dark:bg-slate-800" /></TableCell>
                    <TableCell className="px-5 py-4"><div className="h-4 w-36 rounded-md bg-slate-200 dark:bg-slate-800" /></TableCell>
                    <TableCell className="px-5 py-4"><div className="h-4 w-24 rounded-md bg-slate-200 dark:bg-slate-800" /></TableCell>
                    <TableCell className="px-5 py-4"><div className="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-800" /></TableCell>
                    <TableCell className="px-5 py-4 text-right"><div className="ml-auto h-8 w-16 rounded-md bg-slate-200 dark:bg-slate-800" /></TableCell>
                  </TableRow>
                ))
              ) : careers.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="py-12 text-center text-slate-500 dark:text-slate-400 whitespace-normal">
                    <div className="flex flex-col items-center gap-2">
                      <BookOpenIcon className="size-8 text-slate-300 dark:text-slate-600" />
                      <span className="font-medium">
                        {searchInput ? 'No se encontraron carreras con el término buscado.' : 'Todavía no hay carreras registradas.'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                careers.map((career) => (
                  <TableRow key={career.id}>
                    <TableCell className="px-5 py-4 font-semibold text-slate-900 dark:text-white whitespace-normal">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-blue text-white shadow-2xs">
                          <BookOpenIcon className="size-4" />
                        </div>
                        <div className="flex flex-col">
                          <span>{career.name}</span>
                          <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                            {career.cycles_count === 0
                              ? 'Sin ciclos'
                              : `${career.active_cycles_count} de ${career.cycles_count} ciclo${career.cycles_count === 1 ? '' : 's'} activo${career.active_cycles_count === 1 ? '' : 's'}`}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-normal">
                      {career.faculty_name ?? `Facultad #${career.faculty_id}`}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-normal">
                      {career.modality_name ?? 'Sin modalidad'}
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                          career.status
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
                        )}
                      >
                        <span className={cn('size-1.5 rounded-full', career.status ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400')} />
                        {career.status ? 'Activa' : 'Inactiva'}
                      </span>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectCareer(career)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                          title="Ver ciclos de esta carrera"
                        >
                          <Layers3Icon className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => startCareerEdit(career)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                          title="Editar carrera"
                        >
                          <Edit2Icon className="size-4" />
                        </button>
                        {career.status ? (
                          <button
                            type="button"
                            onClick={() => setCareerToToggle({ career, action: 'deactivate' })}
                            className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                            title="Desactivar carrera"
                          >
                            <PowerOffIcon className="size-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCareerToToggle({ career, action: 'activate' })}
                            className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"
                            title="Habilitar carrera"
                          >
                            <PowerIcon className="size-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <CatalogPagination label="carreras" page={page} lastPage={meta?.last_page ?? 1} disabled={isFetching} onChange={setPage} />
      </div>

      {/* Modal Dialog para Registrar / Editar Carrera */}
      <Dialog
        open={isCareerModalOpen}
        onClose={closeCareerModal}
        title={editingCareer ? 'Editar Carrera' : 'Registrar Carrera'}
        description={editingCareer ? 'Modifica los datos de la carrera seleccionada.' : 'Asigna la nueva carrera a una facultad activa.'}
        maxWidth="max-w-md"
        confirmClose={isCareerFormDirty}
      >
        <form onSubmit={submitCareer}>
          <FieldGroup className="gap-5">
            <Field data-invalid={Boolean(careerErrors.facultyId)}>
              <FieldLabel htmlFor="career-faculty">Facultad Perteneciente</FieldLabel>
              <NativeSelect
                id="career-faculty"
                value={careerFacultyId}
                onChange={(e) => {
                  setCareerFacultyId(e.target.value)
                  setCareerErrors((current) => ({ ...current, facultyId: undefined }))
                }}
                disabled={formPending}
                required
              >
                <option value="">Selecciona una facultad</option>
                {activeFaculties.map((faculty) => (
                  <option key={faculty.id} value={faculty.id}>
                    {faculty.name}
                  </option>
                ))}
              </NativeSelect>
              <FieldError>{careerErrors.facultyId}</FieldError>
            </Field>

            <Field data-invalid={Boolean(modalityNameError)}>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="career-modality">Modalidad</FieldLabel>
                {isAddingModality && <FieldCounter current={newModalityName.length} max={100} />}
              </div>
              {isAddingModality ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={newModalityName}
                    onChange={(e) => {
                      setNewModalityName(sanitizeLetters(e.target.value, 100))
                      setModalityNameError(null)
                    }}
                    placeholder="Ej. Semipresencial"
                    maxLength={100}
                    disabled={creatingModality}
                    autoFocus
                  />
                  <Button
                    type="button"
                    onClick={() => void handleCreateModality()}
                    disabled={creatingModality || !newModalityName.trim()}
                    className="bg-brand-red hover:bg-brand-red/90 text-white font-semibold shrink-0"
                  >
                    {creatingModality && <Spinner data-icon="inline-start" />}
                    Guardar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddingModality(false)
                      setNewModalityName('')
                      setModalityNameError(null)
                    }}
                    disabled={creatingModality}
                    className="shrink-0"
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <NativeSelect
                    id="career-modality"
                    value={careerModalityId}
                    onChange={(e) => setCareerModalityId(e.target.value)}
                    disabled={formPending}
                  >
                    <option value="">Sin modalidad</option>
                    {modalities.map((modality) => (
                      <option key={modality.id} value={modality.id}>
                        {modality.name}
                      </option>
                    ))}
                  </NativeSelect>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setIsAddingModality(true)}
                    disabled={formPending}
                    title="Crear nueva modalidad"
                    className="shrink-0"
                  >
                    <PlusIcon />
                  </Button>
                </div>
              )}
              {modalityNameError ? (
                <FieldError>{modalityNameError}</FieldError>
              ) : (
                !isAddingModality && <FieldDescription className="text-xs">Si no existe, créala con el botón "+".</FieldDescription>
              )}
            </Field>

            <Field data-invalid={Boolean(careerErrors.name)}>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="career-name">Nombre de la carrera</FieldLabel>
                <FieldCounter current={careerName.length} max={150} />
              </div>
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
              <FieldError>{careerErrors.name}</FieldError>
            </Field>

            <FieldError>{formError}</FieldError>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <DialogCancelButton onClick={closeCareerModal} disabled={formPending}>
                Cancelar
              </DialogCancelButton>
              <Button type="submit" disabled={formPending} className="bg-brand-red hover:bg-brand-red/90 text-white font-semibold">
                {pending === 'career' && <Spinner data-icon="inline-start" />}
                {editingCareer ? 'Guardar Cambios' : 'Registrar Carrera'}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Dialog>

      {/* ConfirmModal para Habilitar / Desactivar Carrera */}
      <ConfirmModal
        open={Boolean(careerToToggle)}
        onClose={() => setCareerToToggle(null)}
        onConfirm={() => void handleConfirmToggleCareer()}
        title={careerToToggle?.action === 'activate' ? '¿Habilitar carrera?' : '¿Desactivar carrera?'}
        description={
          careerToToggle?.action === 'activate'
            ? `¿Deseas habilitar la carrera "${careerToToggle?.career.name}"? Volverá a estar disponible en el sistema.`
            : `¿Estás seguro de desactivar la carrera "${careerToToggle?.career.name}"?`
        }
        confirmLabel={careerToToggle?.action === 'activate' ? 'Habilitar carrera' : 'Desactivar carrera'}
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
  const fetchCycles = useCallback(
    (page: number, search: string) => api.listCycles({ page, search, careerId: career.id }),
    [career.id],
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
  } = usePaginatedCatalog(fetchCycles)

  const [formError, setFormError] = useState<string | null>(null)
  const [cycleErrors, setCycleErrors] = useState<CycleFormErrors>({})
  const [pending, setPending] = useState<CyclePendingAction>(null)

  const [editingCycle, setEditingCycle] = useState<Cycle | null>(null)
  const [cycleName, setCycleName] = useState('')
  const [cycleNumber, setCycleNumber] = useState('')
  const [initialCycleName, setInitialCycleName] = useState('')
  const [initialCycleNumber, setInitialCycleNumber] = useState('')

  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false)
  const [cycleToToggle, setCycleToToggle] = useState<CycleToggleTarget | null>(null)

  async function handleRefresh() {
    const ok = await reload()
    if (ok) toast.success('Ciclos actualizados', { description: 'El listado se actualizó correctamente.' })
  }

  function openCreateCycleModal() {
    setEditingCycle(null)
    setCycleName('')
    setCycleNumber('')
    setInitialCycleName('')
    setInitialCycleNumber('')
    setFormError(null)
    setCycleErrors({})
    setIsCycleModalOpen(true)
  }

  function startCycleEdit(cycle: Cycle) {
    setEditingCycle(cycle)
    setCycleName(cycle.name)
    setCycleNumber(String(cycle.number))
    setInitialCycleName(cycle.name)
    setInitialCycleNumber(String(cycle.number))
    setFormError(null)
    setCycleErrors({})
    setIsCycleModalOpen(true)
  }

  function closeCycleModal() {
    setIsCycleModalOpen(false)
    setEditingCycle(null)
    setCycleName('')
    setCycleNumber('')
    setFormError(null)
    setCycleErrors({})
  }

  async function submitCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending !== null) return

    const errors = validateCycleForm(cycleName, cycleNumber)
    setCycleErrors(errors)
    if (Object.keys(errors).length > 0) {
      setFormError('Revisa los campos marcados antes de guardar.')
      return
    }

    setFormError(null)
    setPending('cycle')
    try {
      const input = { career_id: career.id, name: cycleName.trim(), number: Number(cycleNumber) }
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
      setFormError(getErrorMessage(error))
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
      await reload()
    } catch (error: unknown) {
      setCycleToToggle(null)
      toast.error('No se pudo completar la acción', { description: getErrorMessage(error) })
    } finally {
      setPending(null)
    }
  }

  const formPending = pending === 'cycle'
  const isCycleFormDirty = cycleName !== initialCycleName || cycleNumber !== initialCycleNumber

  return (
    <section className="flex flex-col gap-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-red dark:text-slate-400"
      >
        <ArrowLeftIcon className="size-4" />
        Volver a Carreras
      </button>

      <AdminSectionHeader
        title={`Ciclos de ${career.name}`}
        description="Define la estructura de ciclos y niveles dentro de esta carrera."
        eyebrow="Estructura Académica"
        actions={
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => void handleRefresh()} disabled={isFetching}>
              {isFetching ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
              Actualizar
            </Button>
            <Button onClick={openCreateCycleModal} className="bg-brand-red hover:bg-brand-red/90 text-white font-semibold">
              <PlusIcon data-icon="inline-start" />
              Nuevo ciclo
            </Button>
          </div>
        }
      />

      {pageError && (
        <Alert variant="destructive">
          <ShieldAlertIcon />
          <AlertTitle>No se pudo cargar el catálogo</AlertTitle>
          <AlertDescription>{pageError}</AlertDescription>
        </Alert>
      )}

      {/* Tabla de Ciclos */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="relative flex flex-1 items-center max-w-md">
            <SearchIcon className="absolute left-3.5 size-4 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar ciclo por nombre…"
              className="pl-10"
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Mostrando {cycles.length} de {meta?.total ?? 0} ciclos
        </p>

        <div
          className={cn(
            'overflow-x-auto rounded-xl border border-slate-100 transition-opacity dark:border-slate-800',
            isFetching && !isInitialLoading && 'opacity-60',
          )}
        >
          <Table>
            <TableHeader className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-5 py-3.5 whitespace-normal">Ciclo Académico</TableHead>
                <TableHead className="px-5 py-3.5">Orden / Nivel</TableHead>
                <TableHead className="px-5 py-3.5">Estado</TableHead>
                <TableHead className="px-5 py-3.5 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isInitialLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell className="px-5 py-4"><div className="h-5 w-40 rounded-md bg-slate-200 dark:bg-slate-800" /></TableCell>
                    <TableCell className="px-5 py-4"><div className="h-4 w-16 rounded-md bg-slate-200 dark:bg-slate-800" /></TableCell>
                    <TableCell className="px-5 py-4"><div className="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-800" /></TableCell>
                    <TableCell className="px-5 py-4 text-right"><div className="ml-auto h-8 w-16 rounded-md bg-slate-200 dark:bg-slate-800" /></TableCell>
                  </TableRow>
                ))
              ) : cycles.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="py-12 text-center text-slate-500 dark:text-slate-400 whitespace-normal">
                    <div className="flex flex-col items-center gap-2">
                      <Layers3Icon className="size-8 text-slate-300 dark:text-slate-600" />
                      <span className="font-medium">
                        {searchInput ? 'No se encontraron ciclos con el término buscado.' : 'Todavía no hay ciclos registrados para esta carrera.'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                cycles.map((cycle) => (
                  <TableRow key={cycle.id}>
                    <TableCell className="px-5 py-4 font-semibold text-slate-900 dark:text-white whitespace-normal">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-blue text-white shadow-2xs">
                          <Layers3Icon className="size-4" />
                        </div>
                        <span>{cycle.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-xs font-bold text-slate-700 dark:text-slate-200">
                      Nivel {cycle.number}
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                          cycle.status
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
                        )}
                      >
                        <span className={cn('size-1.5 rounded-full', cycle.status ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400')} />
                        {cycle.status ? 'Activo' : 'Inactivo'}
                      </span>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => startCycleEdit(cycle)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                          title="Editar ciclo"
                        >
                          <Edit2Icon className="size-4" />
                        </button>
                        {cycle.status ? (
                          <button
                            type="button"
                            onClick={() => setCycleToToggle({ cycle, action: 'deactivate' })}
                            className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                            title="Desactivar ciclo"
                          >
                            <PowerOffIcon className="size-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCycleToToggle({ cycle, action: 'activate' })}
                            className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"
                            title="Habilitar ciclo"
                          >
                            <PowerIcon className="size-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <CatalogPagination label="ciclos" page={page} lastPage={meta?.last_page ?? 1} disabled={isFetching} onChange={setPage} />
      </div>

      {/* Modal Dialog para Registrar / Editar Ciclo */}
      <Dialog
        open={isCycleModalOpen}
        onClose={closeCycleModal}
        title={editingCycle ? 'Editar Ciclo Académico' : 'Registrar Ciclo Académico'}
        description={editingCycle ? 'Actualiza los datos del ciclo académico.' : `Se asignará a la carrera "${career.name}".`}
        maxWidth="max-w-md"
        confirmClose={isCycleFormDirty}
      >
        <form onSubmit={submitCycle}>
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel>Carrera Profesional</FieldLabel>
              <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                {career.name}
              </div>
            </Field>

            <div className="grid gap-5 sm:grid-cols-[1fr_7rem]">
              <Field data-invalid={Boolean(cycleErrors.name)}>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="cycle-name">Nombre del ciclo</FieldLabel>
                  <FieldCounter current={cycleName.length} max={100} />
                </div>
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
                <FieldError>{cycleErrors.name}</FieldError>
              </Field>
              <Field data-invalid={Boolean(cycleErrors.number)}>
                <FieldLabel htmlFor="cycle-number">Número</FieldLabel>
                <Input
                  id="cycle-number"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={cycleNumber}
                  onChange={(e) => {
                    setCycleNumber(sanitizeDigits(e.target.value, 4))
                    setCycleErrors((current) => ({ ...current, number: undefined }))
                  }}
                  disabled={formPending}
                  required
                />
                <FieldError>{cycleErrors.number}</FieldError>
              </Field>
            </div>

            <FieldError>{formError}</FieldError>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <DialogCancelButton onClick={closeCycleModal} disabled={formPending}>
                Cancelar
              </DialogCancelButton>
              <Button type="submit" disabled={formPending} className="bg-brand-red hover:bg-brand-red/90 text-white font-semibold">
                {pending === 'cycle' && <Spinner data-icon="inline-start" />}
                {editingCycle ? 'Guardar Cambios' : 'Registrar Ciclo'}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Dialog>

      {/* ConfirmModal para Habilitar / Desactivar Ciclo */}
      <ConfirmModal
        open={Boolean(cycleToToggle)}
        onClose={() => setCycleToToggle(null)}
        onConfirm={() => void handleConfirmToggleCycle()}
        title={cycleToToggle?.action === 'activate' ? '¿Habilitar ciclo?' : '¿Desactivar ciclo?'}
        description={
          cycleToToggle?.action === 'activate'
            ? `¿Deseas habilitar el ciclo "${cycleToToggle?.cycle.name}"? Volverá a estar disponible en el sistema.`
            : `¿Estás seguro de desactivar el ciclo "${cycleToToggle?.cycle.name}"?`
        }
        confirmLabel={cycleToToggle?.action === 'activate' ? 'Habilitar ciclo' : 'Desactivar ciclo'}
        cancelLabel="Cancelar"
        variant={cycleToToggle?.action === 'activate' ? 'default' : 'destructive'}
        pending={pending === 'toggle-cycle'}
      />
    </section>
  )
}
