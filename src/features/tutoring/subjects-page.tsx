import { useState, type FormEvent } from 'react'
import { PlusIcon, SaveIcon } from 'lucide-react'
import { toast } from '@/lib/toast'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FormDialog, type FormStep } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { Spinner } from '@/components/ui/spinner'
import { sanitizeCode, sanitizeLetters, formatSubjectName } from '@/lib/sanitize'
import { tutoringApi, type Subject } from '@/lib/tutoring-api'
import { CheckboxListSkeleton } from './tutoring-skeletons'
import type { useOperation, useTutoringCatalogs } from './tutoring-hooks'

const EMPTY_FORM = { career_id: '', cycle_id: '', parallel_ids: [] as string[], modality_id: '', period_id: '', code: '', name: '', next_subject_ids: [] as string[] }

/** Formulario abierto: registrar, editar los datos o editar la secuencia en la malla. */
export type SubjectFormMode = 'create' | 'edit' | 'sequence'

type TutoringCatalogsState = ReturnType<typeof useTutoringCatalogs>

/** Paralelos activos del catálogo (o, sin catálogo, los de los ciclos registrados). */
export function activeParallels(catalogs: TutoringCatalogsState): readonly { id: number; name: string; is_active: boolean }[] {
  return catalogs.sections.length > 0
    ? catalogs.sections.filter((s) => s.is_active)
    : Array.from(
        new Map(
          catalogs.cycles
            .filter((c) => c.paralelo_id && c.paralelo_name)
            .map((c) => [c.paralelo_id!, { id: c.paralelo_id!, name: c.paralelo_name!, is_active: true }]),
        ).values(),
      )
}

/**
 * Modal para registrar una asignatura de la malla, editar sus datos o su secuencia.
 * Se monta de nuevo (con `key`) cada vez que se abre, así parte de los datos actuales.
 */
