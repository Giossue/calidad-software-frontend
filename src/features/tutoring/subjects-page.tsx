import { useState, type FormEvent } from 'react'

import { FormDialog, type FormStep } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { maxCycleNumber } from '@/lib/academic-stage'
import { sanitizeCode, sanitizeLetters, formatSubjectName } from '@/lib/sanitize'
import { tutoringApi, type Subject } from '@/lib/tutoring-api'
import type { useOperation, useTutoringCatalogs } from './tutoring-hooks'

const EMPTY_FORM = { career_id: '', cycle_number: '', modality_id: '', code: '', name: '' }

/** Formulario abierto: registrar o editar los datos. Las previas se conectan en el lienzo de la malla. */
export type SubjectFormMode = 'create' | 'edit'

type TutoringCatalogsState = ReturnType<typeof useTutoringCatalogs>

/**
 * Números de ciclo de la carrera (1 … último), para ubicar una asignatura en la malla. La
 * asignatura no lleva paralelos: el paralelo se elige al crear cada tutoría del período.
 */
export function careerCycleNumbers(catalogs: Pick<TutoringCatalogsState, 'careers' | 'cycles'>, careerId: number): number[] {
  const career = catalogs.careers.find((item) => item.id === careerId)
  const last = Math.max(career?.cycle_levels ?? 0, maxCycleNumber(catalogs.cycles.filter((cycle) => cycle.career_id === careerId)) ?? 0)
  return Array.from({ length: last }, (_, index) => index + 1)
}

/**
 * Modal para registrar una asignatura de la malla o editar sus datos. Toda asignatura
 * tiene modalidad (no existe «Sin modalidad»): al registrar parte de la de la carrera.
 * Se monta de nuevo (con `key`) cada vez que se abre, así parte de los datos actuales.
 */
export function SubjectFormDialog({ catalogs, careerId, mode, subject, initialCycleNumber, operation, onClose, onSaved }: Readonly<{
  catalogs: TutoringCatalogsState
  careerId: number
  mode: SubjectFormMode | null
  /** Asignatura que se edita; `null` al registrar una nueva. */
  subject: Subject | null
  /** Ciclo ya elegido al registrar (al agregar la asignatura desde un ciclo de la malla). */
  initialCycleNumber?: number | null
  operation: ReturnType<typeof useOperation>
  onClose: () => void
  /** Se guardó: `updated` es la asignatura editada (null al registrar). */
  onSaved: (updated: Subject | null) => Promise<void> | void
}>) {
  const editing = subject
  const careerModalityId = catalogs.careers.find((item) => item.id === careerId)?.modality_id
  const [initialForm] = useState(() => editing
    ? { career_id: String(editing.career_id), cycle_number: editing.cycle_number ? String(editing.cycle_number) : '', modality_id: editing.modality_id ? String(editing.modality_id) : '', code: editing.code ?? '', name: editing.name }
    : { ...EMPTY_FORM, career_id: String(careerId), cycle_number: initialCycleNumber ? String(initialCycleNumber) : '', modality_id: careerModalityId ? String(careerModalityId) : '' })
  const [form, setForm] = useState(initialForm)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedCode = form.code.trim()
    const cycleNumber = Number(form.cycle_number) || undefined
    let updated: Subject | null = null

    void operation.run(
      async () => {
        if (editing) {
          updated = await tutoringApi.updateSubject(editing.id, {
            code: trimmedCode ? trimmedCode : null,
            name: form.name.trim(),
            modality_id: Number(form.modality_id),
          })
          return
        }
        await tutoringApi.createSubject({
          code: trimmedCode || undefined,
          name: form.name.trim(),
          career_id: careerId,
          ...(cycleNumber ? { cycle_number: cycleNumber } : {}),
          modality_id: Number(form.modality_id),
        })
      },
      editing ? 'Asignatura actualizada' : 'Asignatura registrada',
      async () => {
        await onSaved(updated)
      },
    )
  }

  const currentCareer = catalogs.careers.find((c) => c.id === careerId)
  const cycleNumbers = careerCycleNumbers(catalogs, careerId)
  const lastCycle = cycleNumbers.at(-1)

  const dataReason = !form.name.trim()
    ? 'El nombre de la asignatura es obligatorio.'
    : !form.modality_id ? 'Elige la modalidad de la asignatura.' : null

  // Lo que identifica a la asignatura va primero; el ciclo, después.
  const dataFields = (
    <>
      <FormField id="subject-name" label="Nombre" required counter={{ current: form.name.length, max: 150 }} error={operation.fieldError('name')}>
        <Input id="subject-name" aria-invalid={Boolean(operation.fieldError('name'))} value={form.name} onChange={(event) => setForm({ ...form, name: sanitizeLetters(event.target.value, 150).toLocaleUpperCase('es') })} required maxLength={150} placeholder="Ej. ALGORITMOS Y LÓGICA DE PROGRAMACIÓN" />
      </FormField>
      <FormField id="subject-code" label="Código" optional counter={form.code.length > 0 ? { current: form.code.length, max: 30 } : undefined} error={operation.fieldError('code')}>
        <Input id="subject-code" aria-invalid={Boolean(operation.fieldError('code'))} value={form.code} onChange={(event) => setForm({ ...form, code: sanitizeCode(event.target.value, 30) })} maxLength={30} placeholder="Ej. SW-B1-001" />
      </FormField>
      <SelectField
        id="subject-modality"
        label="Modalidad"
        required
        value={form.modality_id}
        onValueChange={(value) => setForm({ ...form, modality_id: value })}
        placeholder="Selecciona una modalidad"
        error={operation.fieldError('modality_id')}
        options={catalogs.modalities
          .filter((modality) => modality.is_active || String(modality.id) === form.modality_id)
          .map((modality) => ({ value: String(modality.id), label: `${modality.name}${modality.is_active ? '' : ' (inactiva)'}` }))}
      />
    </>
  )

  const placementFields = (
    <SelectField
      id="subject-new-cycle"
      label="Ciclo"
      optional
      value={form.cycle_number}
      onValueChange={(value) => setForm({ ...form, cycle_number: value })}
      emptyLabel="Sin ciclo"
      placeholder="Selecciona un ciclo"
      error={operation.fieldError('cycle_number')}
      options={cycleNumbers.map((number) => ({ value: String(number), label: `${number}° ciclo${number === lastCycle ? ' · Titulación' : ''}` }))}
    />
  )

  const createSteps: readonly FormStep[] = [
    { title: 'Datos de la asignatura', blockReason: dataReason, fields: ['name', 'code', 'modality_id'], content: dataFields },
    { title: 'Ciclo', fields: ['cycle_number'], content: placementFields },
  ]

  const formTitle = editing ? 'Editar asignatura' : 'Registrar asignatura'
  const formDescription = editing
    ? `Modifica los datos de ${formatSubjectName(editing.name)}.`
    : currentCareer ? `Carrera: ${currentCareer.name}` : undefined

  return (
    <FormDialog
      open={mode !== null}
      title={formTitle}
      description={formDescription}
      pending={operation.pending}
      error={operation.error}
      errorModal={operation.errorModal}
      dirty={JSON.stringify(form) !== JSON.stringify(initialForm)}
      blockReason={dataReason}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={mode === 'create' ? 'Registrar asignatura' : 'Guardar cambios'}
      steps={mode === 'create' ? createSteps : undefined}
    >
      {mode === 'edit' && dataFields}
    </FormDialog>
  )
}
