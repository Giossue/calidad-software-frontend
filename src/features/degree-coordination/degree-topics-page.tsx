import { useState } from 'react'
import { ClipboardListIcon, RefreshCwIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { ErrorNotice, RecordTable } from '@/features/tutoring/tutoring-shared'
import { degreeCoordinationApi, type DegreeTopicStatus } from '@/lib/degree-coordination-api'
import { DEGREE_STATUS_LABELS, formatDegreeDate } from './degree-format'
import { useDegreePeriod, useDegreeResource, useDegreeSearch } from './degree-hooks'
import { DegreeStatusBadge } from './degree-shared'
import { DegreeTopicDetail } from './degree-topic-detail'

export function DegreeTopicsPage() {
  const period = useDegreePeriod()
  const search = useDegreeSearch()
  const [status, setStatus] = useState<DegreeTopicStatus | ''>('')
  const [sectionId, setSectionId] = useState('')
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null)
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

  if (selectedTopicId !== null) return <DegreeTopicDetail topicId={selectedTopicId} onBack={() => { setSelectedTopicId(null); reloadAll() }} />

  function clearFilters() {
    setStatus('')
    setSectionId('')
  }

  return <section className="flex flex-col gap-6">
    <AdminSectionHeader title="Propuestas de titulación" description="Revisa las propuestas del período vigente, registra observaciones y organiza las asignaciones académicas." actions={<Button type="button" variant="outline" disabled={table.loading || period.loading} onClick={reloadAll}><RefreshCwIcon data-icon="inline-start" />Actualizar</Button>} />
    {period.status === 404 && <Alert><AlertDescription>No existe un período académico vigente. Administración debe configurar y activar un período para continuar con la coordinación de titulación.</AlertDescription></Alert>}
    <FilterBar
      id="degree-topics"
      search={search.input}
      onSearch={search.setInput}
      searchLabel="Buscar propuesta"
      searchPlaceholder="Título, estudiante o cédula"
      disabled={period.status === 404}
      onClear={clearFilters}
      filters={[
        { id: 'status', label: 'Estado', value: status, onChange: (value) => setStatus(value as DegreeTopicStatus | ''), allLabel: 'Todos los estados', options: Object.entries(DEGREE_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
        { id: 'section', label: 'Paralelo', value: sectionId, onChange: setSectionId, allLabel: 'Todos los paralelos', options: (period.data?.sections ?? []).map((section) => ({ value: String(section.id), label: `${section.name}${section.is_active ? '' : ' (inactivo)'}` })) },
      ]}
    />
    {period.status !== 404 && <ErrorNotice message={table.error} retry={table.retry} />}
    {period.status !== 404 && <RecordTable rows={table.rows} loading={table.loading} empty={<Empty className="border-none p-0">
      <EmptyMedia variant="icon"><ClipboardListIcon /></EmptyMedia>
      <EmptyTitle>No hay propuestas registradas</EmptyTitle>
      <EmptyDescription>No hay propuestas que coincidan con los filtros en el período vigente.</EmptyDescription>
    </Empty>} columns={[
      { label: '#', render: (topic) => <span className="text-muted-foreground">#{topic.id}</span> },
      { label: 'Propuesta', render: (topic) => <span className="font-medium">{topic.title}</span> },
      { label: 'Estudiante', render: (topic) => <div className="flex flex-col gap-1"><span>{topic.student?.name ?? 'Sin estudiante'}</span><span className="text-xs text-muted-foreground">{topic.student?.identification} · {topic.section ? `Paralelo ${topic.section.name}` : 'Sin paralelo'}</span></div> },
      { label: 'Presentada', render: (topic) => formatDegreeDate(topic.proposed_at) },
      { label: 'Estado', render: (topic) => <DegreeStatusBadge status={topic.status} /> },
      { label: 'Acciones', render: (topic) => <Button type="button" variant="outline" size="sm" onClick={() => setSelectedTopicId(topic.id)} aria-label={`Revisar ${topic.title}`}>Ver detalle</Button> },
    ]} />}
    {!table.loading && !table.error && <p className="text-sm text-muted-foreground">Mostrando {table.rows.length} de {table.rows.length} propuesta{table.rows.length === 1 ? '' : 's'}</p>}
  </section>
}
