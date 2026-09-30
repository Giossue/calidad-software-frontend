import { useState, type FormEvent } from 'react'
import { PencilIcon, PlusIcon, RefreshCwIcon, ReplaceIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { MutationDialog } from '@/features/tutoring/tutoring-shared'
import { degreeCoordinationApi, type DegreeTopic } from '@/lib/degree-coordination-api'
import { studentApi } from '@/lib/student-api'

// El backend también devuelve «descartado» cuando el estudiante reemplaza una propuesta pendiente.
const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente de revisión',
  aprobado: 'Aprobada',
  rechazado: 'Rechazada',
  descartado: 'Reemplazada',
}

type ProposalMode = { kind: 'create' } | { kind: 'replace' } | { kind: 'edit'; topic: DegreeTopic }

function formatDate(value: string | null): string {
  if (!value) return 'Sin registrar'
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? 'Sin registrar' : new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

function TopicCard({ topic, onEdit }: Readonly<{ topic: DegreeTopic; onEdit?: (topic: DegreeTopic) => void }>) {
  const tutor = topic.assignments.find((assignment) => assignment.role === 'tutor')
  const peers = topic.assignments.filter((assignment) => assignment.role === 'par_academico')

  return <Card>
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CardTitle className="min-w-0 break-words">{topic.title}</CardTitle>
        <Badge variant={topic.status === 'rechazado' ? 'destructive' : topic.status === 'aprobado' ? 'default' : 'secondary'}>{STATUS_LABELS[topic.status] ?? topic.status}</Badge>
      </div>
      <CardDescription>{topic.academic_period?.name ?? 'Período sin registrar'}{topic.section ? ` · Paralelo ${topic.section.name}` : ''}</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-5">
      {onEdit && <div><Button type="button" variant="outline" size="sm" onClick={() => onEdit(topic)}><PencilIcon data-icon="inline-start" />Cambiar propuesta</Button></div>}
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

function ProposalDialog({ mode, onClose, onSaved }: Readonly<{ mode: ProposalMode | null; onClose: () => void; onSaved: () => void }>) {
  const operation = useOperation()
  const editing = mode?.kind === 'edit' ? mode.topic : null
  const [form, setForm] = useState({ title: '', description: '' })
  const [initial, setInitial] = useState(form)
  const [openedFor, setOpenedFor] = useState<ProposalMode | null>(null)
  if (mode !== openedFor) {
    const next = editing ? { title: editing.title, description: editing.description ?? '' } : { title: '', description: '' }
    setOpenedFor(mode); setForm(next); setInitial(next); operation.clearError()
  }
  const title = form.title.trim()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!mode) return
    const input = { title, description: form.description.trim() || null }
    void operation.run(() => mode.kind === 'edit' ? studentApi.updateTopic(mode.topic.id, input) : studentApi.createTopic({ ...input, ...(mode.kind === 'replace' ? { replace_pending: true } : {}) }),
      mode.kind === 'edit' ? 'Propuesta actualizada.' : 'Propuesta enviada a coordinación.', () => { onClose(); onSaved() })
  }

  return <MutationDialog open={mode !== null} title={mode?.kind === 'edit' ? 'Cambiar propuesta' : mode?.kind === 'replace' ? 'Proponer una alternativa' : 'Nueva propuesta de titulación'} description={mode?.kind === 'replace' ? 'Tu propuesta pendiente quedará reemplazada por esta nueva.' : 'Coordinación revisará tu propuesta y te notificará el resultado.'} pending={operation.pending} error={operation.error} dirty={form.title !== initial.title || form.description !== initial.description} onClose={onClose} onSubmit={submit} submitLabel={mode?.kind === 'edit' ? 'Guardar cambios' : 'Enviar propuesta'} submitDisabled={title.length < 5}>
    <Field><FieldLabel htmlFor="student-topic-title">Título del tema</FieldLabel><Input id="student-topic-title" required minLength={5} maxLength={255} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /><FieldDescription>Entre 5 y 255 caracteres.</FieldDescription></Field>
    <Field><FieldLabel htmlFor="student-topic-description">Descripción</FieldLabel><Textarea id="student-topic-description" maxLength={2000} rows={5} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /><FieldDescription>Opcional. Explica el alcance y el objetivo del tema.</FieldDescription></Field>
  </MutationDialog>
}

export function StudentDegreeTopicsPage() {
  const resource = useDegreeResource(() => degreeCoordinationApi.studentTopics())
  const [mode, setMode] = useState<ProposalMode | null>(null)
  const topics = resource.data ?? []
  const loading = resource.loading
  const error = resource.error && (resource.status === null || resource.status >= 500)
    ? 'No se pudieron cargar tus propuestas. Inténtalo de nuevo.'
    : resource.error
  const pending = topics.find((topic) => topic.status === 'pendiente')
  const approved = topics.some((topic) => topic.status === 'aprobado' && topic.academic_period?.is_active)
  const canPropose = !loading && !resource.error && !approved
  const action = !canPropose ? null : pending
    ? <Button type="button" onClick={() => setMode({ kind: 'replace' })}><ReplaceIcon data-icon="inline-start" />Proponer alternativa</Button>
    : <Button type="button" onClick={() => setMode({ kind: 'create' })}><PlusIcon data-icon="inline-start" />Nueva propuesta</Button>

  return <section className="flex min-w-0 flex-col gap-6" aria-busy={loading}>
    <AdminSectionHeader title="Mis propuestas de titulación" description="Presenta tu tema, consulta el estado de tus propuestas, los docentes asignados y las observaciones de coordinación." actions={<div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={loading} onClick={resource.reload}><RefreshCwIcon data-icon="inline-start" />Actualizar</Button>{action}</div>} />
    {error ? <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>{error}</span><Button type="button" variant="outline" onClick={resource.reload}>Reintentar</Button></AlertDescription></Alert> : loading ? <div role="status" aria-label="Cargando propuestas" className="flex flex-col gap-4"><Skeleton className="h-36 w-full" /><Skeleton className="h-36 w-full" /></div> : topics.length === 0 ? <Alert><AlertDescription>Aún no tienes propuestas de titulación registradas. Usa «Nueva propuesta» para presentar tu tema a coordinación.</AlertDescription></Alert> : topics.map((topic) => <TopicCard key={topic.id} topic={topic} onEdit={topic.status === 'pendiente' ? (item) => setMode({ kind: 'edit', topic: item }) : undefined} />)}
    <ProposalDialog mode={mode} onClose={() => setMode(null)} onSaved={resource.reload} />
  </section>
}
