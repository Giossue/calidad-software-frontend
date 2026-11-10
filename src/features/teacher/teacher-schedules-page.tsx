import { useEffect, useState, type FormEvent } from 'react'
import { CalendarClockIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { SelectField } from '@/components/ui/select-field'
import { StatusBadge } from '@/components/ui/status-badge'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { DAY_LABELS, WEEK_DAYS, type TutoringSchedule } from '@/lib/tutoring-api'
import { teacherApi, type TeacherTutoring } from '@/lib/teacher-api'
import { TeacherEmpty } from './teacher-shared'

export const SCHEDULE_TIME_OPTIONS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00',
]

type DayTimes = Record<string, { start_time: string; end_time: string }>

function snapshotOf(days: readonly string[], times: DayTimes): string {
  return JSON.stringify([...days].sort().map((day) => [day, times[day]?.start_time ?? '', times[day]?.end_time ?? '']))
}

const TIME_SELECT_OPTIONS = SCHEDULE_TIME_OPTIONS.map((time) => ({ value: time, label: time }))

interface SchedulesPanelProps {
  tutoring: TeacherTutoring
  onReload?: () => Promise<unknown> | void
}

export function SchedulesPanel({ tutoring, onReload }: Readonly<SchedulesPanelProps>) {
  const operation = useOperation()
  const [schedules, setSchedules] = useState<readonly TutoringSchedule[]>(tutoring.schedules ?? [])
  const [isEditing, setIsEditing] = useState(false)
  const [scheduleDays, setScheduleDays] = useState<string[]>([])
  const [dayTimes, setDayTimes] = useState<Record<string, { start_time: string; end_time: string }>>({})
  const [initialSnapshot, setInitialSnapshot] = useState('')

  // Sync state if tutoring or schedules changes
  useEffect(() => {
    setSchedules(tutoring.schedules ?? [])
  }, [tutoring.schedules])

  function openEditModal() {
    operation.clearError()

    const activeSchedules = schedules.filter((s) => s.is_active)
    const days: string[] = []
    const times: Record<string, { start_time: string; end_time: string }> = {}

    activeSchedules.forEach((item) => {
      if (!days.includes(item.day)) {
        days.push(item.day)
      }
      times[item.day] = {
        start_time: item.start_time.slice(0, 5),
        end_time: item.end_time.slice(0, 5),
      }
    })

    const initialDays = days.length > 0 ? days : ['lunes']
    const initialTimes = days.length > 0 ? times : { lunes: { start_time: '08:00', end_time: '10:00' } }
    setScheduleDays(initialDays)
    setDayTimes(initialTimes)
    setInitialSnapshot(snapshotOf(initialDays, initialTimes))

    setIsEditing(true)
  }

  function validate(): string | null {
    if (scheduleDays.length === 0) return 'Selecciona al menos un día para el horario de la tutoría.'
    for (const day of scheduleDays) {
      const times = dayTimes[day]
      const dayLabel = DAY_LABELS[day] ?? day
      if (!times?.start_time || !times?.end_time) return `Selecciona la hora de inicio y fin para el día ${dayLabel}.`
      if (times.start_time >= times.end_time) return `En ${dayLabel}, la hora de fin debe ser posterior a la hora de inicio.`
    }
    return null
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (validate()) return

    const payload = scheduleDays.map((day) => {
      const times = dayTimes[day] ?? { start_time: '08:00', end_time: '10:00' }
      const existingMatch = schedules.find((s) => s.day === day)
      return {
        day,
        start_time: times.start_time.slice(0, 5),
        end_time: times.end_time.slice(0, 5),
        room: existingMatch?.room || 'Por asignar',
      }
    })

    void operation.run(
      async () => {
        const updated = await teacherApi.syncSchedules(tutoring.id, payload)
        setSchedules(updated)
        setIsEditing(false)
        await onReload?.()
      },
      'Horarios de tutoría actualizados',
    )
  }

  // Al marcar un día nuevo toma la hora del primer día marcado.
  function toggleDay(day: string) {
    setScheduleDays((prev) => {
      if (prev.includes(day)) return prev.filter((d) => d !== day)
      const ref = prev[0] ? dayTimes[prev[0]] : undefined
      setDayTimes((times) => ({
        ...times,
        [day]: times[day] ?? { start_time: ref?.start_time || '08:00', end_time: ref?.end_time || '10:00' },
      }))
      return [...prev, day]
    })
  }

  function setTime(day: string, key: 'start_time' | 'end_time', value: string) {
    setDayTimes((prev) => ({
      ...prev,
      [day]: { ...(prev[day] ?? (key === 'start_time' ? { end_time: '10:00' } : { start_time: '08:00' })), [key]: value } as { start_time: string; end_time: string },
    }))
  }

  // Los días marcados se listan en el orden de la semana.
  const orderedDays = WEEK_DAYS.filter((day) => scheduleDays.includes(day))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold tracking-tight">Horarios de tutoría</h3>
          <p className="text-sm text-muted-foreground">Días y horas de clase. Sin horario no se puede tomar asistencia.</p>
        </div>
        <Button
          type="button"
          className="shrink-0"
          disabled={!tutoring.can_manage || operation.pending}
          onClick={openEditModal}
        >
          <CalendarClockIcon data-icon="inline-start" />
          Editar horarios
        </Button>
      </div>

      <RecordTable
        rows={schedules}
        loading={false}
        empty={
          <TeacherEmpty
            title="Sin horarios registrados"
            description="Pulsa «Editar horarios» para configurar los días y horas de esta tutoría."
          />
        }
        columns={[
          { label: 'Día', render: (item) => DAY_LABELS[item.day] ?? item.day },
          {
            label: 'Horario',
            render: (item) => `${item.start_time.slice(0, 5)} – ${item.end_time.slice(0, 5)}`,
          },
          { label: 'Estado', render: (item) => <StatusBadge active={item.is_active} /> },
        ]}
      />

      <FormDialog
        open={isEditing}
        title="Editar horarios de tutoría"
        description={`Configura los días y horas de atención para ${tutoring.subject_name}.`}
        pending={operation.pending}
        error={operation.error}
        dirty={snapshotOf(scheduleDays, dayTimes) !== initialSnapshot}
        blockReason={validate()}
        onClose={() => { setIsEditing(false); operation.clearError() }}
        onSubmit={handleSubmit}
        submitLabel="Guardar horarios"
        maxWidth="max-w-2xl"
      >
        <FormField id="teacher-schedule-days" label="Horario" required>
          <div id="teacher-schedule-days" className="flex flex-wrap gap-x-4 gap-y-2" role="group" aria-label="Días de la semana">
            {WEEK_DAYS.map((day) => (
              <label key={day} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  value={day}
                  checked={scheduleDays.includes(day)}
                  onChange={() => toggleDay(day)}
                  className="size-4 accent-primary"
                />
                {DAY_LABELS[day]}
              </label>
            ))}
          </div>
          {orderedDays.length > 0 ? (
            <div className="flex flex-col gap-2">
              {orderedDays.map((day) => {
                const dayLabel = DAY_LABELS[day] ?? day
                const currentTimes = dayTimes[day] ?? { start_time: '08:00', end_time: '10:00' }
                return (
                  <div key={day} className="grid grid-cols-[6rem_1fr_auto_1fr] items-center gap-2">
                    <span className="text-sm font-medium">{dayLabel}</span>
                    <SelectField
                      id={`teacher-schedule-start-${day}`}
                      label={scheduleDays.length === 1 ? 'Hora de inicio' : `Hora de inicio (${dayLabel})`}
                      labelClassName="sr-only"
                      value={currentTimes.start_time}
                      onValueChange={(value) => setTime(day, 'start_time', value)}
                      options={TIME_SELECT_OPTIONS}
                      placeholder="Inicio"
                    />
                    <span className="text-sm text-muted-foreground">a</span>
                    <SelectField
                      id={`teacher-schedule-end-${day}`}
                      label={scheduleDays.length === 1 ? 'Hora de fin' : `Hora de fin (${dayLabel})`}
                      labelClassName="sr-only"
                      value={currentTimes.end_time}
                      onValueChange={(value) => setTime(day, 'end_time', value)}
                      options={TIME_SELECT_OPTIONS}
                      placeholder="Fin"
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-warning">Marca al menos un día.</p>
          )}
        </FormField>
      </FormDialog>
    </div>
  )
}
