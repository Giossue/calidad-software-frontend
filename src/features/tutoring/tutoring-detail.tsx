import { type ComponentType } from 'react'
import {
  ArrowLeftIcon,
  BookOpenIcon,
  CalendarClockIcon,
  GraduationCapIcon,
  MapPinIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { getInitials } from '@/lib/format'
import { tutoringApi, type Tutoring } from '@/lib/tutoring-api'
import { cn } from '@/lib/utils'
import { ErrorNotice, RecordTable } from './tutoring-shared'
import { CoordinatorStudentsPanel } from './coordinator-students-panel'

function formatDate(value: string, time = false): string {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', ...(time ? { timeStyle: 'short' as const } : {}) }).format(date)
}

function InfoChip({ icon: Icon, label }: Readonly<{ icon: ComponentType<{ className?: string }>; label: string }>) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
      <Icon className="size-3.5" />
      {label}
    </span>
  )
}

export function TutoringDetail({
  tutoring,
  onBack,
}: Readonly<{
  tutoring: Tutoring
  onBack: () => void
  onAssignTeacher?: () => void
}>) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" />
          Volver a tutorías
        </Button>
      </div>

      <AdminSectionHeader
        title={tutoring.subject_name}
        description={
          <div className="flex flex-wrap gap-2">
            <InfoChip icon={BookOpenIcon} label={tutoring.period_name} />
            <InfoChip icon={GraduationCapIcon} label={tutoring.cycle_name} />
            {tutoring.section_name && <InfoChip icon={UsersIcon} label={`Paralelo ${tutoring.section_name}`} />}
            <InfoChip icon={MapPinIcon} label={tutoring.modality_name} />
          </div>
        }
        actions={<StatusBadge active={tutoring.is_active} activeLabel="Tutoría activa" inactiveLabel="Tutoría inactiva" />}
      />

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                tutoring.teacher_name ? 'bg-brand-blue text-white' : 'bg-muted text-muted-foreground',
              )}
            >
              {tutoring.teacher_name ? getInitials(tutoring.teacher_name) : <UserIcon className="size-5" />}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-muted-foreground">Docente responsable</span>
              <span className="text-lg font-semibold">{tutoring.teacher_name || 'Sin docente asignado'}</span>
              <span className="text-sm text-muted-foreground">
                {tutoring.teacher_id && !tutoring.teacher_is_active
                  ? 'El docente asignado se encuentra inactivo.'
                  : tutoring.teacher_id
                    ? 'Revisa la planificación y el seguimiento académico de esta tutoría.'
                    : 'Esta tutoría no tiene docente asignado.'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="supervision">
        <TabsList aria-label="Secciones de la tutoría">
          <TabsTrigger value="supervision">Supervisión</TabsTrigger>
          <TabsTrigger value="students">Estudiantes</TabsTrigger>
        </TabsList>
        <TabsContent value="supervision">
          <SupervisionPanel tutoring={tutoring} />
        </TabsContent>
        <TabsContent value="students">
          <CoordinatorStudentsPanel tutoring={tutoring} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SupervisionPanel({ tutoring }: Readonly<{ tutoring: Tutoring }>) {
  const attendance = usePaginatedCatalog(
    (page) => tutoringApi.attendance(tutoring.id, page),
    String(tutoring.id),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <UsersIcon className="size-5" />
          Supervisión de asistencias
        </CardTitle>
        <CardDescription>Consulta las asistencias registradas por los docentes.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ErrorNotice message={attendance.error} retry={attendance.reload} />
        <RecordTable
          rows={attendance.data}
          loading={attendance.isFetching || attendance.isInitialLoading}
          empty={
            <Empty className="border-none p-0">
              <EmptyMedia variant="icon"><CalendarClockIcon /></EmptyMedia>
              <EmptyTitle>Aún no hay asistencias registradas</EmptyTitle>
              <EmptyDescription>Las asistencias aparecerán aquí cuando los docentes las registren.</EmptyDescription>
            </Empty>
          }
          columns={[
            { label: 'Estudiante', render: (record) => record.student_name },
            { label: 'Fecha', render: (record) => formatDate(record.date) },
            { label: 'Asistencia', render: (record) => <Badge variant={record.present ? 'secondary' : 'inactive'}>{record.present ? 'Presente' : 'Ausente'}</Badge> },
          ]}
        />
        <CatalogPagination
          label="asistencias"
          page={attendance.page}
          lastPage={attendance.meta?.last_page ?? 1}
          disabled={attendance.isFetching}
          onChange={attendance.setPage}
        />
      </CardContent>
    </Card>
  )
}
