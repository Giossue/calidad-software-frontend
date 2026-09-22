import { useEffect, useState, type FormEvent } from 'react'
import {
  CheckCircle2Icon,
  Edit2Icon,
  PlusIcon,
  PowerIcon,
  PowerOffIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldAlertIcon,
  SlidersIcon,
  XCircleIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ApiError, api, type Modality, type ModalityInput } from '@/lib/api'
import { cn } from '@/lib/utils'

type PendingAction = 'modality' | 'toggle-modality' | null
type ToggleTarget = { modality: Modality; action: 'activate' | 'deactivate' }

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.firstValidationMessage ?? error.message
  return 'No fue posible conectar con el servidor.'
}

function isModalityActive(modality: Modality): boolean {
  return modality.is_active
}

export function ModalitiesPage() {
  const [modalities, setModalities] = useState<readonly Modality[]>([])
  const [editingModality, setEditingModality] = useState<Modality | null>(null)
  const [name, setName] = useState('')
  const [initialName, setInitialName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [pending, setPending] = useState<PendingAction>(null)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalityToToggle, setModalityToToggle] = useState<ToggleTarget | null>(null)

  // Búsqueda
  const [searchQuery, setSearchQuery] = useState('')

  async function loadModalities(nextPage = 1, options?: { notify?: boolean }) {
    setPageError(null)
    setIsLoading(true)
    try {
      const response = await api.listModalities(nextPage)
      setModalities(response.data)
      setPage(response.meta?.current_page ?? nextPage)
      setLastPage(response.meta?.last_page ?? nextPage)
      if (options?.notify) {
        toast.success('Modalidades actualizadas', { description: 'El listado se actualizó correctamente.' })
      }
    } catch (error: unknown) {
      setPageError(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadModalities(1) }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  function updateName(value: string) {
    setName(value)
    setNameError(null)
    setFormError(null)
  }

  function openCreateModal() {
    setEditingModality(null)
    setName('')
    setInitialName('')
    setNameError(null)
    setFormError(null)
    setIsModalOpen(true)
  }

  function openEditModal(modality: Modality) {
    setEditingModality(modality)
    setName(modality.name)
    setInitialName(modality.name)
    setNameError(null)
    setFormError(null)
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingModality(null)
    setName('')
    setNameError(null)
    setFormError(null)
  }

  async function submitModality(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending !== null || isLoading) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError('El nombre de la modalidad es obligatorio.')
      setFormError('Revisa los campos marcados antes de guardar.')
      return
    }
    if (trimmedName.length > 100) {
      setNameError('El nombre no puede superar 100 caracteres.')
      setFormError('Revisa los campos marcados antes de guardar.')
      return
    }

    setNameError(null)
    setFormError(null)
    setPending('modality')
    try {
      const input: ModalityInput = { name: trimmedName }
      if (editingModality) {
        await api.updateModality(editingModality.id, input)
        toast.success('Modalidad actualizada', { description: `La modalidad "${trimmedName}" fue modificada.` })
      } else {
        await api.createModality(input)
        toast.success('Modalidad creada', { description: `La modalidad "${trimmedName}" ha sido registrada.` })
      }

      closeModal()
      await loadModalities(page)
    } catch (error: unknown) {
      setFormError(getErrorMessage(error))
    } finally {
      setPending(null)
    }
  }

  async function handleConfirmToggle() {
    if (!modalityToToggle || pending !== null || isLoading) return

    const { modality, action } = modalityToToggle
    setPageError(null)
    setPending('toggle-modality')
    try {
      if (action === 'activate') {
        await api.activateModality(modality.id)
        toast.success('Modalidad habilitada', { description: `La modalidad "${modality.name}" fue habilitada.` })
      } else {
        await api.deactivateModality(modality.id)
        toast.info('Modalidad deshabilitada', { description: `Se desactivó la modalidad "${modality.name}".` })
      }
      setModalityToToggle(null)
      await loadModalities(page)
    } catch (error: unknown) {
      setPageError(getErrorMessage(error))
    } finally {
      setPending(null)
    }
  }

  const busy = isLoading || pending !== null
  const isFormDirty = name.trim() !== initialName.trim()

  // Métricas KPI
  const totalModalities = modalities.length
  const activeModalities = modalities.filter((m) => m.is_active).length
  const inactiveModalities = totalModalities - activeModalities

  // Filtro de búsqueda
  const filteredModalities = modalities.filter((modality) => {
    const query = searchQuery.toLowerCase().trim()
    return (
      !query ||
      modality.name.toLowerCase().includes(query) ||
      String(modality.id).includes(query)
    )
  })

  return (
    <section className="flex flex-col gap-8" aria-labelledby="modalities-title">
      <AdminSectionHeader
        title="Modalidades de Estudio"
        description="Administra los formatos de estudio (Presencial, Semipresencial, En Línea) disponibles en la institución."
        eyebrow="Oferta Institucional"
        titleId="modalities-title"
        actions={
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => void loadModalities(1, { notify: true })} disabled={busy}>
              {isLoading ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
              Actualizar
            </Button>
            <Button onClick={openCreateModal} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
              <PlusIcon data-icon="inline-start" />
              Nueva modalidad
            </Button>
          </div>
        }
      />

      {pageError && (
        <Alert variant="destructive">
          <ShieldAlertIcon />
          <AlertTitle>No se pudieron cargar las modalidades</AlertTitle>
          <AlertDescription>{pageError}</AlertDescription>
        </Alert>
      )}

      {/* Tarjetas KPI de Estadísticas */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-5 border-slate-200/80 dark:border-slate-800">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <SlidersIcon className="size-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Modalidades
            </span>
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {totalModalities}
            </span>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5 border-slate-200/80 dark:border-slate-800">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <CheckCircle2Icon className="size-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Activas
            </span>
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {activeModalities}
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
              {inactiveModalities}
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
              placeholder="Buscar modalidad por nombre…"
              className="pl-10"
            />
          </div>
        </div>

        {/* Tabla de Modalidades */}
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Nombre de la Modalidad</th>
                <th className="px-5 py-3.5">Descripción</th>
                <th className="px-5 py-3.5">Estado</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-4"><div className="h-5 w-40 rounded-md bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-5 py-4"><div className="h-4 w-32 rounded-md bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-5 py-4"><div className="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-5 py-4 text-right"><div className="ml-auto h-8 w-16 rounded-md bg-slate-200 dark:bg-slate-800" /></td>
                  </tr>
                ))
              ) : filteredModalities.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <SlidersIcon className="size-8 text-slate-300 dark:text-slate-600" />
                      <span className="font-medium">
                        {searchQuery
                          ? 'No se encontraron modalidades con el término buscado.'
                          : 'Todavía no hay modalidades registradas.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredModalities.map((modality) => {
                  const active = isModalityActive(modality)

                  return (
                    <tr
                      key={modality.id}
                      className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      {/* Nombre con icono */}
                      <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#0F1E2E] text-white shadow-2xs">
                            <SlidersIcon className="size-4" />
                          </div>
                          <span>{modality.name}</span>
                        </div>
                      </td>

                      {/* Detalle */}
                      <td className="px-5 py-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                        Modalidad de actividad académica
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
                            onClick={() => openEditModal(modality)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                            title="Editar modalidad"
                          >
                            <Edit2Icon className="size-4" />
                          </button>
                          {active ? (
                            <button
                              type="button"
                              onClick={() => setModalityToToggle({ modality, action: 'deactivate' })}
                              className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                              title="Desactivar modalidad"
                            >
                              <PowerOffIcon className="size-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setModalityToToggle({ modality, action: 'activate' })}
                              className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"
                              title="Habilitar modalidad"
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

        {/* Paginación */}
        <CatalogPagination
          label="modalidades"
          page={page}
          lastPage={lastPage}
          disabled={busy}
          onChange={(nextPage) => void loadModalities(nextPage)}
        />
      </div>

      {/* Modal Dialog para Crear / Editar Modalidad */}
      <Dialog
        open={isModalOpen}
        onClose={closeModal}
        title={editingModality ? 'Editar Modalidad' : 'Registrar Modalidad'}
        description={
          editingModality
            ? 'Modifica el nombre de la modalidad seleccionada.'
            : 'Ingresa el nombre de la nueva modalidad de estudio.'
        }
        maxWidth="max-w-md"
        confirmClose={isFormDirty}
      >
        <form onSubmit={submitModality}>
          <FieldGroup className="gap-5">
            <Field data-invalid={Boolean(nameError)}>
              <FieldLabel htmlFor="modality-name">Nombre de la modalidad</FieldLabel>
              <Input
                id="modality-name"
                name="name"
                value={name}
                onChange={(e) => updateName(e.target.value)}
                placeholder="Ej. Presencial, Semipresencial, En Línea"
                maxLength={100}
                autoComplete="off"
                disabled={busy}
                required
              />
              <FieldDescription>Hasta 100 caracteres.</FieldDescription>
              <FieldError>{nameError}</FieldError>
            </Field>

            <FieldError>{formError}</FieldError>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <DialogCancelButton onClick={closeModal} disabled={busy}>
                Cancelar
              </DialogCancelButton>
              <Button type="submit" disabled={busy} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
                {pending === 'modality' && <Spinner data-icon="inline-start" />}
                {editingModality ? 'Guardar Cambios' : 'Registrar Modalidad'}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Dialog>

      {/* ConfirmModal para Habilitar / Desactivar Modalidad */}
      <ConfirmModal
        open={Boolean(modalityToToggle)}
        onClose={() => setModalityToToggle(null)}
        onConfirm={() => void handleConfirmToggle()}
        title={modalityToToggle?.action === 'activate' ? '¿Habilitar modalidad?' : '¿Desactivar modalidad?'}
        description={
          modalityToToggle?.action === 'activate'
            ? `¿Deseas habilitar la modalidad "${modalityToToggle?.modality.name}"? Volverá a estar disponible en el sistema.`
            : `¿Estás seguro de desactivar la modalidad "${modalityToToggle?.modality.name}"? Se marcará como inactiva en el sistema.`
        }
        confirmLabel={modalityToToggle?.action === 'activate' ? 'Habilitar modalidad' : 'Desactivar modalidad'}
        cancelLabel="Cancelar"
        variant={modalityToToggle?.action === 'activate' ? 'default' : 'destructive'}
        pending={pending === 'toggle-modality'}
      />
    </section>
  )
}
