import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { ErrorNotice, RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { teacherApi } from '@/lib/teacher-api'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { TeacherEmpty } from './teacher-shared'
import { TeacherTutoringWorkspace } from './teacher-tutoring-workspace'

export function TeacherTutoringsPage() {
  const [params, setParams] = useSearchParams()
  const selectedId = Number(params.get('tutoring'))

  if (Number.isInteger(selectedId) && selectedId > 0) {
    return <TeacherTutoringWorkspace tutoringId={selectedId} onBack={() => setParams({})} />
  }
  return <TutoringsList onOpen={(id) => setParams({ tutoring: String(id) })} />
}

function TutoringsList({ onOpen }: Readonly<{ onOpen: (id: number) => void }>) {
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('')
  const list = usePaginatedCatalog((page, search) => teacherApi.tutorings({ page, search, status: status || undefined }), status)

  return <section className="flex flex-col gap-6">
    <AdminSectionHeader title="Mis tutorías" description="Elige una tutoría para gestionar sus estudiantes, calificaciones, asistencia, contenido y horarios." />
    <FilterBar id="teacher-tutorings" search={list.searchInput} onSearch={list.setSearchInput} searchPlaceholder="Busca por asignatura…" onClear={() => setStatus('')} filters={[
      { id: 'status', label: 'Estado', value: status, onChange: (value) => setStatus(value as '' | 'active' | 'inactive'), allLabel: 'Todas', options: [{ value: 'active', label: 'En curso' }, { value: 'inactive', label: 'Solo consulta' }] },
    ]} />
    <ErrorNotice message={list.error} retry={list.reload} />
    <RecordTable rows={list.data} onRowClick={(item) => onOpen(item.id)} rowTitle={(item) => `Abrir ${item.subject_name}`} loading={list.isInitialLoading || list.isFetching} empty={<TeacherEmpty title="No hay tutorías para mostrar" description="Revisa los filtros o consulta con el Coordinador de Carrera tus asignaciones." />} columns={[
      { label: 'Asignatura', render: (item) => <div className="flex flex-col gap-1"><span className="font-medium">{item.subject_name}</span><span className="text-xs text-muted-foreground">{item.career_name} · {item.modality_name}</span></div> },
      { label: 'Período y ciclo', render: (item) => <div className="flex flex-col gap-1"><span>{item.period_name}</span><span className="text-xs text-muted-foreground">{item.cycle_name} · {item.section_name ?? 'Sin paralelo'}</span></div> },
      { label: 'Estudiantes', render: (item) => <Badge variant="secondary">{item.active_enrollment_count} inscritos</Badge> },
      { label: 'Estado', render: (item) => <StatusBadge active={item.can_manage} activeLabel="En curso" inactiveLabel="Solo consulta" /> },
    ]} />
    <CatalogPagination label="tutorías" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
  </section>
}
