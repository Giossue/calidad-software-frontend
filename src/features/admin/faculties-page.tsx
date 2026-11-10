import { useCallback, useState, type FormEvent } from 'react'
import { BookOpenIcon, PlusIcon, PowerIcon, PowerOffIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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
import { RowActionsMenu } from '@/components/ui/row-actions-menu'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { api, type Faculty } from '@/lib/api'
import { sanitizeLetters } from '@/lib/sanitize'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { RecordTable } from '@/features/tutoring/tutoring-shared'

type FacultyFormErrors = { name?: string }
type PendingAction = 'faculty' | 'toggle-faculty' | null
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

export function FacultiesPage() {
  const navigate = useNavigate()
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

  const [editingFaculty, setEditingFaculty] = useState<Faculty | null>(null)
  const [name, setName] = useState('')
  const [initialName, setInitialName] = useState('')
  const [nameError, setNameError] = useState<string | undefined>()
  // Error del servidor (o de validación al enviar): se muestra una vez, en línea, dentro del modal.
  const [formError, setFormError] = useState<FriendlyErrorInfo | null>(null)
  const [pending, setPending] = useState<PendingAction>(null)

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [facultyToToggle, setFacultyToToggle] = useState<ToggleTarget | null>(null)

  function updateName(value: string) {
    setName(sanitizeLetters(value, 150))
    setNameError(undefined)
    setFormError(null)
  }

  function openCreateModal() {
    setEditingFaculty(null)
    setName('')
    setInitialName('')
    setNameError(undefined)
    setFormError(null)
    setIsModalOpen(true)
  }

  function openEditModal(faculty: Faculty) {
    setEditingFaculty(faculty)
    setName(faculty.name)
    setInitialName(faculty.name)
    setNameError(undefined)
    setFormError(null)
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingFaculty(null)
    setName('')
    setNameError(undefined)
    setFormError(null)
  }

  async function submitFaculty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending !== null) return

    const normalizedName = name.trim()
    const errors: FacultyFormErrors = { name: validateFacultyName(name) }

    setNameError(errors.name)
    if (errors.name) {
      setFormError({
        title: 'Revisa los campos requeridos',
        description: 'El nombre de la facultad es obligatorio y no puede superar 150 caracteres.',
      })
      return
    }

    setPending('faculty')
    setFormError(null)
    try {
      if (editingFaculty) {
        await api.updateFaculty(editingFaculty.id, { name: normalizedName })
        toast.success('Facultad actualizada', { description: `La facultad "${normalizedName}" fue modificada.` })
      } else {
        await api.createFaculty({ name: normalizedName })
        toast.success('Facultad creada', { description: `La facultad "${normalizedName}" ha sido agregada.` })
      }
      closeModal()
      await reload()
    } catch (error: unknown) {
      const friendly = getFriendlyError(error)
      setFormError(friendly)
      if (friendly.field === 'name') {
        setNameError(friendly.description)
      }
    } finally {
      setPending(null)
    }
  }

  async function handleConfirmToggle() {
    if (!facultyToToggle || pending !== null) return

    const { faculty, action } = facultyToToggle
    setPending('toggle-faculty')
    try {
      if (action === 'activate') {
        await api.activateFaculty(faculty.id)
        toast.success('Facultad habilitada', { description: `La facultad "${faculty.name}" fue habilitada.` })
      } else {
        await api.deactivateFaculty(faculty.id)
        toast.info('Facultad deshabilitada', { description: `Se desactivó la facultad "${faculty.name}".` })
      }
      setFacultyToToggle(null)
      closeModal()
      await reload()
    } catch (error: unknown) {
      setFacultyToToggle(null)
      const friendly = getFriendlyError(error)
      setFormError(friendly)
    } finally {
      setPending(null)
    }
  }

  const formDisabled = pending !== null
  const isFormDirty = name.trim() !== initialName.trim()
  const submitBlockReason = validateFacultyName(name) ?? null
  const editingHasActiveCareers = (editingFaculty?.active_careers_count ?? 0) > 0
  const hasFilters = searchInput.trim() !== '' || statusFilter !== ''

  return (
    <section className="flex flex-col gap-6">
      <AdminSectionHeader
        title="Facultades"
        description="Registra las facultades de la universidad y consulta sus carreras."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
            <RefreshButton onClick={() => void reload()} loading={isFetching} />
            <BulkImportButton type="faculties" title="Carga masiva de facultades" onFinished={reload} className="flex-1 sm:flex-none" />
            <Button onClick={openCreateModal} className="w-full sm:w-auto" data-tour="page-create">
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
          onRowClick={openEditModal}
          isRowSelected={(faculty) => editingFaculty?.id === faculty.id}
          empty={hasFilters ? 'No hay facultades con estos filtros.' : 'Aún no hay facultades registradas.'}
          columns={[
            { label: 'Facultad', render: (faculty) => <span className="font-medium">{faculty.name}</span> },
            {
              label: 'Carreras',
              render: (faculty) => (
                <span className="text-muted-foreground">
                  {faculty.careers_count === 0
                    ? 'Sin carreras'
                    : `${faculty.active_careers_count} de ${faculty.careers_count} carrera${faculty.careers_count === 1 ? '' : 's'} activa${faculty.active_careers_count === 1 ? '' : 's'}`}
                </span>
              ),
            },
            { label: 'Estado', render: (faculty) => <StatusBadge active={faculty.status} activeLabel="Activa" inactiveLabel="Inactiva" /> },
            {
              label: 'Acciones',
              render: (faculty) => (
                <RowActionsMenu
                  name={faculty.name}
                  actions={[{ label: 'Ver carreras', icon: BookOpenIcon, onSelect: () => navigate(careersPath(faculty)) }]}
                />
              ),
            },
          ]}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {faculties.length} de {meta?.total ?? faculties.length} {(meta?.total ?? faculties.length) === 1 ? 'facultad' : 'facultades'}
          </p>
          <CatalogPagination label="facultades" page={page} lastPage={meta?.last_page ?? 1} disabled={isFetching} onChange={setPage} />
        </div>
      </div>

      <FormDialog
        open={isModalOpen}
        onClose={closeModal}
        onSubmit={submitFaculty}
        title={editingFaculty ? 'Editar Facultad' : 'Registrar Facultad'}
        description={editingFaculty ? undefined : 'Escribe el nombre con el que aparecerá en el sistema.'}
        maxWidth="max-w-md"
        pending={pending === 'faculty'}
        error={formError?.description ?? null}
        errorModal={formError}
        dirty={isFormDirty}
        blockReason={submitBlockReason}
        submitLabel={editingFaculty ? 'Guardar Cambios' : 'Registrar Facultad'}
        submitIcon={editingFaculty ? undefined : PlusIcon}
        headerActions={
          editingFaculty ? (
            <>
              <StatusBadge active={editingFaculty.status} activeLabel="Activa" inactiveLabel="Inactiva" />
              {!editingFaculty.status ? (
                <IconAction
                  label="Habilitar facultad"
                  icon={PowerIcon}
                  disabled={formDisabled}
                  onClick={() => setFacultyToToggle({ faculty: editingFaculty, action: 'activate' })}
                />
              ) : editingHasActiveCareers ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button type="button" variant="tertiary" size="icon" disabled aria-label="Desactivar facultad">
                        <PowerOffIcon />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {`No puedes desactivar: tiene ${editingFaculty.active_careers_count} carrera(s) activa(s). Desactívalas primero.`}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <IconAction
                  label="Desactivar facultad"
                  icon={PowerOffIcon}
                  tone="destructive"
                  disabled={formDisabled}
                  onClick={() => setFacultyToToggle({ faculty: editingFaculty, action: 'deactivate' })}
                />
              )}
            </>
          ) : undefined
        }
      >
        <FormField id="faculty-name" label="Nombre de la facultad" counter={{ current: name.length, max: 150 }} error={nameError}>
          <Input
            id="faculty-name"
            name="name"
            value={name}
            onChange={(e) => updateName(e.target.value)}
            maxLength={150}
            placeholder="Ej. Facultad de Jurisprudencia"
            disabled={formDisabled}
            required
          />
        </FormField>
      </FormDialog>

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
        pending={pending === 'toggle-faculty'}
      />
    </section>
  )
}
