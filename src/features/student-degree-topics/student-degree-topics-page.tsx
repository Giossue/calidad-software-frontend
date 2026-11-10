import { useState, type FormEvent, type ReactNode } from 'react'
import { PencilIcon, PlusIcon, ReplaceIcon, SendIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { RefreshButton } from '@/components/ui/refresh-button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ErrorNotice } from '@/components/ui/error-notice'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { degreeCoordinationApi, type DegreeTopic } from '@/lib/degree-coordination-api'
import { studentApi } from '@/lib/student-api'
import { DegreeTopicsSkeleton } from '@/features/student/student-skeletons'
import { Initials } from '@/features/student/student-ui'

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

/** Bloque de la propuesta: título de sección sin ícono y su contenido. */
function Block({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return <section className="flex min-w-0 flex-col gap-3">
    <h4 className="font-semibold">{title}</h4>
    {children}
  </section>
}

function Person({ name, email, role }: Readonly<{ name: string; email?: string | null; role: string }>) {
  return <div className="flex items-center gap-3">
    <Initials name={name} />
    <div className="flex min-w-0 flex-col">
      <span className="text-sm font-medium">{name}</span>
      <span className="break-all text-xs text-muted-foreground">{[role, email].filter(Boolean).join(' · ')}</span>
    </div>
  </div>
}

function TopicCard({ topic, onEdit }: Readonly<{ topic: DegreeTopic; onEdit?: (topic: DegreeTopic) => void }>) {
  const tutor = topic.assignments.find((assignment) => assignment.role === 'tutor')?.teacher
  const peers = topic.assignments.filter((assignment) => assignment.role === 'par_academico')
  const badge = topic.status === 'rechazado' ? 'danger' : topic.status === 'aprobado' ? 'success' : 'secondary'
  const context = [`Propuesta #${topic.id}`, topic.academic_period?.name ?? 'Período sin registrar', topic.section ? `Paralelo ${topic.section.name}` : null, `Presentada el ${formatDate(topic.proposed_at)}`].filter(Boolean).join(' · ')

  return <Card role="article" aria-label={topic.title}>
    <CardContent className="flex flex-col gap-6 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3"><h3 className="break-words text-xl font-semibold tracking-tight">{topic.title}</h3><Badge variant={badge}>{STATUS_LABELS[topic.status] ?? topic.status}</Badge></div>
          <p className="text-sm text-muted-foreground">{context}</p>
        </div>
        {onEdit && <Button type="button" variant="secondary" onClick={() => onEdit(topic)}><PencilIcon data-icon="inline-start" />Cambiar propuesta</Button>}
      </div>
      <div className="grid gap-6 border-t pt-6 lg:grid-cols-2">
        <Block title="Descripción"><p className="whitespace-pre-wrap break-words text-sm leading-6">{topic.description || 'No registraste una descripción.'}</p></Block>
        <Block title="Revisión">
          <dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Coordinación</dt><dd>{topic.reviewer?.name ?? 'Sin asignar'}</dd></div><div><dt className="text-muted-foreground">Fecha de revisión</dt><dd>{formatDate(topic.reviewed_at)}</dd></div></dl>
        </Block>
        <Block title="Docentes asignados">
          {!tutor && peers.length === 0
            ? <p className="text-sm text-muted-foreground">Aún no hay tutor ni pares académicos asignados.</p>
            : <ul className="flex flex-col gap-3">
              <li>{tutor ? <Person name={tutor.name} email={tutor.email} role="Tutor" /> : <p className="text-sm text-muted-foreground">Sin tutor asignado</p>}</li>
              {peers.length === 0
                ? <li className="text-sm text-muted-foreground">Sin pares asignados</li>
                : peers.map((peer) => <li key={peer.id}><Person name={peer.teacher?.name ?? 'Docente no disponible'} email={peer.teacher?.email} role="Par académico" /></li>)}
            </ul>}
        </Block>
        <Block title="Observaciones de coordinación">
          {topic.observations.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay observaciones. Cuando coordinación registre una, la verás aquí.</p> : <ul className="flex flex-col gap-4">
            {topic.observations.map((observation) => <li key={observation.id} className="flex flex-col gap-1 border-l-2 border-border pl-4">
              <p className="whitespace-pre-wrap break-words text-sm leading-6">{observation.observation}</p>
              <p className="text-xs text-muted-foreground">{observation.coordinator?.name ?? 'Coordinación'} · {formatDate(observation.registered_at)}</p>
            </li>)}
          </ul>}
        </Block>
      </div>
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

  const titleError = form.title !== '' && title.length < 5 ? 'El título debe tener entre 5 y 255 caracteres.' : null
  const blockReason = title.length < 5 ? 'El título debe tener al menos 5 caracteres.' : null

  return <FormDialog open={mode !== null} title={mode?.kind === 'edit' ? 'Cambiar propuesta' : mode?.kind === 'replace' ? 'Proponer una alternativa' : 'Nueva propuesta de titulación'} description={mode?.kind === 'replace' ? 'Tu propuesta pendiente quedará reemplazada por esta nueva.' : 'Coordinación revisará tu propuesta y te notificará el resultado.'} pending={operation.pending} error={operation.error} dirty={form.title !== initial.title || form.description !== initial.description} blockReason={blockReason} onClose={onClose} onSubmit={submit} submitIcon={mode?.kind === 'edit' ? undefined : SendIcon} submitLabel={mode?.kind === 'edit' ? 'Guardar cambios' : 'Enviar propuesta'}>
    <FormField id="student-topic-title" label="Título del tema" counter={{ current: form.title.length, max: 255 }} tip="Entre 5 y 255 caracteres." error={titleError}><Input id="student-topic-title" placeholder="Ej.: Plataforma web para el seguimiento de tutorías académicas" required minLength={5} maxLength={255} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} aria-invalid={Boolean(titleError)} /></FormField>
    <FormField id="student-topic-description" label="Descripción" optional counter={{ current: form.description.length, max: 2000 }} tip="Explica el alcance y el objetivo del tema."><Textarea id="student-topic-description" placeholder="Describe el problema que resuelve tu tema, su alcance y los resultados esperados." maxLength={2000} rows={5} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></FormField>
  </FormDialog>
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
    <AdminSectionHeader title="Mis propuestas de titulación" description="Presenta tu tema, consulta el estado de tus propuestas, los docentes asignados y las observaciones de coordinación." actions={<div className="flex shrink-0 flex-col gap-2 sm:flex-row"><RefreshButton disabled={loading} onClick={resource.reload} />{action}</div>} />
    {error ? <ErrorNotice message={error} retry={resource.reload} /> : loading ? <DegreeTopicsSkeleton /> : topics.length === 0 ? <Alert><AlertDescription>Aún no tienes propuestas de titulación registradas. Usa «Nueva propuesta» para presentar tu tema a coordinación.</AlertDescription></Alert> : topics.map((topic) => <TopicCard key={topic.id} topic={topic} onEdit={topic.status === 'pendiente' ? (item) => setMode({ kind: 'edit', topic: item }) : undefined} />)}
    <ProposalDialog mode={mode} onClose={() => setMode(null)} onSaved={resource.reload} />
  </section>
}
