import { PlusIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { FormField } from '@/components/ui/form-field'
import { SelectInput } from '@/components/ui/select-field'
import { DAY_LABELS, WEEK_DAYS, type TutoringSchedule, type TutoringScheduleItem } from '@/lib/tutoring-api'

export const SCHEDULE_TIME_OPTIONS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00',
]

export const DEFAULT_SCHEDULE_TIMES = { start_time: '08:00', end_time: '10:00' }

/** Una franja del horario: un día con su hora de inicio y de fin (una sola por día). */
export type ScheduleRow = { day: string; start_time: string; end_time: string }

export const MISSING_SCHEDULE_MESSAGE = 'Agrega al menos un horario para la tutoría.'

/** Franjas guardadas: una por día, en el orden en que llegan (la última de cada día manda). */
export function rowsFromSchedules(schedules: readonly TutoringSchedule[]): ScheduleRow[] {
  const rows: ScheduleRow[] = []
  for (const schedule of schedules) {
    const row = { day: schedule.day, start_time: schedule.start_time.slice(0, 5), end_time: schedule.end_time.slice(0, 5) }
    const index = rows.findIndex((item) => item.day === schedule.day)
    if (index >= 0) rows[index] = row
    else rows.push(row)
  }
  return rows
}

/** Huella del horario (orden de las filas irrelevante) para detectar cambios reales. */
export function scheduleSignature(rows: readonly ScheduleRow[]): string {
  return JSON.stringify(rows.map((row) => [row.day, row.start_time, row.end_time].join('|')).sort())
}

/**
 * Primer error del horario o null si es válido. Sin filas solo es un error cuando el horario es
 * obligatorio; una fila agregada siempre tiene que estar completa y ser válida.
 */
export function validateScheduleRows(rows: readonly ScheduleRow[], { required = false }: Readonly<{ required?: boolean }> = {}): string | null {
  if (rows.length === 0) return required ? MISSING_SCHEDULE_MESSAGE : null
  for (const [index, row] of rows.entries()) {
    if (!row.day) return 'Selecciona el día de cada horario.'
    const dayLabel = DAY_LABELS[row.day] ?? row.day
    if (rows.findIndex((item) => item.day === row.day) !== index) return `El día ${dayLabel} ya tiene un horario.`
    if (!row.start_time || !row.end_time) return `Selecciona la hora de inicio y fin para el día ${dayLabel}.`
    if (row.start_time >= row.end_time) return `En ${dayLabel}, la hora de fin debe ser posterior a la hora de inicio.`
  }
  return null
}

export function toScheduleItems(rows: readonly ScheduleRow[]): TutoringScheduleItem[] {
  return rows.filter((row) => row.day).map((row) => ({
    day: row.day,
    start_time: (row.start_time || DEFAULT_SCHEDULE_TIMES.start_time).slice(0, 5),
    end_time: (row.end_time || DEFAULT_SCHEDULE_TIMES.end_time).slice(0, 5),
  }))
}

/**
 * Error en línea de una franja. Un rango imposible (fin antes del inicio) se marca en cuanto se
 * elige; lo que falta, solo tras intentar enviar.
 */
function scheduleRowError(row: ScheduleRow, showMissing: boolean): string | null {
  if (row.start_time && row.end_time && row.start_time >= row.end_time) return 'La hora de fin debe ser posterior a la de inicio.'
  if (!showMissing) return null
  if (!row.day) return 'Selecciona el día.'
  if (!row.start_time || !row.end_time) return 'Selecciona la hora de inicio y de fin.'
  return null
}

function timeOptions(current: string) {
  const all = current && !SCHEDULE_TIME_OPTIONS.includes(current) ? [...SCHEDULE_TIME_OPTIONS, current].sort() : SCHEDULE_TIME_OPTIONS
  return all.map((time) => ({ value: time, label: time }))
}

/**
 * Horario: una fila por franja (día, desde, hasta y quitar) y «Agregar horario» debajo. Cada día
 * admite una sola franja, así que un día ya usado se ve deshabilitado en las demás filas. Puede
 * quedar sin filas; si el horario es obligatorio, eso se marca tras intentar enviar.
 */
