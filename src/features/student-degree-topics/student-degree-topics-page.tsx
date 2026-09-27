import { RefreshCwIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { degreeCoordinationApi, type DegreeTopic, type DegreeTopicStatus } from '@/lib/degree-coordination-api'

const STATUS_LABELS: Record<DegreeTopicStatus, string> = {
  pendiente: 'Pendiente de revisión',
  aprobado: 'Aprobada',
  rechazado: 'Rechazada',
}

function formatDate(value: string | null): string {
  if (!value) return 'Sin registrar'
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? 'Sin registrar' : new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

function TopicCard({ topic }: Readonly<{ topic: DegreeTopic }>) {
  const tutor = topic.assignments.find((assignment) => assignment.role === 'tutor')
  const peers = topic.assignments.filter((assignment) => assignment.role === 'par_academico')

  return <Card>
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CardTitle className="min-w-0 break-words">{topic.title}</CardTitle>
        <Badge variant={topic.status === 'rechazado' ? 'destructive' : topic.status === 'aprobado' ? 'default' : 'secondary'}>{STATUS_LABELS[topic.status]}</Badge>
      </div>
      <CardDescription>{topic.academic_period?.name ?? 'Período sin registrar'}{topic.section ? ` · Paralelo ${topic.section.name}` : ''}</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-5">
      <p className="whitespace-pre-wrap break-words">{topic.description || 'Sin descripción.'}</p>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Fecha de propuesta</dt><dd>{formatDate(topic.proposed_at)}</dd></div>
        <div><dt className="text-muted-foreground">Fecha de revisión</dt><dd>{formatDate(topic.reviewed_at)}</dd></div>
        <div><dt className="text-muted-foreground">Coordinación</dt><dd>{topic.reviewer?.name ?? 'Pendiente de revisión'}</dd></div>
        <div><dt className="text-muted-foreground">Tutor</dt><dd>{tutor?.teacher?.name ?? 'Sin tutor asignado'}</dd></div>
        <div className="sm:col-span-2"><dt className="text-muted-foreground">Pares académicos</dt><dd>{peers.length ? peers.map((peer) => peer.teacher?.name ?? 'Docente no disponible').join(', ') : 'Sin pares asignados'}</dd></div>
      </dl>
      <section aria-label={`Observaciones de ${topic.title}`} className="flex flex-col gap-3">
        <h3 className="font-semibold">Observaciones de coordinación</h3>
        {topic.observations.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay observaciones para esta propuesta.</p> : <ul className="flex flex-col gap-3">
          {topic.observations.map((observation) => <li key={observation.id} className="flex flex-col gap-2 border-l-2 border-border pl-4">
            <p className="whitespace-pre-wrap break-words">{observation.observation}</p>
            <p className="text-sm text-muted-foreground">{observation.coordinator?.name ?? 'Coordinación'} · {formatDate(observation.registered_at)}</p>
          </li>)}
        </ul>}
      </section>
    </CardContent>
  </Card>
}

export function StudentDegreeTopicsPage() {
  const resource = useDegreeResource(() => degreeCoordinationApi.studentTopics())
  const topics = resource.data ?? []
  const loading = resource.loading
  const error = resource.error && (resource.status === null || resource.status >= 500)
    ? 'No se pudieron cargar tus propuestas. Inténtalo de nuevo.'
    : resource.error

  return <section className="flex min-w-0 flex-col gap-6" aria-busy={loading}>
    <AdminSectionHeader title="Mis propuestas de titulación" description="Consulta el estado de tus propuestas, los docentes asignados y las observaciones de coordinación." actions={<Button type="button" variant="outline" disabled={loading} onClick={resource.reload}><RefreshCwIcon data-icon="inline-start" />Actualizar</Button>} />
    {error ? <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>{error}</span><Button type="button" variant="outline" onClick={resource.reload}>Reintentar</Button></AlertDescription></Alert> : loading ? <div role="status" aria-label="Cargando propuestas" className="flex flex-col gap-4"><Skeleton className="h-36 w-full" /><Skeleton className="h-36 w-full" /></div> : topics.length === 0 ? <Alert><AlertDescription>Aún no tienes propuestas de titulación registradas. Cuando se registre una propuesta a tu nombre, podrás consultar aquí su revisión.</AlertDescription></Alert> : topics.map((topic) => <TopicCard key={topic.id} topic={topic} />)}
  </section>
}
