import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowLeftIcon, BookOpenIcon, PencilIcon, PlusIcon, PowerIcon, PowerOffIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/lib/toast'

import { BulkImportButton } from '@/components/bulk-import-dialog'
import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { AdminDetailHeaderSkeleton, AdminListSkeleton } from '@/components/admin/admin-skeletons'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Button } from '@/components/ui/button'
import { RefreshButton } from '@/components/ui/refresh-button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { getFriendlyError, type FriendlyErrorInfo } from '@/components/ui/error-modal'
import { ErrorNotice } from '@/components/ui/error-notice'
import { FormDialog, isFormDialogOpen } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDetailParam } from '@/hooks/use-detail-param'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { api, type Career, type Faculty } from '@/lib/api'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { HeadedTableSkeleton } from '@/features/tutoring/tutoring-skeletons'
import { asSentence, sanitizeOfficialName, useTouchedFields } from './form-helpers'

type ToggleTarget = { faculty: Faculty; action: 'activate' | 'deactivate' }

function validateFacultyName(value: string): string | undefined {
  const normalized = value.trim()
  if (!normalized) return 'El nombre de la facultad es obligatorio.'
  if (normalized.length > 150) return 'El nombre no puede superar 150 caracteres.'
  return undefined
}

function careersPath(faculty: Faculty): string {
  return `/panel/careers?${new URLSearchParams({ faculty: String(faculty.id), facultyName: faculty.name })}`
}

/** Ruta de la pantalla de una carrera; "Volver" en esa pantalla regresa a la facultad. */
function careerDetailLocation(career: Career) {
  return {
    pathname: '/panel/careers',
    search: `?${new URLSearchParams({ carrera: String(career.id) })}`,
    state: { detailParam: 'carrera', record: career },
  }
}

/** Busca una facultad por id (no hay ruta de detalle): primero entre las activas, luego en las inactivas. */
async function findFaculty(id: number): Promise<Faculty | null> {
  const active = (await api.listActiveFaculties()).find((faculty) => faculty.id === id)
  if (active) return active
  for (let page = 1, lastPage = 1; page <= lastPage; page += 1) {
    const response = await api.listFaculties({ page, status: 'inactive' })
    const found = response.data.find((faculty) => faculty.id === id)
    if (found) return found
    lastPage = response.meta?.last_page ?? 1
  }
  return null
}

function careersSummary(faculty: Faculty): string {
  return faculty.careers_count === 0
    ? 'Sin carreras'
    : `${faculty.active_careers_count} de ${faculty.careers_count} carrera${faculty.careers_count === 1 ? '' : 's'} activa${faculty.active_careers_count === 1 ? '' : 's'}`
}

type FacultyLookup = { id: number; faculty: Faculty | null; error: string | null }

/**
 * Facultades: la lista y, al pulsar una fila, la pantalla de la facultad con sus carreras y
 * sus acciones (editar, habilitar o desactivar) arriba. La facultad abierta vive en la URL
 * (`?facultad=<id>`): "Atrás" vuelve a la lista y al recargar se vuelve a cargar.
 */
export function FacultiesPage() {
  const detail = useDetailParam('facultad')
  const [opened, setOpened] = useState<Faculty | null>(null)
  const [lookup, setLookup] = useState<FacultyLookup | null>(null)
  const [lookupVersion, setLookupVersion] = useState(0)
  const detailId = detail.id
  const openedMatches = opened !== null && opened.id === detailId

  useEffect(() => {
    if (detailId === null || openedMatches) return
    let cancelled = false
    findFaculty(detailId)
      .then((faculty) => { if (!cancelled) setLookup({ id: detailId, faculty, error: null }) })
      .catch((error: unknown) => { if (!cancelled) setLookup({ id: detailId, faculty: null, error: getFriendlyError(error).description }) })
    return () => { cancelled = true }
  }, [detailId, openedMatches, lookupVersion])

  if (detailId === null) {
    return <FacultiesList onSelectFaculty={(faculty) => { setOpened(faculty); detail.open(faculty.id) }} />
  }

  const faculty = openedMatches ? opened : lookup?.id === detailId ? lookup.faculty : undefined
  if (faculty) {
    return <FacultyDetail faculty={faculty} onChange={setOpened} onBack={detail.close} />
  }
  if (faculty === null && lookup) {
    return (
      <section className="flex flex-col items-start gap-4">
        {lookup.error ? (
          <ErrorNotice title="No se pudo cargar la facultad" message={lookup.error} retry={() => { setLookup(null); setLookupVersion((version) => version + 1) }} />
        ) : (
          <p className="text-sm text-muted-foreground">No encontramos esta facultad.</p>
        )}
        <Button type="button" variant="secondary" onClick={detail.close}>
          <ArrowLeftIcon data-icon="inline-start" />
          Volver a facultades
        </Button>
      </section>
    )
  }
  return <FacultyDetailSkeleton />
}

