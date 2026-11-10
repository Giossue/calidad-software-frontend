import type { ReactNode } from 'react'

import { FilterBarSkeleton, PageHeaderSkeleton } from '@/components/ui/loading-skeletons'
import { Skeleton } from '@/components/ui/skeleton'
import { HeadedTableSkeleton, ListScreenSkeleton, TabsSkeleton } from '@/features/tutoring/tutoring-skeletons'

/**
 * Esqueletos del docente: reproducen la forma completa de cada pantalla y de cada pestaña
 * (textos, botones, filtros y la tabla con sus columnas reales) para que nada salte al llegar
 * los datos. Las formas (`*Shape`) no se anuncian; quien las muestra pone un solo
 * `role="status"` con su nombre ("Cargando…"), que es lo que esperan la guía y las pruebas.
 */

const TUTORING_HEADERS = ['Asignatura', 'Período y ciclo', 'Estudiantes', 'Estado'] as const
const DEGREE_ASSIGNMENT_HEADERS = ['Tema', 'Estudiante', 'Participación', 'Asignación'] as const
const DEGREE_TRACKING_HEADERS = ['Tema', 'Estudiante', 'Participación', 'Avance'] as const
const REPORT_TUTORING_HEADERS = ['Asignatura', 'Ciclo y paralelo', 'Estado'] as const
const STUDENT_HEADERS = ['#', 'Estudiante', 'Contacto', 'Grupo de Conocimiento', 'Etapa', 'Nota', 'Resultado final', 'Inscripción'] as const
const SESSION_HEADERS = ['Sesión', 'Día', 'Fecha', 'Asistencia'] as const
const TOPIC_HEADERS = ['Tema', 'Sesión', 'Recursos', 'Completado', 'Habilitado'] as const
const SCHEDULE_HEADERS = ['Día', 'Horario', 'Estado'] as const
const GRADE_HEADERS = ['#', 'Estudiante', 'Diagnóstico', 'Parcial 1', 'Parcial 2', 'Evolución (Diag → P2)'] as const
const REPORT_HEADERS = ['Informe', 'Autor', 'Enviado'] as const
const REVIEW_HEADERS = ['Día', 'Fecha', 'Asistencia', 'Actividades'] as const

/** Contenedor que anuncia la carga una sola vez; lo de adentro es solo forma. */
function Announced({ label, className = 'flex flex-col gap-5', children }: Readonly<{ label: string; className?: string; children: ReactNode }>) {
  return <div role="status" aria-label={label} className={className}>{children}</div>
}

/** Título de sección (h3) con su descripción y, a la derecha, el botón principal. */
function SectionHeadingShape({ action = true, lines = 1 }: Readonly<{ action?: boolean; lines?: number }>) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-hidden="true">
    <div className="flex min-w-0 flex-col gap-1.5">
      <Skeleton className="h-7 w-56 max-w-full" />
      {Array.from({ length: lines }, (_, index) => <Skeleton key={index} className="h-5 w-96 max-w-full" />)}
    </div>
    {action && <Skeleton className="h-9 w-44 shrink-0" />}
  </div>
}

/** Filtros a la izquierda y el botón de registrar a la derecha (Estudiantes y Contenido). */
function FiltersWithActionShape({ filters }: Readonly<{ filters: number }>) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-start" aria-hidden="true">
    <div className="flex-1"><FilterBarSkeleton filters={filters} /></div>
    <Skeleton className="h-9 w-44 shrink-0" />
  </div>
}

function StudentsShape() {
  return <div className="flex flex-col gap-5">
    <FiltersWithActionShape filters={1} />
    <HeadedTableSkeleton headers={STUDENT_HEADERS} />
  </div>
}

function AttendanceShape() {
  return <div className="flex flex-col gap-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-hidden="true">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Skeleton className="h-5 w-96 max-w-full" />
        <Skeleton className="h-5 w-56" />
      </div>
      <Skeleton className="h-9 w-48 shrink-0" />
    </div>
    <HeadedTableSkeleton headers={SESSION_HEADERS} />
  </div>
}

function ContentShape() {
  return <div className="flex flex-col gap-5">
    <FiltersWithActionShape filters={2} />
    <HeadedTableSkeleton headers={TOPIC_HEADERS} />
  </div>
}

function SchedulesShape() {
  return <div className="flex flex-col gap-5">
    <SectionHeadingShape />
    <HeadedTableSkeleton headers={SCHEDULE_HEADERS} rows={3} />
  </div>
}

function GradesShape() {
  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-center gap-2" aria-hidden="true"><Skeleton className="h-9 w-56" /></div>
    <HeadedTableSkeleton headers={GRADE_HEADERS} />
  </div>
}

export type WorkspaceTab = 'attendance' | 'content' | 'schedules' | 'students' | 'grades'

