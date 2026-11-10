import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/**
 * Esqueletos de carga del estudiante: reproducen la forma de cada pantalla (barras,
 * filtros, filas y tarjetas) para que el contenido no salte al aparecer.
 */

/** Barra de avance con su texto a la derecha (Contenido y Asistencia). */
function ProgressLineSkeleton() {
  return <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
    <Skeleton className="h-2.5 w-full rounded-full" />
    <Skeleton className="h-4 w-56 shrink-0" />
  </div>
}

export function ContentSkeleton() {
  return <div role="status" aria-label="Cargando temas" className="flex flex-col gap-6">
    <ProgressLineSkeleton />
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Skeleton className="h-9 w-full lg:max-w-md" />
      <Skeleton className="h-9 w-full sm:w-72 sm:shrink-0" />
      <Skeleton className="h-9 w-full sm:w-52 sm:shrink-0" />
    </div>
    <ul className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((row) => <li key={row} className="flex items-center gap-4 rounded-md bg-card p-4 shadow-surface ring-1 ring-surface-ring">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="hidden h-6 w-24 rounded-full sm:block" />
        <Skeleton className="size-4 shrink-0" />
      </li>)}
    </ul>
  </div>
}

export function AttendanceSkeleton() {
  return <div role="status" aria-label="Cargando asistencia" className="flex flex-col gap-6">
    <ProgressLineSkeleton />
    <div className="flex flex-col gap-3">
      <Skeleton className="h-9 w-full sm:w-52 sm:self-end" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sesión</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Asistencia</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[0, 1, 2, 3, 4].map((row) => <TableRow key={row}>
            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
          </TableRow>)}
        </TableBody>
      </Table>
    </div>
  </div>
}

export function GradesSkeleton() {
  return <div role="status" aria-label="Cargando calificaciones" className="grid gap-4 sm:grid-cols-3">
    {[0, 1, 2].map((card) => <Card key={card} className="flex flex-col gap-3 p-5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-28" />
      <Skeleton className="h-3 w-20" />
    </Card>)}
  </div>
}

/** Encabezado de la tutoría, pestañas y el primer bloque del panel. */
export function WorkspaceSkeleton() {
  return <div role="status" aria-label="Cargando tutoría" className="flex flex-col gap-6">
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full max-w-md" />
    </div>
    <div className="flex gap-6 border-b pb-3">
      {[0, 1, 2, 3].map((tab) => <Skeleton key={tab} className="h-4 w-20" />)}
    </div>
    <ProgressLineSkeleton />
  </div>
}

/** Desplegable de clases del aviso de inasistencia mientras llegan las fechas. */
export function SelectSkeleton({ label }: Readonly<{ label: string }>) {
  return <Skeleton role="status" aria-label={label} className="h-9 w-full rounded-md" />
}

/** Un docente asignado (iniciales, nombre y contacto). */
function PersonSkeleton() {
  return <li className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
    <Skeleton className="size-10 shrink-0 rounded-full" />
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  </li>
}

/** Tutor y pares: el tema aprobado y sus docentes. */
export function DegreeAssignmentsSkeleton() {
  return <Card className="flex flex-col gap-5 p-6">
    <div className="flex min-w-0 flex-col gap-2">
      <Skeleton className="h-6 w-3/5" />
      <Skeleton className="h-4 w-2/5" />
    </div>
    <ul className="flex flex-col divide-y border-t pt-4"><PersonSkeleton /><PersonSkeleton /></ul>
  </Card>
}

/** Mis propuestas: una tarjeta con título, estado y las secciones de la propuesta. */
export function DegreeTopicsSkeleton() {
  return <Card role="status" aria-label="Cargando propuestas" className="flex flex-col gap-6 p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-6 w-24 rounded-full" />
    </div>
    <div className="grid gap-6 border-t pt-6 lg:grid-cols-2">
      {[0, 1, 2, 3].map((block) => <div key={block} className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>)}
    </div>
  </Card>
}

/** Seguimiento de titulación: pestañas y la ficha con su avance. */
export function DegreeTrackingSkeleton() {
  return <div role="status" aria-label="Cargando seguimiento" className="flex flex-col gap-6">
    <div className="flex gap-6 border-b pb-3">
      {[0, 1, 2].map((tab) => <Skeleton key={tab} className="h-4 w-28" />)}
    </div>
    <Card className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((stat) => <div key={stat} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>)}
      </div>
    </Card>
  </div>
}