const FACULTY_CAREER_HEADERS = ['Carrera', 'Modalidad', 'Ciclos', 'Estado'] as const

/**
 * Pantalla de la facultad mientras carga (la facultad o la primera página de sus carreras):
 * volver, encabezado con estado y acciones, y la sección de carreras con su tabla.
 */
function FacultyDetailSkeleton() {
  return (
    <section className="flex flex-col gap-6">
      <span role="status" aria-label="Cargando facultad" className="sr-only">Cargando facultad</span>
      <AdminDetailHeaderSkeleton />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-hidden="true">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-9 w-48" />
        </div>
        <HeadedTableSkeleton headers={FACULTY_CAREER_HEADERS} rows={3} />
      </div>
    </section>
  )
}

/** Modal para registrar una facultad o cambiar su nombre. Quien lo abre le cambia la `key` en cada apertura. */
function FacultyFormDialog({ open, faculty, onClose, onSaved }: Readonly<{
  open: boolean
  faculty: Faculty | null
  onClose: () => void
  onSaved: (name: string) => Promise<unknown> | void
}>) {
  const initialName = faculty?.name ?? ''
  const [name, setName] = useState(initialName)
  const [nameError, setNameError] = useState<string | undefined>()
  const { touched, touch } = useTouchedFields<'name'>()
  // Error del servidor (o de validación al enviar): se muestra una vez, en línea, dentro del modal.
  const [formError, setFormError] = useState<FriendlyErrorInfo | null>(null)
  const [pending, setPending] = useState(false)

  function updateName(value: string) {
    setName(sanitizeOfficialName(value, 150))
    setNameError(undefined)
    setFormError(null)
  }

  async function submitFaculty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const normalizedName = name.trim()
    const error = validateFacultyName(name)
    // El error de validación va solo bajo el campo, sin otro recuadro.
    setNameError(error)
    if (error) return

    setPending(true)
    setFormError(null)
    try {
      if (faculty) {
        await api.updateFaculty(faculty.id, { name: normalizedName })
        toast.success('Facultad actualizada', { description: `La facultad "${normalizedName}" fue modificada.` })
      } else {
        await api.createFaculty({ name: normalizedName })
        toast.success('Facultad creada', { description: `La facultad "${normalizedName}" ha sido agregada.` })
      }
      onClose()
      await onSaved(normalizedName)
    } catch (error: unknown) {
      const friendly = getFriendlyError(error)
      setFormError(friendly)
      if (friendly.field === 'name') {
        setNameError(friendly.description)
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={submitFaculty}
      title={faculty ? 'Editar facultad' : 'Registrar facultad'}
      maxWidth="max-w-md"
      pending={pending}
      error={formError?.description ?? null}
      errorModal={formError}
      dirty={name.trim() !== initialName.trim()}
      blockReason={validateFacultyName(name) ?? null}
      submitLabel={faculty ? 'Guardar cambios' : 'Registrar facultad'}
    >
      <FormField id="faculty-name" label="Nombre de la facultad" required counter={{ current: name.length, max: 150 }} error={nameError ?? (touched.has('name') ? validateFacultyName(name) : undefined)}>
        <Input
          id="faculty-name"
          name="name"
          value={name}
          onChange={(e) => updateName(e.target.value)}
          onBlur={() => touch('name')}
          maxLength={150}
          placeholder="Ej. Facultad de Jurisprudencia"
          disabled={pending}
          required
        />
      </FormField>
    </FormDialog>
  )
}

function FacultiesList({ onSelectFaculty }: Readonly<{ onSelectFaculty: (faculty: Faculty) => void }>) {
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('')
  const fetchFaculties = useCallback((page: number, search: string) => api.listFaculties({ page, search, status: statusFilter || undefined }), [statusFilter])
  const {
    data: faculties,
    meta,
    page,
    setPage,
    searchInput,
    setSearchInput,
    isInitialLoading,
    isFetching,
    error: pageError,
    reload,
  } = usePaginatedCatalog(fetchFaculties, statusFilter)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const hasFilters = searchInput.trim() !== '' || statusFilter !== ''

  // Primera carga: toda la pantalla en esqueleto; después, solo las filas al filtrar o paginar.
  if (isInitialLoading) {
    return <AdminListSkeleton label="Cargando facultades" headers={['Facultad', 'Carreras', 'Estado']} />
  }

  return (
    <section className="flex flex-col gap-6">
      <AdminSectionHeader
        title="Facultades"
        description="Registra las facultades de la universidad y consulta sus carreras."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
            <RefreshButton onClick={() => void reload()} loading={isFetching} />
            <BulkImportButton type="faculties" title="Carga masiva de facultades" onFinished={reload} className="flex-1 sm:flex-none" />
            <Button onClick={() => { setFormKey((key) => key + 1); setIsModalOpen(true) }} className="w-full sm:w-auto" data-tour="page-create">
              <PlusIcon data-icon="inline-start" />
              Nueva facultad
            </Button>
          </div>
        }
      />

      <ErrorNotice title="No se pudieron cargar las facultades" message={pageError} retry={reload} />

      <div className="flex flex-col gap-4">
        <FilterBar
          id="faculties"
          search={searchInput}
          onSearch={setSearchInput}
          searchLabel="Buscar facultad"
          searchPlaceholder="Buscar facultad por nombre…"
          filters={[
            { id: 'status', label: 'Estado', value: statusFilter, onChange: (value) => setStatusFilter(value as '' | 'active' | 'inactive'), allLabel: 'Todos los estados', options: [{ value: 'active', label: 'Activas' }, { value: 'inactive', label: 'Inactivas' }] },
          ]}
          onClear={() => { setSearchInput(''); setStatusFilter('') }}
        />

        <RecordTable
          rows={faculties}
          loading={isInitialLoading}
          onRowClick={onSelectFaculty}
          empty={hasFilters ? 'No hay facultades con estos filtros.' : 'Aún no hay facultades registradas.'}
          columns={[
            { label: 'Facultad', render: (faculty) => faculty.name },
            { label: 'Carreras', render: (faculty) => <span className="text-muted-foreground">{careersSummary(faculty)}</span> },
            { label: 'Estado', render: (faculty) => <StatusBadge active={faculty.status} activeLabel="Activa" inactiveLabel="Inactiva" /> },
          ]}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {faculties.length} de {meta?.total ?? faculties.length} {(meta?.total ?? faculties.length) === 1 ? 'facultad' : 'facultades'}
          </p>
          <CatalogPagination label="facultades" page={page} lastPage={meta?.last_page ?? 1} disabled={isFetching} onChange={setPage} />
        </div>
      </div>

      <FacultyFormDialog key={formKey} open={isModalOpen} faculty={null} onClose={() => setIsModalOpen(false)} onSaved={reload} />
    </section>
  )
}

