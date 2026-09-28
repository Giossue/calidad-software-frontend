import type { ReactNode } from 'react'
import { CalendarIcon } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { Field, FieldCounter, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { ErrorNotice } from '@/features/tutoring/tutoring-shared'
import type { DegreeTopicStatus } from '@/lib/degree-coordination-api'
import { DEGREE_STATUS_LABELS, formatDegreeDate } from './degree-format'
import type { useDegreePeriod } from './degree-hooks'

export function DegreeStatusBadge({ status }: Readonly<{ status: DegreeTopicStatus }>) {
  return <Badge variant={status === 'aprobado' ? 'success' : status === 'rechazado' ? 'destructive' : 'secondary'}>{DEGREE_STATUS_LABELS[status]}</Badge>
}

export function DegreePeriodCard({ resource, extra }: Readonly<{ resource: ReturnType<typeof useDegreePeriod>; extra?: ReactNode }>) {
  if (resource.loading) return <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner aria-hidden="true" />Cargando período académico…</p>
  if (resource.status === 404) return <Alert><AlertDescription>No existe un período académico vigente. Administración debe configurar y activar un período para continuar con la coordinación de titulación.</AlertDescription></Alert>
  if (resource.error) return <ErrorNotice message={resource.error} retry={resource.reload} />
  if (!resource.data) return null
  const { period } = resource.data
  return <Card><CardContent className="flex flex-wrap items-center gap-6 pt-6">
    <div className="flex items-center gap-4">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue"><CalendarIcon className="size-5" /></div>
      <div className="flex flex-col">
        <CardDescription>Período académico vigente</CardDescription>
        <CardTitle>{period.name}</CardTitle>
        <CardDescription>{formatDegreeDate(period.start_date)} – {formatDegreeDate(period.end_date)}</CardDescription>
      </div>
    </div>
    {extra && <><Separator orientation="vertical" className="hidden h-12 sm:block" />{extra}</>}
  </CardContent></Card>
}

export function DegreeObservationField({ value, onChange, rejection = false }: Readonly<{ value: string; onChange: (value: string) => void; rejection?: boolean }>) {
  return <Field>
    <div className="flex items-center justify-between gap-3"><FieldLabel htmlFor="degree-observation">{rejection ? 'Motivo de rechazo (opcional)' : 'Observación'}</FieldLabel><FieldCounter current={value.length} max={1000} /></div>
    <textarea id="degree-observation" value={value} onChange={(event) => onChange(event.target.value)} maxLength={1000} minLength={rejection ? undefined : 3} required={!rejection} rows={5} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50" />
    <FieldDescription>El estudiante podrá consultar este mensaje en sus propuestas. Máximo 1000 caracteres.</FieldDescription>
  </Field>
}
