import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { MinusIcon, SaveIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Input } from '@/components/ui/input'
import { SelectInput } from '@/components/ui/select-field'
import { Skeleton } from '@/components/ui/skeleton'
import { TableSkeleton } from '@/components/ui/loading-skeletons'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice } from '@/components/ui/error-notice'
import { compareNames } from '@/lib/format'
import { isValidGrade, sanitizeGradeInput } from '@/lib/grade-input'
import { teacherApi, type Enrollment, type GradeSettings, type GradeType, type TeacherTutoring } from '@/lib/teacher-api'
import { jointGroup, ownGroup, type ClassGroup } from './joint-groups'
import { JointNotice } from './joint-notice'
import { TeacherEmpty } from './teacher-shared'

const GRADE_FIELDS = [
  { type: 'diagnostic', label: 'Diagnóstico' },
  { type: 'partial', label: 'Parcial 1' },
  { type: 'partial_two', label: 'Parcial 2' },
] as const satisfies readonly { type: GradeType; label: string }[]

const GRADE_LABELS: Readonly<Record<string, string>> = { diagnostic: 'Diagnóstico', partial: 'Parcial 1', partial_two: 'Parcial 2' }

// Las notas se cargan por etapa (diagnóstico, parcial 1, parcial 2), cada una en su momento del ciclo.
type Values = Readonly<Record<GradeType, string>>
type Grid = Readonly<Record<number, Values>>

const EMPTY_VALUES: Values = { diagnostic: '', partial: '', partial_two: '' }
const stageLabel = (type: GradeType) => GRADE_LABELS[type] ?? type

function serverValues(student: Enrollment): Values {
  return { diagnostic: student.diagnostic_grade ?? '', partial: student.partial_grade ?? '', partial_two: student.second_partial_grade ?? '' }
}

type Evolution =
  | { status: 'up'; delta: number; label: string; title: string }
  | { status: 'down'; delta: number; label: string; title: string }
  | { status: 'same'; delta: number; label: string; title: string }
  | { status: 'partial_one'; delta: number; label: string; title: string }
  | { status: 'pending'; label: string; title: string }
  | { status: 'no_diag'; label: string; title: string }

