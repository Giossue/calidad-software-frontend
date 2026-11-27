import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { MinusIcon, SaveIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice } from '@/components/ui/error-notice'
import { compareNames } from '@/lib/format'
import { isValidGrade, sanitizeGradeInput } from '@/lib/grade-input'
import { teacherApi, type Enrollment, type FinalResult, type GradeSettings, type GradeType, type TeacherTutoring } from '@/lib/teacher-api'
import { jointGroup, ownGroup, type ClassGroup } from './joint-groups'
import { JointNotice } from './joint-notice'
import { TeacherEmpty } from './teacher-shared'
import { GradesTabSkeleton } from './teacher-skeletons'

const GRADE_FIELDS = [
  { type: 'diagnostic', label: 'Diagnóstico' },
  { type: 'partial', label: 'Parcial 1' },
  { type: 'partial_two', label: 'Parcial 2' },
] as const satisfies readonly { type: GradeType; label: string }[]

// Las tres notas quedan abiertas: el docente carga o corrige cualquiera cuando la tiene.
type Values = Readonly<Record<GradeType, string>>
type Grid = Readonly<Record<number, Values>>

const EMPTY_VALUES: Values = { diagnostic: '', partial: '', partial_two: '' }

function serverValues(student: Enrollment): Values {
  return { diagnostic: student.diagnostic_grade ?? '', partial: student.partial_grade ?? '', partial_two: student.second_partial_grade ?? '' }
}

type Evolution =
  | { status: 'up'; delta: number; label: string; title: string }
  | { status: 'down'; delta: number; label: string; title: string }
  | { status: 'same'; delta: number; label: string; title: string }
  | { status: 'pending'; label: string; title: string }
  | { status: 'no_p1'; label: string; title: string }

// La evolución compara solo los parciales: la nota diagnóstica no entra en el cálculo.
function computeEvolution(partialOneStr: string, partialTwoStr: string): Evolution {
  const p1Num = Number(partialOneStr)
  if (!partialOneStr || Number.isNaN(p1Num)) {
    return { status: 'no_p1', label: '—', title: 'Sin calificación del Parcial 1 registrada' }
  }

  const p2Num = Number(partialTwoStr)
  if (!partialTwoStr || Number.isNaN(p2Num)) {
    return { status: 'pending', label: 'Pendiente P2', title: 'Pendiente calificación del Parcial 2' }
  }

  const delta = Math.round((p2Num - p1Num) * 100) / 100
  if (delta > 0) {
    return {
      status: 'up',
      delta,
      label: `+${delta.toFixed(2)}`,
      title: `Evolución positiva: subió ${delta.toFixed(2)} puntos desde Parcial 1 (${p1Num.toFixed(2)}) hasta Parcial 2 (${p2Num.toFixed(2)})`,
    }
  }
  if (delta < 0) {
    return {
      status: 'down',
      delta,
      label: `${delta.toFixed(2)}`,
      title: `Evolución negativa: bajó ${Math.abs(delta).toFixed(2)} puntos desde Parcial 1 (${p1Num.toFixed(2)}) hasta Parcial 2 (${p2Num.toFixed(2)})`,
    }
  }
  return {
    status: 'same',
    delta: 0,
    label: '0.00',
    title: `Sin variación: misma nota en Parcial 1 (${p1Num.toFixed(2)}) y Parcial 2 (${p2Num.toFixed(2)})`,
  }
}

// --- Borrador: lo escrito se conserva aunque el docente salga de la página, hasta que guarde. ---

const draftKey = (tutoringId: number) => `grades-draft:${tutoringId}`

function readDraft(tutoringId: number): Grid | null {
  try {
    const raw = sessionStorage.getItem(draftKey(tutoringId))
    return raw ? JSON.parse(raw) as Grid : null
  } catch {
    return null
  }
}
function writeDraft(tutoringId: number, grid: Grid) {
  try { sessionStorage.setItem(draftKey(tutoringId), JSON.stringify(grid)) } catch { /* sin almacenamiento: el formulario sigue funcionando */ }
}
function clearDraft(tutoringId: number) {
  try { sessionStorage.removeItem(draftKey(tutoringId)) } catch { /* nada que limpiar */ }
}

// "9" o "9.4" se completan a dos decimales al salir de la casilla ("9.00", "9.40").
function normalize(value: string): string {
  return /^\d{1,2}(\.\d{0,2})?$/.test(value) ? Number(value).toFixed(2) : value
}

