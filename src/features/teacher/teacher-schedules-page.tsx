import { useEffect, useState, type FormEvent } from 'react'
import { CalendarClockIcon, CalendarDaysIcon, PencilIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { StatusBadge } from '@/components/ui/status-badge'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice, RecordTable, SelectField } from '@/features/tutoring/tutoring-shared'
import { DAY_LABELS, WEEK_DAYS, type TutoringSchedule } from '@/lib/tutoring-api'
import { teacherApi, type TeacherTutoring } from '@/lib/teacher-api'
import { cn } from '@/lib/utils'
import { TeacherEmpty } from './teacher-shared'

export const SCHEDULE_TIME_OPTIONS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00',
]

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
  const [formError, setFormError] = useState<string | null>(null)

  // Sync state if tutoring or schedules changes
  useEffect(() => {
    setSchedules(tutoring.schedules ?? [])
  }, [tutoring.schedules])

  function openEditModal() {
    operation.clearError()
    setFormError(null)

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

    if (days.length > 0) {
      setScheduleDays(days)
      setDayTimes(times)
    } else {
      setScheduleDays(['lunes'])
      setDayTimes({
        lunes: { start_time: '08:00', end_time: '10:00' },
      })
    }

    setIsEditing(true)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (scheduleDays.length === 0) {
      setFormError('Selecciona al menos un día para el horario de la tutoría.')
      return
    }

    for (const day of scheduleDays) {
      const times = dayTimes[day]
      const dayLabel = DAY_LABELS[day] ?? day
      if (!times?.start_time || !times?.end_time) {
        setFormError(`Selecciona la hora de inicio y fin para el día ${dayLabel}.`)
        return
      }
      if (times.start_time >= times.end_time) {
        setFormError(`En ${dayLabel}, la hora de fin debe ser posterior a la hora de inicio.`)
        return
      }
    }

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
      'Horarios de tutoría actualizados con éxito.',
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Horarios de tutoría</h3>
          <p className="text-sm text-muted-foreground">
            Días de la semana y rangos de horas de atención asignados a esta asignatura.
          </p>
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
            description="Haz clic en 'Editar horarios' para configurar los días y horas de esta tutoría."
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

      <Dialog
        open={isEditing}
        title="Editar horarios de tutoría"
        description={`Configura los días y horas de atención para ${tutoring.subject_name}.`}
        confirmClose={false}
        onClose={() => {
          if (!operation.pending) setIsEditing(false)
        }}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <ErrorNotice message={formError || operation.error} />

          <div className="flex flex-col gap-3 rounded-lg border p-3.5 bg-card">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <CalendarClockIcon className="size-4 text-primary" />
              Horario de la asignatura
            </h4>

            <Field>
              <FieldLabel htmlFor="teacher-schedule-days">
                Selección de días <span className="text-xs font-normal text-muted-foreground">(puedes seleccionar varios)</span>
              </FieldLabel>
              <div id="teacher-schedule-days" className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Días de la semana">
                {WEEK_DAYS.map((day) => {
                  const isChecked = scheduleDays.includes(day)
                  return (
                    <label
                      key={day}
                      className={cn(
                        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium cursor-pointer transition-colors select-none',
                        isChecked
                          ? 'bg-primary/10 border-primary text-primary dark:bg-primary/20'
                          : 'bg-background hover:bg-accent text-foreground border-input',
                      )}
                    >
                      <input
                        type="checkbox"
                        value={day}
                        checked={isChecked}
                        onChange={() => {
                          setScheduleDays((prev) => {
                            if (prev.includes(day)) {
                              return prev.filter((d) => d !== day)
                            } else {
                              const ref = prev[0] ? dayTimes[prev[0]] : undefined
                              setDayTimes((times) => ({
                                ...times,
                                [day]: times[day] ?? {
                                  start_time: ref?.start_time || '08:00',
                                  end_time: ref?.end_time || '10:00',
                                },
                              }))
                              return [...prev, day]
                            }
                          })
                        }}
                        className="size-4 rounded border-input text-primary focus:ring-primary/20"
                      />
                      <span>{DAY_LABELS[day]}</span>
                    </label>
                  )
                })}
              </div>
            </Field>

            {/* Horario por día */}
            <div className="flex flex-col gap-3 pt-1">
              <span className="text-xs font-medium text-muted-foreground">
                Horario por día (puedes configurar horas diferentes según el día):
              </span>
              {scheduleDays.map((day) => {
                const dayLabel = DAY_LABELS[day] ?? day
                const currentTimes = dayTimes[day] ?? { start_time: '08:00', end_time: '10:00' }
                return (
                  <div
                    key={day}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-muted/20"
                  >
                    <div className="sm:w-28 flex items-center gap-2 font-semibold text-sm text-foreground shrink-0">
                      <CalendarDaysIcon className="size-4 text-primary" />
                      <span>{dayLabel}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 flex-1">
                      <SelectField
                        id={`teacher-schedule-start-${day}`}
                        label={scheduleDays.length === 1 ? 'Hora de inicio' : `Hora de inicio (${dayLabel})`}
                        value={currentTimes.start_time}
                        onChange={(val) => {
                          setDayTimes((prev) => ({
                            ...prev,
                            [day]: { ...(prev[day] ?? { end_time: '10:00' }), start_time: val },
                          }))
                        }}
                        required
                      >
                        <option value="">Selecciona hora</option>
                        {SCHEDULE_TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </SelectField>
                      <SelectField
                        id={`teacher-schedule-end-${day}`}
                        label={scheduleDays.length === 1 ? 'Hora de fin' : `Hora de fin (${dayLabel})`}
                        value={currentTimes.end_time}
                        onChange={(val) => {
                          setDayTimes((prev) => ({
                            ...prev,
                            [day]: { ...(prev[day] ?? { start_time: '08:00' }), end_time: val },
                          }))
                        }}
                        required
                      >
                        <option value="">Selecciona hora</option>
                        {SCHEDULE_TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </SelectField>
                    </div>
                  </div>
                )
              })}
              {scheduleDays.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Selecciona al menos un día arriba para configurar su horario.
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <DialogCancelButton disabled={operation.pending}>
              Cancelar
            </DialogCancelButton>
            <Button
              type="submit"
              disabled={operation.pending || scheduleDays.length === 0}
            >
              <PencilIcon data-icon="inline-start" />
              Guardar horarios
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
