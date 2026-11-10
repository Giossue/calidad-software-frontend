import { useState } from 'react'
import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { ErrorNotice } from '@/components/ui/error-notice'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { formatDate } from '@/lib/format'
import { teacherApi, type TeacherDegreeAssignment } from '@/lib/teacher-api'
import { DEGREE_ROLE_LABELS as ROLE_LABELS, DEGREE_ROLE_OPTIONS } from './teacher-labels'
import { TeacherEmpty } from './teacher-shared'
import { DegreeAssignmentsScreenSkeleton } from './teacher-skeletons'

export function TeacherDegreeAssignmentsPage() {
  const [role, setRole] = useState<'' | 'tutor' | 'par_academico'>('')
  const [reading, setReading] = useState<TeacherDegreeAssignment | null>(null)
  const list = usePaginatedCatalog((page, search) => teacherApi.degreeAssignments({ page, search, role: role || undefined }), role)

  if (list.isInitialLoading) return <DegreeAssignmentsScreenSkeleton />

  return <section className="flex flex-col gap-6">
    <AdminSectionHeader title="Mis asignaciones de titulación" description="Consulta los estudiantes y temas en los que participas como tutor o par académico." />
    <FilterBar id="teacher-degree" search={list.searchInput} onSearch={list.setSearchInput} searchLabel="Buscar tema o estudiante" searchPlaceholder="Título del tema o nombre del estudiante" onClear={() => setRole('')} filters={[
      { id: 'role', label: 'Participación', value: role, onChange: (value) => setRole(value as typeof role), allLabel: 'Todas las participaciones', options: DEGREE_ROLE_OPTIONS },
    ]} />
    <ErrorNotice message={list.error} retry={list.reload} />
    <RecordTable rows={list.data} onRowClick={setReading} rowTitle={(item) => `Ver detalle de ${item.topic.title}`} loading={list.isFetching} empty={<TeacherEmpty title="No tienes asignaciones de titulación con estos criterios" description="Las asignaciones aparecerán cuando el Coordinador de Titulación te designe como tutor o par académico." />} columns={[
      { label: 'Tema', render: (item) => <div className="flex flex-col gap-1"><span>{item.topic.title}</span><span className="text-xs text-muted-foreground">{item.period.name}</span></div> },
      { label: 'Estudiante', render: (item) => <div className="flex flex-col gap-1"><span>{item.student.name}</span><span className="text-xs text-muted-foreground break-all">{item.student.email}</span></div> },
      { label: 'Participación', render: (item) => ROLE_LABELS[item.role] }, { label: 'Asignación', render: (item) => item.assigned_at ? formatDate(item.assigned_at) : 'Sin fecha' },
    ]} />
    <CatalogPagination label="asignaciones" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
    <Dialog open={Boolean(reading)} title={reading?.topic.title ?? 'Asignación de titulación'} description={reading ? `${ROLE_LABELS[reading.role]} · ${reading.period.name}` : undefined} onClose={() => setReading(null)} confirmClose={false}>
      <div className="flex flex-col gap-5">{reading && <><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Estudiante</dt><dd>{reading.student.name}</dd></div><div><dt className="text-muted-foreground">Contacto</dt><dd className="break-all">{reading.student.email}</dd></div></dl><p className="whitespace-pre-wrap break-words text-sm leading-6">{reading.topic.description || 'El tema no tiene descripción adicional.'}</p></>}<div className="flex justify-end"><DialogCancelButton>Cerrar detalle</DialogCancelButton></div></div>
    </Dialog>
  </section>
}
