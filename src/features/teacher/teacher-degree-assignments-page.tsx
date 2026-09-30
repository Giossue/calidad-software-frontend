import { useState } from 'react'
import { EyeIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { ErrorNotice, RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { formatDate } from '@/lib/format'
import { teacherApi, type TeacherDegreeAssignment } from '@/lib/teacher-api'
import { TeacherEmpty } from './teacher-shared'

const ROLE_LABELS = { tutor: 'Tutor', par_academico: 'Par académico' }

export function TeacherDegreeAssignmentsPage() {
  const [role, setRole] = useState<'' | 'tutor' | 'par_academico'>('')
  const [reading, setReading] = useState<TeacherDegreeAssignment | null>(null)
  const list = usePaginatedCatalog((page, search) => teacherApi.degreeAssignments({ page, search, role: role || undefined }), role)

  return <section className="flex flex-col gap-6">
    <AdminSectionHeader title="Mis asignaciones de titulación" description="Consulta los estudiantes y temas en los que participas como tutor o par académico." />
    <FilterBar id="teacher-degree" search={list.searchInput} onSearch={list.setSearchInput} searchLabel="Buscar tema o estudiante" searchPlaceholder="Título del tema o nombre del estudiante" onClear={() => setRole('')} filters={[
      { id: 'role', label: 'Participación', value: role, onChange: (value) => setRole(value as typeof role), allLabel: 'Todas', options: [{ value: 'tutor', label: 'Tutor' }, { value: 'par_academico', label: 'Par académico' }] },
    ]} />
    <ErrorNotice message={list.error} retry={list.reload} />
    <RecordTable rows={list.data} loading={list.isInitialLoading || list.isFetching} empty={<TeacherEmpty title="No tienes asignaciones de titulación con estos criterios" description="Las asignaciones aparecerán cuando el Coordinador de Titulación te designe como tutor o par académico." />} columns={[
      { label: 'Tema', render: (item) => <div className="flex flex-col gap-1"><span className="font-medium">{item.topic.title}</span><span className="text-xs text-muted-foreground">{item.period.name}</span></div> },
      { label: 'Estudiante', render: (item) => <div className="flex flex-col gap-1"><span>{item.student.name}</span><span className="text-xs text-muted-foreground break-all">{item.student.email}</span></div> },
      { label: 'Participación', render: (item) => <Badge variant="secondary">{ROLE_LABELS[item.role]}</Badge> }, { label: 'Asignación', render: (item) => item.assigned_at ? formatDate(item.assigned_at) : 'Sin fecha' },
      { label: 'Acciones', render: (item) => <Button variant="ghost" size="icon-sm" title="Ver detalle" aria-label={`Ver detalle de ${item.topic.title}`} onClick={() => setReading(item)}><EyeIcon /></Button> },
    ]} />
    <CatalogPagination label="asignaciones" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
    <Dialog open={Boolean(reading)} title={reading?.topic.title ?? 'Asignación de titulación'} description={reading ? `${ROLE_LABELS[reading.role]} · ${reading.period.name}` : undefined} onClose={() => setReading(null)} confirmClose={false}>
      <div className="flex flex-col gap-5">{reading && <><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Estudiante</dt><dd>{reading.student.name}</dd></div><div><dt className="text-muted-foreground">Contacto</dt><dd className="break-all">{reading.student.email}</dd></div></dl><p className="whitespace-pre-wrap break-words text-sm leading-6">{reading.topic.description || 'El tema no tiene descripción adicional.'}</p></>}<div className="flex justify-end"><DialogCancelButton>Cerrar detalle</DialogCancelButton></div></div>
    </Dialog>
  </section>
}
