import { useState, type FormEvent } from 'react'

import { Checkbox } from '@/components/ui/checkbox'
import { FormDialog, type FormStep } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { maxCycleNumber } from '@/lib/academic-stage'
import { sanitizeCode, sanitizeLetters, formatSubjectName } from '@/lib/sanitize'
import { tutoringApi, type Subject } from '@/lib/tutoring-api'
import { CheckboxListSkeleton } from './tutoring-skeletons'
import type { useOperation, useTutoringCatalogs } from './tutoring-hooks'

const EMPTY_FORM = { career_id: '', cycle_number: '', modality_id: '', code: '', name: '', next_subject_ids: [] as string[] }

/** Formulario abierto: registrar, editar los datos o editar la secuencia en la malla. */
export type SubjectFormMode = 'create' | 'edit' | 'sequence'

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
 * Modal para registrar una asignatura de la malla, editar sus datos o su secuencia.
 * Se monta de nuevo (con `key`) cada vez que se abre, así parte de los datos actuales.
 */
export function SubjectFormDialog({ catalogs, careerId, mode, subject, careerSubjects, initialCycleNumber, operation, onClose, onSaved }: Readonly<{
  catalogs: TutoringCatalogsState
  careerId: number
  mode: SubjectFormMode | null
  /** Asignatura que se edita; `null` al registrar una nueva. */
  subject: Subject | null
  /** Asignaturas de la carrera: para elegir cuáles continúan a la abierta. */
  careerSubjects: readonly Subject[] | null
  /** Ciclo ya elegido al registrar (al agregar la asignatura desde un ciclo de la malla). */
  initialCycleNumber?: number | null
  operation: ReturnType<typeof useOperation>
  onClose: () => void
  /** Se guardó: `updated` es la asignatura editada (null al registrar). */
  onSaved: (updated: Subject | null) => Promise<void> | void
}>) {
  const editing = subject
  const [initialForm] = useState(() => editing
    ? { next_subject_ids: (editing.next_subjects ?? []).map((item) => String(item.id)), career_id: String(editing.career_id), cycle_number: editing.cycle_number ? String(editing.cycle_number) : '', modality_id: editing.modality_id ? String(editing.modality_id) : '', code: editing.code ?? '', name: editing.name }
    : { ...EMPTY_FORM, career_id: String(careerId), cycle_number: initialCycleNumber ? String(initialCycleNumber) : '' })
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
            ...(form.modality_id ? { modality_id: Number(form.modality_id) } : {}),
            next_subject_ids: form.next_subject_ids.map(Number),
          })
          return
        }
        await tutoringApi.createSubject({
          code: trimmedCode || undefined,
          name: form.name.trim(),
          career_id: careerId,
          ...(cycleNumber ? { cycle_number: cycleNumber } : {}),
          ...(form.modality_id ? { modality_id: Number(form.modality_id) } : {}),
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

  const nameReason = form.name.trim() ? null : 'El nombre de la asignatura es obligatorio.'

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
        optional
        value={form.modality_id}
        onValueChange={(value) => setForm({ ...form, modality_id: value })}
        emptyLabel="Sin modalidad"
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
    { title: 'Datos de la asignatura', blockReason: nameReason, fields: ['name', 'code', 'modality_id'], content: dataFields },
    { title: 'Ciclo', fields: ['cycle_number'], content: placementFields },
  ]

  const formTitle = mode === 'sequence' ? 'Secuencia en la malla' : editing ? 'Editar asignatura' : 'Registrar asignatura'
  const formDescription = editing
    ? (mode === 'sequence' ? formatSubjectName(editing.name) : `Modifica los datos de ${formatSubjectName(editing.name)}.`)
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
      blockReason={nameReason}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={mode === 'create' ? 'Registrar asignatura' : mode === 'sequence' ? 'Guardar secuencia' : 'Guardar cambios'}
      steps={mode === 'create' ? createSteps : undefined}
    >
      {mode === 'edit' && dataFields}
      {mode === 'sequence' && editing && (
        <NextSubjectsField
          subject={editing}
          options={careerSubjects}
          value={form.next_subject_ids}
          onChange={(ids) => setForm({ ...form, next_subject_ids: ids })}
          disabled={operation.pending}
        />
      )}
    </FormDialog>
  )
}

/**
 * Asignaturas que continúan a `subject` en la malla: el estudiante que aprueba todas
 * sus previas pasa a ellas. Se ofrecen las de ciclos posteriores de la misma carrera.
 */
function NextSubjectsField({ subject, options, value, onChange, disabled }: Readonly<{
  subject: Subject
  options: readonly Subject[] | null
  value: readonly string[]
  onChange: (ids: string[]) => void
  disabled: boolean
}>) {
  const levelOf = (item: Subject) => item.cycle_number ?? Infinity
  const ownLevel = levelOf(subject)
  const candidates = (options ?? [])
    .filter((item) => item.id !== subject.id && (value.includes(String(item.id)) || !Number.isFinite(ownLevel) || levelOf(item) > ownLevel))
    .sort((a, b) => levelOf(a) - levelOf(b) || a.name.localeCompare(b.name))
  const previous = subject.previous_subjects ?? []

  return (
    <FormField
      id="subject-next"
      label="Continúa en"
      optional
      tip="Quien aprueba esta asignatura (y las demás previas de la siguiente) queda inscrito en la tutoría de la siguiente en el nuevo período."
    >
      <div className="flex flex-col gap-2">
        {previous.length > 0 && (
          <p className="text-xs text-muted-foreground">Viene de: {previous.map((item) => formatSubjectName(item.name)).join(', ')}</p>
        )}
        {options === null ? (
          <div role="status" aria-label="Cargando asignaturas"><CheckboxListSkeleton /></div>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay asignaturas de ciclos posteriores en esta carrera.</p>
        ) : (
          <div role="group" aria-label="Asignaturas que continúan" className="flex max-h-56 flex-col gap-2 overflow-y-auto py-1">
            {candidates.map((item) => {
              const id = String(item.id)
              const level = levelOf(item)
              return (
                <label key={item.id} htmlFor={`subject-next-${item.id}`} className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <Checkbox
                    id={`subject-next-${item.id}`}
                    checked={value.includes(id)}
                    disabled={disabled}
                    onCheckedChange={(checked) => onChange(checked === true ? [...value, id] : value.filter((current) => current !== id))}
                  />
                  <span>{formatSubjectName(item.name)}{Number.isFinite(level) && <span className="text-xs text-muted-foreground"> · {level}° ciclo</span>}</span>
                </label>
              )
            })}
          </div>
        )}
        {value.length === 0 && options !== null && <p className="text-xs text-muted-foreground">Sin asignatura siguiente: aquí termina la secuencia.</p>}
      </div>
    </FormField>
  )
}