function groupFor(value: string, settings: GradeSettings): string | null {
  if (!isValidGrade(value, settings.maximum)) return null
  const number = Number(value)
  return settings.groups.find((group) => number >= group.min && number <= group.max)?.label ?? null
}

// --- Panel ---

/** La tabla de notas (#, estudiante, tres notas, evolución y estado), siempre editable. */
export function GradesPanel({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  const resource = useDegreeResource(async () => {
    const [students, settings, joints] = await Promise.all([teacherApi.allStudents(tutoring.id), teacherApi.gradeSettings(), teacherApi.jointTutorings(tutoring.id)])
    // Clase conjunta: los grupos de la misma asignatura a la misma hora se califican juntos.
    const joint = await Promise.all(joints.filter((item) => item.can_manage).map(async (item) => ({ group: jointGroup(item), students: await teacherApi.allStudents(item.id) })))
    return { students, settings, joint }
  }, String(tutoring.id))

  return <div className="flex flex-col gap-5">
    <ErrorNotice message={resource.error} retry={resource.reload} />
    {resource.loading ? <GradesTabSkeleton /> : resource.data && <GradesForm tutoring={tutoring} {...resource.data} onSaved={resource.reload} />}
  </div>
}

type GradesTableMeta = {
  grid: Grid
  saved: Grid
  settings: GradeSettings
  editable: boolean
  disabled: boolean
  onChange: (studentId: number, type: GradeType, value: string) => void
}

/** Problema de una casilla: fuera de la escala, o vacía cuando ya tenía una nota guardada (no se borra). */
function cellProblem(value: string, savedValue: string, maximum: number): string | null {
  if (value === '') return savedValue ? 'Una nota guardada no se puede dejar vacía.' : null
  return isValidGrade(value, maximum) ? null : `Escribe una nota de 0 a ${maximum}, con hasta dos decimales.`
}

const STATE_LABELS: Record<FinalResult, string> = { approved: 'Aprobó', failed: 'Reprobó' }

// Columnas estables: el estado llega por `meta` para que las casillas no se remonten (y pierdan el foco) al escribir.
const GRADE_COLUMNS: ColumnDef<Enrollment>[] = [
  { id: 'number', header: '#', cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.index + 1}</span> },
  { id: 'name', header: 'Apellidos y nombres', cell: ({ row }) => row.original.name },
  ...GRADE_FIELDS.map(({ type, label }): ColumnDef<Enrollment> => ({
    id: type,
    header: () => <div className="text-center">{label}</div>,
    cell: ({ row, table }) => {
      const meta = table.options.meta as GradesTableMeta
      if (!meta.editable) return <div className="text-center tabular-nums text-muted-foreground">{meta.saved[row.original.id]?.[type] || '—'}</div>
      const value = meta.grid[row.original.id]?.[type] ?? ''
      const savedValue = meta.saved[row.original.id]?.[type] ?? ''
      const problem = cellProblem(value, savedValue, meta.settings.maximum)
      return <div className="flex flex-col items-center gap-1">
        <Input
          className="h-9 w-24 text-center tabular-nums"
          inputMode="decimal"
          autoComplete="off"
          maxLength={5}
          placeholder="—"
          data-grade-column={type}
          data-changed={value !== savedValue ? 'true' : undefined}
          aria-label={`${label} de ${row.original.name}`}
          aria-invalid={problem !== null}
          title={problem ?? undefined}
          value={value}
          disabled={meta.disabled}
          onChange={(event) => meta.onChange(row.original.id, type, sanitizeGradeInput(event.target.value, value, meta.settings.maximum))}
          onBlur={() => { if (value !== '') meta.onChange(row.original.id, type, normalize(value)) }}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => focusNextRow(event, type)}
        />
        {type === 'diagnostic' && value && groupFor(value, meta.settings) && (
          <span className="text-xs text-success">{groupFor(value, meta.settings)}</span>
        )}
      </div>
    },
  })),
  {
    id: 'evolution',
    header: () => <div className="text-center">Evolución (P1 → P2)</div>,
    cell: ({ row, table }) => {
      const meta = table.options.meta as GradesTableMeta
      // Se calcula con las notas guardadas: lo escrito y no guardado no cuenta como evolución.
      const p1Str = meta.saved[row.original.id]?.partial ?? ''
      const p2Str = meta.saved[row.original.id]?.partial_two ?? ''
      const evo = computeEvolution(p1Str, p2Str)

      const icon = evo.status === 'up' ? <TrendingUpIcon aria-hidden="true" /> : evo.status === 'down' ? <TrendingDownIcon aria-hidden="true" /> : evo.status === 'same' ? <MinusIcon aria-hidden="true" /> : null
      const tone = evo.status === 'up' ? 'text-success' : evo.status === 'down' ? 'text-destructive' : 'text-muted-foreground'
      // El detalle del cálculo se lee en un tooltip; la celda muestra solo la diferencia.
      // La diferencia es un valor (texto con su color); «Pendiente P2» es un estado (badge).
      return (
        <div className="flex justify-center">
          <Tooltip>
            <TooltipTrigger asChild>
              {evo.status === 'pending'
                ? <span tabIndex={0} className="inline-flex"><Badge variant="warning">{evo.label}</Badge></span>
                : evo.status === 'no_p1'
                ? <span tabIndex={0} className="text-xs text-muted-foreground">{evo.label}</span>
                : <span tabIndex={0} className={`inline-flex items-center gap-1 text-sm tabular-nums [&>svg]:size-4 ${tone}`}>{icon}<span>{evo.label}</span></span>}
            </TooltipTrigger>
            <TooltipContent>{evo.title}</TooltipContent>
          </Tooltip>
        </div>
      )
    },
  },
  {
    id: 'state',
    header: 'Estado',
    cell: ({ row }) => {
      // Se calcula solo con los dos parciales guardados (promedio frente a la nota mínima); no se elige a mano.
      const student = row.original
      const state = student.suggested_result ?? student.final_result ?? null
      if (!state) return <Tooltip>
        <TooltipTrigger asChild><span tabIndex={0} className="inline-flex"><Badge variant="neutral">Pendiente</Badge></span></TooltipTrigger>
        <TooltipContent>Se calcula al guardar el Parcial 1 y el Parcial 2.</TooltipContent>
      </Tooltip>
      return <Badge variant={state === 'approved' ? 'success' : 'danger'}>{STATE_LABELS[state]}</Badge>
    },
  },
]

