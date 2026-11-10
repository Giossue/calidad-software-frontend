import { useState } from 'react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { RefreshButton } from '@/components/ui/refresh-button'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { ErrorNotice } from '@/components/ui/error-notice'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { degreeCoordinationApi, type DegreeTopicStatus } from '@/lib/degree-coordination-api'
import { DEGREE_STATUS_LABELS, formatDegreeDate } from './degree-format'
import { useDegreePeriod, useDegreeResource, useDegreeSearch, useDetailParam } from './degree-hooks'
import { DegreePeriodNotice, DegreeStatusBadge } from './degree-shared'
import { DegreeTopicDetail } from './degree-topic-detail'

export function DegreeTopicsPage() {
  const period = useDegreePeriod()
  const search = useDegreeSearch()
  const [status, setStatus] = useState<DegreeTopicStatus | ''>('')
  const [sectionId, setSectionId] = useState('')
  // La propuesta abierta vive en la dirección (?topic=), así funciona el botón atrás.
  const detail = useDetailParam('topic')
  const hasActiveFilters = Boolean(search.input || status || sectionId)

  // El período completo (sin filtros) se pide una sola vez y alimenta tanto las
  // estadísticas como la tabla cuando no hay filtros activos. Cuando sí los hay,
  // "filteredTopics" pide ese subconjunto aparte; su loader no llama a la API si
  // no hace falta, así evitamos duplicar la misma consulta en cada carga.
  const overview = useDegreeResource(() => degreeCoordinationApi.topics({}), 'overview')
  const filteredTopics = useDegreeResource(
    () => hasActiveFilters
      ? degreeCoordinationApi.topics({ status: status || undefined, section_id: Number(sectionId) || undefined, search: search.search })
      : Promise.resolve(null),
    `${status}|${sectionId}|${search.search}`,
  )
  const table = hasActiveFilters
    ? { rows: filteredTopics.data?.data ?? [], loading: filteredTopics.loading, error: filteredTopics.error, retry: filteredTopics.reload }
    : { rows: overview.data?.data ?? [], loading: overview.loading, error: overview.error, retry: overview.reload }

  function reloadAll() {
    period.reload()
    overview.reload()
    if (hasActiveFilters) filteredTopics.reload()
  }

  if (detail.id !== null) return <DegreeTopicDetail topicId={detail.id} onBack={detail.close} onChanged={reloadAll} />

  function clearFilters() {
    setStatus('')
    setSectionId('')
  }

  const noPeriod = period.status === 404

  return <section className="flex flex-col gap-6">
    <AdminSectionHeader title="Propuestas de titulación" description="Revisa los temas que proponen los estudiantes y resuélvelos." actions={<RefreshButton disabled={table.loading || period.loading} onClick={reloadAll} />} />
    {noPeriod && <DegreePeriodNotice resource={period} />}
    <FilterBar
      id="degree-topics"
      search={search.input}
      onSearch={search.setInput}
      searchLabel="Buscar propuesta"
      searchPlaceholder="Título, estudiante o cédula"
      disabled={noPeriod}
      onClear={clearFilters}
      filters={[
        { id: 'status', label: 'Estado', value: status, onChange: (value) => setStatus(value as DegreeTopicStatus | ''), allLabel: 'Todos los estados', options: Object.entries(DEGREE_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
        { id: 'section', label: 'Paralelo', value: sectionId, onChange: setSectionId, allLabel: 'Todos los paralelos', options: (period.data?.sections ?? []).map((section) => ({ value: String(section.id), label: `${section.name}${section.is_active ? '' : ' (inactivo)'}` })) },
      ]}
    />
    {!noPeriod && <ErrorNotice message={table.error} retry={table.retry} />}
    {!noPeriod && <RecordTable rows={table.rows} loading={table.loading} empty={hasActiveFilters ? 'No hay propuestas con estos filtros.' : 'Aún no hay propuestas en el período vigente.'} onRowClick={(topic) => detail.open(topic.id)} rowTitle={(topic) => `Revisar ${topic.title}`} columns={[
      { label: '#', render: (topic) => `#${topic.id}` },
      { label: 'Propuesta', render: (topic) => topic.title },
      { label: 'Estudiante', render: (topic) => <div className="flex flex-col gap-1"><span>{topic.student?.name ?? 'Sin estudiante'}</span><span>{topic.student?.identification} · {topic.section ? `Paralelo ${topic.section.name}` : 'Sin paralelo'}</span></div> },
      { label: 'Presentada', render: (topic) => formatDegreeDate(topic.proposed_at) },
      { label: 'Estado', render: (topic) => <DegreeStatusBadge status={topic.status} /> },
    ]} />}
    {!noPeriod && !table.loading && !table.error && table.rows.length > 0 && <p className="text-sm text-muted-foreground">Mostrando {table.rows.length} de {table.rows.length} {table.rows.length === 1 ? 'propuesta' : 'propuestas'}</p>}
  </section>
}
