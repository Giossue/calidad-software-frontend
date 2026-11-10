import type { ComponentType, ReactNode } from 'react'
import { CheckCircle2Icon, ClockIcon, XCircleIcon } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/format'
import { FormField } from '@/components/ui/form-field'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ErrorNotice } from '@/components/ui/error-notice'
import type { DegreeTopicStatus } from '@/lib/degree-coordination-api'
import { DEGREE_STATUS_LABELS, formatDegreeDate } from './degree-format'
import type { useDegreePeriod } from './degree-hooks'

const STATUS_ICONS = { aprobado: CheckCircle2Icon, rechazado: XCircleIcon, pendiente: ClockIcon } as const

export function DegreeStatusBadge({ status }: Readonly<{ status: DegreeTopicStatus }>) {
  const Icon = STATUS_ICONS[status]
  return <Badge variant={status === 'aprobado' ? 'success' : status === 'rechazado' ? 'danger' : 'secondary'} className="gap-1.5 px-3 py-1"><Icon aria-hidden="true" />{DEGREE_STATUS_LABELS[status]}</Badge>
}

type IconType = ComponentType<{ className?: string }>
/** Se conserva por compatibilidad: todas las variantes usan el mismo fondo neutro (sin tintes). */
export type SectionTone = 'gray' | 'red' | 'blue'

/**
 * Tarjeta de sección: título, descripción y una acción opcional a la derecha.
 * `icon` y `tone` se aceptan por compatibilidad, pero ya no se pintan (sin íconos con tinte).
 */
export function SectionCard({ title, description, action, children }: Readonly<{ icon?: IconType; title: string; description?: ReactNode; action?: ReactNode; tone?: SectionTone; children?: ReactNode }>) {
  return <Card className="flex flex-col">
    <div className="flex flex-wrap items-center justify-between gap-4 p-6 pb-4">
      <div className="flex min-w-0 flex-col gap-0.5"><h3 className="text-base font-semibold tracking-tight">{title}</h3>{description && <p className="text-sm text-muted-foreground">{description}</p>}</div>
      {action}
    </div>
    {children && <CardContent className="flex-1 border-t pt-5">{children}</CardContent>}
  </Card>
}

export function InitialsAvatar({ name, className }: Readonly<{ name: string; tone?: SectionTone; className?: string }>) {
  return <span aria-hidden="true" className={cn('flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground', className)}>{getInitials(name)}</span>
}

const NO_PERIOD = 'No existe un período académico vigente. Administración debe configurar y activar un período para continuar con la coordinación de titulación.'

/** Solo avisa cuando no hay período vigente o no se pudo cargar; si todo está bien, no ocupa espacio. */
export function DegreePeriodNotice({ resource }: Readonly<{ resource: ReturnType<typeof useDegreePeriod> }>) {
  if (resource.status === 404) return <Alert><AlertDescription>{NO_PERIOD}</AlertDescription></Alert>
  return <ErrorNotice message={resource.error} retry={resource.reload} />
}

export function DegreePeriodCard({ resource, extra }: Readonly<{ resource: ReturnType<typeof useDegreePeriod>; extra?: ReactNode }>) {
  if (resource.loading) return <Skeleton role="status" aria-label="Cargando período académico" className="h-24 w-full" />
  if (resource.status === 404 || resource.error) return <DegreePeriodNotice resource={resource} />
  if (!resource.data) return null
  const { period } = resource.data
  return <Card><CardContent className="flex flex-wrap items-center justify-between gap-6 pt-6">
    <div className="flex flex-col">
      <CardDescription>Período académico vigente</CardDescription>
      <CardTitle>{period.name}</CardTitle>
      <CardDescription>{formatDegreeDate(period.start_date)} – {formatDegreeDate(period.end_date)}</CardDescription>
    </div>
    {extra && <><Separator orientation="vertical" className="hidden h-12 sm:block" />{extra}</>}
  </CardContent></Card>
}

export function DegreeObservationField({ value, onChange, rejection = false, error }: Readonly<{ value: string; onChange: (value: string) => void; rejection?: boolean; error?: string | null }>) {
  return <FormField id="degree-observation" label={rejection ? 'Motivo de rechazo' : 'Observación'} optional={rejection} required={!rejection} counter={{ current: value.length, max: 1000 }} error={error} tip="El estudiante verá este mensaje en su propuesta.">
    <Textarea id="degree-observation" value={value} onChange={(event) => onChange(event.target.value)} maxLength={1000} minLength={rejection ? undefined : 3} required={!rejection} rows={5} aria-invalid={Boolean(error)} />
  </FormField>
}
