import { useState, type FormEvent } from 'react'
import { ListIcon, MailWarningIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { SelectInput } from '@/components/ui/select-field'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice } from '@/components/ui/error-notice'
import { formatDate } from '@/lib/format'
import { studentApi, type StudentAbsenceDate, type StudentAbsenceNotice } from '@/lib/student-api'
import { DAY_LABELS } from '@/lib/tutoring-api'
import { SelectSkeleton } from './student-skeletons'

const STATUS: Record<StudentAbsenceNotice['status'], { label: string; variant: 'success' | 'danger' | 'outline' }> = {
  pendiente: { label: 'Enviado al docente', variant: 'outline' },
  presente: { label: 'Registrado: presente', variant: 'success' },
  ausente: { label: 'Registrado: ausente', variant: 'danger' },
}

// Las próximas clases bastan para avisar con tiempo; evita una lista de todo el período.
const MAX_DATES = 10

function classLabel(item: StudentAbsenceDate): string {
  return `${DAY_LABELS[item.day_of_week] ?? item.day_of_week} ${formatDate(item.date)} · ${item.start_time} – ${item.end_time}`
}

/** Avisos al docente de que el estudiante no podrá asistir a una clase. */
export function AbsenceNotices({ tutoringId, canNotify }: Readonly<{ tutoringId: number; canNotify: boolean }>) {
  const notices = useDegreeResource(() => studentApi.absenceNotices(tutoringId), String(tutoringId))
  const operation = useOperation()
  const [open, setOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const dates = useDegreeResource(() => studentApi.absenceDates(tutoringId), `absence-dates-${tutoringId}`)
  const options = (dates.data ?? []).slice(0, MAX_DATES)
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  // El error del motivo se muestra bajo el campo una vez que el estudiante sale de él.
  const [reasonTouched, setReasonTouched] = useState(false)

  async function openDialog() {
    setDate('')
    setReason('')
    setReasonTouched(false)
    operation.clearError()
    setOpen(true)
    await dates.reload()
  }

  // Sin elegir, se propone la próxima clase.
  const selectedDate = date || options[0]?.date || ''

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void operation.run(
      () => studentApi.createAbsenceNotice(tutoringId, { date: selectedDate, reason: reason.trim() }),
      'Aviso enviado a tu docente.',
      async () => {
        setOpen(false)
        await Promise.all([notices.reload(), dates.reload()])
      },
    )
  }

  const reasonError = reason.trim().length < 5 ? 'El motivo debe tener al menos 5 caracteres.' : null
  const items = notices.data ?? []
  // Hasta la primera respuesta no se sabe cuántos avisos hay: no se afirma que no existen.
  const noticesPending = notices.loading && !notices.data

  return (
    <Card role="region" className="flex flex-col gap-3 p-4" aria-labelledby="absence-notices-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <h3 id="absence-notices-title" className="font-semibold">Avisos de inasistencia</h3>
          {noticesPending
            ? <Skeleton role="status" aria-label="Cargando avisos" className="mt-1 h-4 w-32" />
            : <p className="text-sm text-muted-foreground">{items.length === 0 ? 'Aún no has enviado avisos.' : items.length === 1 ? '1 aviso enviado' : `${items.length} avisos enviados`}</p>}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {items.length > 0 && (
            <Button type="button" variant="secondary" onClick={() => setListOpen(true)}>
              <ListIcon data-icon="inline-start" />Ver avisos ({items.length})
            </Button>
          )}
          {canNotify && (
            <Button type="button" onClick={() => void openDialog()}>
              <MailWarningIcon data-icon="inline-start" />Avisar inasistencia
            </Button>
          )}
        </div>
      </div>
      <ErrorNotice message={notices.error} retry={notices.reload} />

      <Dialog open={listOpen} onClose={() => setListOpen(false)} title="Avisos de inasistencia" description="Tu docente decide la asistencia al tomar lista.">
        <ul className="flex flex-col divide-y text-sm">
          {items.map((notice) => <li key={notice.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{formatDate(notice.date)}</span>
              <Badge variant={STATUS[notice.status].variant}>{STATUS[notice.status].label}</Badge>
            </div>
            <p className="whitespace-pre-wrap break-words text-muted-foreground">{notice.reason}</p>
          </li>)}
        </ul>
      </Dialog>

      <FormDialog
        open={open}
        title="Avisar inasistencia"
        description="Tu docente recibirá el aviso y lo verá al tomar lista."
        pending={operation.pending}
        error={operation.error}
        dirty={reason.trim() !== ''}
        blockReason={!selectedDate ? 'No hay próximas clases para avisar.' : reasonError}
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Enviar aviso"
        submitIcon={MailWarningIcon}
      >
        <FormField id="absence-date" label="Clase" required tip="Solo aparecen las próximas clases de tu horario en las que aún no avisaste.">
          {dates.loading && options.length === 0
            ? <SelectSkeleton label="Cargando tus próximas clases" />
            : options.length === 0
              ? <p className="text-sm text-muted-foreground">No hay próximas clases para avisar en este período.</p>
              : <SelectInput
                id="absence-date"
                ariaLabel="Clase"
                className="w-full"
                value={selectedDate}
                onValueChange={setDate}
                options={options.map((item) => ({ value: item.date, label: classLabel(item) }))}
              />}
        </FormField>
        <FormField id="absence-reason" label="Motivo" required counter={{ current: reason.length, max: 500 }} error={reasonTouched ? reasonError : null}>
          <Textarea id="absence-reason" value={reason} onChange={(event) => setReason(event.target.value.slice(0, 500))} onBlur={() => setReasonTouched(true)} maxLength={500} rows={3} required placeholder="Ej. Cita médica programada" aria-invalid={reasonTouched && Boolean(reasonError)} />
        </FormField>
      </FormDialog>
    </Card>
  )
}
