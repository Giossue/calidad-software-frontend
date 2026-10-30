import { useEffect, useState, type FormEvent } from 'react'
import { SendIcon } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { DiagnosticReportDocument } from '@/features/reports/diagnostic-report-document'
import { PrintReport, SheetFrame } from '@/features/reports/report-sheet'
import { describeError, useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice } from '@/components/ui/error-notice'
import type { DiagnosticReportSummary } from '@/lib/diagnostic-report'
import { todayIsoDate } from '@/lib/format'
import { teacherApi, type TeacherTutoring } from '@/lib/teacher-api'

const MAX_OBSERVATIONS = 5000

/** Prepara, revisa e imprime el "Reporte de la Evaluación Diagnóstica" y lo envía a coordinación. */
export function DiagnosticReportDialog({
  tutoring,
  open,
  onClose,
  onSent,
}: Readonly<{ tutoring: TeacherTutoring; open: boolean; onClose: () => void; onSent: () => Promise<unknown> }>) {
  const operation = useOperation()
  const [date, setDate] = useState(todayIsoDate)
  const [observations, setObservations] = useState('')
  const [preview, setPreview] = useState<DiagnosticReportSummary | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!open || !date) return
    let cancelled = false
    teacherApi.diagnosticReportPreview(tutoring.id, date).then(
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
  }, [open, tutoring.id, date, attempt])

  const loading = !preview && !loadError
  const summary = preview && { ...preview, date, observations: observations.trim() || null }
  const hasGrades = Boolean(preview && preview.students_evaluated > 0)

  function close() {
    setDate(todayIsoDate())
    setObservations('')
    setPreview(null)
    setLoadError(null)
    operation.clearError()
    onClose()
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void operation.run(
      () => teacherApi.sendDiagnosticReport(tutoring.id, { date, observations: observations.trim() }),
      'Reporte de evaluación diagnóstica enviado a coordinación.',
      async () => {
        close()
        await onSent()
      },
    )
  }

  const blockReason = !date
    ? 'Indica la fecha del reporte.'
    : loading
      ? 'Calculando el reporte…'
      : !hasGrades
        ? 'Aún no hay calificaciones diagnósticas registradas.'
        : !tutoring.can_manage
          ? 'No tienes permiso para enviar este reporte.'
          : null

  return (
    <FormDialog
      open={open}
      title="Reporte de la evaluación diagnóstica"
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
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <FormField id="diagnostic-report-date" label="Fecha">
          <Input
            id="diagnostic-report-date"
            type="date"
            value={date}
            max={todayIsoDate()}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </FormField>
        <FormField id="diagnostic-report-observations" label="Observaciones" optional counter={{ current: observations.length, max: MAX_OBSERVATIONS }}>
          <Textarea
            id="diagnostic-report-observations"
            value={observations}
            onChange={(event) => setObservations(event.target.value)}
            maxLength={MAX_OBSERVATIONS}
            rows={3}
            placeholder="Ej.: Al menos 9 estudiantes requieren clase de refuerzo sobre conceptos básicos."
          />
        </FormField>
      </div>

      <ErrorNotice message={loadError} retry={() => { setLoadError(null); setAttempt((value) => value + 1) }} />
      {loading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner aria-hidden="true" />
          Calculando el reporte con las calificaciones registradas…
        </p>
      )}
      {preview && !hasGrades && (
        <Alert>
          <AlertDescription>
            Aún no hay calificaciones diagnósticas registradas. Regístralas en la pestaña Notas antes de enviar el reporte.
          </AlertDescription>
        </Alert>
      )}
      {summary && (
        <SheetFrame>
          <DiagnosticReportDocument summary={summary} />
        </SheetFrame>
      )}
      {summary && (
        <div className="flex justify-end">
          <PrintReport disabled={operation.pending}><DiagnosticReportDocument summary={summary} /></PrintReport>
        </div>
      )}
    </FormDialog>
  )
}