export function SubjectFormDialog({ catalogs, careerId, mode, subject, careerSubjects, operation, onClose, onSaved }: Readonly<{
  catalogs: TutoringCatalogsState
  careerId: number
  mode: SubjectFormMode | null
  /** Asignatura que se edita; `null` al registrar una nueva. */
  subject: Subject | null
  /** Asignaturas de la carrera: para elegir cuáles continúan a la abierta. */
  careerSubjects: readonly Subject[] | null
  operation: ReturnType<typeof useOperation>
  onClose: () => void
  /** Se guardó: `updated` es la asignatura editada (null al registrar). */
  onSaved: (updated: Subject | null) => Promise<void> | void
}>) {
  const editing = subject
  const activePeriod = catalogs.periods.find((p) => p.is_active) ?? catalogs.periods[0]
  const [initialForm] = useState(() => editing
    ? { next_subject_ids: (editing.next_subjects ?? []).map((item) => String(item.id)), career_id: String(editing.career_id), cycle_id: '', parallel_ids: [] as string[], modality_id: editing.modality_id ? String(editing.modality_id) : '', period_id: editing.period_id ? String(editing.period_id) : (activePeriod ? String(activePeriod.id) : ''), code: editing.code ?? '', name: editing.name }
    : { ...EMPTY_FORM, career_id: String(careerId), period_id: activePeriod ? String(activePeriod.id) : '' })
  const [form, setForm] = useState(initialForm)
  const [isAddingSection, setIsAddingSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [creatingSection, setCreatingSection] = useState(false)
  const [sectionError, setSectionError] = useState<string | null>(null)

  function toggleParallel(id: string) {
    setForm((prev) => ({
      ...prev,
      parallel_ids: prev.parallel_ids.includes(id)
        ? prev.parallel_ids.filter((item) => item !== id)
        : [...prev.parallel_ids, id],
    }))
  }

  async function handleCreateSection() {
    const trimmed = newSectionName.trim()
    if (!trimmed) {
      setSectionError('El nombre del paralelo es obligatorio.')
      return
    }
    setCreatingSection(true)
    setSectionError(null)
    try {
      const created = await tutoringApi.createSection(trimmed)
      await catalogs.reload()
      setForm((prev) => ({
        ...prev,
        parallel_ids: prev.parallel_ids.includes(String(created.id))
          ? prev.parallel_ids
          : [...prev.parallel_ids, String(created.id)],
      }))
      setIsAddingSection(false)
      setNewSectionName('')
      toast.success('Paralelo creado', { description: `Se agregó "${created.name}" al catálogo de paralelos.` })
    } catch {
      setSectionError('No fue posible crear el paralelo. Intenta nuevamente.')
    } finally {
      setCreatingSection(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedCode = form.code.trim()
    const newParallel = isAddingSection && newSectionName.trim() ? newSectionName.trim() : undefined
    const selectedParallelIds = form.parallel_ids.map(Number).filter(Boolean)
    const chosenCycleId = form.cycle_id ? Number(form.cycle_id) : undefined
    const periodId = Number(form.period_id || activePeriod?.id) || undefined
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
          ...(chosenCycleId ? { cycle_id: chosenCycleId } : {}),
          ...(selectedParallelIds.length > 0 ? { parallel_ids: selectedParallelIds } : {}),
          ...(newParallel ? { new_parallel_name: newParallel } : {}),
          ...(form.modality_id ? { modality_id: Number(form.modality_id) } : {}),
          ...(periodId ? { period_id: periodId } : {}),
        })
      },
      editing ? 'Asignatura actualizada' : 'Asignatura registrada',
      async () => {
        await onSaved(updated)
      },
    )
  }

  const currentCareer = catalogs.careers.find((c) => c.id === careerId)
  const currentPeriod = activePeriod
  const careerCycles = catalogs.cycles.filter(
    (cycle) => cycle.status && cycle.career_id === careerId,
  )
  const uniqueCycleLevels = Array.from(
    new Map(careerCycles.map((c) => [c.number || c.name, c])).values(),
  ).sort((a, b) => a.number - b.number)
  const allParallels = activeParallels(catalogs)

  const nameReason = form.name.trim() ? null : 'El nombre de la asignatura es obligatorio.'

  // Lo que identifica a la asignatura va primero; el ciclo y los paralelos, después.
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
    <>
      <FormField id="subject-period" label="Período académico">
        <div className="relative flex items-center">
          <Input
            id="subject-period"
            value={currentPeriod ? currentPeriod.name : 'Sin período académico activo'}
            disabled
            readOnly
            className="pr-24"
            aria-readonly="true"
          />
          <span className="absolute right-2 text-xs text-muted-foreground">PAO actual</span>
        </div>
      </FormField>
      <SelectField
        id="subject-new-cycle"
        label="Ciclo"
        optional
        value={form.cycle_id}
        onValueChange={(value) => setForm({ ...form, cycle_id: value })}
        emptyLabel="Sin ciclo"
        placeholder="Selecciona un ciclo"
        error={operation.fieldError('cycle_id', 'cycle_ids')}
        options={uniqueCycleLevels.map((cycle) => ({ value: String(cycle.id), label: `${cycle.number}° ciclo` }))}
      />
      <FormField id="subject-parallels" label="Paralelo(s)" optional error={sectionError ?? operation.fieldError('parallel_ids', 'section_ids', 'new_parallel_name')}>
        {isAddingSection ? (
          <div className="flex items-center gap-2">
            <Input
              id="new-parallel-name"
              aria-label="Nombre del nuevo paralelo"
              value={newSectionName}
              onChange={(e) => {
                setNewSectionName(sanitizeLetters(e.target.value, 50))
                setSectionError(null)
              }}
              placeholder="Ej. B"
              maxLength={50}
              disabled={creatingSection}
              autoFocus
            />
            <Button
              type="button"
              onClick={() => void handleCreateSection()}
              disabled={creatingSection || !newSectionName.trim()}
              className="shrink-0"
            >
              {creatingSection ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
              Guardar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsAddingSection(false)
                setNewSectionName('')
                setSectionError(null)
              }}
              disabled={creatingSection}
              className="shrink-0"
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <div id="subject-parallels" className="flex flex-wrap items-center gap-2 pt-1" role="group" aria-label="Paralelos">
            {allParallels.map((parallel) => (
              <label key={parallel.id} htmlFor={`subject-parallel-${parallel.id}`} className="inline-flex cursor-pointer items-center gap-2 pr-2 text-sm">
                <Checkbox
                  id={`subject-parallel-${parallel.id}`}
                  checked={form.parallel_ids.includes(String(parallel.id))}
                  onCheckedChange={() => toggleParallel(String(parallel.id))}
                />
                {parallel.name.startsWith('Paralelo') ? parallel.name : `Paralelo ${parallel.name}`}
              </label>
            ))}
            {allParallels.length === 0 && (
              <p className="text-xs text-muted-foreground">No hay paralelos activos registrados aún.</p>
            )}
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              onClick={() => {
                setIsAddingSection(true)
                setNewSectionName('')
                setSectionError(null)
              }}
              disabled={operation.pending}
            >
              <PlusIcon data-icon="inline-start" /> Crear nuevo paralelo
            </Button>
          </div>
        )}
      </FormField>
    </>
  )

  const createSteps: readonly FormStep[] = [
    { title: 'Datos de la asignatura', blockReason: nameReason, fields: ['name', 'code', 'modality_id'], content: dataFields },
    { title: 'Ciclo y paralelos', fields: ['cycle_ids', 'section_ids'], content: placementFields },
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
      dirty={JSON.stringify(form) !== JSON.stringify(initialForm) || Boolean(newSectionName)}
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
          cycleNumber={(id) => catalogs.cycles.find((cycle) => cycle.id === id)?.number}
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
function NextSubjectsField({ subject, options, cycleNumber, value, onChange, disabled }: Readonly<{
  subject: Subject
  options: readonly Subject[] | null
  cycleNumber: (cycleId: number) => number | undefined
  value: readonly string[]
  onChange: (ids: string[]) => void
  disabled: boolean
}>) {
  const levelOf = (item: Subject) => Math.min(...item.cycle_ids.map((id) => cycleNumber(id) ?? Infinity))
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
