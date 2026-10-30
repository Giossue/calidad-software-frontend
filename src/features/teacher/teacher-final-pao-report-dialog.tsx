import { useEffect, useState, type FormEvent } from 'react'
import { SendIcon } from 'lucide-react'

import { Checkbox } from '@/components/ui/checkbox'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { Field, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { InfoTip } from '@/components/ui/info-tip'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { FinalPaoReportDocument } from '@/features/reports/final-pao-report-document'
import { PrintReport, SheetFrame } from '@/features/reports/report-sheet'
import { describeError, useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice } from '@/components/ui/error-notice'
import type { FinalPaoReportSummary } from '@/lib/final-pao-report'
import { todayIsoDate } from '@/lib/format'
import { teacherApi, type TeacherTutoring } from '@/lib/teacher-api'

const MAX_TEXT = 5000
const MAX_OBSERVATION = 1000

/** Prepara, revisa e imprime el "Informe final PAO" del docente y lo envía a coordinación. */
export function FinalPaoReportDialog({
  tutoring,
  open,
  onClose,
  onSent,
}: Readonly<{ tutoring: TeacherTutoring; open: boolean; onClose: () => void; onSent: () => Promise<unknown> }>) {
  const operation = useOperation()
  const [date, setDate] = useState(todayIsoDate)
  const [reportNumber, setReportNumber] = useState('')
  const [selectedIds, setSelectedIds] = useState<readonly number[] | null>(null)
  const [observations, setObservations] = useState<Readonly<Record<number, string>>>({})
  const [conclusions, setConclusions] = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [preview, setPreview] = useState<FinalPaoReportSummary | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const selectionKey = selectedIds?.join(',') ?? ''

  useEffect(() => {
    if (!open || !date) return
    let cancelled = false
    const tutoringIds = selectionKey ? selectionKey.split(',').map(Number) : undefined
    teacherApi.finalPaoReportPreview(tutoring.id, { date, tutoring_ids: tutoringIds }).then(
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
  }, [open, tutoring.id, date, selectionKey, attempt])

  const loading = !preview && !loadError
  const available = preview?.available_tutorings ?? []
  const included = preview?.matrix.map((row) => row.tutoring_id) ?? []
  const checkedIds = selectedIds ?? included
  const summary: FinalPaoReportSummary | null = preview && {
    ...preview,
    report_number: reportNumber.trim() || preview.report_number,
    matrix: preview.matrix.map((row) => ({ ...row, observation: observations[row.tutoring_id]?.trim() || null })),
    conclusions: conclusions.trim() || null,
    recommendations: recommendations.trim() || null,
  }
  const dirty = Boolean(conclusions.trim() || recommendations.trim() || Object.values(observations).some((value) => value.trim()))

  function toggle(id: number, checked: boolean) {
    const next = checked ? [...checkedIds, id] : checkedIds.filter((value) => value !== id)
    setSelectedIds(available.map((item) => item.id).filter((value) => next.includes(value)))
  }

  function close() {
    setDate(todayIsoDate())
    setReportNumber('')
    setSelectedIds(null)
    setObservations({})
    setConclusions('')
    setRecommendations('')
    setPreview(null)
    setLoadError(null)
    operation.clearError()
    onClose()
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!summary) return
    void operation.run(
      () => teacherApi.sendFinalPaoReport(tutoring.id, {
        date,
        report_number: summary.report_number,
        tutoring_ids: included,
        observations: Object.fromEntries(included.map((id) => [id, observations[id]?.trim() ?? ''])),
        conclusions: conclusions.trim(),
        recommendations: recommendations.trim(),
      }),
      'Informe final PAO enviado a coordinación.',
      async () => {
        close()
        await onSent()
      },
    )
  }

  const today = todayIsoDate()

  const blockReason = !date
    ? 'Indica la fecha del informe.'
    : loading
      ? 'Calculando el informe…'
      : !summary
        ? 'No se pudo calcular el informe.'
        : !tutoring.can_manage
          ? 'No tienes permiso para enviar este informe.'
          : null

  return (
    <FormDialog
      open={open}
      title="Informe final PAO"
      description={`Ejecución de tutorías académicas · ${tutoring.period_name}`}
      pending={operation.pending}
      error={operation.error}
      dirty={dirty}
      requireChanges={false}
      blockReason={blockReason}
      onClose={close}
      onSubmit={submit}
      submitLabel="Enviar a coordinación"
      submitIcon={SendIcon}
      maxWidth="max-w-6xl"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="final-pao-date" label="Fecha de informe">
          <Input id="final-pao-date" type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} required />
        </FormField>
        <FormField id="final-pao-number" label="No. de informe" optional tip="Si lo dejas vacío se usa el número sugerido.">
          <Input
            id="final-pao-number"
            value={reportNumber}
            onChange={(event) => setReportNumber(event.target.value)}
            maxLength={30}
            placeholder={preview?.report_number ?? '01-TA-2026'}
          />
        </FormField>
      </div>

      {available.length > 1 && (
        <FieldSet>
          <div className="flex items-center gap-1.5">
            <FieldLegend variant="label" className="mb-0">Asignaturas incluidas</FieldLegend>
            <InfoTip>Tus tutorías del mismo período y carrera. La tutoría actual siempre se incluye.</InfoTip>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {available.map((item) => (
              <Field key={item.id} orientation="horizontal">
                <Checkbox
                  id={`final-pao-tutoring-${item.id}`}
                  checked={checkedIds.includes(item.id)}
                  disabled={item.id === tutoring.id}
                  onCheckedChange={(checked) => toggle(item.id, checked === true)}
                />
                <FieldLabel htmlFor={`final-pao-tutoring-${item.id}`} className="font-normal">
                  {item.subject}{item.section ? ` · Paralelo ${item.section}` : ''}
                </FieldLabel>
              </Field>
            ))}
          </div>
        </FieldSet>
      )}

      {preview && preview.matrix.length > 0 && (
        <FieldSet>
          <FieldLegend variant="label">Observaciones por asignatura</FieldLegend>
          {preview.matrix.map((row) => (
            <FormField key={row.tutoring_id} id={`final-pao-observation-${row.tutoring_id}`} label={`${row.subject}${row.section ? ` · Paralelo ${row.section}` : ''}`} optional>
              <Input
                id={`final-pao-observation-${row.tutoring_id}`}
                value={observations[row.tutoring_id] ?? ''}
                onChange={(event) => setObservations({ ...observations, [row.tutoring_id]: event.target.value })}
                maxLength={MAX_OBSERVATION}
              />
            </FormField>
          ))}
        </FieldSet>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <FormField id="final-pao-conclusions" label="Conclusiones" optional counter={{ current: conclusions.length, max: MAX_TEXT }}>
          <Textarea id="final-pao-conclusions" value={conclusions} onChange={(event) => setConclusions(event.target.value)} maxLength={MAX_TEXT} rows={4} />
        </FormField>
        <FormField id="final-pao-recommendations" label="Recomendaciones" optional counter={{ current: recommendations.length, max: MAX_TEXT }}>
          <Textarea id="final-pao-recommendations" value={recommendations} onChange={(event) => setRecommendations(event.target.value)} maxLength={MAX_TEXT} rows={4} />
        </FormField>
      </div>

      <ErrorNotice message={loadError} retry={() => { setLoadError(null); setAttempt((value) => value + 1) }} />
      {loading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner aria-hidden="true" />
          Calculando el informe con las tutorías, asistencias y notas registradas…
        </p>
      )}
      {summary && (
        <SheetFrame>
          <FinalPaoReportDocument summary={summary} />
        </SheetFrame>
      )}
      {summary && (
        <div className="flex justify-end">
          <PrintReport disabled={operation.pending}><FinalPaoReportDocument summary={summary} /></PrintReport>
        </div>
      )}
    </FormDialog>
  )
}
