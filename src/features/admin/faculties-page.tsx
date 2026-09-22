import { useEffect, useState, type FormEvent } from 'react'
import {
  Building2Icon,
  CheckCircle2Icon,
  Edit2Icon,
  PlusIcon,
  PowerIcon,
  PowerOffIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldAlertIcon,
  XCircleIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ApiError, api, type Faculty } from '@/lib/api'
import { cn } from '@/lib/utils'

type FacultyFormErrors = { name?: string }
type PendingAction = 'loading' | 'faculty' | 'toggle-faculty' | null
type ToggleTarget = { faculty: Faculty; action: 'activate' | 'deactivate' }

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.firstValidationMessage ?? error.message
  return 'No fue posible conectar con el servidor.'
}

function isFacultyActive(faculty: Faculty): boolean {
  return faculty.status
}

export function FacultiesPage() {
  const [faculties, setFaculties] = useState<readonly Faculty[]>([])
  const [editingFaculty, setEditingFaculty] = useState<Faculty | null>(null)
  const [name, setName] = useState('')
  const [initialName, setInitialName] = useState('')
  const [nameError, setNameError] = useState<string | undefined>()
  const [pageError, setPageError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction>(null)

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [facultyToToggle, setFacultyToToggle] = useState<ToggleTarget | null>(null)

  // Tooltip del botón de desactivar bloqueado (hover en escritorio, tap en móvil)
  const [blockedTooltipFacultyId, setBlockedTooltipFacultyId] = useState<number | null>(null)

  // Búsqueda
  const [searchQuery, setSearchQuery] = useState('')

  async function loadFaculties(options?: { notify?: boolean }) {
    setPageError(null)
    setPending('loading')
    try {
      const facultyData = await api.listFaculties()
      setFaculties(facultyData)
      if (options?.notify) {
        toast.success('Facultades actualizadas', { description: 'El listado se actualizó correctamente.' })
      }
    } catch (error: unknown) {
      setPageError(getErrorMessage(error))
    } finally {
      setPending(null)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadFaculties() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  function updateName(value: string) {
    setName(value)
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
    const errors: FacultyFormErrors = {}
    if (!normalizedName) errors.name = 'El nombre de la facultad es obligatorio.'
    else if (normalizedName.length > 150) errors.name = 'El nombre no puede superar 150 caracteres.'

    setNameError(errors.name)
    if (Object.keys(errors).length > 0) {
      setFormError('Revisa el nombre antes de guardar.')
      return
    }

    setFormError(null)
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
      await loadFaculties()
    } catch (error: unknown) {
      setFormError(getErrorMessage(error))
    } finally {
      setPending(null)
    }
  }

  async function handleConfirmToggle() {
    if (!facultyToToggle || pending !== null) return

    const { faculty, action } = facultyToToggle
    setPageError(null)
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
      await loadFaculties()
    } catch (error: unknown) {
      setFacultyToToggle(null)
      setPageError(getErrorMessage(error))
    } finally {
      setPending(null)
    }
  }

  const formDisabled = pending !== null
  const isFormDirty = name.trim() !== initialName.trim()

  // Métricas KPI
  const totalFaculties = faculties.length
  const activeFaculties = faculties.filter((f) => f.status).length
  const inactiveFaculties = totalFaculties - activeFaculties

  // Filtro de búsqueda
  const filteredFaculties = faculties.filter((faculty) => {
    const query = searchQuery.toLowerCase().trim()
    return (
      !query ||
      faculty.name.toLowerCase().includes(query) ||
      String(faculty.id).includes(query)
    )
  })

  return (
    <section className="flex flex-col gap-8">
      <AdminSectionHeader
        title="Estructura de Facultades"
        description="Gestiona las unidades académicas principales de la universidad."
        eyebrow="Catálogo Institucional"
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => void loadFaculties({ notify: true })}
              disabled={formDisabled}
            >
              {pending === 'loading' ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCwIcon data-icon="inline-start" />
              )}
              Actualizar
            </Button>
            <Button onClick={openCreateModal} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
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

      {/* Tarjetas KPI de Estadísticas */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-5 border-slate-200/80 dark:border-slate-800">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <Building2Icon className="size-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Facultades
            </span>
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {totalFaculties}
            </span>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5 border-slate-200/80 dark:border-slate-800">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <CheckCircle2Icon className="size-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Facultades Activas
            </span>
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {activeFaculties}
            </span>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5 border-slate-200/80 dark:border-slate-800">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <XCircleIcon className="size-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Inactivas
            </span>
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {inactiveFaculties}
            </span>
          </div>
        </Card>
      </div>

      {/* Contenedor Principal: Filtro + Tabla Moderna */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        {/* Barra de Búsqueda */}
        <div className="flex items-center justify-between">
          <div className="relative flex flex-1 items-center max-w-md">
            <SearchIcon className="absolute left-3.5 size-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar facultad por nombre o código…"
              className="pl-10"
            />
          </div>
        </div>

        {/* Tabla de Facultades */}
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Nombre de la Facultad</th>
                <th className="px-5 py-3.5">Código Institucional</th>
                <th className="px-5 py-3.5">Estado</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {pending === 'loading' ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-4"><div className="h-5 w-48 rounded-md bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-5 py-4"><div className="h-4 w-20 rounded-md bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-5 py-4"><div className="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-5 py-4 text-right"><div className="ml-auto h-8 w-16 rounded-md bg-slate-200 dark:bg-slate-800" /></td>
                  </tr>
                ))
              ) : filteredFaculties.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Building2Icon className="size-8 text-slate-300 dark:text-slate-600" />
                      <span className="font-medium">
                        {searchQuery
                          ? 'No se encontraron facultades con el término buscado.'
                          : 'Todavía no hay facultades registradas.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredFaculties.map((faculty) => {
                  const active = isFacultyActive(faculty)
                  const hasActiveCareers = faculty.active_careers_count > 0

                  return (
                    <tr
                      key={faculty.id}
                      className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      {/* Nombre con icono */}
                      <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#0F1E2E] text-white shadow-2xs">
                            <Building2Icon className="size-4" />
                          </div>
                          <span>{faculty.name}</span>
                        </div>
                      </td>

                      {/* Código */}
                      <td className="px-5 py-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                        <div className="flex flex-col gap-0.5">
                          <span>Facultad #{faculty.id}</span>
                          <span>
                            {faculty.careers_count === 0
                              ? 'Sin carreras'
                              : `${faculty.active_careers_count} de ${faculty.careers_count} carrera${faculty.careers_count === 1 ? '' : 's'} activa${faculty.active_careers_count === 1 ? '' : 's'}`}
                          </span>
                        </div>
                      </td>

                      {/* Estado Pulsante */}
                      <td className="px-5 py-4">
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
                      </td>

                      {/* Acciones */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
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
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
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
              <FieldLabel htmlFor="faculty-name">Nombre de la facultad</FieldLabel>
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
              <FieldDescription>Hasta 150 caracteres.</FieldDescription>
              <FieldError>{nameError}</FieldError>
            </Field>

            <FieldError>{formError}</FieldError>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <DialogCancelButton onClick={closeModal} disabled={formDisabled}>
                Cancelar
              </DialogCancelButton>
              <Button type="submit" disabled={formDisabled} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
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
    </section>
  )
}
