import { useEffect, useState, type FormEvent } from 'react'
import {
  CalendarCheck2Icon,
  CalendarDaysIcon,
  CalendarIcon,
  CalendarOffIcon,
  Edit2Icon,
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
import { Card } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ApiError, api, type AcademicPeriod, type AcademicPeriodInput } from '@/lib/api'
import { cn } from '@/lib/utils'

type AcademicPeriodForm = {
  name: string
  startDate: string
  endDate: string
}

type AcademicPeriodFormErrors = Partial<Record<keyof AcademicPeriodForm, string>>
type PendingAction = 'period' | 'toggle-period' | null
type ToggleTarget = { period: AcademicPeriod; action: 'activate' | 'deactivate' }

const INITIAL_FORM: AcademicPeriodForm = {
  name: '',
  startDate: '',
  endDate: '',
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.firstValidationMessage ?? error.message
  return 'No fue posible conectar con el servidor.'
}

function isPeriodActive(period: AcademicPeriod): boolean {
  return period.is_active
}

function validatePeriodForm(form: AcademicPeriodForm): AcademicPeriodFormErrors {
  const errors: AcademicPeriodFormErrors = {}
  const name = form.name.trim()

  if (!name) errors.name = 'El nombre del período es obligatorio.'
  else if (name.length > 100) errors.name = 'El nombre no puede superar 100 caracteres.'

  if (!form.startDate) errors.startDate = 'La fecha de inicio es obligatoria.'
  if (!form.endDate) errors.endDate = 'La fecha de finalización es obligatoria.'
  else if (form.startDate && form.endDate < form.startDate) {
    errors.endDate = 'La fecha de finalización debe ser igual o posterior a la fecha de inicio.'
  }

  return errors
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

export function AcademicPeriodsPage() {
  const [periods, setPeriods] = useState<readonly AcademicPeriod[]>([])
  const [editingPeriod, setEditingPeriod] = useState<AcademicPeriod | null>(null)
  const [form, setForm] = useState<AcademicPeriodForm>(INITIAL_FORM)
  const [initialForm, setInitialForm] = useState<AcademicPeriodForm>(INITIAL_FORM)
  const [formErrors, setFormErrors] = useState<AcademicPeriodFormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [pending, setPending] = useState<PendingAction>(null)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [periodToToggle, setPeriodToToggle] = useState<ToggleTarget | null>(null)

  // Búsqueda
  const [searchQuery, setSearchQuery] = useState('')

  async function loadPeriods(nextPage = 1, options?: { notify?: boolean }) {
    setPageError(null)
    setIsLoading(true)
    try {
      const response = await api.listAcademicPeriods(nextPage)
      setPeriods(response.data)
      setPage(response.meta?.current_page ?? nextPage)
      setLastPage(response.meta?.last_page ?? nextPage)
      if (options?.notify) {
        toast.success('Períodos actualizados', { description: 'El listado se actualizó correctamente.' })
      }
    } catch (error: unknown) {
      setPageError(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadPeriods(1) }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  function updateField(field: keyof AcademicPeriodForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
    setFormErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
    setFormError(null)
  }

  function openCreateModal() {
    setEditingPeriod(null)
    setForm(INITIAL_FORM)
    setInitialForm(INITIAL_FORM)
    setFormErrors({})
    setFormError(null)
    setIsModalOpen(true)
  }

  function openEditModal(period: AcademicPeriod) {
    setEditingPeriod(period)
    const initial: AcademicPeriodForm = {
      name: period.name,
      startDate: period.start_date.slice(0, 10),
      endDate: period.end_date.slice(0, 10),
    }
    setForm(initial)
    setInitialForm(initial)
    setFormErrors({})
    setFormError(null)
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingPeriod(null)
    setForm(INITIAL_FORM)
    setFormErrors({})
    setFormError(null)
  }

  async function submitPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending !== null || isLoading) return

    const errors = validatePeriodForm(form)
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) {
      setFormError('Revisa los campos marcados antes de guardar.')
      return
    }

    setFormError(null)
    setPending('period')
    try {
      const input: AcademicPeriodInput = {
        name: form.name.trim(),
        start_date: form.startDate,
        end_date: form.endDate,
      }

      if (editingPeriod) {
        await api.updateAcademicPeriod(editingPeriod.id, input)
        toast.success('Período actualizado', { description: `El período "${input.name}" fue modificado exitosamente.` })
      } else {
        await api.createAcademicPeriod(input)
        toast.success('Período creado', { description: `El período "${input.name}" ha sido registrado en el catálogo.` })
      }

      closeModal()
      await loadPeriods(page)
    } catch (error: unknown) {
      setFormError(getErrorMessage(error))
    } finally {
      setPending(null)
    }
  }

  async function handleConfirmToggle() {
    if (!periodToToggle || pending !== null || isLoading) return

    const { period, action } = periodToToggle
    setPageError(null)
    setPending('toggle-period')
    try {
      if (action === 'activate') {
        await api.activateAcademicPeriod(period.id)
        toast.success('Período habilitado', { description: `El período "${period.name}" fue habilitado.` })
      } else {
        await api.deactivateAcademicPeriod(period.id)
        toast.info('Período deshabilitado', { description: `Se desactivó el período "${period.name}".` })
      }
      setPeriodToToggle(null)
      await loadPeriods(page)
    } catch (error: unknown) {
      setPageError(getErrorMessage(error))
    } finally {
      setPending(null)
    }
  }

  const busy = isLoading || pending !== null
  const isFormDirty = form.name !== initialForm.name || form.startDate !== initialForm.startDate || form.endDate !== initialForm.endDate

  // Métricas KPI
  const totalPeriods = periods.length
  const activePeriods = periods.filter((p) => p.is_active).length
  const inactivePeriods = totalPeriods - activePeriods

  // Períodos filtrados por búsqueda
  const filteredPeriods = periods.filter((period) => {
    const query = searchQuery.toLowerCase().trim()
    return (
      !query ||
      period.name.toLowerCase().includes(query) ||
      period.start_date.includes(query) ||
      period.end_date.includes(query)
    )
  })

  return (
    <section className="flex flex-col gap-8" aria-labelledby="academic-periods-title">
      <AdminSectionHeader
        title="Períodos Académicos"
        description="Configura los lapsos académicos en los que se organizan las materias, tutorías y titulaciones."
        eyebrow="Calendario Institucional"
        titleId="academic-periods-title"
        actions={
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => void loadPeriods(1, { notify: true })} disabled={busy}>
              {isLoading ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
              Actualizar
            </Button>
            <Button onClick={openCreateModal} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
              <PlusIcon data-icon="inline-start" />
              Nuevo período
            </Button>
          </div>
        }
      />

      {pageError && (
        <Alert variant="destructive">
          <ShieldAlertIcon />
          <AlertTitle>No se pudieron cargar los períodos</AlertTitle>
          <AlertDescription>{pageError}</AlertDescription>
        </Alert>
      )}

      {/* Tarjetas KPI de Estadísticas */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-5 border-slate-200/80 dark:border-slate-800">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <CalendarDaysIcon className="size-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Registrados
            </span>
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {totalPeriods}
            </span>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5 border-slate-200/80 dark:border-slate-800">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <CalendarCheck2Icon className="size-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Períodos Activos
            </span>
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {activePeriods}
            </span>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5 border-slate-200/80 dark:border-slate-800">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <CalendarOffIcon className="size-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Períodos Concluidos
            </span>
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {inactivePeriods}
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
              placeholder="Buscar período por nombre o fecha…"
              className="pl-10"
            />
          </div>
        </div>

        {/* Tabla de Períodos */}
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Nombre del Período</th>
                <th className="px-5 py-3.5">Fecha Inicio</th>
                <th className="px-5 py-3.5">Fecha Finalización</th>
                <th className="px-5 py-3.5">Estado</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-4"><div className="h-5 w-36 rounded-md bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-5 py-4"><div className="h-4 w-28 rounded-md bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-5 py-4"><div className="h-4 w-28 rounded-md bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-5 py-4"><div className="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-5 py-4 text-right"><div className="ml-auto h-8 w-16 rounded-md bg-slate-200 dark:bg-slate-800" /></td>
                  </tr>
                ))
              ) : filteredPeriods.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <CalendarDaysIcon className="size-8 text-slate-300 dark:text-slate-600" />
                      <span className="font-medium">
                        {searchQuery
                          ? 'No se encontraron períodos con el término buscado.'
                          : 'Todavía no hay períodos registrados.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPeriods.map((period) => {
                  const active = isPeriodActive(period)

                  return (
                    <tr
                      key={period.id}
                      className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      {/* Nombre con icono */}
                      <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                            <CalendarIcon className="size-4" />
                          </div>
                          <span>{period.name}</span>
                        </div>
                      </td>

                      {/* Fecha Inicio */}
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                        {formatDate(period.start_date)}
                      </td>

                      {/* Fecha Fin */}
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                        {formatDate(period.end_date)}
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
                          {active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(period)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                            title="Editar período"
                          >
                            <Edit2Icon className="size-4" />
                          </button>
                          {active ? (
                            <button
                              type="button"
                              onClick={() => setPeriodToToggle({ period, action: 'deactivate' })}
                              className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                              title="Desactivar período"
                            >
                              <PowerOffIcon className="size-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPeriodToToggle({ period, action: 'activate' })}
                              className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"
                              title="Habilitar período"
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
          label="períodos"
          page={page}
          lastPage={lastPage}
          disabled={busy}
          onChange={(nextPage) => void loadPeriods(nextPage)}
        />
      </div>

      {/* Modal Dialog para Crear / Editar Período */}
      <Dialog
        open={isModalOpen}
        onClose={closeModal}
        title={editingPeriod ? 'Editar Período Académico' : 'Registrar Período Académico'}
        description={
          editingPeriod
            ? 'Modifica las fechas o el nombre del período seleccionado.'
            : 'Ingresa el nombre y el rango de fechas para el nuevo período académico.'
        }
        maxWidth="max-w-lg"
        confirmClose={isFormDirty}
      >
        <form onSubmit={submitPeriod}>
          <FieldGroup className="gap-5">
            <Field data-invalid={Boolean(formErrors.name)}>
              <FieldLabel htmlFor="academic-period-name">Nombre del período</FieldLabel>
              <Input
                id="academic-period-name"
                name="name"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Ej. PAO II 2026 o 2026-1"
                maxLength={100}
                autoComplete="off"
                disabled={busy}
                required
              />
              <FieldDescription>Ejemplo: PAO I 2026, PAO II 2026.</FieldDescription>
              <FieldError>{formErrors.name}</FieldError>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={Boolean(formErrors.startDate)}>
                <FieldLabel htmlFor="academic-period-start-date">Fecha de inicio</FieldLabel>
                <Input
                  id="academic-period-start-date"
                  name="start_date"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => updateField('startDate', e.target.value)}
                  disabled={busy}
                  required
                />
                <FieldError>{formErrors.startDate}</FieldError>
              </Field>

              <Field data-invalid={Boolean(formErrors.endDate)}>
                <FieldLabel htmlFor="academic-period-end-date">Fecha de finalización</FieldLabel>
                <Input
                  id="academic-period-end-date"
                  name="end_date"
                  type="date"
                  value={form.endDate}
                  min={form.startDate || undefined}
                  onChange={(e) => updateField('endDate', e.target.value)}
                  disabled={busy}
                  required
                />
                <FieldError>{formErrors.endDate}</FieldError>
              </Field>
            </div>

            <FieldError>{formError}</FieldError>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <DialogCancelButton onClick={closeModal} disabled={busy}>
                Cancelar
              </DialogCancelButton>
              <Button type="submit" disabled={busy} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
                {pending === 'period' && <Spinner data-icon="inline-start" />}
                {editingPeriod ? 'Guardar Cambios' : 'Registrar Período'}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Dialog>

      {/* ConfirmModal para Habilitar / Desactivar Período */}
      <ConfirmModal
        open={Boolean(periodToToggle)}
        onClose={() => setPeriodToToggle(null)}
        onConfirm={() => void handleConfirmToggle()}
        title={periodToToggle?.action === 'activate' ? '¿Habilitar período académico?' : '¿Desactivar período académico?'}
        description={
          periodToToggle?.action === 'activate'
            ? `¿Deseas habilitar el período "${periodToToggle?.period.name}"? Volverá a estar disponible en el sistema.`
            : `¿Estás seguro de desactivar el período "${periodToToggle?.period.name}"? Se marcará como inactivo en el sistema.`
        }
        confirmLabel={periodToToggle?.action === 'activate' ? 'Habilitar período' : 'Desactivar período'}
        cancelLabel="Cancelar"
        variant={periodToToggle?.action === 'activate' ? 'default' : 'destructive'}
        pending={pending === 'toggle-period'}
      />
    </section>
  )
}
