import { useState, type FormEvent } from 'react'
import { PencilIcon, PlusIcon, StarIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Field, FieldLabel } from '@/components/ui/field'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { IconAction } from '@/components/ui/icon-action'
import { Input } from '@/components/ui/input'
import { tutoringApi, type Malla } from '@/lib/tutoring-api'
import { useOperation, type MallaSelection } from './tutoring-hooks'

const NAME_MAX = 100

/** Una malla se elimina solo vacía (sin asignaturas, estudiantes ni tutorías) y si no es la vigente. */
function canDeleteMalla(malla: Malla | undefined): boolean {
  return Boolean(malla && !malla.is_current && malla.subjects_count === 0 && malla.students_count === 0 && malla.tutorings_count === 0)
}

/**
 * Gestión de las mallas de la carrera en la malla curricular: crear una malla (opcionalmente
 * vigente), renombrar la elegida, marcarla como vigente y eliminarla si está vacía.
 * `mallas` trae lo que tiene cada malla; mientras no llega, no se ofrece eliminar.
 * `onChanged` recarga las mallas (y la carrera) antes de elegir la malla creada.
 */
export function MallaManagement({ careerId, selection, mallas, disabled = false, onChanged }: Readonly<{
  careerId: number
  selection: MallaSelection
  mallas: readonly Malla[] | null
  disabled?: boolean
  onChanged: () => Promise<void>
}>) {
  const operation = useOperation()
  const [form, setForm] = useState<{ key: number; mode: 'create' | 'rename' | null }>({ key: 0, mode: null })
  const [confirming, setConfirming] = useState<'current' | 'delete' | null>(null)
  const malla = selection.malla
  if (!malla) return null
  const selected = mallas?.find((item) => item.id === malla.id)
  const currentName = selection.mallas.find((item) => item.is_current)?.name

  function openForm(mode: 'create' | 'rename') {
    operation.clearError()
    setForm((value) => ({ key: value.key + 1, mode }))
  }

  function closeForm() {
    setForm((value) => ({ ...value, mode: null }))
  }

  function confirm() {
    if (!malla || !confirming) return
    const target = malla
    if (confirming === 'current') {
      void operation.run(
        () => tutoringApi.updateMalla(target.id, { is_current: true }),
        `«${target.name}» es ahora la malla vigente`,
        async () => { setConfirming(null); await onChanged() },
      )
      return
    }
    void operation.run(
      () => tutoringApi.deleteMalla(target.id),
      'Malla eliminada',
      async () => { setConfirming(null); selection.reset(); await onChanged() },
    )
  }

  return (
    <>
      <IconAction label="Renombrar malla" icon={PencilIcon} disabled={disabled || operation.pending} onClick={() => openForm('rename')} />
      {!malla.is_current && (
        <IconAction label="Marcar como vigente" icon={StarIcon} disabled={disabled || operation.pending} onClick={() => { operation.clearError(); setConfirming('current') }} />
      )}
      {!malla.is_current && canDeleteMalla(selected) && (
        <IconAction label="Eliminar malla" icon={Trash2Icon} tone="destructive" disabled={disabled || operation.pending} onClick={() => { operation.clearError(); setConfirming('delete') }} />
      )}
      <Button type="button" variant="secondary" size="sm" disabled={disabled || operation.pending} onClick={() => openForm('create')}>
        <PlusIcon data-icon="inline-start" />
        Nueva malla
      </Button>

      <MallaFormDialog
        key={form.key}
        careerId={careerId}
        mode={form.mode}
        malla={form.mode === 'rename' ? malla : null}
        operation={operation}
        onClose={closeForm}
        onSaved={async (created) => {
          closeForm()
          await onChanged()
          if (created) selection.select(created.id)
        }}
      />

      <ConfirmModal
        open={confirming === 'current'}
        title={`¿Marcar «${malla.name}» como vigente?`}
        description={`Los estudiantes nuevos de la carrera quedarán en esta malla.${currentName ? ` «${currentName}» dejará de ser la vigente; sus estudiantes la conservan.` : ''}`}
        confirmLabel="Marcar como vigente"
        confirmIcon={StarIcon}
        variant="default"
        pending={operation.pending}
        onClose={() => { if (!operation.pending) setConfirming(null) }}
        onConfirm={confirm}
      />
      <ConfirmModal
        open={confirming === 'delete'}
        title={`¿Eliminar «${malla.name}»?`}
        description="La malla no tiene asignaturas, estudiantes ni tutorías. Esta acción no se puede deshacer."
        confirmLabel="Eliminar malla"
        pending={operation.pending}
        onClose={() => { if (!operation.pending) setConfirming(null) }}
        onConfirm={confirm}
      />
    </>
  )
}

/** Modal para crear una malla o renombrar la elegida; se monta de nuevo (con `key`) al abrirse. */
function MallaFormDialog({ careerId, mode, malla, operation, onClose, onSaved }: Readonly<{
  careerId: number
  mode: 'create' | 'rename' | null
  malla: { id: number; name: string } | null
  operation: ReturnType<typeof useOperation>
  onClose: () => void
  /** Se guardó: `created` es la malla nueva (null al renombrar). */
  onSaved: (created: Malla | null) => Promise<void>
}>) {
  const initialName = malla?.name ?? ''
  const [name, setName] = useState(initialName)
  const [isCurrent, setIsCurrent] = useState(false)
  const creating = mode === 'create'

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    let created: Malla | null = null
    void operation.run(
      async () => {
        if (creating) {
          created = await tutoringApi.createMalla({ career_id: careerId, name: name.trim(), is_current: isCurrent })
          return
        }
        if (malla) await tutoringApi.updateMalla(malla.id, { name: name.trim() })
      },
      creating ? 'Malla creada' : 'Malla renombrada',
      () => onSaved(created),
    )
  }

  return (
    <FormDialog
      open={mode !== null}
      title={creating ? 'Nueva malla' : 'Renombrar malla'}
      description={creating ? 'Las asignaturas, los estudiantes y las tutorías de cada malla son independientes.' : undefined}
      pending={operation.pending}
      error={operation.error}
      errorModal={operation.errorModal}
      dirty={name !== initialName || isCurrent}
      blockReason={name.trim() ? null : 'El nombre de la malla es obligatorio.'}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={creating ? 'Crear malla' : 'Guardar cambios'}
    >
      <FormField id="malla-name" label="Nombre" required counter={{ current: name.length, max: NAME_MAX }} error={operation.fieldError('name')}>
        <Input id="malla-name" aria-invalid={Boolean(operation.fieldError('name'))} value={name} maxLength={NAME_MAX} required placeholder="Ej. Malla 2025" onChange={(event) => setName(event.target.value.slice(0, NAME_MAX))} />
      </FormField>
      {creating && (
        <Field orientation="horizontal">
          <Checkbox id="malla-current" checked={isCurrent} onCheckedChange={(checked) => setIsCurrent(checked === true)} />
          <FieldLabel htmlFor="malla-current">Marcar como vigente</FieldLabel>
        </Field>
      )}
    </FormDialog>
  )
}
