import { useState } from 'react'
import { RefreshCwIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ErrorNotice, RecordTable, SelectField } from '@/features/tutoring/tutoring-shared'
import { degreeCoordinationApi, type DegreeTopicStatus } from '@/lib/degree-coordination-api'
import { DEGREE_STATUS_LABELS, formatDegreeDate } from './degree-format'
import { useDegreePeriod, useDegreeResource, useDegreeSearch } from './degree-hooks'
import { DegreePeriodCard, DegreeStatusBadge } from './degree-shared'
import { DegreeTopicDetail } from './degree-topic-detail'

export function DegreeTopicsPage() {
  const period = useDegreePeriod()
  const search = useDegreeSearch()
  const [status, setStatus] = useState<DegreeTopicStatus | ''>('')
  const [sectionId, setSectionId] = useState('')
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null)
  const topics = useDegreeResource(() => degreeCoordinationApi.topics({ status: status || undefined, section_id: Number(sectionId) || undefined, search: search.search }), `${status}|${sectionId}|${search.search}`)

  if (selectedTopicId !== null) return <DegreeTopicDetail topicId={selectedTopicId} onBack={() => { setSelectedTopicId(null); topics.reload() }} />

  return <section className="flex flex-col gap-6">
    <AdminSectionHeader title="Propuestas de titulación" description="Revisa las propuestas del período vigente, registra observaciones y organiza las asignaciones académicas." actions={<Button type="button" variant="outline" disabled={topics.loading || period.loading} onClick={() => { period.reload(); topics.reload() }}><RefreshCwIcon data-icon="inline-start" />Actualizar</Button>} />
    <DegreePeriodCard resource={period} />
    <FieldGroup className="flex flex-col gap-4 lg:flex-row">
      <Field className="flex-1"><FieldLabel htmlFor="degree-topic-search">Buscar propuesta</FieldLabel><Input id="degree-topic-search" type="search" placeholder="Título, estudiante o cédula" value={search.input} onChange={(event) => search.setInput(event.target.value)} disabled={period.status === 404} /></Field>
      <SelectField id="degree-topic-status" label="Estado" value={status} onChange={(value) => setStatus(value as DegreeTopicStatus | '')} required={false} disabled={period.status === 404}><option value="">Todos los estados</option>{Object.entries(DEGREE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField>
      <SelectField id="degree-topic-section" label="Paralelo" value={sectionId} onChange={setSectionId} required={false} disabled={period.loading || !period.data}><option value="">Todos los paralelos</option>{period.data?.sections.map((section) => <option key={section.id} value={section.id}>{section.name}{section.is_active ? '' : ' (inactivo)'}</option>)}</SelectField>
    </FieldGroup>
    {period.status !== 404 && <ErrorNotice message={topics.error} retry={topics.reload} />}
    {period.status !== 404 && <RecordTable rows={topics.data?.data ?? []} loading={topics.loading} empty="No hay propuestas que coincidan con estos filtros en el período vigente." columns={[
      { label: 'Propuesta', render: (topic) => <div className="flex flex-col gap-1"><span className="font-medium">{topic.title}</span><span className="text-xs text-muted-foreground">Propuesta #{topic.id}</span></div> },
      { label: 'Estudiante', render: (topic) => <div className="flex flex-col gap-1"><span>{topic.student?.name ?? 'Sin estudiante'}</span><span className="text-xs text-muted-foreground">{topic.student?.identification} · {topic.section ? `Paralelo ${topic.section.name}` : 'Sin paralelo'}</span></div> },
      { label: 'Presentada', render: (topic) => formatDegreeDate(topic.proposed_at) },
      { label: 'Estado', render: (topic) => <DegreeStatusBadge status={topic.status} /> },
      { label: 'Acciones', render: (topic) => <Button type="button" variant="outline" size="sm" onClick={() => setSelectedTopicId(topic.id)} aria-label={`Revisar ${topic.title}`}>Ver detalle</Button> },
    ]} />}
    {topics.data && <p className="text-sm text-muted-foreground">{topics.data.data.length} propuesta{topics.data.data.length === 1 ? '' : 's'} en esta consulta.</p>}
  </section>
}
