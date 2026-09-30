import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDaysIcon, MoreVerticalIcon, UsersIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/ui/status-badge'
import { ErrorNotice, RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { teacherApi, type TeacherTutoring } from '@/lib/teacher-api'
import { DAY_LABELS } from '@/lib/tutoring-api'
import { TeacherEmpty, TeacherFilters } from './teacher-shared'

export function TeacherTutoringsPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('')
  const [detail, setDetail] = useState<TeacherTutoring | null>(null)
  const list = usePaginatedCatalog((page, search) => teacherApi.tutorings({ page, search, status: status || undefined }), status)
  const open = (section: string, tutoring: TeacherTutoring) => navigate(`/panel/${section}?tutoring=${tutoring.id}`)

  return <section className="flex flex-col gap-6">
    <AdminSectionHeader title="Mis tutorías" description="Consulta tu carga de tutorías y accede a sus estudiantes, notas, asistencia y contenidos." />
    <Card><CardHeader><CardTitle>Tutorías asignadas</CardTitle></CardHeader><CardContent><TeacherFilters id="teacher-tutorings" search={list.searchInput} onSearch={list.setSearchInput} status={status} onStatus={setStatus} /></CardContent></Card>
    <ErrorNotice message={list.error} retry={list.reload} />
    <RecordTable rows={list.data} loading={list.isInitialLoading || list.isFetching} empty={<TeacherEmpty title="No hay tutorías para mostrar" description="Revisa los filtros o consulta con el Coordinador de Carrera tus asignaciones." />} columns={[
      { label: 'Asignatura', render: (item) => <div className="flex flex-col gap-1"><span className="font-medium">{item.subject_name}</span><span className="text-xs text-muted-foreground">{item.career_name} · {item.modality_name}</span></div> },
      { label: 'Período y ciclo', render: (item) => <div className="flex flex-col gap-1"><span>{item.period_name}</span><span className="text-xs text-muted-foreground">{item.cycle_name} · {item.section_name ?? 'Sin paralelo'}</span></div> },
      { label: 'Estudiantes', render: (item) => <Badge variant="secondary">{item.active_enrollment_count} inscritos</Badge> },
      { label: 'Estado', render: (item) => <StatusBadge active={item.can_manage} activeLabel="En curso" inactiveLabel="Solo consulta" /> },
      { label: 'Acciones', render: (item) => <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => open('teacher-students', item)}><UsersIcon data-icon="inline-start" />Estudiantes</Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Ver horarios de ${item.subject_name}`} title="Ver horarios" onClick={() => setDetail(item)}><CalendarDaysIcon /></Button>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Más acciones para ${item.subject_name}`}><MoreVerticalIcon /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => open('teacher-grades', item)}>Calificaciones</DropdownMenuItem><DropdownMenuItem onSelect={() => open('teacher-attendance', item)}>Asistencia</DropdownMenuItem><DropdownMenuItem onSelect={() => open('teacher-content', item)}>Contenido</DropdownMenuItem><DropdownMenuItem onSelect={() => open('teacher-reports', item)}>Informes</DropdownMenuItem>
        </DropdownMenuGroup></DropdownMenuContent></DropdownMenu>
      </div> },
    ]} />
    <CatalogPagination label="tutorías" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
    <Dialog open={Boolean(detail)} title={detail?.subject_name ?? 'Horarios'} description={detail ? `${detail.period_name} · ${detail.cycle_name} · ${detail.section_name ?? ''}` : undefined} onClose={() => setDetail(null)} confirmClose={false}>
      <div className="flex flex-col gap-5"><RecordTable rows={detail?.schedules ?? []} loading={false} empty="Esta tutoría aún no tiene horarios registrados." columns={[
        { label: 'Día', render: (item) => DAY_LABELS[item.day] ?? item.day }, { label: 'Horario', render: (item) => `${item.start_time.slice(0, 5)} – ${item.end_time.slice(0, 5)}` }, { label: 'Aula o lugar', render: (item) => item.room || 'Sin aula' }, { label: 'Estado', render: (item) => <StatusBadge active={item.is_active} /> },
      ]} /><div className="flex justify-end"><DialogCancelButton>Cerrar</DialogCancelButton></div></div>
    </Dialog>
  </section>
}
