import { useEffect, useState, type FormEvent } from 'react'
import { Building2Icon, PencilIcon, PlusIcon, RefreshCwIcon, ShieldAlertIcon, XIcon } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ApiError, api, type Faculty } from '@/lib/api'

type FacultyFormErrors = { name?: string }
type PendingAction = 'loading' | 'faculty' | 'deactivate-faculty' | null



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
  const [nameError, setNameError] = useState<string | undefined>()
  const [pageError, setPageError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction>(null)
  const [pendingFacultyId, setPendingFacultyId] = useState<number | null>(null)

  async function loadFaculties() {
    setPageError(null)
    setPending('loading')
    setPendingFacultyId(null)
    try {
      const facultyData = await api.listFaculties()
      setFaculties(facultyData)
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

  function startFacultyEdit(faculty: Faculty) {
    setEditingFaculty(faculty)
    setName(faculty.name)
    setNameError(undefined)
    setFormError(null)
  }

  function resetFacultyForm() {
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
      if (editingFaculty) await api.updateFaculty(editingFaculty.id, { name: normalizedName })
      else await api.createFaculty({ name: normalizedName })
      resetFacultyForm()
      await loadFaculties()
    } catch (error: unknown) {
      setFormError(getErrorMessage(error))
    } finally {
      setPending(null)
      setPendingFacultyId(null)
    }
  }

  async function deactivateFaculty(faculty: Faculty) {
    if (!window.confirm(`¿Desactivar la facultad “${faculty.name}”?`)) return

    setPageError(null)
    setPending('deactivate-faculty')
    setPendingFacultyId(faculty.id)
    try {
      await api.deactivateFaculty(faculty.id)
      await loadFaculties()
    } catch (error: unknown) {
      setPageError(getErrorMessage(error))
    } finally {
      setPending(null)
      setPendingFacultyId(null)
    }
  }

  const formDisabled = pending !== null

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-[0.16em] text-brand-red uppercase">Administración académica</p>
          <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Facultades</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Organiza las facultades que sirven como base para el catálogo académico.</p>
        </div>
        <Button variant="outline" onClick={() => void loadFaculties()} disabled={formDisabled}>
          {pending === 'loading' ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
          Actualizar
        </Button>
      </div>

      {pageError && <Alert variant="destructive"><ShieldAlertIcon /><AlertTitle>No se pudieron cargar las facultades</AlertTitle><AlertDescription>{pageError}</AlertDescription></Alert>}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.35fr)]">
        <form onSubmit={submitFaculty} noValidate className="flex flex-col gap-6 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6" aria-labelledby="faculty-form-title">
          <div className="flex flex-col gap-1">
            <h3 id="faculty-form-title" className="text-lg font-semibold">{editingFaculty ? 'Editar facultad' : 'Registrar facultad'}</h3>
            <p className="text-sm text-muted-foreground">{editingFaculty ? 'Actualiza el nombre de la facultad seleccionada.' : 'Añade una facultad al catálogo institucional.'}</p>
          </div>

          <FieldGroup className="gap-5">
            <Field data-invalid={Boolean(nameError)}>
              <FieldLabel htmlFor="faculty-name">Nombre de la facultad</FieldLabel>
              <Input id="faculty-name" name="name" value={name} onChange={(event) => updateName(event.target.value)} maxLength={150} placeholder="Facultad de Ingeniería" aria-invalid={Boolean(nameError)} aria-describedby={nameError ? 'faculty-name-error' : undefined} disabled={formDisabled} required />
              <FieldError id="faculty-name-error">{nameError}</FieldError>
            </Field>
            <FieldError id="faculty-form-error">{formError}</FieldError>
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="submit" disabled={formDisabled}>{pending === 'faculty' ? <Spinner data-icon="inline-start" /> : editingFaculty ? <PencilIcon data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}{pending === 'faculty' ? 'Guardando…' : editingFaculty ? 'Guardar cambios' : 'Registrar facultad'}</Button>
              {editingFaculty && <Button type="button" variant="ghost" onClick={resetFacultyForm} disabled={formDisabled}><XIcon data-icon="inline-start" />Cancelar</Button>}
            </div>
          </FieldGroup>
        </form>

        <div className="rounded-2xl border border-border/70 bg-card shadow-sm" aria-labelledby="faculties-list-title">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
            <div className="flex items-center gap-3">
              <Building2Icon className="size-5 text-brand-red" aria-hidden="true" />
              <h3 id="faculties-list-title" className="font-semibold">Facultades registradas</h3>
            </div>
            <span className="text-xs text-muted-foreground">{faculties.length} {faculties.length === 1 ? 'facultad' : 'facultades'}</span>
          </div>
          <div className="flex flex-col" role="list" aria-busy={pending === 'loading'}>
            {pending === 'loading' ? <div className="flex items-center gap-2 px-5 py-8 text-sm text-muted-foreground" role="status"><Spinner />Cargando facultades…</div> : faculties.length === 0 ? <p className="px-5 py-8 text-sm text-muted-foreground">Todavía no hay facultades registradas.</p> : faculties.map((faculty) => <FacultyRow key={faculty.id} faculty={faculty} disabled={formDisabled} deactivating={pending === 'deactivate-faculty' && pendingFacultyId === faculty.id} onEdit={() => startFacultyEdit(faculty)} onDeactivate={() => void deactivateFaculty(faculty)} />)}
          </div>
        </div>
      </div>
    </section>
  )
}

function FacultyRow({ faculty, disabled, deactivating, onEdit, onDeactivate }: Readonly<{ faculty: Faculty; disabled: boolean; deactivating: boolean; onEdit: () => void; onDeactivate: () => void }>) {
  const active = isFacultyActive(faculty)

  return <div role="listitem" className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-4 last:border-b-0">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="truncate text-sm font-medium">{faculty.name}</p>
        <span className={`rounded-full px-2 py-1 text-[0.68rem] font-semibold ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'}`}>{active ? 'Activa' : 'Inactiva'}</span>
      </div>
      <p className="text-xs text-muted-foreground">Facultad #{faculty.id}</p>
    </div>
    {active && <div className="flex shrink-0 items-center gap-2">
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar facultad ${faculty.name}`} onClick={onEdit} disabled={disabled}><PencilIcon /></Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Desactivar facultad ${faculty.name}`} onClick={onDeactivate} disabled={disabled}>{deactivating ? <Spinner /> : <XIcon />}</Button>
    </div>}
  </div>
}