/** Pantalla de una facultad: arriba su estado y acciones; debajo, sus carreras. */
function FacultyDetail({ faculty, onChange, onBack }: Readonly<{
  faculty: Faculty
  onChange: (faculty: Faculty) => void
  onBack: () => void
}>) {
  const navigate = useNavigate()
  const fetchCareers = useCallback((page: number, search: string) => api.listCareers({ page, search, facultyId: faculty.id }), [faculty.id])
  const careers = usePaginatedCatalog(fetchCareers, String(faculty.id))

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [facultyToToggle, setFacultyToToggle] = useState<ToggleTarget | null>(null)
  const [pending, setPending] = useState(false)
  const hasActiveCareers = faculty.active_careers_count > 0

  async function handleConfirmToggle() {
    if (!facultyToToggle || pending) return

    const { action } = facultyToToggle
    setPending(true)
    try {
      if (action === 'activate') {
        await api.activateFaculty(faculty.id)
        toast.success('Facultad habilitada', { description: `La facultad "${faculty.name}" fue habilitada.` })
      } else {
        await api.deactivateFaculty(faculty.id)
        toast.info('Facultad desactivada', { description: `Se desactivó la facultad "${faculty.name}".` })
      }
      setFacultyToToggle(null)
      const active = action === 'activate'
      onChange({ ...faculty, status: active, is_active: active })
    } catch (error: unknown) {
      setFacultyToToggle(null)
      // Fuera de un formulario, el error va en un toast.
      const friendly = getFriendlyError(error)
      if (!isFormDialogOpen()) toast.error(friendly.title, { description: asSentence(friendly.description) })
    } finally {
      setPending(false)
    }
  }

  // Hasta que llega la primera página de carreras, la pantalla sigue en esqueleto (sin un
  // encabezado real junto a una tabla que aún carga).
  if (careers.isInitialLoading) return <FacultyDetailSkeleton />

  return (
    <section className="flex flex-col gap-6" data-tour-view="detail">
      <div>
        <Button type="button" variant="tertiary" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" />
          Volver a facultades
        </Button>
      </div>

      <AdminSectionHeader
        title={faculty.name}
        description={careersSummary(faculty)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge active={faculty.status} activeLabel="Activa" inactiveLabel="Inactiva" />
            <Button type="button" variant="tertiary" size="icon" aria-label="Editar facultad" disabled={pending} onClick={() => { setFormKey((key) => key + 1); setIsModalOpen(true) }}>
              <PencilIcon />
            </Button>
            {!faculty.status ? (
              <Button type="button" variant="tertiary" size="icon" aria-label="Habilitar facultad" disabled={pending} onClick={() => setFacultyToToggle({ faculty, action: 'activate' })}>
                <PowerIcon />
              </Button>
            ) : hasActiveCareers ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button type="button" variant="tertiary" size="icon" tone="destructive" aria-label="Desactivar facultad" disabled tooltip={false}>
                      <PowerOffIcon />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {`No puedes desactivar: tiene ${faculty.active_careers_count} carrera(s) activa(s). Desactívalas primero.`}
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button type="button" variant="tertiary" size="icon" tone="destructive" aria-label="Desactivar facultad" disabled={pending} onClick={() => setFacultyToToggle({ faculty, action: 'deactivate' })}>
                <PowerOffIcon />
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Carreras</h2>
          <Button type="button" variant="secondary" onClick={() => navigate(careersPath(faculty))}>
            <BookOpenIcon data-icon="inline-start" />
            Administrar carreras
          </Button>
        </div>

        <ErrorNotice title="No se pudieron cargar las carreras" message={careers.error} retry={careers.reload} />

        <RecordTable
          rows={careers.data}
          loading={careers.isInitialLoading}
          onRowClick={(career) => void navigate(careerDetailLocation(career))}
          empty="Esta facultad aún no tiene carreras registradas."
          columns={[
            { label: 'Carrera', render: (career) => career.name },
            { label: 'Modalidad', render: (career) => <span className="text-muted-foreground">{career.modality_name ?? 'Sin modalidad'}</span> },
            { label: 'Ciclos', render: (career) => <span className="text-muted-foreground">{career.cycles_count === 0 ? 'Sin ciclos' : `${career.active_cycles_count} de ${career.cycles_count} activos`}</span> },
            { label: 'Estado', render: (career) => <StatusBadge active={career.status} activeLabel="Activa" inactiveLabel="Inactiva" /> },
          ]}
        />

        {(careers.meta?.last_page ?? 1) > 1 && (
          <CatalogPagination label="carreras" page={careers.page} lastPage={careers.meta?.last_page ?? 1} disabled={careers.isFetching} onChange={careers.setPage} />
        )}
      </div>

      <FacultyFormDialog
        key={formKey}
        open={isModalOpen}
        faculty={faculty}
        onClose={() => setIsModalOpen(false)}
        onSaved={(name) => onChange({ ...faculty, name })}
      />

      <ConfirmModal
        open={Boolean(facultyToToggle)}
        onClose={() => setFacultyToToggle(null)}
        onConfirm={() => void handleConfirmToggle()}
        title={facultyToToggle?.action === 'activate' ? '¿Habilitar facultad?' : '¿Desactivar facultad?'}
        description={
          facultyToToggle?.action === 'activate'
            ? `"${facultyToToggle?.faculty.name}" volverá a estar disponible en el sistema.`
            : `"${facultyToToggle?.faculty.name}" quedará inactiva en el sistema. Puedes volver a habilitarla después.`
        }
        confirmLabel={facultyToToggle?.action === 'activate' ? 'Habilitar facultad' : 'Desactivar facultad'}
        confirmIcon={facultyToToggle?.action === 'activate' ? PowerIcon : PowerOffIcon}
        cancelLabel="Cancelar"
        variant={facultyToToggle?.action === 'activate' ? 'default' : 'destructive'}
        pending={pending}
      />
    </section>
  )
}
