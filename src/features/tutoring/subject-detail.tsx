import { useState, type FormEvent } from 'react'
import { ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, GitBranchIcon, PencilIcon, PlusIcon, PowerOffIcon, XIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { IconAction } from '@/components/ui/icon-action'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatSubjectName, sanitizeLetters } from '@/lib/sanitize'
import { tutoringApi, type Cycle, type Subject } from '@/lib/tutoring-api'
import type { useOperation } from './tutoring-hooks'

type Operation = ReturnType<typeof useOperation>

const parallelLabel = (name: string) => (name.startsWith('Paralelo') ? name : `Paralelo ${name}`)

/**
 * Pantalla de una asignatura: se abre al pulsar su fila. Arriba lo esencial y sus
 * acciones (editar, desactivar); debajo, sus paralelos y su secuencia en la malla.
 */
export function SubjectDetail({
  subject,
  cycles,
  parallels,
  operation,
  onBack,
  onEdit,
  onEditSequence,
  onDeactivate,
  onChanged,
}: Readonly<{
  subject: Subject
  cycles: readonly Cycle[]
  parallels: readonly { id: number; name: string }[]
  operation: Operation
  onBack: () => void
  onEdit: () => void
  onEditSequence: () => void
  onDeactivate: () => void
  /** La asignatura cambió (paralelos asignados o quitados). */
  onChanged: (updated: Subject) => Promise<void> | void
}>) {
  const subjectCycle = cycles.find((cycle) => subject.cycle_ids.includes(cycle.id))
  const description = [subject.code, subjectCycle ? `${subjectCycle.number}° ciclo` : 'Sin ciclo'].filter(Boolean).join(' · ')
  const previous = subject.previous_subjects ?? []
  const next = subject.next_subjects ?? []

  return (
    <div className="flex flex-col gap-6" data-tour-view="detail">
      <div>
        <Button type="button" variant="tertiary" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" />
          Volver a la malla
        </Button>
      </div>

      <AdminSectionHeader
        title={formatSubjectName(subject.name)}
        description={description}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge active={subject.is_active} activeLabel="Activa" inactiveLabel="Inactiva" />
            {subject.is_active && (
              <>
                <Button type="button" variant="tertiary" size="icon" aria-label="Editar asignatura" disabled={operation.pending} onClick={onEdit}>
                  <PencilIcon />
                </Button>
                <Button type="button" variant="tertiary" size="icon" tone="destructive" aria-label="Desactivar asignatura" disabled={operation.pending} onClick={onDeactivate}>
                  <PowerOffIcon />
                </Button>
              </>
            )}
          </div>
        }
      />

      <Tabs defaultValue="parallels">
        <TabsList aria-label="Secciones de la asignatura">
          <TabsTrigger value="parallels">Paralelos</TabsTrigger>
          <TabsTrigger value="curriculum">Malla</TabsTrigger>
          <TabsTrigger value="data">Datos</TabsTrigger>
        </TabsList>
        <TabsContent value="parallels">
          <ParallelsPanel subject={subject} cycles={cycles} parallels={parallels} operation={operation} onChanged={onChanged} />
        </TabsContent>
        <TabsContent value="curriculum">
          <Card>
            <CardContent className="flex flex-col gap-5 pt-6">
              {/* La secuencia se lee de izquierda a derecha: de dónde viene, esta asignatura y en cuál continúa. */}
              <ol aria-label="Secuencia en la malla" className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <SequenceStep label="Viene de" names={previous.map((item) => formatSubjectName(item.name))} empty="Ninguna: inicia una secuencia." />
                <SequenceArrow />
                <SequenceStep label="Esta asignatura" names={[formatSubjectName(subject.name)]} current />
                <SequenceArrow />
                <SequenceStep label="Continúa en" names={next.map((item) => formatSubjectName(item.name))} empty="Ninguna: aquí termina la secuencia." />
              </ol>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {next.length > 0
                    ? `Al aprobarla, el estudiante pasa a la tutoría de ${next.map((item) => formatSubjectName(item.name)).join(' y ')} en el siguiente período.`
                    : 'Al aprobarla, el estudiante no pasa a otra tutoría de esta secuencia.'}
                </p>
                {subject.is_active && (
                  <Button type="button" variant="secondary" disabled={operation.pending} onClick={onEditSequence}>
                    <GitBranchIcon data-icon="inline-start" />
                    Editar secuencia
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="data">
          <dl className="grid max-w-3xl gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <Datum label="Código" value={subject.code || 'Sin código'} />
            <Datum label="Ciclo" value={subjectCycle?.name ?? 'Sin ciclo'} />
            <Datum label="Modalidad" value={subject.modality_name || 'Sin modalidad'} />
            <Datum label="Período académico" value={subject.period_name || '—'} />
          </dl>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Datum({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="[overflow-wrap:anywhere]">{value}</dd>
    </div>
  )
}

/** Paralelos asignados a la asignatura en su ciclo: se agregan y se quitan aquí mismo. */
function ParallelsPanel({ subject, cycles, parallels, operation, onChanged }: Readonly<{
  subject: Subject
  cycles: readonly Cycle[]
  parallels: readonly { id: number; name: string }[]
  operation: Operation
  onChanged: (updated: Subject) => Promise<void> | void
}>) {
  const [parallelId, setParallelId] = useState('')
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newParallelName, setNewParallelName] = useState('')

  const assignedParallels = subject.cycle_ids.map((id) => {
    const c = cycles.find((item) => item.id === id)
    const parallelName = c?.paralelo_name || (c?.paralelo_id ? `Paralelo #${c.paralelo_id}` : null)
    const label = parallelName ? parallelLabel(parallelName) : (c ? `${c.name} (General)` : `Ciclo #${id}`)
    return { key: id, cycleId: id, parallelId: c?.paralelo_id ?? null, label }
  })
  const assignedParallelIds = new Set(assignedParallels.map((p) => p.parallelId).filter((id): id is number => id !== null))
  const assignedParallelNames = new Set(assignedParallels.map((p) => p.label.replace(/^Paralelo\s+/, '').trim().toLowerCase()))
  const available = parallels.filter(
    (p) => !assignedParallelIds.has(p.id) && !assignedParallelNames.has(p.name.replace(/^Paralelo\s+/, '').trim().toLowerCase()),
  )

  function resetAdd() {
    setParallelId('')
    setNewParallelName('')
    setIsAddingNew(false)
  }

  function addParallel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const newName = isAddingNew ? newParallelName.trim() : ''
    const chosenParallelId = parallelId ? Number(parallelId) : undefined
    if (!newName && !chosenParallelId) return
    const subjectCycle = cycles.find((c) => subject.cycle_ids.includes(c.id))
    let updated: Subject | null = null

    void operation.run(
      async () => {
        updated = tutoringApi.assignSubjectParallel
          ? await tutoringApi.assignSubjectParallel(subject.id, {
              parallel_id: chosenParallelId,
              new_parallel_name: newName || undefined,
              cycle_id: subjectCycle?.id,
            })
          : await tutoringApi.assignSubjectCycle(subject.id, chosenParallelId ?? 0)
        resetAdd()
      },
      'Paralelo asignado',
      async () => { if (updated) await onChanged(updated) },
    )
  }

  function removeParallel(targetCycleId: number, targetParallelId?: number | null) {
    let updated: Subject | null = null
    void operation.run(
      async () => {
        updated = targetParallelId && tutoringApi.unassignSubjectParallel
          ? await tutoringApi.unassignSubjectParallel(subject.id, targetParallelId)
          : await tutoringApi.unassignSubjectCycle(subject.id, targetCycleId)
      },
      'Paralelo desasignado',
      async () => { if (updated) await onChanged(updated) },
    )
  }

  const canAdd = Boolean(parallelId || newParallelName.trim())

  return (
    <div className="flex flex-col gap-6">
      {assignedParallels.length > 0 ? (
        <ul aria-label="Paralelos asignados" className="flex flex-col divide-y divide-border rounded-md ring-1 ring-surface-ring">
          {assignedParallels.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
              <span>{item.label}</span>
              {subject.is_active && (
                <IconAction
                  label={`Quitar ${item.label}`}
                  icon={XIcon}
                  tone="destructive"
                  disabled={operation.pending}
                  onClick={() => removeParallel(item.cycleId, item.parallelId)}
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Esta asignatura no tiene paralelos asignados en su ciclo.</p>
      )}

      {subject.is_active && (
        <form onSubmit={addParallel} aria-label="Agregar paralelo a la asignatura" className="flex flex-col gap-3">
          {isAddingNew ? (
            <FormField id="new-subject-parallel-name" label="Nuevo paralelo" error={operation.fieldError('new_parallel_name', 'name')}>
              <div className="flex items-center gap-2">
                <Input
                  id="new-subject-parallel-name"
                  aria-invalid={Boolean(operation.fieldError('new_parallel_name', 'name'))}
                  value={newParallelName}
                  onChange={(event) => setNewParallelName(sanitizeLetters(event.target.value, 50))}
                  placeholder="Ej. C"
                  maxLength={50}
                  disabled={operation.pending}
                  autoFocus
                />
                <Button type="button" variant="secondary" className="shrink-0" disabled={operation.pending} onClick={resetAdd}>
                  Cancelar
                </Button>
              </div>
            </FormField>
          ) : (
            <>
              <SelectField
                id="subject-parallel-select"
                label="Agregar un paralelo"
                value={parallelId}
                onValueChange={setParallelId}
                placeholder={available.length === 0 ? 'Sin paralelos por asignar' : 'Selecciona un paralelo'}
                disabled={operation.pending || available.length === 0}
                error={operation.fieldError('parallel_id', 'cycle_id')}
                options={available.map((p) => ({ value: String(p.id), label: parallelLabel(p.name) }))}
              />
            </>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={!canAdd || operation.pending}>
              {operation.pending ? <Spinner data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
              Agregar paralelo
            </Button>
            {!isAddingNew && (
              <Button type="button" variant="tertiary" disabled={operation.pending} onClick={() => { setParallelId(''); setIsAddingNew(true) }}>
                <PlusIcon data-icon="inline-start" />
                Crear nuevo paralelo
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}

/** Un tramo de la secuencia: su rótulo y las asignaturas (o qué significa que no haya). */
function SequenceStep({ label, names, empty, current = false }: Readonly<{ label: string; names: readonly string[]; empty?: string; current?: boolean }>) {
  return (
    <li className={`flex min-w-0 flex-1 flex-col gap-1 rounded-md border p-3 ${current ? 'border-primary bg-accent' : 'border-border'}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {names.length > 0 ? (
        names.map((name) => <span key={name} className="text-sm">{name}</span>)
      ) : (
        <span className="text-sm text-muted-foreground">{empty}</span>
      )}
    </li>
  )
}

function SequenceArrow() {
  return (
    <li aria-hidden="true" className="flex shrink-0 justify-center text-muted-foreground">
      <ArrowRightIcon className="hidden size-4 sm:block" />
      <ArrowDownIcon className="size-4 sm:hidden" />
    </li>
  )
}