// Enter baja a la casilla de abajo en la misma columna, para cargar una columna completa sin usar el mouse.
function focusNextRow(event: KeyboardEvent<HTMLInputElement>, type: GradeType) {
  if (event.key !== 'Enter') return
  event.preventDefault()
  const inputs = Array.from(event.currentTarget.form?.querySelectorAll<HTMLInputElement>(`input[data-grade-column="${type}"]`) ?? [])
  inputs[inputs.indexOf(event.currentTarget) + 1]?.focus()
}

const activeStudents = (students: readonly Enrollment[]) =>
  students.filter((student) => student.is_active && student.student_is_active && !student.is_abandoned).sort((a, b) => compareNames(a.name, b.name))

function GradesForm({ tutoring, students, settings, joint, onSaved }: Readonly<{
  tutoring: TeacherTutoring
  students: readonly Enrollment[]
  settings: GradeSettings
  joint: readonly Readonly<{ group: ClassGroup; students: readonly Enrollment[] }>[]
  onSaved: () => void
}>) {
  const operation = useOperation()
  const [includeJoint, setIncludeJoint] = useState(true)
  // Grupo propio y, si se incluyen, los grupos de la clase conjunta; cada uno se guarda en su tutoría.
  const groups = useMemo(() => [
    { group: ownGroup(tutoring), active: activeStudents(students) },
    ...(includeJoint ? joint : []).map((item) => ({ group: item.group, active: activeStudents(item.students) })),
  ], [tutoring, students, joint, includeJoint])
  const active = useMemo(() => groups.flatMap((item) => item.active), [groups])
  const saved = useMemo<Grid>(() => Object.fromEntries(active.map((student) => [student.id, serverValues(student)])), [active])
  const [grid, setGrid] = useState<Grid>(() => {
    const draft = readDraft(tutoring.id) ?? {}
    // El borrador se mezcla campo a campo: lo no escrito conserva el valor guardado en el servidor.
    return Object.fromEntries(Object.entries(saved).map(([id, values]) => [id, { ...values, ...(draft[Number(id)] ?? {}) }]))
  })
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const readOnly = !tutoring.can_manage

  function setValue(studentId: number, type: GradeType, value: string) {
    setGrid((current) => {
      const next = { ...current, [studentId]: { ...(current[studentId] ?? EMPTY_VALUES), [type]: value } }
      writeDraft(tutoring.id, next)
      return next
    })
  }

  const valueOf = (studentId: number, type: GradeType) => grid[studentId]?.[type] ?? ''
  const savedOf = (studentId: number, type: GradeType) => saved[studentId]?.[type] ?? ''
  const changedCells = active.flatMap((student) => GRADE_FIELDS.filter(({ type }) => valueOf(student.id, type) !== savedOf(student.id, type)).map(({ type }) => ({ student, type })))
  const changed = changedCells.length > 0
  const invalid = changedCells.filter(({ student, type }) => cellProblem(valueOf(student.id, type), savedOf(student.id, type), settings.maximum) !== null).length

  function discard() {
    setGrid(saved)
    clearDraft(tutoring.id)
    setConfirmDiscard(false)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!changed || invalid > 0 || readOnly || operation.pending) return
    const batches = groups.filter((item) => item.active.length > 0)
    void operation.run(async () => {
      for (const { group, active: groupStudents } of batches) {
        // Van todos los estudiantes, con solo las notas que cambiaron: así el backend también ajusta
        // el estado de quien ya tenía sus dos parciales.
        await teacherApi.saveGrades(group.id, groupStudents.map((student) => ({
          enrollment_id: student.id,
          ...Object.fromEntries(GRADE_FIELDS.filter(({ type }) => valueOf(student.id, type) !== savedOf(student.id, type)).map(({ type }) => [type, valueOf(student.id, type)])),
        })))
      }
    }, changedCells.length === 1 ? 'Nota guardada.' : `${changedCells.length} notas guardadas.`, () => {
      clearDraft(tutoring.id)
      onSaved()
    })
  }

  const tableMeta: GradesTableMeta = { grid, saved, settings, editable: !readOnly, disabled: operation.pending, onChange: setValue }
  const hint = invalid > 0 ? (invalid === 1 ? 'Hay 1 nota por corregir.' : `Hay ${invalid} notas por corregir.`) : 'Todo listo para guardar.'

  if (active.length === 0) return <TeacherEmpty title="No hay estudiantes para evaluar" description="Inscribe estudiantes en la pestaña Estudiantes para cargar sus calificaciones." />

  return <>
  <form onSubmit={submit} aria-label="Calificaciones" className="flex flex-col gap-4">
    {readOnly
      ? <Alert><AlertDescription>Esta tutoría está en modo consulta: no se pueden modificar calificaciones.</AlertDescription></Alert>
      : <p className="text-sm text-muted-foreground">Escribe o corrige cualquier nota y guarda. El estado se calcula solo con el Parcial 1 y el Parcial 2 (promedio desde {settings.passing_grade ?? 7}).</p>}
    <JointNotice groups={joint.map((item) => item.group)} include={includeJoint} onIncludeChange={setIncludeJoint} action="calificar" />
    {groups.map(({ group, active: groupStudents }) => (
      <section key={group.id} aria-label={groups.length > 1 ? `Grupo ${group.label}` : undefined} className="flex flex-col gap-2">
        {groups.length > 1 && <h3 className="text-sm font-semibold">{group.label} <span className="font-normal text-muted-foreground">· {groupStudents.length} estudiantes</span></h3>}
        <DataTable dense columns={GRADE_COLUMNS} meta={tableMeta} data={groupStudents} getRowId={(student) => String(student.id)} />
      </section>
    ))}
    <ErrorNotice message={operation.error} />
    {changed && !readOnly && <div data-carbon-actions className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t bg-background py-3">
      <div className="flex flex-col">
        <p className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">{changedCells.length === 1 ? '1 nota cambiada' : `${changedCells.length} notas cambiadas`}<Badge variant="warning">Sin guardar</Badge></p>
        <p className="text-xs text-muted-foreground"><span>{hint}</span> <span>Escala de 0 a {settings.maximum}, hasta dos decimales (ej. 9.42).</span></p>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" disabled={operation.pending} onClick={() => setConfirmDiscard(true)}>Descartar</Button>
        <Button type="submit" disabled={invalid > 0 || operation.pending}>{operation.pending ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}{operation.pending ? 'Guardando…' : 'Guardar notas'}</Button>
      </div>
    </div>}
  </form>
    <ConfirmModal open={confirmDiscard} title="¿Descartar los cambios?" description="Las notas que escribiste y no guardaste volverán a su valor guardado." confirmLabel="Sí, descartar" cancelLabel="Seguir editando" variant="destructive" onClose={() => setConfirmDiscard(false)} onConfirm={discard} />
  </>
}