function computeEvolution(diagnosticStr: string, partialTwoStr: string, partialOneStr?: string): Evolution {
  const diagNum = Number(diagnosticStr)
  if (!diagnosticStr || Number.isNaN(diagNum)) {
    return { status: 'no_diag', label: '—', title: 'Sin calificación de diagnóstico registrada' }
  }

  const p2Num = Number(partialTwoStr)
  if (partialTwoStr && !Number.isNaN(p2Num)) {
    const delta = Math.round((p2Num - diagNum) * 100) / 100
    if (delta > 0) {
      return {
        status: 'up',
        delta,
        label: `+${delta.toFixed(2)}`,
        title: `Evolución positiva: subió ${delta.toFixed(2)} puntos desde Diagnóstico (${diagNum.toFixed(2)}) hasta Parcial 2 (${p2Num.toFixed(2)})`,
      }
    }
    if (delta < 0) {
      return {
        status: 'down',
        delta,
        label: `${delta.toFixed(2)}`,
        title: `Evolución negativa: bajó ${Math.abs(delta).toFixed(2)} puntos desde Diagnóstico (${diagNum.toFixed(2)}) hasta Parcial 2 (${p2Num.toFixed(2)})`,
      }
    }
    return {
      status: 'same',
      delta: 0,
      label: '0.00',
      title: `Sin variación: misma nota en Diagnóstico (${diagNum.toFixed(2)}) y Parcial 2 (${p2Num.toFixed(2)})`,
    }
  }

  const p1Num = Number(partialOneStr)
  if (partialOneStr && !Number.isNaN(p1Num)) {
    const delta = Math.round((p1Num - diagNum) * 100) / 100
    const sign = delta > 0 ? '+' : ''
    return {
      status: 'partial_one',
      delta,
      label: `P1: ${sign}${delta.toFixed(2)}`,
      title: `Evolución parcial preliminar: ${sign}${delta.toFixed(2)} en Parcial 1 (${p1Num.toFixed(2)}) respecto a Diagnóstico (${diagNum.toFixed(2)}). Pendiente Parcial 2.`,
    }
  }

  return { status: 'pending', label: 'Pendiente P2', title: 'Pendiente calificación del Parcial 2' }
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
// Al guardar una etapa se descartan solo sus valores del borrador; las otras etapas conservan lo escrito.
function clearDraft(tutoringId: number, stage: GradeType) {
  try {
    const draft = readDraft(tutoringId)
    if (!draft) return
    const rest = Object.fromEntries(Object.entries(draft).map(([studentId, values]) => [studentId, { ...values, [stage]: undefined }]))
    sessionStorage.setItem(draftKey(tutoringId), JSON.stringify(rest))
  } catch { /* nada que limpiar */ }
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

/** La etapa a calificar y la tabla de notas (#, estudiante, tres notas y evolución). */
function GradesSkeleton() {
  return <div role="status" aria-label="Cargando calificaciones" className="flex flex-col gap-5">
    <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
      <Skeleton className="h-9 w-56" />
    </div>
    <TableSkeleton columns={GRADE_FIELDS.length + 3} />
  </div>
}

export function GradesPanel({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  const resource = useDegreeResource(async () => {
    const [students, settings, joints] = await Promise.all([teacherApi.allStudents(tutoring.id), teacherApi.gradeSettings(), teacherApi.jointTutorings(tutoring.id)])
    // Clase conjunta: los grupos de la misma asignatura a la misma hora se califican juntos.
    const joint = await Promise.all(joints.filter((item) => item.can_manage).map(async (item) => ({ group: jointGroup(item), students: await teacherApi.allStudents(item.id) })))
    return { students, settings, joint }
  }, String(tutoring.id))

  return <div className="flex flex-col gap-5">
    <ErrorNotice message={resource.error} retry={resource.reload} />
    {resource.loading ? <GradesSkeleton /> : resource.data && <GradesForm tutoring={tutoring} {...resource.data} onSaved={resource.reload} />}
  </div>
}

type GradesTableMeta = { grid: Grid; saved: Grid; stage: GradeType | null; settings: GradeSettings; disabled: boolean; onChange: (studentId: number, type: GradeType, value: string) => void }

// Columnas estables: el estado llega por `meta` para que las casillas no se remonten (y pierdan el foco) al escribir.
const GRADE_COLUMNS: ColumnDef<Enrollment>[] = [
  { id: 'number', header: '#', cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.index + 1}</span> },
  { id: 'name', header: 'Estudiante', cell: ({ row }) => row.original.name },
  ...GRADE_FIELDS.map(({ type, label }): ColumnDef<Enrollment> => ({
    id: type,
    header: ({ table }) => <div className={`text-center ${(table.options.meta as GradesTableMeta).stage === type ? 'text-foreground' : ''}`}>{label}</div>,
    cell: ({ row, table }) => {
      const meta = table.options.meta as GradesTableMeta
      // Solo la etapa elegida se edita; las otras muestran lo guardado (nunca un borrador).
      if (meta.stage !== type) return <div className="text-center tabular-nums text-muted-foreground">{meta.saved[row.original.id]?.[type] || '—'}</div>
      const value = meta.grid[row.original.id]?.[type] ?? ''
      return <div className="flex flex-col items-center gap-1">
        <Input
          className="h-9 w-24 text-center tabular-nums"
          inputMode="decimal"
          autoComplete="off"
          maxLength={5}
          placeholder="0.00"
          data-grade-column={type}
          aria-label={`${label} de ${row.original.name}`}
          aria-invalid={value !== '' && !isValidGrade(value, meta.settings.maximum)}
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
    header: () => <div className="text-center">Evolución (Diag → P2)</div>,
    cell: ({ row, table }) => {
      const meta = table.options.meta as GradesTableMeta
      // Se calcula con las notas guardadas: lo escrito y no guardado no cuenta como evolución.
      const diagStr = meta.saved[row.original.id]?.diagnostic ?? ''
      const p2Str = meta.saved[row.original.id]?.partial_two ?? ''
      const p1Str = meta.saved[row.original.id]?.partial ?? ''
      const evo = computeEvolution(diagStr, p2Str, p1Str)

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
                : evo.status === 'no_diag'
                ? <span tabIndex={0} className="text-xs text-muted-foreground">{evo.label}</span>
                : <span tabIndex={0} className={`inline-flex items-center gap-1 text-sm tabular-nums [&>svg]:size-4 ${tone}`}>{icon}<span>{evo.label}</span></span>}
            </TooltipTrigger>
            <TooltipContent>{evo.title}</TooltipContent>
          </Tooltip>
        </div>
      )
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
  students.filter((student) => student.is_active && student.student_is_active).sort((a, b) => compareNames(a.name, b.name))

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
  // Sin etapa elegida la tabla es solo de consulta; se elige una etapa únicamente para cargar o corregir notas.
  const [stage, setStage] = useState<GradeType | null>(null)
  // Etapa a la que se quiere pasar (o 'all' para volver a la consulta) mientras se confirma descartar lo no guardado.
  const [confirmTarget, setConfirmTarget] = useState<GradeType | 'all' | null>(null)
  const readOnly = !tutoring.can_manage

  function setValue(studentId: number, type: GradeType, value: string) {
    setGrid((current) => {
      const next = { ...current, [studentId]: { ...(current[studentId] ?? EMPTY_VALUES), [type]: value } }
      writeDraft(tutoring.id, next)
      return next
    })
  }

  const total = active.length
  const valueOf = (studentId: number, type: GradeType) => grid[studentId]?.[type] ?? ''
  const filled = stage ? active.filter((student) => isValidGrade(valueOf(student.id, stage), settings.maximum)).length : 0
  const hasInvalid = stage ? active.some((student) => { const value = valueOf(student.id, stage); return value !== '' && !isValidGrade(value, settings.maximum) }) : false
  const complete = total > 0 && filled === total
  const changed = stage ? active.some((student) => valueOf(student.id, stage) !== (saved[student.id]?.[stage] ?? '')) : false
  const label = stage ? stageLabel(stage) : ''

  // Salir de una etapa descarta lo escrito (y no guardado) en ella y pasa a otra etapa o a la consulta.
  function leaveStage(next: GradeType | null = null) {
    if (stage) {
      setGrid((current) => Object.fromEntries(Object.entries(current).map(([id, values]) => [id, { ...values, [stage]: saved[Number(id)]?.[stage] ?? '' }])))
      clearDraft(tutoring.id, stage)
    }
    setConfirmTarget(null)
    setStage(next)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!stage || !complete || hasInvalid || !changed || readOnly || operation.pending) return
    const batches = groups.filter((item) => item.active.length > 0)
    void operation.run(async () => {
      for (const { group, active: groupStudents } of batches) {
        await teacherApi.saveGrades(group.id, groupStudents.map((student) => ({ enrollment_id: student.id, [stage]: valueOf(student.id, stage) })))
      }
    }, batches.length > 1 ? `${label} guardado en los ${batches.length} grupos.` : `${label} guardado para todos los estudiantes.`, () => {
      clearDraft(tutoring.id, stage)
      onSaved()
    })
  }

  // Cada etapa indica en el desplegable si ya tiene todas sus notas guardadas.
  const stageOptions = GRADE_FIELDS.map(({ type, label: name }) => ({
    value: type,
    label: `${name} · ${active.every((student) => saved[student.id]?.[type]) ? 'Completo' : 'Pendiente'}`,
  }))
  // Salir de la etapa con notas sin guardar (a otra etapa o a «Todas las etapas») pide confirmar el descarte.
  function chooseStage(value: string) {
    const next = value === '' ? null : value as GradeType
    if (next === stage) return
    if (stage && changed) setConfirmTarget(next ?? 'all')
    else leaveStage(next)
  }
  // Notas escritas y no guardadas de otra visita (borrador): se avisan, nunca se muestran como guardadas.
  const draftStages = stage ? [] : GRADE_FIELDS.filter(({ type }) => active.some((student) => valueOf(student.id, type) !== (saved[student.id]?.[type] ?? '')))

  const tableMeta: GradesTableMeta = { grid, saved, stage, settings, disabled: readOnly || operation.pending, onChange: setValue }
  const saveBlocked = readOnly || !complete || hasInvalid || !changed
  const missing = total - filled
  const hint = readOnly ? '' : hasInvalid ? 'Hay notas incompletas o fuera de la escala.' : missing > 0 ? `${missing === 1 ? 'Falta 1 nota' : `Faltan ${missing} notas`} de ${label}.` : !changed ? 'No hay cambios por guardar.' : 'Todo listo para guardar.'

  if (active.length === 0) return <TeacherEmpty title="No hay estudiantes para evaluar" description="Inscribe estudiantes en la pestaña Estudiantes para cargar sus calificaciones." />

  return <>
  <form onSubmit={submit} aria-label="Calificaciones" className="flex flex-col gap-4">
    {readOnly && <Alert><AlertDescription>Esta tutoría está en modo consulta: no se pueden modificar calificaciones.</AlertDescription></Alert>}
    {!readOnly && <div role="group" aria-label="Etapa de calificación" className="flex flex-wrap items-center gap-2">
      <SelectInput
        id={`grades-stage-${tutoring.id}`}
        ariaLabel="Etapa"
        value={stage ?? ''}
        onValueChange={chooseStage}
        emptyLabel="Todas las etapas"
        options={stageOptions}
        disabled={operation.pending}
        className="w-56"
      />
    </div>}
    {draftStages.length > 0 && <Alert><AlertDescription>Tienes notas sin guardar de {draftStages.map((item) => item.label).join(', ')}. Elige la etapa para revisarlas y guardarlas; mientras tanto se muestran las notas guardadas.</AlertDescription></Alert>}
    <JointNotice groups={joint.map((item) => item.group)} include={includeJoint} onIncludeChange={setIncludeJoint} action="calificar" />
    {groups.map(({ group, active: groupStudents }) => (
      <section key={group.id} aria-label={groups.length > 1 ? `Grupo ${group.label}` : undefined} className="flex flex-col gap-2">
        {groups.length > 1 && <h3 className="text-sm font-semibold">{group.label} <span className="font-normal text-muted-foreground">· {groupStudents.length} estudiantes</span></h3>}
        <DataTable dense columns={GRADE_COLUMNS} meta={tableMeta} data={groupStudents} getRowId={(student) => String(student.id)} />
      </section>
    ))}
    <ErrorNotice message={operation.error} />
    {stage && <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t bg-background py-3">
      <div className="flex flex-col">
        <p className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">{filled} de {total} notas de {label} ingresadas{changed && <Badge variant="warning">Sin guardar</Badge>}</p>
        <p className="text-xs text-muted-foreground"><span>{hint}</span> <span>Escala de 0 a {settings.maximum}, hasta dos decimales (ej. 9.42).</span></p>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" disabled={operation.pending} onClick={() => (changed ? setConfirmTarget('all') : leaveStage())}>Cancelar</Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={saveBlocked ? 0 : -1}>
              <Button type="submit" disabled={saveBlocked || operation.pending}>{operation.pending ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}{operation.pending ? 'Guardando…' : `Guardar ${label}`}</Button>
            </span>
          </TooltipTrigger>
          {saveBlocked && !operation.pending && <TooltipContent>{hint || 'No hay cambios por guardar.'}</TooltipContent>}
        </Tooltip>
      </div>
    </div>}
  </form>
    <ConfirmModal open={confirmTarget !== null} title={`¿Descartar las notas de ${label}?`} description={`Lo que escribiste y no guardaste se perderá y ${confirmTarget && confirmTarget !== 'all' ? `pasarás a ${stageLabel(confirmTarget)}` : 'volverás al modo consulta'}.`} confirmLabel="Sí, descartar" cancelLabel="Seguir editando" variant="destructive" onClose={() => setConfirmTarget(null)} onConfirm={() => leaveStage(confirmTarget && confirmTarget !== 'all' ? confirmTarget : null)} />
  </>
}
