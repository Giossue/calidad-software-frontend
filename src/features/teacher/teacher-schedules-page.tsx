import { useEffect, useState, type FormEvent } from 'react'
import { CalendarClockIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/ui/form-dialog'
import { StatusBadge } from '@/components/ui/status-badge'
import { rowsFromSchedules, ScheduleEditor, scheduleSignature, toScheduleItems, validateScheduleRows, type ScheduleRow } from '@/features/tutoring/schedule-editor'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { DAY_LABELS, type TutoringSchedule } from '@/lib/tutoring-api'
import { teacherApi, type TeacherTutoring } from '@/lib/teacher-api'
import { TeacherEmpty } from './teacher-shared'

interface SchedulesPanelProps {
  tutoring: TeacherTutoring
  onReload?: () => Promise<unknown> | void
}

export function SchedulesPanel({ tutoring, onReload }: Readonly<SchedulesPanelProps>) {
  const operation = useOperation()
  const [schedules, setSchedules] = useState<readonly TutoringSchedule[]>(tutoring.schedules ?? [])
  const [isEditing, setIsEditing] = useState(false)
  const [rows, setRows] = useState<ScheduleRow[]>([])
  const [initialSignature, setInitialSignature] = useState('')
  const [attempted, setAttempted] = useState(false)

  // Sync state if tutoring or schedules changes
  useEffect(() => {
    setSchedules(tutoring.schedules ?? [])
  }, [tutoring.schedules])

  function openEditModal() {
    operation.clearError()
    // El docente parte de su horario vigente; sin horario, sin filas (lo agrega con «Agregar horario»).
    const initialRows = rowsFromSchedules(schedules.filter((s) => s.is_active))
    setRows(initialRows)
    setInitialSignature(scheduleSignature(initialRows))
    setAttempted(false)
    setIsEditing(true)
  }

  // El docente sí necesita un horario: sin él no puede tomar asistencia.
  const blockReason = validateScheduleRows(rows, { required: true })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (blockReason) {
      setAttempted(true)
      return
    }

    // Cada día conserva el aula que ya tenía; uno nuevo queda «Por asignar».
    const payload = toScheduleItems(rows).map((item) => ({
      ...item,
      room: schedules.find((s) => s.day === item.day)?.room || 'Por asignar',
    }))

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
        dirty={scheduleSignature(rows) !== initialSignature}
        blockReason={blockReason}
        onClose={() => { setIsEditing(false); operation.clearError() }}
        onSubmit={handleSubmit}
        submitLabel="Guardar horarios"
        maxWidth="max-w-2xl"
      >
        <ScheduleEditor prefix="teacher" rows={rows} onChange={setRows} required showErrors={attempted} />
      </FormDialog>
    </div>
  )
}
