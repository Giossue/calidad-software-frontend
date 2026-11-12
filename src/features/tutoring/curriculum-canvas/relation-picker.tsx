import { useState, type FormEvent } from 'react'
import { Link2Icon } from 'lucide-react'

import { FormDialog } from '@/components/ui/form-dialog'
import { SelectField } from '@/components/ui/select-field'
import { formatSubjectName } from '@/lib/sanitize'
import type { useOperation } from '../tutoring-hooks'
import type { CanvasSubject, RelationMode } from './layout'

/**
 * Otra forma de conectar una previa sin arrastrar (teclado, pantallas táctiles): se elige la
 * otra asignatura de una lista. Solo se ofrecen las de ciclos anteriores (su previa) o
 * posteriores (de cuál es previa), igual que en el formulario de la secuencia.
 */
export function CurriculumRelationPicker({ subject, mode, subjects, operation, onClose, onPick }: Readonly<{
  subject: CanvasSubject
  mode: RelationMode
  subjects: readonly CanvasSubject[]
  operation: ReturnType<typeof useOperation>
  onClose: () => void
  onPick: (connection: { source: string; target: string }) => void
}>) {
  const [chosen, setChosen] = useState('')
  const own = subject.cycle ?? 0
  const options = subjects
    .filter((item) => item.id !== subject.id && item.cycle !== null && subject.cycle !== null)
    .filter((item) => (mode === 'requires' ? (item.cycle ?? 0) < own : (item.cycle ?? 0) > own))
    .sort((left, right) => (left.cycle ?? 0) - (right.cycle ?? 0) || left.name.localeCompare(right.name))
  const question = mode === 'requires' ? '¿Qué asignatura es su previa?' : '¿De qué asignatura es previa?'

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!chosen) return
    onPick(mode === 'requires' ? { source: chosen, target: subject.id } : { source: subject.id, target: chosen })
  }

  return (
    <FormDialog
      open
      title="Nueva previa"
      description={formatSubjectName(subject.name)}
      pending={operation.pending}
      error={operation.error}
      errorModal={operation.errorModal}
      dirty={chosen !== ''}
      blockReason={chosen ? null : 'Elige una asignatura.'}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Agregar previa"
      submitIcon={Link2Icon}
    >
      <SelectField
        id="curriculum-relation-subject"
        label={question}
        required
        value={chosen}
        onValueChange={setChosen}
        placeholder={options.length > 0 ? 'Selecciona una asignatura' : mode === 'requires' ? 'No hay asignaturas de ciclos anteriores' : 'No hay asignaturas de ciclos posteriores'}
        disabled={options.length === 0 || operation.pending}
        options={options.map((item) => ({ value: item.id, label: `${item.cycle}° ciclo · ${item.code ? `${item.code} · ` : ''}${formatSubjectName(item.name)}` }))}
      />
    </FormDialog>
  )
}