const TAB_SHAPES: Record<WorkspaceTab, () => ReactNode> = {
  attendance: AttendanceShape,
  content: ContentShape,
  schedules: SchedulesShape,
  students: StudentsShape,
  grades: GradesShape,
}

/** Encabezado de la tutoría, sus pestañas y la forma de la pestaña que se va a abrir. */
export function WorkspaceSkeleton({ tab, tabs }: Readonly<{ tab: WorkspaceTab; tabs: number }>) {
  const Shape = TAB_SHAPES[tab]
  return <Announced label="Cargando tutoría" className="flex flex-col gap-6">
    <div className="flex flex-col gap-2" aria-hidden="true">
      <Skeleton className="h-8 w-72 max-w-full" />
      <div className="flex items-center gap-2"><Skeleton className="h-5 w-96 max-w-full" /><Skeleton className="h-5 w-20 rounded-full" /></div>
    </div>
    <div className="flex flex-col gap-4">
      <TabsSkeleton tabs={tabs} />
      <Shape />
    </div>
  </Announced>
}

export function StudentsTabSkeleton() {
  return <Announced label="Cargando estudiantes"><StudentsShape /></Announced>
}

export function SessionsTabSkeleton() {
  return <Announced label="Cargando sesiones"><AttendanceShape /></Announced>
}

export function ContentTabSkeleton() {
  return <Announced label="Cargando temas"><ContentShape /></Announced>
}

export function GradesTabSkeleton() {
  return <Announced label="Cargando calificaciones"><GradesShape /></Announced>
}

/** Una sesión consultada: volver, título con día y resumen, insignia y la lista de asistencia. */
export function SessionConsultSkeleton() {
  return <Announced label="Cargando sesión" className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3" aria-hidden="true">
      <div className="flex items-center gap-2">
        <Skeleton className="size-9 shrink-0" />
        <div className="flex flex-col gap-1.5"><Skeleton className="h-7 w-64 max-w-full" /><Skeleton className="h-5 w-48" /></div>
      </div>
      <Skeleton className="h-5 w-24 rounded-full" />
    </div>
    <HeadedTableSkeleton headers={['#', 'Estudiante', 'Asistencia']} />
  </Announced>
}

/** Informes enviados: el botón de reportes oficiales y la tabla de informes. */
export function ReportsListSkeleton() {
  return <Announced label="Cargando informes">
    <div className="flex justify-end" aria-hidden="true"><Skeleton className="h-9 w-48" /></div>
    <HeadedTableSkeleton headers={REPORT_HEADERS} />
  </Announced>
}

/** Revisión de actividades: título, descripción y la tabla de fechas. */
export function ActivitiesReviewSkeleton() {
  return <Announced label="Cargando sesiones">
    <SectionHeadingShape action={false} />
    <HeadedTableSkeleton headers={REVIEW_HEADERS} />
  </Announced>
}

/** Informes de una tutoría abierta por enlace: volver, encabezado, pestañas e informes. */
export function ReportsTutoringSkeleton() {
  return <Announced label="Cargando informes" className="flex flex-col gap-6">
    <div className="flex flex-col gap-1" aria-hidden="true">
      <Skeleton className="h-8 w-44" />
      <PageHeaderSkeleton actions={0} />
    </div>
    <div className="flex flex-col gap-5">
      <TabsSkeleton tabs={2} />
      <div className="flex justify-end" aria-hidden="true"><Skeleton className="h-9 w-48" /></div>
      <HeadedTableSkeleton headers={REPORT_HEADERS} />
    </div>
  </Announced>
}

/** Mis tutorías: encabezado, buscador con el filtro de estado y la tabla. */
export function TutoringsScreenSkeleton() {
  return <ListScreenSkeleton label="Cargando tutorías" actions={0} headers={TUTORING_HEADERS} />
}

/** Mis asignaciones de titulación: encabezado, buscador con la participación y la tabla. */
export function DegreeAssignmentsScreenSkeleton() {
  return <ListScreenSkeleton label="Cargando asignaciones" actions={0} headers={DEGREE_ASSIGNMENT_HEADERS} />
}

/** Seguimiento de titulación: encabezado, buscador con la participación y la tabla. */
export function DegreeTrackingScreenSkeleton() {
  return <ListScreenSkeleton label="Cargando temas" actions={0} headers={DEGREE_TRACKING_HEADERS} />
}

/** Informes (elegir tutoría): encabezado sin filtros y la tabla de tutorías. */
export function ReportsTutoringsScreenSkeleton() {
  return <Announced label="Cargando tutorías" className="flex flex-col gap-6">
    <PageHeaderSkeleton actions={0} />
    <HeadedTableSkeleton headers={REPORT_TUTORING_HEADERS} />
  </Announced>
}

/** Botón «Imprimir» de un reporte mientras se calcula la vista previa. */
export function PrintButtonSkeleton() {
  return <div className="flex justify-end" aria-hidden="true"><Skeleton className="h-9 w-32" /></div>
}
