import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { ErrorNotice } from '@/components/ui/error-notice'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { degreeCoordinationApi } from '@/lib/degree-coordination-api'
import { useDegreeResource, useDegreeSearch } from './degree-hooks'
import { DegreeListSkeleton } from './degree-shared'

const HEADERS = ['Docente', 'Contacto', 'Carrera / Facultad', 'Asignaciones como tutor', 'Asignaciones como par'] as const

export function DegreeTeachersPage() {
  const search = useDegreeSearch()
  const resource = useDegreeResource(() => degreeCoordinationApi.teachers(search.search), search.search)

  // Primera carga: toda la pantalla como esqueleto; al buscar solo cargan las filas.
  if (!resource.settled) return <DegreeListSkeleton label="Cargando docentes" headers={HEADERS} />

  return <section className="flex flex-col gap-6">
    <AdminSectionHeader title="Docentes de titulación" />
    <FilterBar id="degree-teachers" search={search.input} onSearch={search.setInput} searchLabel="Buscar docente" searchPlaceholder="Buscar por nombre, cédula, correo, carrera o facultad" onClear={() => search.setInput('')} filters={[]} />
    <ErrorNotice message={resource.error} retry={resource.reload} />
    <RecordTable rows={resource.data ?? []} loading={resource.loading} empty="No se encontraron docentes activos con estos criterios." columns={[
      { label: 'Docente', render: (teacher) => <div className="flex flex-col gap-1"><span>{teacher.name}</span><span>{teacher.identification}</span></div> },
      { label: 'Contacto', render: (teacher) => <div className="flex flex-col gap-1"><span>{teacher.email}</span><span>{teacher.phone || 'Sin teléfono registrado'}</span></div> },
      {
        label: 'Carrera / Facultad',
        render: (teacher) => (
          <span>
            {teacher.careers && teacher.careers.length > 0
              ? teacher.careers.map((c) => c.faculty_name ? `${c.name} (${c.faculty_name})` : c.name).join(', ')
              : 'Sin carrera asignada'}
          </span>
        ),
      },
      { label: 'Asignaciones como tutor', render: (teacher) => teacher.active_tutorships_count },
      { label: 'Asignaciones como par', render: (teacher) => teacher.active_peer_reviews_count },
    ]} />
  </section>
}
