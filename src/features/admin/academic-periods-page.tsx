import { useEffect, useState, type FormEvent } from 'react'
import { CalendarDaysIcon, RefreshCwIcon, ShieldAlertIcon } from 'lucide-react'

import { AdminCrudLayout } from '@/components/admin/admin-crud-layout'
import { AdminFormCard } from '@/components/admin/admin-form-card'
import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogFormActions } from '@/components/admin/catalog-form-actions'
import { CatalogList } from '@/components/admin/catalog-list'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { CatalogRow } from '@/components/admin/catalog-row'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ApiError, api, type AcademicPeriod, type AcademicPeriodInput } from '@/lib/api'

type AcademicPeriodForm = {
  name: string
  startDate: string
  endDate: string
}

type AcademicPeriodFormErrors = Partial<Record<keyof AcademicPeriodForm, string>>
type PendingAction = 'period' | 'deactivate-period' | null

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
  const [formErrors, setFormErrors] = useState<AcademicPeriodFormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [pending, setPending] = useState<PendingAction>(null)
  const [pendingPeriodId, setPendingPeriodId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)

  async function loadPeriods(nextPage = 1) {
    setPageError(null)
    setIsLoading(true)
    try {
      const response = await api.listAcademicPeriods(nextPage)
      setPeriods(response.data)
      setPage(response.meta?.current_page ?? nextPage)
      setLastPage(response.meta?.last_page ?? nextPage)
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

  function startEdit(period: AcademicPeriod) {
    setEditingPeriod(period)
    setForm({
      name: period.name,
      startDate: period.start_date.slice(0, 10),
      endDate: period.end_date.slice(0, 10),
    })
    setFormErrors({})
    setFormError(null)
  }

  function resetForm() {
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

      if (editingPeriod) await api.updateAcademicPeriod(editingPeriod.id, input)
      else await api.createAcademicPeriod(input)

      resetForm()
      await loadPeriods(page)
    } catch (error: unknown) {
      setFormError(getErrorMessage(error))
    } finally {
      setPending(null)
      setPendingPeriodId(null)
    }
  }

  async function deactivatePeriod(period: AcademicPeriod) {
    if (pending !== null || isLoading) return
    if (!window.confirm(`¿Desactivar el período “${period.name}”?`)) return

    setPageError(null)
    setPending('deactivate-period')
    setPendingPeriodId(period.id)
    try {
      await api.deactivateAcademicPeriod(period.id)
      await loadPeriods(page)
    } catch (error: unknown) {
      setPageError(getErrorMessage(error))
    } finally {
      setPending(null)
      setPendingPeriodId(null)
    }
  }

  const busy = isLoading || pending !== null
  const formDisabled = busy

  return (
    <section className="flex flex-col gap-8" aria-labelledby="academic-periods-title">
      <AdminSectionHeader title="Períodos académicos" description="Define los períodos en los que se organizan las actividades del sistema de calidad." titleId="academic-periods-title" actions={<Button variant="outline" onClick={() => void loadPeriods(1)} disabled={busy}>
        {isLoading ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
        Actualizar
      </Button>} />

      {pageError && <Alert variant="destructive"><ShieldAlertIcon /><AlertTitle>No se pudieron cargar los períodos</AlertTitle><AlertDescription>{pageError}</AlertDescription></Alert>}

      <AdminCrudLayout>
        <AdminFormCard title={editingPeriod ? 'Editar período' : 'Registrar período'} description={editingPeriod ? 'Actualiza las fechas del período seleccionado.' : 'Agrega un período académico al catálogo.'} onSubmit={submitPeriod} labelledBy="period-form-title">
          <FieldGroup className="gap-5">
            <Field data-invalid={Boolean(formErrors.name)}>
              <FieldLabel htmlFor="academic-period-name">Nombre del período</FieldLabel>
              <Input id="academic-period-name" name="name" value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="2026-1" maxLength={100} autoComplete="off" aria-invalid={Boolean(formErrors.name)} aria-describedby={formErrors.name ? 'academic-period-name-error' : undefined} disabled={formDisabled} required />
              <FieldDescription>Hasta 100 caracteres.</FieldDescription>
              <FieldError id="academic-period-name-error">{formErrors.name}</FieldError>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Field data-invalid={Boolean(formErrors.startDate)}>
                <FieldLabel htmlFor="academic-period-start-date">Fecha de inicio</FieldLabel>
                <Input id="academic-period-start-date" name="start_date" type="date" value={form.startDate} onChange={(event) => updateField('startDate', event.target.value)} aria-invalid={Boolean(formErrors.startDate)} aria-describedby={formErrors.startDate ? 'academic-period-start-date-error' : undefined} disabled={formDisabled} required />
                <FieldError id="academic-period-start-date-error">{formErrors.startDate}</FieldError>
              </Field>
              <Field data-invalid={Boolean(formErrors.endDate)}>
                <FieldLabel htmlFor="academic-period-end-date">Fecha de finalización</FieldLabel>
                <Input id="academic-period-end-date" name="end_date" type="date" value={form.endDate} min={form.startDate || undefined} onChange={(event) => updateField('endDate', event.target.value)} aria-invalid={Boolean(formErrors.endDate)} aria-describedby={formErrors.endDate ? 'academic-period-end-date-error' : undefined} disabled={formDisabled} required />
                <FieldError id="academic-period-end-date-error">{formErrors.endDate}</FieldError>
              </Field>
            </div>

            <FieldError>{formError}</FieldError>
            <CatalogFormActions editing={Boolean(editingPeriod)} pending={pending === 'period'} onCancel={resetForm} />
          </FieldGroup>
        </AdminFormCard>

        <div className="flex flex-col gap-3">
          <CatalogList title="Períodos registrados" icon={<CalendarDaysIcon />} loading={isLoading} loadingMessage="Cargando períodos…" emptyMessage="Todavía no hay períodos registrados.">
            {periods.map((period) => {
              const active = isPeriodActive(period)
              const deactivating = pending === 'deactivate-period' && pendingPeriodId === period.id
              return <CatalogRow key={period.id} title={period.name} detail={`${formatDate(period.start_date)} — ${formatDate(period.end_date)}`} active={active} deactivating={deactivating} disabled={busy} onEdit={() => startEdit(period)} onDeactivate={() => void deactivatePeriod(period)} />
            })}
          </CatalogList>
          <CatalogPagination label="períodos" page={page} lastPage={lastPage} disabled={busy} onChange={(nextPage) => void loadPeriods(nextPage)} />
        </div>
      </AdminCrudLayout>
    </section>
  )
}
