import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { PlusIcon, PowerIcon } from 'lucide-react'
import { toast } from '@/lib/toast'

import { BulkImportButton } from '@/components/bulk-import-dialog'
import { AdminListSkeleton } from '@/components/admin/admin-skeletons'
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
import { SelectInput } from '@/components/ui/select-field'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { api, type AcademicPeriod, type AcademicPeriodInput } from '@/lib/api'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { useTouchedFields, visibleFieldError } from './form-helpers'

const PAO_NUMBERS = ['I', 'II', 'III'] as const
type PaoNumber = (typeof PAO_NUMBERS)[number]

type AcademicPeriodForm = {
  paoNumber: PaoNumber | ''
  year: string
  startDate: string
  endDate: string
}

type AcademicPeriodFormErrors = Partial<Record<keyof AcademicPeriodForm, string>>
type PendingAction = 'period' | 'activate-period' | null

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

type ActivationState = { allowed: true } | { allowed: false; reason: string }

/** Un período solo puede habilitarse manualmente si está vigente por fechas. */
function getActivationState(period: AcademicPeriod): ActivationState {
  const todayStr = new Date().toISOString().slice(0, 10)
  if (period.end_date.slice(0, 10) < todayStr) {
    return { allowed: false, reason: `Período finalizado el ${formatDate(period.end_date)}. No se puede reactivar.` }
  }
  if (period.start_date.slice(0, 10) > todayStr) {
    return { allowed: false, reason: `Se habilitará automáticamente en su fecha de inicio (${formatDate(period.start_date)}).` }
  }
  return { allowed: true }
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
  // Errores al enviar (o del servidor); los de validación se ven en cuanto se toca el campo.
  const [formErrors, setFormErrors] = useState<AcademicPeriodFormErrors>({})
  const { touched, touch, reset: resetTouched } = useTouchedFields<keyof AcademicPeriodForm>()
  // Error del servidor (o de validación al enviar): se muestra una vez, en línea, dentro del modal.
  const [formError, setFormError] = useState<FriendlyErrorInfo | null>(null)
  const [pending, setPending] = useState<PendingAction>(null)

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [periodToActivate, setPeriodToActivate] = useState<AcademicPeriod | null>(null)

  function updateField(field: keyof AcademicPeriodForm, value: string) {
    // Elegir el número o una fecha ya cuenta como tocar el campo; el año se marca al salir de él.
    if (field !== 'year') touch(field)
    setForm((current) => ({ ...current, [field]: value }))
    setFormError(null)
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
    resetTouched()
    setFormError(null)
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
    resetTouched()
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

    // Los errores de validación van solo bajo cada campo, sin otro recuadro.
    const errors = validatePeriodForm(form, !editingPeriod)
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setPending('period')
    setFormError(null)
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
      setFormError(friendly)
      if (friendly.field === 'name' || friendly.field === 'nombre') {
        setFormErrors((prev) => ({ ...prev, paoNumber: friendly.description }))
      }
    } finally {
      setPending(null)
    }
  }

  async function handleConfirmActivate() {
    if (!periodToActivate || pending !== null) return

    const period = periodToActivate
    setPending('activate-period')
    try {
      await api.activateAcademicPeriod(period.id)
      toast.success('Período habilitado', { description: `El período "${period.name}" fue habilitado.` })
      setPeriodToActivate(null)
      closeModal()
      await reload()
    } catch (error: unknown) {
      setPeriodToActivate(null)
      const friendly = getFriendlyError(error)
      setFormError(friendly)
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
  // "Guardar" se bloquea con el primer error de validación; sin cambios lo bloquea FormDialog.
  const liveErrors = validatePeriodForm(form, isCreating)
  const submitBlockReason = Object.values(liveErrors)[0] ?? null
  const fieldError = (field: keyof AcademicPeriodForm) => visibleFieldError(field, formErrors, liveErrors, touched)
  const activationState = editingPeriod && !editingPeriod.is_active ? getActivationState(editingPeriod) : null
  const hasFilters = searchInput.trim() !== '' || statusFilter !== ''

  // Primera carga: toda la pantalla en esqueleto; después, solo las filas al filtrar o paginar.
  if (isInitialLoading) {
    return <AdminListSkeleton label="Cargando períodos académicos" headers={['Período', 'Inicio', 'Fin', 'Estado']} />
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="academic-periods-title">
      <AdminSectionHeader
        title="Períodos académicos"
        titleId="academic-periods-title"
        description="Define el calendario académico. El período vigente es el que usan tutorías y titulación."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
            <RefreshButton onClick={() => void reload()} loading={isFetching} />
            <BulkImportButton type="academic-periods" title="Carga masiva de períodos académicos" onFinished={reload} className="flex-1 sm:flex-none" />
            <Button onClick={openCreateModal} className="w-full sm:w-auto" data-tour="page-create">
              <PlusIcon data-icon="inline-start" />
              Nuevo período
            </Button>
          </div>
        }
      />

      <ErrorNotice title="No se pudieron cargar los períodos" message={pageError} retry={reload} />

      <div className="flex flex-col gap-4">
        <FilterBar
          id="academic-periods"
          search={searchInput}
          onSearch={setSearchInput}
          searchLabel="Buscar período"
          searchPlaceholder="Buscar período por nombre…"
          filters={[
            { id: 'status', label: 'Estado', value: statusFilter, onChange: (value) => setStatusFilter(value as '' | 'active' | 'inactive'), allLabel: 'Todos los estados', options: [{ value: 'active', label: 'Activos' }, { value: 'inactive', label: 'Inactivos' }] },
          ]}
          onClear={() => { setSearchInput(''); setStatusFilter('') }}
        />

        <RecordTable
          rows={periods}
          loading={isInitialLoading}
          onRowClick={openEditModal}
          isRowSelected={(period) => editingPeriod?.id === period.id}
          empty={hasFilters ? 'No hay períodos con estos filtros.' : 'Aún no hay períodos registrados.'}
          columns={[
            { label: 'Período', render: (period) => period.name },
            { label: 'Inicio', render: (period) => <span className="text-muted-foreground">{formatDate(period.start_date)}</span> },
            { label: 'Fin', render: (period) => <span className="text-muted-foreground">{formatDate(period.end_date)}</span> },
            { label: 'Estado', render: (period) => <StatusBadge active={period.is_active} /> },
          ]}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {periods.length} de {meta?.total ?? periods.length} {(meta?.total ?? periods.length) === 1 ? 'período' : 'períodos'}
          </p>
          <CatalogPagination label="períodos" page={page} lastPage={meta?.last_page ?? 1} disabled={isFetching} onChange={setPage} />
        </div>
      </div>

      <FormDialog
        open={isModalOpen}
        onClose={closeModal}
        onSubmit={submitPeriod}
        title={editingPeriod ? 'Editar período académico' : 'Registrar período académico'}
        maxWidth="max-w-lg"
        pending={pending === 'period'}
        error={formError?.description ?? null}
        errorModal={formError}
        dirty={isFormDirty}
        blockReason={submitBlockReason}
        submitLabel={editingPeriod ? 'Guardar cambios' : 'Registrar período'}
        headerActions={
          editingPeriod ? (
            <>
              <StatusBadge active={editingPeriod.is_active} />
              {activationState?.allowed && (
                <IconAction
                  label="Habilitar como período vigente"
                  icon={PowerIcon}
                  disabled={formDisabled}
                  onClick={() => setPeriodToActivate(editingPeriod)}
                />
              )}
              {activationState && !activationState.allowed && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button type="button" variant="tertiary" size="icon" disabled aria-label="Habilitar como período vigente">
                        <PowerIcon />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{activationState.reason}</TooltipContent>
                </Tooltip>
              )}
            </>
          ) : undefined
        }
      >
        {/* Nombre del período: PAO + número romano + año */}
        <FormField
          id="period-pao-number"
          label="Nombre del período académico"
          required
          tip={composedName ? <>Se registrará como <strong>{composedName}</strong>.</> : undefined}
          error={fieldError('paoNumber') ?? fieldError('year')}
        >
          <div className="flex items-center gap-2">
            <Input value="PAO" readOnly tabIndex={-1} aria-label="Prefijo del período" className="w-16 shrink-0 text-center font-medium select-none" />
            <SelectInput
              id="period-pao-number"
              name="paoNumber"
              value={form.paoNumber}
              onValueChange={(value) => updateField('paoNumber', value)}
              options={PAO_NUMBERS.map((n) => ({ value: n, label: n }))}
              placeholder="Nº"
              disabled={formDisabled}
              invalid={Boolean(fieldError('paoNumber'))}
              className="flex-1"
            />
            <Input
              id="period-year"
              name="year"
              inputMode="numeric"
              value={form.year}
              onChange={(e) => updateField('year', e.target.value.replace(/\D/g, '').slice(0, 4))}
              onBlur={() => touch('year')}
              placeholder="Año"
              aria-label="Año del período"
              aria-invalid={Boolean(fieldError('year'))}
              maxLength={4}
              autoComplete="off"
              disabled={formDisabled}
              required
              className="flex-1"
            />
          </div>
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="academic-period-start-date" label="Fecha de inicio" required error={fieldError('startDate')}>
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
          </FormField>

          <FormField id="academic-period-end-date" label="Fecha de finalización" required error={fieldError('endDate')}>
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
          </FormField>
        </div>
      </FormDialog>

      {/* Habilitar un período; la desactivación es automática por fecha */}
      <ConfirmModal
        open={Boolean(periodToActivate)}
        onClose={() => setPeriodToActivate(null)}
        onConfirm={() => void handleConfirmActivate()}
        title="¿Habilitar período académico?"
        description={`"${periodToActivate?.name}" será el único período vigente hasta su fecha de finalización (${periodToActivate ? formatDate(periodToActivate.end_date) : ''}). Cualquier otro período que estuviera activo se cerrará automáticamente.`}
        confirmLabel="Habilitar período"
        confirmIcon={PowerIcon}
        cancelLabel="Cancelar"
        variant="default"
        pending={pending === 'activate-period'}
      />
    </section>
  )
}
