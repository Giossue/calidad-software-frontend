import { useCallback, useMemo, useState, type FormEvent } from 'react'
import {
  CalendarDaysIcon,
  CalendarIcon,
  Edit2Icon,
  PlusIcon,
  PowerIcon,
  PowerOffIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { ErrorModal, getFriendlyError } from '@/components/ui/error-modal'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { api, type AcademicPeriod, type AcademicPeriodInput } from '@/lib/api'
import { cn } from '@/lib/utils'
import { FilterBar } from '@/features/tutoring/filter-bar'

const PAO_NUMBERS = ['I', 'II', 'III'] as const
type PaoNumber = (typeof PAO_NUMBERS)[number]

type AcademicPeriodForm = {
  paoNumber: PaoNumber | ''
  year: string
  startDate: string
  endDate: string
}

type AcademicPeriodFormErrors = Partial<Record<keyof AcademicPeriodForm, string>>
type PendingAction = 'period' | 'toggle-period' | null
type ToggleTarget = { period: AcademicPeriod; action: 'activate' | 'deactivate' }

const INITIAL_FORM: AcademicPeriodForm = {
  paoNumber: '',
  year: '',
  startDate: '',
  endDate: '',
}

function composePeriodName(paoNumber: string, year: string): string {
  return `PAO ${paoNumber} ${year}`.trim()
}

function parsePeriodName(name: string): { paoNumber: PaoNumber | ''; year: string } {
  const match = /^PAO\s+(I{1,3})\s+(\d{4})$/.exec(name.trim())
  if (match) {
    const num = match[1] as PaoNumber
    return { paoNumber: PAO_NUMBERS.includes(num) ? num : '', year: match[2] }
  }
  return { paoNumber: '', year: '' }
}

function getPeriodDateBounds() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0')
  const minDate = `${currentYear}-${currentMonth}-01`
  const maxYear = currentYear + 2
  const maxDate = `${maxYear}-12-31`
  return { minDate, maxDate, maxYear }
}

