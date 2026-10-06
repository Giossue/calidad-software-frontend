import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ClipboardCheckIcon, MinusIcon, SaveIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice } from '@/features/tutoring/tutoring-shared'
import { compareNames } from '@/lib/format'
import { isValidGrade, sanitizeGradeInput } from '@/lib/grade-input'
import { teacherApi, type Enrollment, type GradeSettings, type GradeType, type TeacherTutoring } from '@/lib/teacher-api'
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

export function GradesPanel({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  const resource = useDegreeResource(async () => {
    const [students, settings] = await Promise.all([teacherApi.allStudents(tutoring.id), teacherApi.gradeSettings()])
    return { students, settings }
  }, String(tutoring.id))

  return <div className="flex flex-col gap-5">
    <ErrorNotice message={resource.error} retry={resource.reload} />
    {resource.loading ? <Skeleton className="h-64 w-full" aria-label="Cargando calificaciones" /> : resource.data && <GradesForm tutoring={tutoring} {...resource.data} onSaved={resource.reload} />}
  </div>
}

type GradesTableMeta = { grid: Grid; stage: GradeType | null; settings: GradeSettings; disabled: boolean; onChange: (studentId: number, type: GradeType, value: string) => void }

// Columnas estables: el estado llega por `meta` para que las casillas no se remonten (y pierdan el foco) al escribir.
const GRADE_COLUMNS: ColumnDef<Enrollment>[] = [
  { id: 'number', header: 'N.°', cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.index + 1}</span> },
  { id: 'name', header: 'Estudiante', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
  ...GRADE_FIELDS.map(({ type, label }): ColumnDef<Enrollment> => ({
    id: type,
    header: ({ table }) => <div className={`text-center ${(table.options.meta as GradesTableMeta).stage === type ? 'font-semibold text-foreground' : ''}`}>{label}</div>,
    cell: ({ row, table }) => {
      const meta = table.options.meta as GradesTableMeta
      const value = meta.grid[row.original.id]?.[type] ?? ''
      // Solo la etapa elegida se edita; las otras se muestran como referencia.
      if (meta.stage !== type) return <div className="text-center tabular-nums text-muted-foreground">{value || '—'}</div>
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
          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{groupFor(value, meta.settings)}</span>
        )}
      </div>
    },
  })),
  {
    id: 'evolution',
    header: () => <div className="text-center font-medium">Evolución (Diag → P2)</div>,
    cell: ({ row, table }) => {
      const meta = table.options.meta as GradesTableMeta
      const diagStr = meta.grid[row.original.id]?.diagnostic ?? ''
      const p2Str = meta.grid[row.original.id]?.partial_two ?? ''
      const p1Str = meta.grid[row.original.id]?.partial ?? ''
      const evo = computeEvolution(diagStr, p2Str, p1Str)

      if (evo.status === 'up') {
        return (
          <div className="flex justify-center">
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 font-semibold tabular-nums" title={evo.title}>
              <TrendingUpIcon className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{evo.label}</span>
            </Badge>
          </div>
        )
      }

      if (evo.status === 'down') {
        return (
          <div className="flex justify-center">
            <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 gap-1 font-semibold tabular-nums" title={evo.title}>
              <TrendingDownIcon className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{evo.label}</span>
            </Badge>
          </div>
        )
      }

      if (evo.status === 'same') {
        return (
          <div className="flex justify-center">
            <Badge variant="outline" className="text-muted-foreground gap-1 tabular-nums font-medium" title={evo.title}>
              <MinusIcon className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{evo.label}</span>
            </Badge>
          </div>
        )
      }

      if (evo.status === 'partial_one') {
        return (
          <div className="flex justify-center">
            <Badge variant="secondary" className="text-xs font-normal tabular-nums text-muted-foreground" title={evo.title}>
              {evo.label}
            </Badge>
          </div>
        )
      }

      return (
        <div className="text-center text-xs text-muted-foreground" title={evo.title}>
          {evo.label}
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

function GradesForm({ tutoring, students, settings, onSaved }: Readonly<{ tutoring: TeacherTutoring; students: readonly Enrollment[]; settings: GradeSettings; onSaved: () => void }>) {
  const operation = useOperation()
  const active = useMemo(() => students.filter((student) => student.is_active && student.student_is_active).sort((a, b) => compareNames(a.name, b.name)), [students])
  const saved = useMemo<Grid>(() => Object.fromEntries(active.map((student) => [student.id, serverValues(student)])), [active])
  const [grid, setGrid] = useState<Grid>(() => {
    const draft = readDraft(tutoring.id) ?? {}
    // El borrador se mezcla campo a campo: lo no escrito conserva el valor guardado en el servidor.
    return Object.fromEntries(Object.entries(saved).map(([id, values]) => [id, { ...values, ...(draft[Number(id)] ?? {}) }]))
  })
  // Sin etapa elegida la tabla es solo de consulta; se elige una etapa únicamente para cargar o corregir notas.
  const [stage, setStage] = useState<GradeType | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
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

  // Cancelar descarta lo escrito (y no guardado) de la etapa y vuelve a modo consulta.
  function leaveStage() {
    if (stage) {
      setGrid((current) => Object.fromEntries(Object.entries(current).map(([id, values]) => [id, { ...values, [stage]: saved[Number(id)]?.[stage] ?? '' }])))
      clearDraft(tutoring.id, stage)
    }
    setConfirmCancel(false)
    setStage(null)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!stage || !complete || hasInvalid || !changed || readOnly || operation.pending) return
    const entries = active.map((student) => ({ enrollment_id: student.id, [stage]: valueOf(student.id, stage) }))
    void operation.run(() => teacherApi.saveGrades(tutoring.id, entries), `${label} guardado para todos los estudiantes.`, () => {
      clearDraft(tutoring.id, stage)
      onSaved()
    })
  }

  const tableMeta: GradesTableMeta = { grid, stage, settings, disabled: readOnly || operation.pending, onChange: setValue }
  const missing = total - filled
  const hint = readOnly ? '' : hasInvalid ? 'Hay notas incompletas o fuera de la escala.' : missing > 0 ? `Faltan ${missing} ${missing === 1 ? 'nota' : 'notas'} de ${label}.` : !changed ? 'No hay cambios por guardar.' : 'Todo listo para guardar.'

  if (active.length === 0) return <TeacherEmpty title="No hay estudiantes para evaluar" description="Inscribe estudiantes en la pestaña Estudiantes para cargar sus calificaciones." />

  return <>
  <form onSubmit={submit} aria-label="Calificaciones" className="flex flex-col gap-4">
    {readOnly && <Alert><AlertDescription>Esta tutoría está en modo consulta: no se pueden modificar calificaciones.</AlertDescription></Alert>}
    {!readOnly && <div role="group" aria-label="Etapa de calificación" className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2">
      <span className="mr-1 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground"><ClipboardCheckIcon className="size-4 text-muted-foreground" aria-hidden="true" />Etapa:</span>
      <Button type="button" size="sm" variant={stage === null ? 'default' : 'outline'} aria-pressed={stage === null} disabled={operation.pending} className={stage === null ? undefined : 'bg-card'} onClick={() => { if (stage) { if (changed) setConfirmCancel(true); else leaveStage() } }}>Todas las etapas</Button>
      {GRADE_FIELDS.map(({ type, label: name }) => {
        const done = active.every((student) => saved[student.id]?.[type])
        const selected = stage === type
        return <Button key={type} type="button" size="sm" variant={selected ? 'default' : 'outline'} aria-pressed={selected} disabled={operation.pending} className={selected ? undefined : 'bg-card'} onClick={() => setStage(type)}>
          {name}{' '}
          <span className={`rounded-full px-1.5 text-[11px] font-medium ${selected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{done ? 'Completo' : 'Pendiente'}</span>
        </Button>
      })}
    </div>}
    <DataTable dense columns={GRADE_COLUMNS} meta={tableMeta} data={active} getRowId={(student) => String(student.id)} />
    <ErrorNotice message={operation.error} />
    {stage && <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 py-3 backdrop-blur">
      <div className="flex flex-col">
        <p className="text-sm font-medium" aria-live="polite">{filled} de {total} notas de {label} ingresadas</p>
        <p className="text-xs text-muted-foreground"><span>{hint}</span> <span>Escala de 0 a {settings.maximum}, hasta dos decimales (ej. 9.42).</span></p>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" disabled={operation.pending} onClick={() => (changed ? setConfirmCancel(true) : leaveStage())}>Cancelar</Button>
        <Button type="submit" disabled={readOnly || !complete || hasInvalid || !changed || operation.pending}>{operation.pending ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}{operation.pending ? 'Guardando…' : `Guardar ${label}`}</Button>
      </div>
    </div>}
  </form>
    <ConfirmModal open={confirmCancel} title={`¿Descartar las notas de ${label}?`} description="Lo que escribiste y no guardaste se perderá y volverás al modo consulta." confirmLabel="Sí, descartar" cancelLabel="Seguir editando" variant="destructive" onClose={() => setConfirmCancel(false)} onConfirm={leaveStage} />
  </>
}
