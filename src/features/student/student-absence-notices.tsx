import { useState, type FormEvent } from 'react'
import { ListIcon, MailWarningIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice } from '@/components/ui/error-notice'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { formatDate } from '@/lib/format'
import { studentApi, type StudentAbsenceNotice } from '@/lib/student-api'

const STATUS: Record<StudentAbsenceNotice['status'], { label: string; variant: 'success' | 'danger' | 'outline' }> = {
  pendiente: { label: 'Enviado al docente', variant: 'outline' },
  presente: { label: 'Registrado: presente', variant: 'success' },
  ausente: { label: 'Registrado: ausente', variant: 'danger' },
}

function todayDate(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Avisos al docente de que el estudiante no podrá asistir a una clase. */
export function AbsenceNotices({ tutoringId, canNotify }: Readonly<{ tutoringId: number; canNotify: boolean }>) {
  const notices = useDegreeResource(() => studentApi.absenceNotices(tutoringId), String(tutoringId))
  const operation = useOperation()
  const [open, setOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [date, setDate] = useState(todayDate)
  const [reason, setReason] = useState('')

  function openDialog() {
    setDate(todayDate())
    setReason('')
    operation.clearError()
    setOpen(true)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void operation.run(
      () => studentApi.createAbsenceNotice(tutoringId, { date, reason: reason.trim() }),
      'Aviso enviado a tu docente.',
      async () => {
        setOpen(false)
        await notices.reload()
      },
    )
  }

  const items = notices.data ?? []

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4" aria-labelledby="absence-notices-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <h3 id="absence-notices-title" className="font-semibold">Avisos de inasistencia</h3>
          <p className="text-sm text-muted-foreground">{items.length === 0 ? 'Aún no has enviado avisos.' : items.length === 1 ? '1 aviso enviado' : `${items.length} avisos enviados`}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {items.length > 0 && (
            <Button type="button" variant="secondary" onClick={() => setListOpen(true)}>
              <ListIcon data-icon="inline-start" />Ver avisos ({items.length})
            </Button>
          )}
          {canNotify && (
            <Button type="button" onClick={openDialog}>
              <MailWarningIcon data-icon="inline-start" />Avisar inasistencia
            </Button>
          )}
        </div>
      </div>
      <ErrorNotice message={notices.error} retry={notices.reload} />

      <Dialog open={listOpen} onClose={() => setListOpen(false)} title="Avisos de inasistencia" description="Tu docente decide la asistencia al tomar lista.">
        <RecordTable
          rows={items}
          loading={notices.loading}
          empty="Aún no has enviado avisos."
          columns={[
            { label: 'Fecha', render: (notice) => <span className="font-medium">{formatDate(notice.date)}</span> },
            { label: 'Motivo', render: (notice) => <span title={notice.reason} className="line-clamp-2 whitespace-normal text-muted-foreground">{notice.reason}</span> },
            { label: 'Estado', render: (notice) => <Badge variant={STATUS[notice.status].variant}>{STATUS[notice.status].label}</Badge> },
          ]}
        />
      </Dialog>

      <FormDialog
        open={open}
        title="Avisar inasistencia"
        description="Tu docente recibirá el aviso y lo verá al tomar lista."
        pending={operation.pending}
        error={operation.error}
        dirty={reason.trim() !== ''}
        blockReason={!date ? 'Indica la fecha de la clase.' : reason.trim().length < 5 ? 'El motivo debe tener al menos 5 caracteres.' : null}
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Enviar aviso"
        submitIcon={MailWarningIcon}
      >
        <FormField id="absence-date" label="Fecha de la clase">
          <Input id="absence-date" type="date" min={todayDate()} value={date} onChange={(event) => setDate(event.target.value)} required />
        </FormField>
        <FormField id="absence-reason" label="Motivo" tip="Mínimo 5 caracteres." counter={{ current: reason.length, max: 500 }}>
          <Textarea id="absence-reason" value={reason} onChange={(event) => setReason(event.target.value.slice(0, 500))} maxLength={500} rows={3} required placeholder="Ej. Cita médica programada" />
        </FormField>
      </FormDialog>
    </section>
  )
}
