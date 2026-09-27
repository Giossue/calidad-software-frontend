import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { ApiError, type Career, type User } from '@/lib/api'
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
    <Dialog
      open
      onClose={() => { if (!savingRef.current) onClose() }}
      title="Asignar carreras"
      description={`Selecciona las carreras que puede coordinar ${user.name}.`}
      confirmClose={dirty && !pending}
      confirmCloseDescription="Los cambios en las carreras asignadas todavía no se han guardado."
    >
      <form onSubmit={(event) => void submit(event)} aria-label="Asignar carreras" aria-busy={loading || pending}>
        <FieldGroup>
          {loading && <p role="status" className="flex items-center gap-2"><Spinner aria-hidden="true" /> Cargando carreras…</p>}
          {loadError && (
            <Alert variant="destructive">
              <AlertTitle>No se pudieron cargar las carreras</AlertTitle>
              <AlertDescription>
                <p>{loadError}</p>
                <Button type="button" variant="outline" onClick={() => {
                  setLoading(true)
                  setLoadError(null)
                  setLoadVersion((value) => value + 1)
                }}>
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {!loading && !loadError && (
            <FieldSet disabled={pending}>
              <FieldLegend>Carreras disponibles</FieldLegend>
              <FieldDescription id="coordinator-careers-help">
                Puedes seleccionar varias carreras. Si desmarcas todas, el coordinador perderá el acceso a la gestión de tutorías.
              </FieldDescription>
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
                      aria-describedby="coordinator-careers-help"
                    />
                    <FieldLabel htmlFor={`coordinator-career-${career.id}`}>{career.name}</FieldLabel>
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
          {saveError && (
            <Alert variant="destructive">
              <AlertTitle>No se pudieron guardar las carreras</AlertTitle>
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <DialogCancelButton disabled={pending}>Cancelar</DialogCancelButton>
            <Button type="submit" disabled={loading || pending || Boolean(loadError) || !dirty}>
              {pending && <Spinner data-icon="inline-start" aria-hidden="true" />}
              {pending ? 'Guardando…' : 'Guardar carreras'}
            </Button>
          </div>
        </FieldGroup>
      </form>
    </Dialog>
  )
}