export function ScheduleEditor({ prefix, rows, onChange, required = false, disabled = false, error = null, showErrors = false }: Readonly<{
  prefix: string
  rows: readonly ScheduleRow[]
  onChange: (rows: ScheduleRow[]) => void
  /** Pide al menos una franja (asterisco y error en línea tras intentar enviar). */
  required?: boolean
  disabled?: boolean
  /** Error del servidor sobre el horario. */
  error?: string | null
  /** Tras intentar enviar: marca en rojo lo que falta. */
  showErrors?: boolean
}>) {
  const numbered = rows.length > 1
  const suffix = (index: number) => (numbered ? ` (horario ${index + 1})` : '')
  const allDaysUsed = WEEK_DAYS.every((day) => rows.some((row) => row.day === day))
  const fieldError = error ?? (showErrors && required && rows.length === 0 ? MISSING_SCHEDULE_MESSAGE : null)

  function update(index: number, patch: Partial<ScheduleRow>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function add() {
    // La fila nueva toma las horas de la anterior: casi siempre solo cambia el día.
    const last = rows.at(-1)
    onChange([...rows, { day: '', start_time: last?.start_time || DEFAULT_SCHEDULE_TIMES.start_time, end_time: last?.end_time || DEFAULT_SCHEDULE_TIMES.end_time }])
  }

  return (
    <FormField id={`${prefix}-schedule-day-0`} label="Horario" required={required} error={fieldError}>
      {rows.length > 0 && (
        <div className="flex flex-col gap-2">
          {rows.map((row, index) => {
            const rowError = scheduleRowError(row, showErrors)
            const usedElsewhere = new Set(rows.filter((_, i) => i !== index).map((item) => item.day))
            return (
              // Filas sin identidad propia: todos sus campos son controlados, así que la posición basta.
              <div key={index} className="flex flex-col gap-1">
                <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_minmax(0,1fr)_2rem] items-center gap-2">
                  <SelectInput
                    id={`${prefix}-schedule-day-${index}`}
                    ariaLabel={`Día${suffix(index)}`}
                    value={row.day}
                    onValueChange={(day) => update(index, { day })}
                    placeholder="Día"
                    disabled={disabled}
                    invalid={Boolean(rowError) && !row.day}
                    options={WEEK_DAYS.map((day) => ({ value: day, label: DAY_LABELS[day] ?? day, disabled: usedElsewhere.has(day) }))}
                  />
                  <SelectInput
                    id={`${prefix}-schedule-start-${index}`}
                    ariaLabel={`Hora de inicio${suffix(index)}`}
                    value={row.start_time}
                    onValueChange={(value) => update(index, { start_time: value })}
                    placeholder="Desde"
                    disabled={disabled}
                    invalid={Boolean(rowError) && Boolean(row.day)}
                    options={timeOptions(row.start_time)}
                  />
                  <span className="text-sm text-muted-foreground">a</span>
                  <SelectInput
                    id={`${prefix}-schedule-end-${index}`}
                    ariaLabel={`Hora de fin${suffix(index)}`}
                    value={row.end_time}
                    onValueChange={(value) => update(index, { end_time: value })}
                    placeholder="Hasta"
                    disabled={disabled}
                    invalid={Boolean(rowError) && Boolean(row.day)}
                    options={timeOptions(row.end_time)}
                  />
                  <Button type="button" variant="tertiary" tone="destructive" size="icon-sm" aria-label="Quitar horario" disabled={disabled} onClick={() => onChange(rows.filter((_, i) => i !== index))}>
                    <Trash2Icon />
                  </Button>
                </div>
                {rowError && <FieldError>{rowError}</FieldError>}
              </div>
            )
          })}
        </div>
      )}
      <Button type="button" variant="secondary" size="sm" className="self-start" disabled={disabled || allDaysUsed} onClick={add}>
        <PlusIcon data-icon="inline-start" />
        Agregar horario
      </Button>
    </FormField>
  )
}
