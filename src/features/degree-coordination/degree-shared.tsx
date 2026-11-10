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
import { FilterBarSkeleton } from '@/components/ui/loading-skeletons'
import { HeadedTableSkeleton } from '@/features/tutoring/tutoring-skeletons'
import type { DegreeTopicStatus } from '@/lib/degree-coordination-api'
import { DEGREE_STATUS_LABELS, formatDegreeDate, isTrackingFinished, trackingStatusLabel } from './degree-format'
import type { useDegreePeriod } from './degree-hooks'

const STATUS_ICONS = { aprobado: CheckCircle2Icon, rechazado: XCircleIcon, pendiente: ClockIcon } as const

export function DegreeStatusBadge({ status }: Readonly<{ status: DegreeTopicStatus }>) {
  const Icon = STATUS_ICONS[status]
  return <Badge variant={status === 'aprobado' ? 'success' : status === 'rechazado' ? 'danger' : 'secondary'} className="gap-1.5 px-3 py-1"><Icon aria-hidden="true" />{DEGREE_STATUS_LABELS[status]}</Badge>
}

/** Estado de la ficha de seguimiento con su nombre legible («En progreso», «Finalizado»…). */
export function DegreeTrackingStatusBadge({ status }: Readonly<{ status?: string | null }>) {
  return <Badge variant={isTrackingFinished(status) ? 'success' : 'secondary'} className="w-fit">{trackingStatusLabel(status)}</Badge>
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
  // Al recargar (p. ej. tras registrar un paralelo) se sigue viendo el período ya cargado.
  const data = resource.data ?? (resource.loading ? resource.previous : null)
  if (resource.loading && !data) return <Card role="status" aria-label="Cargando período académico"><PeriodCardSkeletonBody /></Card>
  if (resource.status === 404 || resource.error) return <DegreePeriodNotice resource={resource} />
  if (!data) return null
  const { period } = data
  return <Card><CardContent className="flex flex-wrap items-center justify-between gap-6 pt-6">
    <div className="flex flex-col">
      <CardDescription>Período académico vigente</CardDescription>
      <CardTitle>{period.name}</CardTitle>
      <CardDescription>{formatDegreeDate(period.start_date)} – {formatDegreeDate(period.end_date)}</CardDescription>
    </div>
    {extra && <><Separator orientation="vertical" className="hidden h-12 sm:block" />{extra}</>}
  </CardContent></Card>
}

function PeriodCardSkeletonBody() {
  return <CardContent className="flex flex-col gap-2 pt-6" aria-hidden="true">
    <Skeleton className="h-4 w-44" />
    <Skeleton className="h-5 w-32" />
    <Skeleton className="h-4 w-56" />
  </CardContent>
}

/**
 * Encabezado de una pantalla mientras carga: título y descripción; a la derecha, los botones
 * de solo ícono (cuadrados) y los botones con texto, en el mismo orden que los reales.
 */
export function DegreeHeaderSkeleton({ iconActions = 0, actions = 0, badge = false }: Readonly<{ iconActions?: number; actions?: number; badge?: boolean }>) {
  return <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" aria-hidden="true">
    <div className="flex min-w-0 flex-col gap-2">
      <Skeleton className="h-8 w-72 max-w-full" />
      <Skeleton className="h-5 w-96 max-w-full" />
    </div>
    {(badge || iconActions > 0 || actions > 0) && <div className="flex flex-wrap items-center gap-2">
      {badge && <Skeleton className="h-6 w-24 rounded-full" />}
      {Array.from({ length: iconActions }, (_, index) => <Skeleton key={`icon-${index}`} className="size-9" />)}
      {Array.from({ length: actions }, (_, index) => <Skeleton key={index} className="h-9 w-40" />)}
    </div>}
  </div>
}

/** El botón «Volver a …» de una ficha. */
export function BackButtonSkeleton() {
  return <Skeleton className="h-9 w-44" aria-hidden="true" />
}

/** Paginación «Anterior · Página 1 de 1 · Siguiente». */
export function PaginationSkeleton() {
  return <div className="flex items-center justify-between gap-2 sm:justify-end sm:gap-3" aria-hidden="true">
    <Skeleton className="h-8 w-24" />
    <Skeleton className="h-4 w-24" />
    <Skeleton className="h-8 w-24" />
  </div>
}

/**
 * Pantalla de lista de titulación en su primera carga: encabezado (con sus botones), tarjeta
 * del período, buscador y desplegables, la tabla con sus columnas reales y la paginación.
 * Un solo `role="status"` con `label` (empieza por "Cargando"), que espera la guía de ayuda.
 */
export function DegreeListSkeleton({ label, headers, iconActions = 0, actions = 0, search = true, filters = 0, periodCard = false, pagination = false }: Readonly<{
  label: string
  headers: readonly string[]
  iconActions?: number
  actions?: number
  search?: boolean
  filters?: number
  periodCard?: boolean
  pagination?: boolean
}>) {
  return <section className="flex flex-col gap-6">
    <span role="status" aria-label={label} className="sr-only">{label}</span>
    <DegreeHeaderSkeleton iconActions={iconActions} actions={actions} />
    {periodCard && <Card aria-hidden="true"><PeriodCardSkeletonBody /></Card>}
    {search && <FilterBarSkeleton filters={filters} />}
    <HeadedTableSkeleton headers={headers} />
    {pagination && <PaginationSkeleton />}
  </section>
}

export function DegreeObservationField({ value, onChange, rejection = false, error }: Readonly<{ value: string; onChange: (value: string) => void; rejection?: boolean; error?: string | null }>) {
  return <FormField id="degree-observation" label={rejection ? 'Motivo de rechazo' : 'Observación'} optional={rejection} required={!rejection} counter={{ current: value.length, max: 1000 }} error={error} tip="El estudiante verá este mensaje en su propuesta.">
    <Textarea id="degree-observation" value={value} onChange={(event) => onChange(event.target.value)} maxLength={1000} minLength={rejection ? undefined : 3} required={!rejection} rows={5} aria-invalid={Boolean(error)} />
  </FormField>
}
