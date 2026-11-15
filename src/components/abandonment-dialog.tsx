import { useState, type FormEvent } from 'react'
import { RotateCcwIcon, UserXIcon } from 'lucide-react'

import { ConfirmModal } from '@/components/ui/confirm-modal'
import { FieldDescription } from '@/components/ui/field'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { IconAction } from '@/components/ui/icon-action'
import { Textarea } from '@/components/ui/textarea'
import type { useOperation } from '@/features/tutoring/tutoring-hooks'

const REASON_MIN = 3
const REASON_MAX = 1000

export interface AbandonmentTarget {
  readonly name: string
  readonly is_abandoned?: boolean
  readonly abandonment_reason?: string | null
}

interface AbandonmentDialogProps {
  /** El estudiante cuyo abandono se registra o se consulta; `null` cierra el modal. */
  readonly target: AbandonmentTarget | null
  readonly subject?: string
  readonly operation: ReturnType<typeof useOperation>
  readonly onClose: () => void
  readonly onSave: (reason: string) => Promise<unknown>
  readonly onClear: () => Promise<unknown>
  /** Tras guardar o quitar con éxito: el padre cierra lo que abrió y recarga la lista. */
  readonly onChanged: () => Promise<unknown> | void
}

/**
 * Modal para registrar que un estudiante abandonó la tutoría y el motivo (texto libre).
 * Si ya figura como abandonó, muestra el motivo para corregirlo o quitar el abandono.
 */
export function AbandonmentDialog(props: Readonly<AbandonmentDialogProps>) {
  // Se monta solo mientras hay un estudiante: el motivo escrito no sobrevive a otro modal.
  return props.target ? <AbandonmentForm {...props} target={props.target} /> : null
}

function AbandonmentForm({ target, subject, operation, onClose, onSave, onClear, onChanged }: Readonly<AbandonmentDialogProps & { target: AbandonmentTarget }>) {
  const marked = Boolean(target.is_abandoned)
  const saved = target.abandonment_reason ?? ''
  const [reason, setReason] = useState(saved)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const trimmed = reason.trim()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void operation.run(() => onSave(trimmed), marked ? 'Motivo actualizado.' : 'Abandono registrado.', onChanged)
  }

  return (
    <>
      <FormDialog
        open
        title={marked ? 'Abandono de la tutoría' : 'Registrar abandono'}
        description={subject ? `${target.name} · ${subject}` : target.name}
        pending={operation.pending}
        error={operation.error}
        errorModal={operation.errorModal}
        dirty={trimmed !== saved.trim()}
        requireChanges={marked}
        blockReason={trimmed.length < REASON_MIN ? `Escribe el motivo del abandono (mínimo ${REASON_MIN} caracteres).` : null}
        headerActions={marked ? <IconAction label="Quitar abandono" icon={RotateCcwIcon} disabled={operation.pending} onClick={() => { operation.clearError(); setConfirmingClear(true) }} /> : undefined}
        onClose={() => { operation.clearError(); onClose() }}
        onSubmit={submit}
        submitLabel={marked ? 'Guardar motivo' : 'Registrar abandono'}
        submitIcon={UserXIcon}
        maxWidth="max-w-lg"
      >
        <FormField id="abandonment-reason" label="Motivo" required counter={{ current: reason.length, max: REASON_MAX }}>
          <Textarea id="abandonment-reason" maxLength={REASON_MAX} rows={4} placeholder="Ej. Consiguió trabajo y ya no puede asistir" value={reason} onChange={(event) => setReason(event.target.value)} />
        </FormField>
        <FieldDescription>Mientras figure como abandonó no se le registran notas, asistencia ni resultado final, y no avanza a la asignatura siguiente.</FieldDescription>
      </FormDialog>
      <ConfirmModal
        open={confirmingClear}
        variant="default"
        confirmIcon={RotateCcwIcon}
        title="¿Quitar el abandono?"
        description={`${target.name} volverá a recibir notas, asistencia y resultado final. Se borrará el motivo registrado.`}
        confirmLabel="Quitar abandono"
        pending={operation.pending}
        onClose={() => { if (!operation.pending) setConfirmingClear(false) }}
        onConfirm={() => void operation.run(() => onClear(), 'Abandono quitado.', async () => { setConfirmingClear(false); await onChanged() })}
      />
    </>
  )
}
