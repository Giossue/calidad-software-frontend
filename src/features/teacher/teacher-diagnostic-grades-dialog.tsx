import { useEffect, useState, type FormEvent } from 'react'
import { SendIcon } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { ErrorNotice } from '@/components/ui/error-notice'
import { FormDialog } from '@/components/ui/form-dialog'
import { Spinner } from '@/components/ui/spinner'
import { DiagnosticGradesSheet } from '@/features/reports/diagnostic-grades-document'
import { PrintReport, SheetFrame } from '@/features/reports/report-sheet'
import { describeError, useOperation } from '@/features/tutoring/tutoring-hooks'
import type { DiagnosticGradesSummary } from '@/lib/diagnostic-grades'
import { teacherApi, type TeacherTutoring } from '@/lib/teacher-api'

/** Muestra, imprime y envía a coordinación las "Calificaciones Evaluación Diagnóstica". */
export function DiagnosticGradesDialog({
  tutoring,
  open,
  onClose,
  onSent,
}: Readonly<{ tutoring: TeacherTutoring; open: boolean; onClose: () => void; onSent: () => Promise<unknown> }>) {
  const operation = useOperation()
  const [preview, setPreview] = useState<DiagnosticGradesSummary | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    teacherApi.diagnosticGradesPreview(tutoring.id).then(
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
  }, [open, tutoring.id, attempt])

  const loading = !preview && !loadError
  const hasGrades = Boolean(preview && preview.students_evaluated > 0)

  function close() {
    setPreview(null)
    setLoadError(null)
    operation.clearError()
    onClose()
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void operation.run(
      () => teacherApi.sendDiagnosticGrades(tutoring.id),
      'Calificaciones diagnósticas enviadas a coordinación.',
      async () => {
        close()
        await onSent()
      },
    )
  }

  const blockReason = loading
    ? 'Cargando las calificaciones…'
    : !hasGrades
      ? 'No hay calificaciones para enviar.'
      : !tutoring.can_manage
        ? 'No tienes permiso para enviar estas calificaciones.'
        : null

  return (
    <FormDialog
      open={open}
      title="Calificaciones diagnósticas"
      description={`${tutoring.subject_name} · Paralelo ${tutoring.section_name}`}
      pending={operation.pending}
      error={operation.error}
      dirty={false}
      requireChanges={false}
      blockReason={blockReason}
      onClose={close}
      onSubmit={submit}
      submitLabel="Enviar a coordinación"
      submitIcon={SendIcon}
      maxWidth="max-w-5xl"
    >
      <ErrorNotice message={loadError} retry={() => { setLoadError(null); setAttempt((value) => value + 1) }} />
      {loading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner aria-hidden="true" />
          Cargando las calificaciones diagnósticas registradas…
        </p>
      )}
      {preview && !hasGrades && (
        <Alert>
          <AlertDescription>
            Aún no hay calificaciones diagnósticas registradas. Regístralas en Estudiantes y Calificaciones antes de enviarlas.
          </AlertDescription>
        </Alert>
      )}
      {preview && (
        <SheetFrame>
          <DiagnosticGradesSheet summary={preview} />
        </SheetFrame>
      )}
      {preview && (
        <div className="flex justify-end">
          <PrintReport disabled={operation.pending}><DiagnosticGradesSheet summary={preview} /></PrintReport>
        </div>
      )}
    </FormDialog>
  )
}
