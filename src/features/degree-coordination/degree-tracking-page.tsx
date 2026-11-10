import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { ErrorNotice } from '@/components/ui/error-notice'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { degreeCoordinationApi } from '@/lib/degree-coordination-api'
import { roundPercent } from './degree-format'
import { useDegreePeriod, useDegreeResource, useDegreeSearch, useDetailParam } from './degree-hooks'
import { DegreeListSkeleton, DegreePeriodNotice } from './degree-shared'
import { DegreeTrackingDetail } from './degree-tracking-detail'

export function DegreeTrackingPage() {
  const period = useDegreePeriod()
  const search = useDegreeSearch()
  // El tema abierto vive en la dirección (?topic=), así funciona el botón atrás.
  const detail = useDetailParam('topic')

  const topicsResource = useDegreeResource(
    () => degreeCoordinationApi.topics({ status: 'aprobado', search: search.search }),
    `approved-topics-${search.search}`,
  )
  const rows = topicsResource.data?.data ?? []
  const periodName = (period.data ?? period.previous)?.period.name

  if (detail.id !== null) return <DegreeTrackingDetail topicId={detail.id} onBack={detail.close} onChanged={topicsResource.reload} />
  // Primera carga: la descripción depende del período, así que todo espera como un solo esqueleto.
  if (!period.settled || !topicsResource.settled) return <DegreeListSkeleton label="Cargando seguimiento" headers={['Tema de titulación', 'Estudiante', 'Tutor', 'Avance']} />

  return (
    <section className="flex flex-col gap-6">
      <AdminSectionHeader
        title="Seguimiento de titulación"
        description={`Supervisa el avance de los temas aprobados${periodName ? ` del período ${periodName}` : ''}.`}
      />

      <DegreePeriodNotice resource={period} />

      <FilterBar
        id="degree-tracking"
        search={search.input}
        onSearch={search.setInput}
        searchLabel="Buscar tema o estudiante"
        searchPlaceholder="Título del tema, estudiante o cédula"
        onClear={() => search.setInput('')}
        filters={[]}
      />

      <ErrorNotice message={topicsResource.error} retry={topicsResource.reload} />

      <RecordTable
        rows={rows}
        loading={topicsResource.loading}
        empty={search.search ? 'No hay temas aprobados con esta búsqueda.' : 'Aún no hay temas aprobados en seguimiento.'}
        onRowClick={(topic) => detail.open(topic.id)}
        rowTitle={(topic) => `Ver evolución de ${topic.title}`}
        columns={[
          {
            label: 'Tema de titulación',
            render: (topic) => (
              <div className="flex max-w-md flex-col gap-1">
                <span>{topic.title}</span>
                <span className="line-clamp-2">{topic.description || 'Sin descripción'}</span>
              </div>
            ),
          },
          {
            label: 'Estudiante',
            render: (topic) => (
              <div className="flex flex-col gap-0.5">
                <span>{topic.student?.name}</span>
                <span>{topic.student?.identification}</span>
              </div>
            ),
          },
          {
            label: 'Tutor',
            render: (topic) => {
              const tutor = topic.assignments.find((assignment) => assignment.role === 'tutor')?.teacher
              return tutor ? tutor.name : 'Por asignar'
            },
          },
          {
            label: 'Avance',
            render: (topic) => {
              const progress = roundPercent(topic.tracking?.progress_percentage)
              return (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="tabular-nums">{progress}%</span>
                </div>
              )
            },
          },
        ]}
      />
      {!topicsResource.loading && !topicsResource.error && rows.length > 0 && <p className="text-sm text-muted-foreground">Mostrando {rows.length} de {rows.length} {rows.length === 1 ? 'tema' : 'temas'}</p>}
    </section>
  )
}
