import { useCallback, useState, type FormEvent } from 'react'
import {
  CalendarDaysIcon,
  CalendarIcon,
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
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { Field, FieldCounter, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
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

function sanitizePeriodName(value: string, maxLength: number): string {
  return value.replace(/[^\p{L}\p{N}\s-]/gu, '').slice(0, maxLength)
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
  const fetchPeriods = useCallback((page: number, search: string) => api.listAcademicPeriods({ page, search }), [])
  const {
    data: periods,
    meta,
    page,
    setPage,
    searchInput,
    setSearchInput,
    isInitialLoading,
    isFetching,
    error: pageError,
    reload,
  } = usePaginatedCatalog(fetchPeriods)

  const [editingPeriod, setEditingPeriod] = useState<AcademicPeriod | null>(null)
  const [form, setForm] = useState<AcademicPeriodForm>(INITIAL_FORM)
  const [initialForm, setInitialForm] = useState<AcademicPeriodForm>(INITIAL_FORM)
  const [formErrors, setFormErrors] = useState<AcademicPeriodFormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction>(null)

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [periodToToggle, setPeriodToToggle] = useState<ToggleTarget | null>(null)

  async function handleRefresh() {
    const ok = await reload()
    if (ok) toast.success('Períodos actualizados', { description: 'El listado se actualizó correctamente.' })
  }

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
    if (pending !== null) return

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
      await reload()
    } catch (error: unknown) {
      setFormError(getErrorMessage(error))
    } finally {
      setPending(null)
    }
  }

  async function handleConfirmToggle() {
    if (!periodToToggle || pending !== null) return

    const { period, action } = periodToToggle
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
      await reload()
    } catch (error: unknown) {
      setPeriodToToggle(null)
      toast.error('No se pudo completar la acción', { description: getErrorMessage(error) })
    } finally {
      setPending(null)
    }
  }

  const formDisabled = pending !== null
  const isFormDirty = form.name !== initialForm.name || form.startDate !== initialForm.startDate || form.endDate !== initialForm.endDate

  return (
    <section className="flex flex-col gap-8" aria-labelledby="academic-periods-title">
      <AdminSectionHeader
        title="Períodos Académicos"
        description="Configura los lapsos académicos en los que se organizan las materias, tutorías y titulaciones."
        titleId="academic-periods-title"
        actions={
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => void handleRefresh()} disabled={isFetching}>
              {isFetching ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
              Actualizar
            </Button>
            <Button onClick={openCreateModal} className="bg-brand-red hover:bg-brand-red/90 text-white font-semibold">
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

      {/* Contenedor Principal: Filtro + Tabla */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-2xs">
        {/* Barra de Búsqueda */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex flex-1 items-center max-w-md">
            <SearchIcon className="absolute left-3.5 size-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar período por nombre…"
              className="pl-10"
            />
          </div>
          <p className="shrink-0 text-sm text-muted-foreground">
            Mostrando {periods.length} de {meta?.total ?? 0} períodos
          </p>
        </div>

        {/* Tabla de Períodos */}
        <div
          className={cn(
            'overflow-x-auto rounded-xl border border-border transition-opacity',
            isFetching && !isInitialLoading && 'opacity-60',
          )}
        >
          <Table>
            <TableHeader className="bg-muted text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-5 py-3.5 whitespace-normal">Nombre del Período</TableHead>
                <TableHead className="px-5 py-3.5">Fecha Inicio</TableHead>
                <TableHead className="px-5 py-3.5">Fecha Finalización</TableHead>
                <TableHead className="px-5 py-3.5">Estado</TableHead>
                <TableHead className="px-5 py-3.5 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {isInitialLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell className="px-5 py-4"><div className="h-5 w-36 rounded-md bg-muted" /></TableCell>
                    <TableCell className="px-5 py-4"><div className="h-4 w-28 rounded-md bg-muted" /></TableCell>
                    <TableCell className="px-5 py-4"><div className="h-4 w-28 rounded-md bg-muted" /></TableCell>
                    <TableCell className="px-5 py-4"><div className="h-6 w-16 rounded-full bg-muted" /></TableCell>
                    <TableCell className="px-5 py-4 text-right"><div className="ml-auto h-8 w-16 rounded-md bg-muted" /></TableCell>
                  </TableRow>
                ))
              ) : periods.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground whitespace-normal">
                    <div className="flex flex-col items-center gap-2">
                      <CalendarDaysIcon className="size-8 text-muted-foreground/50" />
                      <span className="font-medium">
                        {searchInput
                          ? 'No se encontraron períodos con el término buscado.'
                          : 'Todavía no hay períodos registrados.'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                periods.map((period) => {
                  const active = period.is_active

                  return (
                    <TableRow key={period.id}>
                      {/* Nombre con icono */}
                      <TableCell className="px-5 py-4 font-semibold text-foreground whitespace-normal">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-red/10 text-brand-red dark:bg-brand-red/20">
                            <CalendarIcon className="size-4" />
                          </div>
                          <span>{period.name}</span>
                        </div>
                      </TableCell>

                      {/* Fecha Inicio */}
                      <TableCell className="px-5 py-4 text-muted-foreground">
                        {formatDate(period.start_date)}
                      </TableCell>

                      {/* Fecha Fin */}
                      <TableCell className="px-5 py-4 text-muted-foreground">
                        {formatDate(period.end_date)}
                      </TableCell>

                      {/* Estado Pulsante */}
                      <TableCell className="px-5 py-4">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                            active
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'border-border bg-muted text-muted-foreground',
                          )}
                        >
                          <span
                            className={cn(
                              'size-1.5 rounded-full',
                              active ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground',
                            )}
                          />
                          {active ? 'Activo' : 'Inactivo'}
                        </span>
                      </TableCell>

                      {/* Acciones */}
                      <TableCell className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(period)}
                            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Editar período"
                          >
                            <Edit2Icon className="size-4" />
                          </button>
                          {active ? (
                            <button
                              type="button"
                              onClick={() => setPeriodToToggle({ period, action: 'deactivate' })}
                              className="rounded-lg p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                              title="Desactivar período"
                            >
                              <PowerOffIcon className="size-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPeriodToToggle({ period, action: 'activate' })}
                              className="rounded-lg p-2 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"
                              title="Habilitar período"
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
        <CatalogPagination
          label="períodos"
          page={page}
          lastPage={meta?.last_page ?? 1}
          disabled={isFetching}
          onChange={setPage}
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
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="academic-period-name">Nombre del período</FieldLabel>
                <FieldCounter current={form.name.length} max={100} />
              </div>
              <Input
                id="academic-period-name"
                name="name"
                value={form.name}
                onChange={(e) => updateField('name', sanitizePeriodName(e.target.value, 100))}
                placeholder="Ej. PAO II 2026 o 2026-1"
                maxLength={100}
                autoComplete="off"
                disabled={formDisabled}
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
                  disabled={formDisabled}
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
                  disabled={formDisabled}
                  required
                />
                <FieldError>{formErrors.endDate}</FieldError>
              </Field>
            </div>

            <FieldError>{formError}</FieldError>

            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              <DialogCancelButton onClick={closeModal} disabled={formDisabled}>
                Cancelar
              </DialogCancelButton>
              <Button type="submit" disabled={formDisabled} className="bg-brand-red hover:bg-brand-red/90 text-white font-semibold">
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
