import { useState } from 'react'
import { ClipboardListIcon, ClockIcon, FileTextIcon, RefreshCwIcon, RotateCcwIcon, UsersIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ErrorNotice, RecordTable, SelectField } from '@/features/tutoring/tutoring-shared'
import { degreeCoordinationApi, type DegreeTopicStatus } from '@/lib/degree-coordination-api'
import { DEGREE_STATUS_LABELS, formatDegreeDate } from './degree-format'
import { useDegreePeriod, useDegreeResource, useDegreeSearch } from './degree-hooks'
import { DegreePeriodCard, DegreeStatusBadge } from './degree-shared'
import { DegreeTopicDetail } from './degree-topic-detail'

function OverviewStat({ icon: Icon, tone, label, value }: Readonly<{ icon: typeof ClockIcon; tone: 'green' | 'blue' | 'muted'; label: string; value: number }>) {
  const toneClass = tone === 'green'
    ? 'bg-success/10 text-success-foreground'
    : tone === 'blue'
      ? 'bg-brand-blue/10 text-brand-blue'
      : 'bg-muted text-muted-foreground'
  return <div className="flex items-center gap-3">
    <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${toneClass}`}><Icon className="size-5" /></div>
    <div className="flex flex-col"><span className="text-lg font-semibold leading-none">{value}</span><span className="text-sm text-muted-foreground">{label}</span></div>
  </div>
}

export function DegreeTopicsPage() {
  const period = useDegreePeriod()
  const search = useDegreeSearch()
  const [status, setStatus] = useState<DegreeTopicStatus | ''>('')
  const [sectionId, setSectionId] = useState('')
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null)
  const topics = useDegreeResource(() => degreeCoordinationApi.topics({ status: status || undefined, section_id: Number(sectionId) || undefined, search: search.search }), `${status}|${sectionId}|${search.search}`)
  const overview = useDegreeResource(() => degreeCoordinationApi.topics({}), 'overview')

  if (selectedTopicId !== null) return <DegreeTopicDetail topicId={selectedTopicId} onBack={() => { setSelectedTopicId(null); topics.reload(); overview.reload() }} />

  const hasActiveFilters = Boolean(search.input || status || sectionId)
  function clearFilters() {
    search.setInput('')
    setStatus('')
    setSectionId('')
  }

  const overviewRows = overview.data?.data ?? []
  const uniqueStudents = new Set(overviewRows.flatMap((topic) => topic.student ? [topic.student.id] : [])).size
  const pendingCount = overviewRows.filter((topic) => topic.status === 'pendiente').length

  return <section className="flex flex-col gap-6">
    <AdminSectionHeader title="Propuestas de titulación" description="Revisa las propuestas del período vigente, registra observaciones y organiza las asignaciones académicas." actions={<Button type="button" variant="outline" disabled={topics.loading || period.loading} onClick={() => { period.reload(); topics.reload(); overview.reload() }}><RefreshCwIcon data-icon="inline-start" />Actualizar</Button>} />
    <DegreePeriodCard resource={period} extra={period.status !== 404 && !overview.error && <div className="flex flex-wrap gap-6">
      <OverviewStat icon={FileTextIcon} tone="green" label="Propuestas" value={overviewRows.length} />
      <OverviewStat icon={UsersIcon} tone="blue" label="Estudiantes únicos" value={uniqueStudents} />
      <OverviewStat icon={ClockIcon} tone="muted" label="En revisión" value={pendingCount} />
    </div>} />
    <Card>
      <CardContent className="pt-6">
        <FieldGroup className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <Field className="flex-1 lg:min-w-[220px]"><FieldLabel htmlFor="degree-topic-search">Buscar propuesta</FieldLabel><Input id="degree-topic-search" type="search" placeholder="Título, estudiante o cédula" value={search.input} onChange={(event) => search.setInput(event.target.value)} disabled={period.status === 404} /></Field>
          <div className="lg:w-52"><SelectField id="degree-topic-status" label="Estado" value={status} onChange={(value) => setStatus(value as DegreeTopicStatus | '')} required={false} disabled={period.status === 404}><option value="">Todos los estados</option>{Object.entries(DEGREE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField></div>
          <div className="lg:w-52"><SelectField id="degree-topic-section" label="Paralelo" value={sectionId} onChange={setSectionId} required={false} disabled={period.loading || !period.data}><option value="">Todos los paralelos</option>{period.data?.sections.map((section) => <option key={section.id} value={section.id}>{section.name}{section.is_active ? '' : ' (inactivo)'}</option>)}</SelectField></div>
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" disabled={!hasActiveFilters} onClick={clearFilters}><RotateCcwIcon data-icon="inline-start" />Limpiar filtros</Button>
        </FieldGroup>
      </CardContent>
    </Card>
    {period.status !== 404 && <ErrorNotice message={topics.error} retry={topics.reload} />}
    {period.status !== 404 && <RecordTable rows={topics.data?.data ?? []} loading={topics.loading} empty={<Empty className="border-none p-0">
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
    {topics.data && <p className="text-sm text-muted-foreground">Mostrando {topics.data.data.length} propuesta{topics.data.data.length === 1 ? '' : 's'} en esta consulta.</p>}
  </section>
}
