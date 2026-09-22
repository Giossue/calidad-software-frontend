import { Children, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { CheckCircle2Icon, ChevronLeftIcon, ChevronRightIcon, PencilIcon, PlusIcon, RefreshCwIcon, ShieldAlertIcon, XIcon } from 'lucide-react'

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
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-[0.16em] text-brand-red uppercase">Administración académica</p>
          <h2 id="modalities-title" className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Modalidades</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Administra las modalidades disponibles para registrar actividades académicas.</p>
        </div>
        <Button variant="outline" onClick={() => void loadModalities(1)} disabled={busy}>
          {isLoading ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
          Actualizar
        </Button>
      </div>

      {pageError && <Alert variant="destructive"><ShieldAlertIcon /><AlertTitle>No se pudieron cargar las modalidades</AlertTitle><AlertDescription>{pageError}</AlertDescription></Alert>}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.35fr)]">
        <form onSubmit={submitModality} noValidate className="flex flex-col gap-6 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6" aria-labelledby="modality-form-title">
          <div className="flex flex-col gap-1">
            <h3 id="modality-form-title" className="text-lg font-semibold">{editingModality ? 'Editar modalidad' : 'Registrar modalidad'}</h3>
            <p className="text-sm text-muted-foreground">{editingModality ? 'Actualiza el nombre de la modalidad seleccionada.' : 'Agrega una modalidad al catálogo institucional.'}</p>
          </div>

          <FieldGroup className="gap-5">
            <Field data-invalid={Boolean(nameError)}>
              <FieldLabel htmlFor="modality-name">Nombre de la modalidad</FieldLabel>
              <Input id="modality-name" name="name" value={name} onChange={(event) => updateName(event.target.value)} placeholder="Presencial" maxLength={100} autoComplete="off" aria-invalid={Boolean(nameError)} aria-describedby={nameError ? 'modality-name-error' : undefined} disabled={busy} required />
              <FieldDescription>Hasta 100 caracteres.</FieldDescription>
              <FieldError id="modality-name-error">{nameError}</FieldError>
            </Field>

            <FieldError>{formError}</FieldError>
            <FormActions editing={Boolean(editingModality)} pending={pending === 'modality'} onCancel={resetForm} disabled={busy} />
          </FieldGroup>
        </form>

        <div className="flex flex-col gap-3">
          <CatalogList title="Modalidades registradas" icon={<CheckCircle2Icon />} loading={isLoading} emptyMessage="Todavía no hay modalidades registradas.">
            {modalities.map((modality) => {
              const active = isModalityActive(modality)
              const deactivating = pending === 'deactivate-modality' && pendingModalityId === modality.id
              return <CatalogRow key={modality.id} modality={modality} active={active} deactivating={deactivating} disabled={busy} onEdit={() => startEdit(modality)} onDeactivate={() => void deactivateModality(modality)} />
            })}
          </CatalogList>
          <PaginationControls page={page} lastPage={lastPage} disabled={busy} onChange={(nextPage) => void loadModalities(nextPage)} />
        </div>
      </div>
    </section>
  )
}

function FormActions({ editing, pending, onCancel, disabled }: Readonly<{ editing: boolean; pending: boolean; onCancel: () => void; disabled: boolean }>) {
  return <div className="flex flex-wrap justify-end gap-3"><Button type="submit" disabled={disabled}>{pending ? <Spinner data-icon="inline-start" /> : editing ? <PencilIcon data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}{pending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar'}</Button>{editing && <Button type="button" variant="ghost" onClick={onCancel} disabled={disabled}><XIcon data-icon="inline-start" />Cancelar</Button>}</div>
}

function CatalogList({ title, icon, loading, emptyMessage, children }: Readonly<{ title: string; icon: ReactNode; loading: boolean; emptyMessage: string; children: ReactNode }>) {
  return <div className="rounded-2xl border border-border/70 bg-card shadow-sm"><div className="flex items-center gap-3 border-b border-border/70 px-5 py-4"><span className="text-brand-red">{icon}</span><h3 className="font-semibold">{title}</h3></div><div className="flex flex-col" aria-live="polite">{loading && Children.count(children) === 0 ? <p className="px-5 py-8 text-sm text-muted-foreground">Cargando modalidades…</p> : Children.count(children) > 0 ? children : <p className="px-5 py-8 text-sm text-muted-foreground">{emptyMessage}</p>}</div></div>
}

function PaginationControls({ page, lastPage, disabled, onChange }: Readonly<{ page: number; lastPage: number; disabled: boolean; onChange: (page: number) => void }>) {
  if (lastPage <= 1) return null

  return <nav className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-3" aria-label="Paginación de modalidades">
    <Button variant="ghost" size="sm" onClick={() => onChange(page - 1)} disabled={disabled || page <= 1}><ChevronLeftIcon />Anterior</Button>
    <span className="text-xs text-muted-foreground">Página {page} de {lastPage}</span>
    <Button variant="ghost" size="sm" onClick={() => onChange(page + 1)} disabled={disabled || page >= lastPage}>Siguiente<ChevronRightIcon /></Button>
  </nav>
}

function CatalogRow({ modality, active, deactivating, disabled, onEdit, onDeactivate }: Readonly<{ modality: Modality; active: boolean; deactivating: boolean; disabled: boolean; onEdit: () => void; onDeactivate: () => void }>) {
  return <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-4 last:border-b-0"><div className="min-w-0"><p className="truncate text-sm font-medium">{modality.name}</p><p className="text-xs text-muted-foreground">Modalidad de actividad académica</p></div><div className="flex shrink-0 items-center gap-2"><span className={`rounded-full px-2 py-1 text-[0.68rem] font-semibold ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'}`}>{active ? 'Activo' : 'Inactivo'}</span>{active && <><Button variant="ghost" size="icon-sm" aria-label={`Editar ${modality.name}`} onClick={onEdit} disabled={disabled}><PencilIcon /></Button><Button variant="ghost" size="icon-sm" aria-label={`Desactivar ${modality.name}`} onClick={onDeactivate} disabled={disabled}>{deactivating ? <Spinner /> : <XIcon />}</Button></>}</div></div>
}
