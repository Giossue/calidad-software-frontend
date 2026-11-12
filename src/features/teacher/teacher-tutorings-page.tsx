import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { StatusBadge } from '@/components/ui/status-badge'
import { ErrorNotice } from '@/components/ui/error-notice'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { teacherApi } from '@/lib/teacher-api'
import { DAY_LABELS, WEEK_DAYS, type TutoringSchedule } from '@/lib/tutoring-api'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { TeacherEmpty } from './teacher-shared'
import { TutoringsScreenSkeleton } from './teacher-skeletons'
import { TeacherTutoringWorkspace } from './teacher-tutoring-workspace'

export function TeacherTutoringsPage() {
  const [params, setParams] = useSearchParams()
  const selectedId = Number(params.get('tutoring'))

  if (Number.isInteger(selectedId) && selectedId > 0) {
    return <TeacherTutoringWorkspace tutoringId={selectedId} />
  }
  return <TutoringsList onOpen={(id) => setParams({ tutoring: String(id) })} />
}

function TutoringsList({ onOpen }: Readonly<{ onOpen: (id: number) => void }>) {
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('')
  const list = usePaginatedCatalog((page, search) => teacherApi.tutorings({ page, search, status: status || undefined }), status)

  // Primera carga: toda la pantalla (encabezado, filtros y tabla) es un solo esqueleto.
  if (list.isInitialLoading) return <TutoringsScreenSkeleton />

  return <section className="flex flex-col gap-6">
    <AdminSectionHeader title="Mis tutorías" description="Elige una tutoría para gestionar sus estudiantes, calificaciones, asistencia, contenido y horarios." />
    <FilterBar id="teacher-tutorings" search={list.searchInput} onSearch={list.setSearchInput} searchPlaceholder="Busca por asignatura…" onClear={() => setStatus('')} filters={[
      { id: 'status', label: 'Estado', value: status, onChange: (value) => setStatus(value as '' | 'active' | 'inactive'), allLabel: 'Todos los estados', options: [{ value: 'active', label: 'En curso' }, { value: 'inactive', label: 'Solo consulta' }] },
    ]} />
    <ErrorNotice message={list.error} retry={list.reload} />
    <RecordTable rows={list.data} onRowClick={(item) => onOpen(item.id)} rowTitle={(item) => `Abrir ${item.subject_name}`} loading={list.isFetching} empty={<TeacherEmpty title="No hay tutorías para mostrar" description="Revisa los filtros o consulta con el Coordinador de Carrera tus asignaciones." />} columns={[
      { label: 'Asignatura', render: (item) => <div className="flex flex-col gap-1"><span>{item.subject_name}</span><span className="text-xs text-muted-foreground">{item.career_name} · {item.modality_name}</span></div> },
      { label: 'Período y ciclo', render: (item) => <div className="flex flex-col gap-1"><span>{item.period_name}</span><span className="text-xs text-muted-foreground">{item.cycle_name} · {item.section_name ?? 'Sin paralelo'}</span></div> },
      { label: 'Horario', render: (item) => <ScheduleCell schedules={item.schedules} /> },
      { label: 'Estudiantes', render: (item) => `${item.active_enrollment_count} inscritos` },
      { label: 'Estado', render: (item) => <StatusBadge active={item.can_manage} activeLabel="En curso" inactiveLabel="Solo consulta" /> },
    ]} />
    <CatalogPagination label="tutorías" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
  </section>
}

/** Franjas activas en el orden de la semana («Lunes 08:00 – 10:00»), o «Sin horario». */
const dayOrder = (day: string) => (WEEK_DAYS as readonly string[]).indexOf(day)

function ScheduleCell({ schedules }: Readonly<{ schedules?: readonly TutoringSchedule[] }>) {
  const active = (schedules ?? [])
    .filter((schedule) => schedule.is_active)
    .sort((a, b) => dayOrder(a.day) - dayOrder(b.day) || a.start_time.localeCompare(b.start_time))
  if (active.length === 0) return 'Sin horario'
  return <div className="flex flex-col gap-0.5">
    {active.map((schedule) => <span key={schedule.id}>{`${DAY_LABELS[schedule.day] ?? schedule.day} ${schedule.start_time.slice(0, 5)} – ${schedule.end_time.slice(0, 5)}`}</span>)}
  </div>
}
