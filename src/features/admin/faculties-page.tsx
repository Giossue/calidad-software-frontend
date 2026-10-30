import { useCallback, useState, type FormEvent } from 'react'
import {
  ChevronRightIcon,
  PlusIcon,
  PowerIcon,
  PowerOffIcon,
  ShieldAlertIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { BulkImportButton } from '@/components/bulk-import-dialog'
import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RefreshButton } from '@/components/ui/refresh-button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { ErrorModal, getFriendlyError } from '@/components/ui/error-modal'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { IconAction } from '@/components/ui/icon-action'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { api, type Faculty } from '@/lib/api'
import { sanitizeLetters } from '@/lib/sanitize'
import { cn } from '@/lib/utils'
import { FilterBar } from '@/features/tutoring/filter-bar'

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
  const [errorModal, setErrorModal] = useState<{ open: boolean; title: string; description: string } | null>(null)
  const [pending, setPending] = useState<PendingAction>(null)

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [facultyToToggle, setFacultyToToggle] = useState<ToggleTarget | null>(null)

  async function handleRefresh() {
    const ok = await reload()
    if (ok) toast.success('Facultades actualizadas', { description: 'El listado se actualizó correctamente.' })
  }

  function updateName(value: string) {
    setName(sanitizeLetters(value, 150))
    setNameError(undefined)
  }

  function openCreateModal() {
    setEditingFaculty(null)
    setName('')
    setInitialName('')
    setNameError(undefined)
    setIsModalOpen(true)
  }

  function openEditModal(faculty: Faculty) {
    setEditingFaculty(faculty)
    setName(faculty.name)
    setInitialName(faculty.name)
    setNameError(undefined)
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingFaculty(null)
    setName('')
    setNameError(undefined)
  }

  async function submitFaculty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending !== null) return

    const normalizedName = name.trim()
    const errors: FacultyFormErrors = { name: validateFacultyName(name) }

    setNameError(errors.name)
    if (errors.name) {
      setErrorModal({
        open: true,
        title: 'Revisa los campos requeridos',
        description: 'El nombre de la facultad es obligatorio y no puede superar 150 caracteres.',
      })
      return
    }

    setPending('faculty')
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
      setErrorModal({
        open: true,
        title: friendly.title,
        description: friendly.description,
      })
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
      setErrorModal({
        open: true,
        title: friendly.title,
        description: friendly.description,
      })
    } finally {
      setPending(null)
    }
  }

  const formDisabled = pending !== null
  const isFormDirty = name.trim() !== initialName.trim()
  const submitBlockReason = validateFacultyName(name) ?? null
  const editingHasActiveCareers = (editingFaculty?.active_careers_count ?? 0) > 0

  return (
    <section className="flex flex-col gap-8">
      <AdminSectionHeader
        title="Estructura de Facultades"
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
            <RefreshButton onClick={() => void handleRefresh()} loading={isFetching} />
            <BulkImportButton type="faculties" title="Carga masiva de facultades" onFinished={reload} className="flex-1 sm:flex-none" />
            <Button onClick={openCreateModal} className="w-full sm:w-auto">
              <PlusIcon data-icon="inline-start" />
              Nueva facultad
            </Button>
          </div>
        }
      />

      {pageError && (
        <Alert variant="destructive">
          <ShieldAlertIcon />
          <AlertTitle>No se pudieron cargar las facultades</AlertTitle>
          <AlertDescription>{pageError}</AlertDescription>
        </Alert>
      )}

      {/* Contenedor Principal: Filtro + Tabla */}
      <div className="flex flex-col gap-4">
        <FilterBar
          id="faculties"
          search={searchInput}
          onSearch={setSearchInput}
          searchLabel="Buscar facultad"
          searchPlaceholder="Buscar facultad por nombre…"
          filters={[
            { id: 'status', label: 'Estado', value: statusFilter, onChange: (value) => setStatusFilter(value as '' | 'active' | 'inactive'), allLabel: 'Todas', options: [{ value: 'active', label: 'Activas' }, { value: 'inactive', label: 'Inactivas' }] },
          ]}
          onClear={() => { setSearchInput(''); setStatusFilter('') }}
        />

        {/* Tabla de Facultades */}
        <Card
          className={cn(
            'overflow-hidden transition-opacity max-md:overflow-visible max-md:border-0 max-md:bg-transparent max-md:shadow-none',
            isFetching && !isInitialLoading && 'opacity-60',
          )}
        >
          <Table stacked cardTitle>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre de la Facultad</TableHead>
                <TableHead>Código Institucional</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead><span className="sr-only">Acciones</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isInitialLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="ml-auto size-8 rounded-lg" /></TableCell>
                  </TableRow>
                ))
              ) : faculties.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="py-12 text-center text-muted-foreground whitespace-normal">
                    <div className="flex flex-col items-center gap-2">
                      <span>
                        {searchInput
                          ? 'No se encontraron facultades con el término buscado.'
                          : 'Todavía no hay facultades registradas.'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                faculties.map((faculty) => {
                  const selected = editingFaculty?.id === faculty.id

                  return (
                    <TableRow
                      key={faculty.id}
                      tabIndex={0}
                      aria-selected={selected}
                      onClick={() => openEditModal(faculty)}
                      onKeyDown={(event) => {
                        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                          event.preventDefault()
                          openEditModal(faculty)
                        }
                      }}
                      className={cn('cursor-pointer', selected && 'bg-muted/60')}
                    >
                      {/* Nombre */}
                      <TableCell className="font-medium text-foreground whitespace-normal">
                        <span>{faculty.name}</span>
                      </TableCell>

                      {/* Código */}
                      <TableCell className="text-xs text-muted-foreground whitespace-normal">
                        <div className="flex flex-col gap-0.5">
                          <span>Facultad #{faculty.id}</span>
                          <span>
                            {faculty.careers_count === 0
                              ? 'Sin carreras'
                              : `${faculty.active_careers_count} de ${faculty.careers_count} carrera${faculty.careers_count === 1 ? '' : 's'} activa${faculty.active_careers_count === 1 ? '' : 's'}`}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <StatusBadge active={faculty.status} activeLabel="Activa" inactiveLabel="Inactiva" />
                      </TableCell>

                      {/* Acción de dominio: ver las carreras de la facultad */}
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <IconAction
                          label={`Ver carreras de ${faculty.name}`}
                          icon={ChevronRightIcon}
                          onClick={() => navigate(careersPath(faculty))}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Paginación */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {faculties.length} de {meta?.total ?? faculties.length} {meta?.total ?? faculties.length === 1 ? 'facultad' : 'facultades'}
          </p>
          <CatalogPagination
            label="facultades"
            page={page}
            lastPage={meta?.last_page ?? 1}
            disabled={isFetching}
            onChange={setPage}
          />
        </div>
      </div>

      {/* Modal para Crear / Editar Facultad */}
      <FormDialog
        open={isModalOpen}
        onClose={closeModal}
        onSubmit={submitFaculty}
        title={editingFaculty ? 'Editar Facultad' : 'Registrar Facultad'}
        description={
          editingFaculty
            ? 'Modifica el nombre de la facultad seleccionada.'
            : 'Ingresa el nombre de la nueva facultad para añadirla al catálogo.'
        }
        maxWidth="max-w-md"
        pending={pending === 'faculty'}
        error={null}
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

      {/* ConfirmModal para Habilitar / Desactivar Facultad */}
      <ConfirmModal
        open={Boolean(facultyToToggle)}
        onClose={() => setFacultyToToggle(null)}
        onConfirm={() => void handleConfirmToggle()}
        title={facultyToToggle?.action === 'activate' ? '¿Habilitar facultad?' : '¿Desactivar facultad?'}
        description={
          facultyToToggle?.action === 'activate'
            ? `¿Deseas habilitar la facultad "${facultyToToggle?.faculty.name}"? Volverá a estar disponible en el sistema.`
            : `¿Estás seguro de desactivar la "${facultyToToggle?.faculty.name}"? Se marcará como inactiva en el sistema.`
        }
        confirmLabel={facultyToToggle?.action === 'activate' ? 'Habilitar facultad' : 'Desactivar facultad'}
        cancelLabel="Cancelar"
        variant={facultyToToggle?.action === 'activate' ? 'default' : 'destructive'}
        pending={pending === 'toggle-faculty'}
      />

      {/* ErrorModal para Notificar Errores de Validación o Datos Duplicados */}
      <ErrorModal
        open={Boolean(errorModal?.open)}
        onClose={() => setErrorModal(null)}
        title={errorModal?.title}
        description={errorModal?.description}
      />
    </section>
  )
}
