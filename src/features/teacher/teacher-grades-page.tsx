import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { CheckIcon, SaveIcon } from 'lucide-react'
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
      return <div className="flex justify-center"><Input
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
      /></div>
    },
  })),
  {
    id: 'group',
    header: 'Grupo',
    cell: ({ row, table }) => {
      const meta = table.options.meta as GradesTableMeta
      const group = groupFor(meta.grid[row.original.id]?.diagnostic ?? '', meta.settings)
      return group ? <Badge variant="secondary">{group}</Badge> : <span className="text-muted-foreground">—</span>
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
    {!readOnly && <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Etapa de calificación">
        <span className="text-sm text-muted-foreground">Cargar notas de:</span>
        {GRADE_FIELDS.map(({ type, label: name }) => {
          const done = active.every((student) => saved[student.id]?.[type])
          return <Button key={type} type="button" size="sm" variant={stage === type ? 'default' : 'outline'} aria-pressed={stage === type} disabled={operation.pending} onClick={() => setStage(stage === type ? null : type)}>{name}{done && <CheckIcon data-icon="inline-end" aria-label="Completo" />}</Button>
        })}
      </div>
      <p className="text-sm text-muted-foreground">{stage ? `Escribe la nota de ${label} de cada estudiante (de 0 a ${settings.maximum}, con hasta dos decimales, por ejemplo 9.42). Se guardan todas juntas y lo que escribas se conserva hasta que guardes. Toca de nuevo la etapa para volver a solo consulta.` : 'Estás en modo consulta. Elige una etapa para cargar o corregir sus notas.'}</p>
    </div>}
    <DataTable dense columns={GRADE_COLUMNS} meta={tableMeta} data={active} getRowId={(student) => String(student.id)} />
    <ErrorNotice message={operation.error} />
    {stage && <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 py-3 backdrop-blur">
      <div className="flex flex-col">
        <p className="text-sm font-medium" aria-live="polite">{filled} de {total} notas de {label} ingresadas</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
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
