import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ErrorNotice, RecordTable } from '@/features/tutoring/tutoring-shared'
import { degreeCoordinationApi } from '@/lib/degree-coordination-api'
import { useDegreeResource, useDegreeSearch } from './degree-hooks'

export function DegreeTeachersPage() {
  const search = useDegreeSearch()
  const resource = useDegreeResource(() => degreeCoordinationApi.teachers(search.search), search.search)

  return <section className="flex flex-col gap-6">
    <AdminSectionHeader title="Docentes de titulación" />
    <Field><FieldLabel htmlFor="degree-teachers-search">Buscar docente</FieldLabel><Input id="degree-teachers-search" type="search" placeholder="Buscar por nombre, cédula, correo, carrera o facultad" value={search.input} onChange={(event) => search.setInput(event.target.value)} /></Field>
    <ErrorNotice message={resource.error} retry={resource.reload} />
    <RecordTable rows={resource.data ?? []} loading={resource.loading} empty="No se encontraron docentes activos con estos criterios." columns={[
      { label: 'Docente', render: (teacher) => <div className="flex flex-col gap-1"><span className="font-medium">{teacher.name}</span><span className="text-xs text-muted-foreground">{teacher.identification}</span></div> },
      { label: 'Contacto', render: (teacher) => <div className="flex flex-col gap-1"><span>{teacher.email}</span><span className="text-xs text-muted-foreground">{teacher.phone || 'Sin teléfono registrado'}</span></div> },
      {
        label: 'Carrera / Facultad',
        render: (teacher) => (
          <span className="text-xs text-muted-foreground">
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
