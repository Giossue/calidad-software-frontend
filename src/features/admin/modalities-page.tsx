import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2Icon, RefreshCwIcon, ShieldAlertIcon } from 'lucide-react'

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
import { ApiError, api, type Modality, type ModalityInput } from '@/lib/api'
type PendingAction = 'modality' | 'deactivate-modality' | null


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
  const [nameError, setNameError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [pending, setPending] = useState<PendingAction>(null)
  const [pendingModalityId, setPendingModalityId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)

  async function loadModalities(nextPage = 1) {
    setPageError(null)
    setIsLoading(true)
    try {
      const response = await api.listModalities(nextPage)
      setModalities(response.data)
      setPage(response.meta?.current_page ?? nextPage)
      setLastPage(response.meta?.last_page ?? nextPage)
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

  function startEdit(modality: Modality) {
    setEditingModality(modality)
    setName(modality.name)
    setNameError(null)
    setFormError(null)
  }

  function resetForm() {
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
      if (editingModality) await api.updateModality(editingModality.id, input)
      else await api.createModality(input)

      resetForm()
      await loadModalities(page)
    } catch (error: unknown) {
      setFormError(getErrorMessage(error))
    } finally {
      setPending(null)
      setPendingModalityId(null)
    }
  }

  async function deactivateModality(modality: Modality) {
    if (pending !== null || isLoading) return
    if (!window.confirm(`¿Desactivar la modalidad “${modality.name}”?`)) return

    setPageError(null)
    setPending('deactivate-modality')
    setPendingModalityId(modality.id)
    try {
      await api.deactivateModality(modality.id)
      await loadModalities(page)
    } catch (error: unknown) {
      setPageError(getErrorMessage(error))
    } finally {
      setPending(null)
      setPendingModalityId(null)
    }
  }

  const busy = isLoading || pending !== null

  return (
    <section className="flex flex-col gap-8" aria-labelledby="modalities-title">
      <AdminSectionHeader title="Modalidades" description="Administra las modalidades disponibles para registrar actividades académicas." titleId="modalities-title" actions={<Button variant="outline" onClick={() => void loadModalities(1)} disabled={busy}>
        {isLoading ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
        Actualizar
      </Button>} />

      {pageError && <Alert variant="destructive"><ShieldAlertIcon /><AlertTitle>No se pudieron cargar las modalidades</AlertTitle><AlertDescription>{pageError}</AlertDescription></Alert>}

      <AdminCrudLayout>
        <AdminFormCard title={editingModality ? 'Editar modalidad' : 'Registrar modalidad'} description={editingModality ? 'Actualiza el nombre de la modalidad seleccionada.' : 'Agrega una modalidad al catálogo institucional.'} onSubmit={submitModality} labelledBy="modality-form-title">
          <FieldGroup className="gap-5">
            <Field data-invalid={Boolean(nameError)}>
              <FieldLabel htmlFor="modality-name">Nombre de la modalidad</FieldLabel>
              <Input id="modality-name" name="name" value={name} onChange={(event) => updateName(event.target.value)} placeholder="Presencial" maxLength={100} autoComplete="off" aria-invalid={Boolean(nameError)} aria-describedby={nameError ? 'modality-name-error' : undefined} disabled={busy} required />
              <FieldDescription>Hasta 100 caracteres.</FieldDescription>
              <FieldError id="modality-name-error">{nameError}</FieldError>
            </Field>

            <FieldError>{formError}</FieldError>
            <CatalogFormActions editing={Boolean(editingModality)} pending={pending === 'modality'} onCancel={resetForm} />
          </FieldGroup>
        </AdminFormCard>

        <div className="flex flex-col gap-3">
          <CatalogList title="Modalidades registradas" icon={<CheckCircle2Icon />} loading={isLoading} loadingMessage="Cargando modalidades…" emptyMessage="Todavía no hay modalidades registradas.">
            {modalities.map((modality) => {
              const active = isModalityActive(modality)
              const deactivating = pending === 'deactivate-modality' && pendingModalityId === modality.id
              return <CatalogRow key={modality.id} title={modality.name} detail="Modalidad de actividad académica" active={active} deactivating={deactivating} disabled={busy} onEdit={() => startEdit(modality)} onDeactivate={() => void deactivateModality(modality)} />
            })}
          </CatalogList>
          <CatalogPagination label="modalidades" page={page} lastPage={lastPage} disabled={busy} onChange={(nextPage) => void loadModalities(nextPage)} />
        </div>
      </AdminCrudLayout>
    </section>
  )
}
