import { useEffect, useState, type FormEvent } from 'react'
import { SendIcon } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { FollowUpReportDocument } from '@/features/reports/follow-up-report-document'
import { PrintReport, SheetFrame } from '@/features/reports/report-sheet'
import { describeError, useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice } from '@/components/ui/error-notice'
import type { FollowUpReportSummary } from '@/lib/follow-up-report'
import { todayIsoDate } from '@/lib/format'
import { teacherApi, type FollowUpReportParams, type TeacherTutoring } from '@/lib/teacher-api'

const MAX_OBSERVATIONS = 5000
const PARTIAL_OPTIONS = [{ value: '1', label: 'Primer parcial' }, { value: '2', label: 'Segundo parcial' }]

function initialParams(tutoring: TeacherTutoring): FollowUpReportParams {
  const today = todayIsoDate()
  const start = tutoring.period_start_date && tutoring.period_start_date <= today ? tutoring.period_start_date : today
  return { partial: 1, from: start, to: today, date: today }
}

/** Prepara, revisa e imprime el "Reporte de Seguimiento a las Tutorías Académicas" de un parcial y lo envía a coordinación. */
export function FollowUpReportDialog({
  tutoring,
  open,
  onClose,
  onSent,
}: Readonly<{ tutoring: TeacherTutoring; open: boolean; onClose: () => void; onSent: () => Promise<unknown> }>) {
  const operation = useOperation()
  const [params, setParams] = useState(() => initialParams(tutoring))
  const [observations, setObservations] = useState('')
  const [preview, setPreview] = useState<FollowUpReportSummary | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const validRange = Boolean(params.from && params.to && params.date && params.from <= params.to)
  const { partial, from, to, date } = params

  useEffect(() => {
    if (!open || !validRange) return
    let cancelled = false
    teacherApi.followUpReportPreview(tutoring.id, { partial, from, to, date }).then(
      (summary) => {
        if (cancelled) return
        setPreview(summary)
        setLoadError(null)
      },
      (caught: unknown) => {
        if (!cancelled) setLoadError(describeError(caught))
      },
    )
    return () => { cancelled = true }
  }, [open, validRange, tutoring.id, partial, from, to, date, attempt])

  const loading = validRange && !preview && !loadError
  const summary = validRange && preview ? { ...preview, observations: observations.trim() || null } : null
  const hasSessions = Boolean(preview && preview.session_count > 0)

  function update(changes: Partial<FollowUpReportParams>) {
    setParams((current) => ({ ...current, ...changes }))
  }

  function close() {
    setParams(initialParams(tutoring))
    setObservations('')
    setPreview(null)
    setLoadError(null)
    operation.clearError()
    onClose()
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void operation.run(
      () => teacherApi.sendFollowUpReport(tutoring.id, { ...params, observations: observations.trim() }),
      'Reporte de seguimiento enviado a coordinación.',
      async () => {
        close()
        await onSent()
      },
    )
  }

  const today = todayIsoDate()

  const blockReason = !validRange
    ? 'Indica un rango de fechas válido.'
    : loading
      ? 'Calculando el reporte…'
      : !hasSessions
        ? 'No hay tutorías registradas entre las fechas indicadas.'
        : !tutoring.can_manage
          ? 'No tienes permiso para enviar este reporte.'
          : null

  return (
    <FormDialog
      open={open}
      title="Reporte de seguimiento a las tutorías"
      description={`${tutoring.subject_name} · Paralelo ${tutoring.section_name}`}
      pending={operation.pending}
      error={operation.error}
      dirty={observations.trim() !== ''}
      requireChanges={false}
      blockReason={blockReason}
      onClose={close}
      onSubmit={submit}
      submitLabel="Enviar a coordinación"
      submitIcon={SendIcon}
      maxWidth="max-w-5xl"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField id="follow-up-partial" label="Parcial" value={String(partial)} onValueChange={(value) => update({ partial: value === '2' ? 2 : 1 })} options={PARTIAL_OPTIONS} />
        <FormField id="follow-up-from" label="Tutorías desde">
          <Input id="follow-up-from" type="date" value={from} max={to || today} onChange={(event) => update({ from: event.target.value })} required />
        </FormField>
        <FormField id="follow-up-to" label="Tutorías hasta">
          <Input id="follow-up-to" type="date" value={to} min={from} max={today} onChange={(event) => update({ to: event.target.value })} required />
        </FormField>
        <FormField id="follow-up-date" label="Fecha de presentación">
          <Input id="follow-up-date" type="date" value={date} max={today} onChange={(event) => update({ date: event.target.value })} required />
        </FormField>
      </div>
      <FormField id="follow-up-observations" label="Observación" optional counter={{ current: observations.length, max: MAX_OBSERVATIONS }}>
        <Textarea
          id="follow-up-observations"
          value={observations}
          onChange={(event) => setObservations(event.target.value)}
          maxLength={MAX_OBSERVATIONS}
          rows={3}
          placeholder="Ej.: Los temas de refuerzo fueron seleccionados por los estudiantes según sus requerimientos académicos."
        />
      </FormField>

      {!validRange && (
        <Alert variant="destructive">
          <AlertDescription>Indica un rango de fechas válido: «desde» no puede ser posterior a «hasta».</AlertDescription>
        </Alert>
      )}
      <ErrorNotice message={loadError} retry={() => { setLoadError(null); setAttempt((value) => value + 1) }} />
      {loading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner aria-hidden="true" />
          Calculando el reporte con las tutorías registradas…
        </p>
      )}
      {validRange && preview && !hasSessions && (
        <Alert>
          <AlertDescription>No hay tutorías registradas entre las fechas indicadas. Ajusta el rango o registra la asistencia antes de enviar el reporte.</AlertDescription>
        </Alert>
      )}
      {summary && (
        <SheetFrame>
          <FollowUpReportDocument summary={summary} />
        </SheetFrame>
      )}
      {summary && (
        <div className="flex justify-end">
          <PrintReport disabled={operation.pending}><FollowUpReportDocument summary={summary} /></PrintReport>
        </div>
      )}
    </FormDialog>
  )
}