function validatePeriodForm(form: AcademicPeriodForm, isCreating = false): AcademicPeriodFormErrors {
  const errors: AcademicPeriodFormErrors = {}

  if (!form.paoNumber) errors.paoNumber = 'Selecciona el número de PAO.'
  if (!form.year) {
    errors.year = 'El año es obligatorio.'
  } else if (!/^\d{4}$/.test(form.year)) {
    errors.year = 'Ingresa un año válido de 4 dígitos.'
  } else {
    const yearNum = Number(form.year)
    const currentYear = new Date().getFullYear()
    if (yearNum < currentYear) errors.year = `El año no puede ser anterior a ${currentYear}.`
    if (yearNum > currentYear + 2) errors.year = `El año no puede superar ${currentYear + 2}.`
  }

  const { minDate, maxDate, maxYear } = getPeriodDateBounds()

  if (!form.startDate) {
    errors.startDate = 'La fecha de inicio es obligatoria.'
  } else if (isCreating && form.startDate < minDate) {
    errors.startDate = 'La fecha de inicio no puede pertenecer a un mes anterior.'
  } else if (form.startDate > maxDate) {
    errors.startDate = `El año no puede ser mayor a ${maxYear}.`
  }

  if (!form.endDate) {
    errors.endDate = 'La fecha de finalización es obligatoria.'
  } else if (form.startDate && form.endDate < form.startDate) {
    errors.endDate = 'La fecha de finalización debe ser igual o posterior a la fecha de inicio.'
  } else if (form.endDate > maxDate) {
    errors.endDate = `El año no puede ser mayor a ${maxYear}.`
  }

  return errors
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

export function AcademicPeriodsPage() {
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('')
  const fetchPeriods = useCallback((page: number, search: string) => api.listAcademicPeriods({ page, search, status: statusFilter || undefined }), [statusFilter])
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
  } = usePaginatedCatalog(fetchPeriods, statusFilter)

  const [editingPeriod, setEditingPeriod] = useState<AcademicPeriod | null>(null)
  const [form, setForm] = useState<AcademicPeriodForm>(INITIAL_FORM)
  const [initialForm, setInitialForm] = useState<AcademicPeriodForm>(INITIAL_FORM)

  const composedName = useMemo(
    () => (form.paoNumber && form.year ? composePeriodName(form.paoNumber, form.year) : ''),
    [form.paoNumber, form.year],
  )
  const [formErrors, setFormErrors] = useState<AcademicPeriodFormErrors>({})
  const [errorModal, setErrorModal] = useState<{ open: boolean; title: string; description: string } | null>(null)
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
  }

  function openCreateModal() {
    setEditingPeriod(null)
    setForm(INITIAL_FORM)
    setInitialForm(INITIAL_FORM)
    setFormErrors({})
    setIsModalOpen(true)
  }

  function openEditModal(period: AcademicPeriod) {
    setEditingPeriod(period)
    const parsed = parsePeriodName(period.name)
    const initial: AcademicPeriodForm = {
      paoNumber: parsed.paoNumber,
      year: parsed.year || period.name,  // fallback: put raw name in year field if not parseable
      startDate: period.start_date.slice(0, 10),
      endDate: period.end_date.slice(0, 10),
    }
    setForm(initial)
    setInitialForm(initial)
    setFormErrors({})
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingPeriod(null)
    setForm(INITIAL_FORM)
    setFormErrors({})
  }

  async function submitPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending !== null) return

    const errors = validatePeriodForm(form, !editingPeriod)
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) {
      const firstErrorMessage = Object.values(errors).find(Boolean)
      setErrorModal({
        open: true,
        title: errors.startDate || errors.endDate ? 'Fecha no válida' : (errors.paoNumber || errors.year) ? 'Nombre de período no válido' : 'Revisa los campos requeridos',
        description: firstErrorMessage || 'Hay datos incompletos o fechas incorrectas en el período académico. Por favor, revísalos antes de continuar.',
      })
      return
    }

    setPending('period')
    try {
      const input: AcademicPeriodInput = {
        name: composedName,
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
      const friendly = getFriendlyError(error)
      setErrorModal({
        open: true,
        title: friendly.title,
        description: friendly.description,
      })
      if (friendly.field === 'name' || friendly.field === 'nombre') {
        setFormErrors((prev) => ({ ...prev, paoNumber: friendly.description }))
      }
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
  const isFormDirty =
    form.paoNumber !== initialForm.paoNumber ||
    form.year !== initialForm.year ||
    form.startDate !== initialForm.startDate ||
    form.endDate !== initialForm.endDate
  const isCreating = editingPeriod === null
  const { minDate, maxDate } = getPeriodDateBounds()

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
      <div className="flex flex-col gap-4">
        <FilterBar
          id="academic-periods"
          search={searchInput}
          onSearch={setSearchInput}
          searchLabel="Buscar período"
          searchPlaceholder="Buscar período por nombre…"
          filters={[
            { id: 'status', label: 'Estado', value: statusFilter, onChange: (value) => setStatusFilter(value as '' | 'active' | 'inactive'), allLabel: 'Todos', options: [{ value: 'active', label: 'Activos' }, { value: 'inactive', label: 'Inactivos' }] },
          ]}
          onClear={() => { setSearchInput(''); setStatusFilter('') }}
        />

        {/* Tabla de Períodos */}
        <div
          className={cn(
            'overflow-hidden rounded-xl border bg-card transition-opacity max-md:overflow-visible max-md:border-0 max-md:bg-transparent',
            isFetching && !isInitialLoading && 'opacity-60',
          )}
        >
          <Table stacked cardTitle>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre del Período</TableHead>
                <TableHead>Fecha Inicio</TableHead>
                <TableHead>Fecha Finalización</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isInitialLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell><div className="h-5 w-36 rounded-md bg-slate-200 dark:bg-slate-800" /></TableCell>
                    <TableCell><div className="h-4 w-28 rounded-md bg-slate-200 dark:bg-slate-800" /></TableCell>
                    <TableCell><div className="h-4 w-28 rounded-md bg-slate-200 dark:bg-slate-800" /></TableCell>
                    <TableCell><div className="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-800" /></TableCell>
                    <TableCell><div className="ml-auto h-8 w-16 rounded-md bg-slate-200 dark:bg-slate-800" /></TableCell>
                  </TableRow>
                ))
              ) : periods.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="py-12 text-center text-slate-500 dark:text-slate-400 whitespace-normal">
                    <div className="flex flex-col items-center gap-2">
                      <CalendarDaysIcon className="size-8 text-slate-300 dark:text-slate-600" />
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
                      <TableCell className="font-semibold text-slate-900 dark:text-white whitespace-normal">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-red/10 text-brand-red dark:bg-brand-red/20 dark:text-brand-red-contrast">
                            <CalendarIcon className="size-4" />
                          </div>
                          <span>{period.name}</span>
                        </div>
                      </TableCell>

                      {/* Fecha Inicio */}
                      <TableCell className="text-slate-600 dark:text-slate-300">
                        {formatDate(period.start_date)}
                      </TableCell>

                      {/* Fecha Fin */}
                      <TableCell className="text-slate-600 dark:text-slate-300">
                        {formatDate(period.end_date)}
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
                          {active ? 'Activo' : 'Inactivo'}
                        </span>
                      </TableCell>

                      {/* Acciones */}
                      <TableCell>
                        <div className="flex items-center gap-1">
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
            Mostrando {periods.length} de {meta?.total ?? periods.length} {meta?.total ?? periods.length === 1 ? 'período' : 'períodos'}
          </p>
          <CatalogPagination
            label="períodos"
            page={page}
            lastPage={meta?.last_page ?? 1}
            disabled={isFetching}
            onChange={setPage}
          />
        </div>
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
            {/* Nombre del período: PAO + número + año */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <FieldLabel className="mb-3 block">Nombre del período académico</FieldLabel>
              <div className="flex items-center gap-2">
                {/* Prefijo fijo: PAO */}
                <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 select-none">
                  PAO
                </div>

                {/* Selector de número romano */}
                <Field data-invalid={Boolean(formErrors.paoNumber)} className="flex-1">
                  <NativeSelect
                    id="period-pao-number"
                    name="paoNumber"
                    value={form.paoNumber}
                    onChange={(e) => updateField('paoNumber', e.target.value)}
                    disabled={formDisabled}
                    required
                  >
                    <option value="">Nº</option>
                    {PAO_NUMBERS.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </NativeSelect>
                  <FieldError>{formErrors.paoNumber}</FieldError>
                </Field>

                {/* Campo de año */}
                <Field data-invalid={Boolean(formErrors.year)} className="flex-1">
                  <Input
                    id="period-year"
                    name="year"
                    inputMode="numeric"
                    value={form.year}
                    onChange={(e) => updateField('year', e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="Año"
                    maxLength={4}
                    autoComplete="off"
                    disabled={formDisabled}
                    required
                  />
                  <FieldError>{formErrors.year}</FieldError>
                </Field>
              </div>

              {/* Preview del nombre generado */}
              {composedName && (
                <FieldDescription className="mt-2">
                  El período se registrará como: <strong>{composedName}</strong>
                </FieldDescription>
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={Boolean(formErrors.startDate)}>
                <FieldLabel htmlFor="academic-period-start-date">Fecha de inicio</FieldLabel>
                <Input
                  id="academic-period-start-date"
                  name="start_date"
                  type="date"
                  min={isCreating ? minDate : undefined}
                  max={maxDate}
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
                  min={form.startDate || (isCreating ? minDate : undefined)}
                  max={maxDate}
                  value={form.endDate}
                  onChange={(e) => updateField('endDate', e.target.value)}
                  disabled={formDisabled}
                  required
                />
                <FieldError>{formErrors.endDate}</FieldError>
              </Field>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
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
