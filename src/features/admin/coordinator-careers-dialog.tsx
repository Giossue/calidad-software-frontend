import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from '@/lib/toast'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { ErrorNotice } from '@/components/ui/error-notice'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { FormDialog } from '@/components/ui/form-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError, type Career, type User } from '@/lib/api'
import { careerLabel } from '@/lib/career-label'
import { coordinatorCareersApi } from '@/lib/coordinator-careers-api'

function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.firstValidationMessage ?? error.message
  return 'No fue posible conectar con el servidor. Inténtalo nuevamente.'
}

export function CoordinatorCareersDialog({ user, onClose, onSaved }: Readonly<{
  user: User
  onClose: () => void
  onSaved: () => void
}>) {
  const [careers, setCareers] = useState<readonly Career[]>([])
  const [selectedIds, setSelectedIds] = useState<readonly number[]>(() => user.coordinated_career_ids ?? [])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [loadVersion, setLoadVersion] = useState(0)
  const savingRef = useRef(false)
  const initialIds = user.coordinated_career_ids ?? []
  const dirty = selectedIds.length !== initialIds.length || selectedIds.some((id) => !initialIds.includes(id))
  const unavailableIds = initialIds.filter((id) => !careers.some((career) => career.id === id))

  useEffect(() => {
    const controller = new AbortController()
    void coordinatorCareersApi.listCareers(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setCareers(result)
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(describeError(error))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [loadVersion])

  function toggleCareer(id: number, checked: boolean) {
    setSelectedIds((current) => checked ? [...current, id] : current.filter((value) => value !== id))
    setSaveError(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (savingRef.current || loading || loadError || !dirty) return
    savingRef.current = true
    setPending(true)
    setSaveError(null)
    try {
      await coordinatorCareersApi.assignCareers(user.id, selectedIds)
      toast.success('Carreras asignadas actualizadas', {
        description: selectedIds.length === 0
          ? `${user.name} ya no tiene carreras asignadas.`
          : `Se guardaron las carreras de ${user.name}.`,
      })
      onSaved()
      onClose()
    } catch (error: unknown) {
      setSaveError(describeError(error))
    } finally {
      savingRef.current = false
      setPending(false)
    }
  }

  return (
    <FormDialog
      open
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      title="Asignar carreras"
      description={`Selecciona las carreras que puede coordinar ${user.name}.`}
      pending={pending}
      error={saveError}
      errorModal={saveError ? { title: 'No se pudieron guardar las carreras', description: saveError } : null}
      dirty={dirty}
      submitDisabled={loading || Boolean(loadError)}
      submitLabel="Guardar carreras"
    >
        {loading && (
          <div role="status" aria-label="Cargando carreras" className="flex flex-col gap-3">
            <Skeleton className="h-5 w-40" aria-hidden="true" />
            <Skeleton className="h-4 w-full max-w-md" aria-hidden="true" />
            <div className="flex flex-col gap-4 pt-1" aria-hidden="true">
              {['w-3/4', 'w-1/2', 'w-2/3', 'w-2/5'].map((width) => (
                <div key={width} className="flex items-center gap-3">
                  <Skeleton className="size-4 shrink-0 rounded-sm" />
                  <Skeleton className={`h-4 ${width}`} />
                </div>
              ))}
            </div>
          </div>
        )}
        <ErrorNotice
          title="No se pudieron cargar las carreras"
          message={loadError}
          retry={() => {
            setLoading(true)
            setLoadError(null)
            setLoadVersion((value) => value + 1)
          }}
        />
        {!loading && !loadError && (
          <FieldSet disabled={pending}>
            <FieldLegend className="mb-1">Carreras disponibles</FieldLegend>
            <FieldDescription className="mb-3">Puedes marcar varias. Si desmarcas todas, el coordinador perderá el acceso a la gestión de tutorías.</FieldDescription>
            {careers.length === 0 && (
              <Alert>
                <AlertTitle>No hay carreras activas</AlertTitle>
                <AlertDescription>Habilita una carrera en el catálogo académico para poder asignarla.</AlertDescription>
              </Alert>
            )}
            <FieldGroup className="max-h-72 overflow-y-auto">
              {careers.map((career) => (
                <Field key={career.id} orientation="horizontal" data-disabled={pending}>
                  <Checkbox
                    id={`coordinator-career-${career.id}`}
                    checked={selectedIds.includes(career.id)}
                    onCheckedChange={(checked) => toggleCareer(career.id, checked === true)}
                    disabled={pending}
                  />
                  <FieldLabel htmlFor={`coordinator-career-${career.id}`}>{careerLabel(career, careers)}</FieldLabel>
                </Field>
              ))}
              {unavailableIds.map((id) => (
                <Field key={id} orientation="horizontal" data-disabled={pending}>
                  <Checkbox
                    id={`coordinator-career-${id}`}
                    checked={selectedIds.includes(id)}
                    onCheckedChange={(checked) => toggleCareer(id, checked === true)}
                    disabled={pending}
                  />
                  <FieldLabel htmlFor={`coordinator-career-${id}`}>Carrera no disponible (#{id})</FieldLabel>
                </Field>
              ))}
            </FieldGroup>
            {unavailableIds.some((id) => selectedIds.includes(id)) && (
              <FieldDescription>Las asignaciones a carreras no disponibles se conservan hasta que las desmarques.</FieldDescription>
            )}
          </FieldSet>
        )}
    </FormDialog>
  )
}
