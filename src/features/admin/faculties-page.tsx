import { useCallback, useState, type FormEvent } from 'react'
import {
  Building2Icon,
  Edit2Icon,
  PlusIcon,
  PowerIcon,
  PowerOffIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { ErrorModal, getFriendlyError } from '@/components/ui/error-modal'
import { Field, FieldCounter, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
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

  // Tooltip del botón de desactivar bloqueado (hover en escritorio, tap en móvil)
  const [blockedTooltipFacultyId, setBlockedTooltipFacultyId] = useState<number | null>(null)

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
    const errors: FacultyFormErrors = {}
    if (!normalizedName) errors.name = 'El nombre de la facultad es obligatorio.'
    else if (normalizedName.length > 150) errors.name = 'El nombre no puede superar 150 caracteres.'

    setNameError(errors.name)
    if (Object.keys(errors).length > 0) {
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

  return (
    <section className="flex flex-col gap-8">
      <AdminSectionHeader
        title="Estructura de Facultades"
        description="Gestiona las unidades académicas principales de la universidad."
        actions={
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => void handleRefresh()} disabled={isFetching}>
              {isFetching ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
              Actualizar
            </Button>
            <Button onClick={openCreateModal} className="bg-brand-red hover:bg-brand-red/90 text-white font-semibold">
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
        <div
          className={cn(
            'overflow-hidden rounded-xl border bg-card transition-opacity max-md:overflow-visible max-md:border-0 max-md:bg-transparent',
            isFetching && !isInitialLoading && 'opacity-60',
          )}
        >
          <Table stacked cardTitle>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre de la Facultad</TableHead>
                <TableHead>Código Institucional</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isInitialLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell><div className="h-5 w-48 rounded-md bg-slate-200 dark:bg-slate-800" /></TableCell>
                    <TableCell><div className="h-4 w-20 rounded-md bg-slate-200 dark:bg-slate-800" /></TableCell>
                    <TableCell><div className="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-800" /></TableCell>
                    <TableCell><div className="ml-auto h-8 w-16 rounded-md bg-slate-200 dark:bg-slate-800" /></TableCell>
                  </TableRow>
                ))
              ) : faculties.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="py-12 text-center text-slate-500 dark:text-slate-400 whitespace-normal">
                    <div className="flex flex-col items-center gap-2">
                      <Building2Icon className="size-8 text-slate-300 dark:text-slate-600" />
                      <span className="font-medium">
                        {searchInput
                          ? 'No se encontraron facultades con el término buscado.'
                          : 'Todavía no hay facultades registradas.'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                faculties.map((faculty) => {
                  const active = faculty.status
                  const hasActiveCareers = faculty.active_careers_count > 0

                  return (
                    <TableRow
                      key={faculty.id}
                      tabIndex={0}
                      onClick={() => navigate(careersPath(faculty))}
                      onKeyDown={(event) => {
                        if (event.target === event.currentTarget && event.key === 'Enter') navigate(careersPath(faculty))
                      }}
                      className="cursor-pointer"
                      title="Ver carreras de esta facultad"
                    >
                      {/* Nombre con icono */}
                      <TableCell className="font-semibold text-slate-900 dark:text-white whitespace-normal">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-blue text-white shadow-2xs">
                            <Building2Icon className="size-4" />
                          </div>
                          <span>{faculty.name}</span>
                        </div>
                      </TableCell>

                      {/* Código */}
                      <TableCell className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-normal">
                        <div className="flex flex-col gap-0.5">
                          <span>Facultad #{faculty.id}</span>
                          <span>
                            {faculty.careers_count === 0
                              ? 'Sin carreras'
                              : `${faculty.active_careers_count} de ${faculty.careers_count} carrera${faculty.careers_count === 1 ? '' : 's'} activa${faculty.active_careers_count === 1 ? '' : 's'}`}
                          </span>
                        </div>
                      </TableCell>

                      {/* Estado Pulsante */}
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                            active
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
                          )}
                        >
                          <span
                            className={cn(
                              'size-1.5 rounded-full',
                              active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400',
                            )}
                          />
                          {active ? 'Activa' : 'Inactiva'}
                        </span>
                      </TableCell>

                      {/* Acciones */}
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(faculty)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                            title="Editar facultad"
                          >
                            <Edit2Icon className="size-4" />
                          </button>
                          {active ? (
                            <Tooltip
                              open={hasActiveCareers ? blockedTooltipFacultyId === faculty.id : undefined}
                              onOpenChange={(open) => {
                                if (hasActiveCareers) setBlockedTooltipFacultyId(open ? faculty.id : null)
                              }}
                            >
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  aria-disabled={hasActiveCareers}
                                  onMouseEnter={() => hasActiveCareers && setBlockedTooltipFacultyId(faculty.id)}
                                  onMouseLeave={() => hasActiveCareers && setBlockedTooltipFacultyId(null)}
                                  onFocus={() => hasActiveCareers && setBlockedTooltipFacultyId(faculty.id)}
                                  onBlur={() => hasActiveCareers && setBlockedTooltipFacultyId(null)}
                                  onClick={() => {
                                    if (hasActiveCareers) {
                                      setBlockedTooltipFacultyId(faculty.id)
                                      return
                                    }
                                    setFacultyToToggle({ faculty, action: 'deactivate' })
                                  }}
                                  className={cn(
                                    'rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400',
                                    hasActiveCareers && 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-slate-400',
                                  )}
                                >
                                  <PowerOffIcon className="size-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {hasActiveCareers
                                  ? `No puedes desactivar: tiene ${faculty.active_careers_count} carrera(s) activa(s). Desactívalas primero.`
                                  : 'Desactivar facultad'}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setFacultyToToggle({ faculty, action: 'activate' })}
                              className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"
                              title="Habilitar facultad"
                            >
                              <PowerIcon className="size-4" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

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

      {/* Modal Dialog para Crear / Editar Facultad */}
      <Dialog
        open={isModalOpen}
        onClose={closeModal}
        title={editingFaculty ? 'Editar Facultad' : 'Registrar Facultad'}
        description={
          editingFaculty
            ? 'Modifica el nombre de la facultad seleccionada.'
            : 'Ingresa el nombre de la nueva facultad para añadirla al catálogo.'
        }
        maxWidth="max-w-md"
        confirmClose={isFormDirty}
      >
        <form onSubmit={submitFaculty}>
          <FieldGroup className="gap-5">
            <Field data-invalid={Boolean(nameError)}>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="faculty-name">Nombre de la facultad</FieldLabel>
                <FieldCounter current={name.length} max={150} />
              </div>
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
              <FieldError>{nameError}</FieldError>
            </Field>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <DialogCancelButton onClick={closeModal} disabled={formDisabled}>
                Cancelar
              </DialogCancelButton>
              <Button type="submit" disabled={formDisabled} className="bg-brand-red hover:bg-brand-red/90 text-white font-semibold">
                {pending === 'faculty' && <Spinner data-icon="inline-start" />}
                {editingFaculty ? 'Guardar Cambios' : 'Registrar Facultad'}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Dialog>

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
