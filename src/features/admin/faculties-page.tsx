import { useEffect, useState, type FormEvent } from 'react'
import { Building2Icon, RefreshCwIcon, ShieldAlertIcon } from 'lucide-react'

import { AdminCrudLayout } from '@/components/admin/admin-crud-layout'
import { AdminFormCard } from '@/components/admin/admin-form-card'
import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogFormActions } from '@/components/admin/catalog-form-actions'
import { CatalogList } from '@/components/admin/catalog-list'
import { CatalogRow } from '@/components/admin/catalog-row'
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
      <AdminSectionHeader title="Facultades" description="Organiza las facultades que sirven como base para el catálogo académico." actions={<Button variant="outline" onClick={() => void loadFaculties()} disabled={formDisabled}>
        {pending === 'loading' ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
        Actualizar
      </Button>} />

      {pageError && <Alert variant="destructive"><ShieldAlertIcon /><AlertTitle>No se pudieron cargar las facultades</AlertTitle><AlertDescription>{pageError}</AlertDescription></Alert>}

      <AdminCrudLayout>
        <AdminFormCard title={editingFaculty ? 'Editar facultad' : 'Registrar facultad'} description={editingFaculty ? 'Actualiza el nombre de la facultad seleccionada.' : 'Añade una facultad al catálogo institucional.'} onSubmit={submitFaculty} labelledBy="faculty-form-title">
          <FieldGroup className="gap-5">
            <Field data-invalid={Boolean(nameError)}>
              <FieldLabel htmlFor="faculty-name">Nombre de la facultad</FieldLabel>
              <Input id="faculty-name" name="name" value={name} onChange={(event) => updateName(event.target.value)} maxLength={150} placeholder="Facultad de Ingeniería" aria-invalid={Boolean(nameError)} aria-describedby={nameError ? 'faculty-name-error' : undefined} disabled={formDisabled} required />
              <FieldError id="faculty-name-error">{nameError}</FieldError>
            </Field>
            <FieldError id="faculty-form-error">{formError}</FieldError>
            <CatalogFormActions editing={Boolean(editingFaculty)} pending={pending === 'faculty'} onCancel={resetFacultyForm} createLabel="Registrar facultad" />
          </FieldGroup>
        </AdminFormCard>

        <CatalogList title={`Facultades registradas · ${faculties.length}`} icon={<Building2Icon />} loading={pending === 'loading'} loadingMessage="Cargando facultades…" emptyMessage="Todavía no hay facultades registradas.">
          {faculties.map((faculty) => <CatalogRow key={faculty.id} title={faculty.name} detail={`Facultad #${faculty.id}`} active={isFacultyActive(faculty)} activeLabel="Activa" inactiveLabel="Inactiva" disabled={formDisabled} deactivating={pending === 'deactivate-faculty' && pendingFacultyId === faculty.id} onEdit={() => startFacultyEdit(faculty)} onDeactivate={() => void deactivateFaculty(faculty)} />)}
        </CatalogList>
      </AdminCrudLayout>
    </section>
  )
}
