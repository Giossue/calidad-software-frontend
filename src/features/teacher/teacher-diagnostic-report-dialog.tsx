import { useEffect, useState, type FormEvent } from 'react'
import { SendIcon } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { Field, FieldCounter, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { DiagnosticReportDocument } from '@/features/reports/diagnostic-report-document'
import { PrintReport, SheetFrame } from '@/features/reports/report-sheet'
import { describeError, useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice } from '@/features/tutoring/tutoring-shared'
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

  return (
    <Dialog
      open={open}
      title="Reporte de la evaluación diagnóstica"
      description={`${tutoring.subject_name} · Paralelo ${tutoring.section_name}`}
      confirmClose={observations.trim() !== ''}
      onClose={() => { if (!operation.pending) close() }}
      maxWidth="max-w-5xl"
    >
      <form onSubmit={submit} aria-label="Reporte de la evaluación diagnóstica" className="max-h-[70vh] overflow-y-auto p-1">
        <fieldset disabled={operation.pending}>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
              <Field>
                <FieldLabel htmlFor="diagnostic-report-date">Fecha</FieldLabel>
                <Input
                  id="diagnostic-report-date"
                  type="date"
                  value={date}
                  max={todayIsoDate()}
                  onChange={(event) => setDate(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="diagnostic-report-observations">Observaciones</FieldLabel>
                  <FieldCounter current={observations.length} max={MAX_OBSERVATIONS} />
                </div>
                <Textarea
                  id="diagnostic-report-observations"
                  value={observations}
                  onChange={(event) => setObservations(event.target.value)}
                  maxLength={MAX_OBSERVATIONS}
                  rows={3}
                  placeholder="Ej.: Al menos 9 estudiantes requieren clase de refuerzo sobre conceptos básicos."
                />
              </Field>
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

            <ErrorNotice message={operation.error} />
            <div className="flex flex-wrap justify-end gap-3">
              <DialogCancelButton disabled={operation.pending}>Cancelar</DialogCancelButton>
              {summary && <PrintReport disabled={operation.pending}><DiagnosticReportDocument summary={summary} /></PrintReport>}
              <Button type="submit" disabled={operation.pending || !hasGrades || !tutoring.can_manage}>
                {operation.pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <SendIcon data-icon="inline-start" />}
                {operation.pending ? 'Enviando…' : 'Enviar a coordinación'}
              </Button>
            </div>
          </FieldGroup>
        </fieldset>
      </form>
    </Dialog>
  )
}
