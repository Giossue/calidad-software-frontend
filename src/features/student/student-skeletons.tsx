import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { HeadedTableSkeleton, PersonSkeleton, TabsSkeleton } from '@/features/tutoring/tutoring-skeletons'

/**
 * Esqueletos de carga del estudiante: reproducen la forma de cada pantalla (barras,
 * filtros, filas y tarjetas) para que el contenido no salte al aparecer. Las formas
 * (`*Shape`) no se anuncian; los esqueletos exportados llevan el `role="status"`.
 */

/** Barra de avance con su texto a la derecha (Contenido y Asistencia). */
function ProgressLineSkeleton() {
  return <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4" aria-hidden="true">
    <Skeleton className="h-2.5 w-full rounded-full" />
    <Skeleton className="h-5 w-56 shrink-0" />
  </div>
}

function ContentShape() {
  return <div className="flex flex-col gap-6">
    <ProgressLineSkeleton />
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center" aria-hidden="true">
      <Skeleton className="h-9 w-full lg:max-w-md" />
      <Skeleton className="h-9 w-full sm:w-72 sm:shrink-0" />
      <Skeleton className="h-9 w-full sm:w-52 sm:shrink-0" />
    </div>
    <ul className="flex flex-col gap-3" aria-hidden="true">
      {[0, 1, 2, 3].map((row) => <li key={row} className="flex items-center gap-4 rounded-md bg-card p-4 shadow-surface ring-1 ring-surface-ring">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="hidden h-5 w-24 rounded-full sm:block" />
        <Skeleton className="size-4 shrink-0" />
      </li>)}
    </ul>
  </div>
}

function AttendanceShape() {
  return <div className="flex flex-col gap-6">
    <ProgressLineSkeleton />
    <div className="flex flex-col gap-3">
      <Skeleton className="h-9 w-full sm:w-52 sm:self-end" aria-hidden="true" />
      <HeadedTableSkeleton headers={['Sesión', 'Fecha', 'Asistencia']} />
    </div>
  </div>
}

/** Tarjeta de avisos de inasistencia que va debajo del récord. */
function NoticesShape() {
  return <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" aria-hidden="true">
    <div className="flex flex-col gap-1.5"><Skeleton className="h-5 w-48" /><Skeleton className="h-4 w-32" /></div>
    <Skeleton className="h-9 w-44" />
  </Card>
}

function GradesShape() {
  return <div className="grid gap-4 sm:grid-cols-3" aria-hidden="true">
    {[0, 1, 2].map((card) => <Card key={card} className="flex flex-col gap-2 p-5">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-10 w-28" />
      <Skeleton className="h-4 w-20" />
    </Card>)}
  </div>
}

function SchedulesShape() {
  return <div className="grid gap-4 lg:grid-cols-3">
    <div className="flex min-w-0 flex-col gap-3 lg:col-span-2">
      <HeadedTableSkeleton headers={['Día', 'Horario', 'Aula']} rows={3} />
      <Skeleton className="h-5 w-64" aria-hidden="true" />
    </div>
    <Card className="flex h-fit flex-col gap-4 p-6" aria-hidden="true">
      <Skeleton className="h-5 w-20" />
      <PersonSkeleton />
    </Card>
  </div>
}

export function ContentSkeleton() {
  return <div role="status" aria-label="Cargando temas"><ContentShape /></div>
}

export function AttendanceSkeleton() {
  return <div role="status" aria-label="Cargando asistencia"><AttendanceShape /></div>
}

export function GradesSkeleton() {
  return <div role="status" aria-label="Cargando calificaciones"><GradesShape /></div>
}

/** Encabezado de la tutoría (título, datos y estado), pestañas y la forma de la pestaña abierta. */
export function WorkspaceSkeleton({ tab = 'content' }: Readonly<{ tab?: 'content' | 'attendance' | 'grades' | 'schedules' }>) {
  return <div role="status" aria-label="Cargando tutoría" className="flex flex-col gap-6">
    <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" aria-hidden="true">
      <div className="flex min-w-0 flex-col gap-2">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-5 w-20 rounded-full" />
    </div>
    <div className="flex flex-col gap-4">
      <TabsSkeleton tabs={4} />
      {tab === 'content' && <ContentShape />}
      {tab === 'attendance' && <div className="flex flex-col gap-6"><AttendanceShape /><NoticesShape /></div>}
      {tab === 'grades' && <GradesShape />}
      {tab === 'schedules' && <SchedulesShape />}
    </div>
  </div>
}

/** Desplegable de clases del aviso de inasistencia mientras llegan las fechas. */
export function SelectSkeleton({ label }: Readonly<{ label: string }>) {
  return <Skeleton role="status" aria-label={label} className="h-9 w-full rounded-md" />
}

/** Un docente asignado (iniciales, nombre con su rol, correo y fecha). */
function AssignedPersonSkeleton() {
  return <li className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
    <Skeleton className="size-10 shrink-0 rounded-full" />
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <Skeleton className="h-5 w-64 max-w-full" />
      <Skeleton className="h-4 w-56 max-w-full" />
      <Skeleton className="h-3 w-28" />
    </div>
  </li>
}

/** Tutor y pares: el tema aprobado y sus docentes. */
export function DegreeAssignmentsSkeleton() {
  return <Card aria-hidden="true">
    <CardContent className="flex flex-col gap-5 pt-6">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Skeleton className="h-7 w-3/5" />
        <Skeleton className="h-5 w-2/5" />
      </div>
      <ul className="flex flex-col divide-y border-t pt-4"><AssignedPersonSkeleton /><AssignedPersonSkeleton /></ul>
    </CardContent>
  </Card>
}

/** Mis propuestas: una tarjeta con título y estado, la acción y las secciones de la propuesta. */
export function DegreeTopicsSkeleton() {
  return <Card role="status" aria-label="Cargando propuestas">
    <CardContent className="flex flex-col gap-6 pt-6" aria-hidden="true">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3"><Skeleton className="h-7 w-2/3" /><Skeleton className="h-5 w-28 rounded-full" /></div>
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-44" />
      </div>
      <div className="grid gap-6 border-t pt-6 lg:grid-cols-2">
        {[0, 1, 2, 3].map((block) => <div key={block} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-36" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>)}
      </div>
    </CardContent>
  </Card>
}

/** Seguimiento de titulación: pestañas y la ficha con su avance. */
export function DegreeTrackingSkeleton() {
  return <div role="status" aria-label="Cargando seguimiento" className="flex flex-col gap-4">
    <TabsSkeleton tabs={3} />
    <Card>
      <CardContent className="flex flex-col gap-6 pt-6" aria-hidden="true">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Skeleton className="h-7 w-96 max-w-full" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="h-5 w-32 rounded-full" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((stat) => <div key={stat} className="flex flex-col gap-1.5">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-8 w-16" />
            {stat === 0 ? <Skeleton className="mt-1 h-2.5 w-full rounded-full" /> : <Skeleton className="h-4 w-32" />}
          </div>)}
        </div>
      </CardContent>
    </Card>
  </div>
}
