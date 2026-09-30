import type { ReactNode } from 'react'
import { CalendarIcon, CheckCircle2Icon, ClockIcon, XCircleIcon } from 'lucide-react'
import type { ComponentType } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/format'
import { Field, FieldCounter, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { ErrorNotice } from '@/features/tutoring/tutoring-shared'
import type { DegreeTopicStatus } from '@/lib/degree-coordination-api'
import { DEGREE_STATUS_LABELS, formatDegreeDate } from './degree-format'
import type { useDegreePeriod } from './degree-hooks'

const STATUS_ICONS = { aprobado: CheckCircle2Icon, rechazado: XCircleIcon, pendiente: ClockIcon } as const

export function DegreeStatusBadge({ status }: Readonly<{ status: DegreeTopicStatus }>) {
  const Icon = STATUS_ICONS[status]
  return <Badge variant={status === 'aprobado' ? 'success' : status === 'rechazado' ? 'destructive' : 'secondary'} className="gap-1.5 px-3 py-1"><Icon aria-hidden="true" />{DEGREE_STATUS_LABELS[status]}</Badge>
}

type IconType = ComponentType<{ className?: string }>
const TONES = {
  gray: 'bg-muted text-foreground',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
} as const
export type SectionTone = keyof typeof TONES

/** Tarjeta de sección: ícono con tinte suave, título, descripción y una acción opcional a la derecha. */
export function SectionCard({ icon: Icon, title, description, action, tone = 'gray', children }: Readonly<{ icon: IconType; title: string; description?: ReactNode; action?: ReactNode; tone?: SectionTone; children?: ReactNode }>) {
  return <Card className="flex flex-col">
    <div className="flex flex-wrap items-center justify-between gap-4 p-6 pb-4">
      <div className="flex min-w-0 items-center gap-4">
        <span aria-hidden="true" className={cn('flex size-11 shrink-0 items-center justify-center rounded-full', TONES[tone])}><Icon className="size-5" /></span>
        <div className="flex min-w-0 flex-col gap-0.5"><h3 className="text-base font-semibold tracking-tight">{title}</h3>{description && <p className="text-sm text-muted-foreground">{description}</p>}</div>
      </div>
      {action}
    </div>
    {children && <CardContent className="flex-1 border-t pt-5">{children}</CardContent>}
  </Card>
}

export function InitialsAvatar({ name, tone = 'gray' }: Readonly<{ name: string; tone?: SectionTone }>) {
  return <span aria-hidden="true" className={cn('flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold', TONES[tone])}>{getInitials(name)}</span>
}

export function DegreePeriodCard({ resource, extra }: Readonly<{ resource: ReturnType<typeof useDegreePeriod>; extra?: ReactNode }>) {
  if (resource.loading) return <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner aria-hidden="true" />Cargando período académico…</p>
  if (resource.status === 404) return <Alert><AlertDescription>No existe un período académico vigente. Administración debe configurar y activar un período para continuar con la coordinación de titulación.</AlertDescription></Alert>
  if (resource.error) return <ErrorNotice message={resource.error} retry={resource.reload} />
  if (!resource.data) return null
  const { period } = resource.data
  return <Card><CardContent className="flex flex-wrap items-center justify-between gap-6 pt-6">
    <div className="flex items-center gap-4">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"><CalendarIcon className="size-5" /></div>
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
