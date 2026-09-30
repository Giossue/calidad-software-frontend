import { useState, type FormEvent } from 'react'
import { ArrowLeftIcon, CheckIcon, ClipboardListIcon, FileTextIcon, MessageSquareIcon, PlusCircleIcon, UserIcon, UsersIcon, XIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice, MutationDialog, SelectField } from '@/features/tutoring/tutoring-shared'
import { degreeCoordinationApi } from '@/lib/degree-coordination-api'
import { formatDegreeDate } from './degree-format'
import { useDegreeResource } from './degree-hooks'
import { DegreeObservationField, DegreeStatusBadge, InitialsAvatar, SectionCard } from './degree-shared'

type ReviewAction = 'approve' | 'reject' | 'observe' | 'peers'
const ACTION_LABELS: Record<ReviewAction, string> = { approve: 'Aprobar propuesta', reject: 'Rechazar propuesta', observe: 'Registrar observación', peers: 'Gestionar pares académicos' }
type ReviewDraft = { tutorId: string; peerIds: readonly number[]; observation: string }
const EMPTY_DRAFT: ReviewDraft = { tutorId: '', peerIds: [], observation: '' }

export function DegreeTopicDetail({ topicId, onBack }: Readonly<{ topicId: number; onBack: () => void }>) {
  const resource = useDegreeResource(() => degreeCoordinationApi.topic(topicId), String(topicId))
  const teachers = useDegreeResource(() => degreeCoordinationApi.teachers())
  const operation = useOperation()
  const [action, setAction] = useState<ReviewAction | null>(null)
  const [draft, setDraft] = useState<ReviewDraft>(EMPTY_DRAFT)
  const [initialDraft, setInitialDraft] = useState<ReviewDraft>(EMPTY_DRAFT)
  const topic = resource.data
  const activeTeachers = (teachers.data ?? []).filter((teacher) => teacher.is_active)
  const assignments = topic?.assignments.filter((assignment) => assignment.is_active !== false) ?? []
  const tutor = assignments.find((assignment) => assignment.role === 'tutor')?.teacher
  const peers = assignments.filter((assignment) => assignment.role === 'par_academico')
  const availablePeers = activeTeachers.filter((teacher) => teacher.id !== Number(draft.tutorId))
  const selectedPeersValid = draft.peerIds.length > 0 && draft.peerIds.every((id) => availablePeers.some((teacher) => teacher.id === id))
  const approvalPossible = !teachers.loading && !teachers.error && activeTeachers.length >= 2
  const peerChangePossible = !teachers.loading && !teachers.error && activeTeachers.some((teacher) => teacher.id !== tutor?.id)
  const hasUnavailablePeers = peers.some((assignment) => assignment.teacher && !activeTeachers.some((teacher) => teacher.id === assignment.teacher?.id))
  const canSubmit = action === 'approve'
    ? approvalPossible && activeTeachers.some((teacher) => teacher.id === Number(draft.tutorId)) && selectedPeersValid
    : action === 'peers' ? peerChangePossible && selectedPeersValid
      : action === 'observe' ? draft.observation.trim().length >= 3 && draft.observation.length <= 1000
        : action === 'reject' && draft.observation.length <= 1000

  function openAction(nextAction: ReviewAction) {
    const next = nextAction === 'peers' ? {
      tutorId: String(tutor?.id ?? ''),
      peerIds: peers.flatMap((assignment) => assignment.teacher && activeTeachers.some((teacher) => teacher.id === assignment.teacher?.id) ? [assignment.teacher.id] : []),
      observation: '',
    } : EMPTY_DRAFT
    setDraft(next)
    setInitialDraft(next)
    operation.clearError()
    setAction(nextAction)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!topic || !action || !canSubmit) return
    const mutation = () => {
      switch (action) {
        case 'approve': return degreeCoordinationApi.approve(topic.id, { tutor_id: Number(draft.tutorId), peer_ids: draft.peerIds })
        case 'reject': return degreeCoordinationApi.reject(topic.id, draft.observation.trim())
        case 'observe': return degreeCoordinationApi.observe(topic.id, draft.observation.trim())
        case 'peers': return degreeCoordinationApi.updatePeers(topic.id, draft.peerIds)
      }
    }
    const message = action === 'approve' ? 'Propuesta aprobada y docentes asignados.' : action === 'reject' ? 'Propuesta rechazada.' : action === 'observe' ? 'Observación registrada.' : 'Pares académicos actualizados.'
    void operation.run(mutation, message, () => { setAction(null); resource.reload(); teachers.reload() })
  }

  return <section className="flex flex-col gap-6">
    <div><Button type="button" variant="ghost" onClick={onBack} disabled={operation.pending}><ArrowLeftIcon data-icon="inline-start" />Volver a propuestas</Button></div>
    {resource.loading && <p role="status" className="flex items-center gap-2"><Spinner aria-hidden="true" />Cargando propuesta…</p>}
    <ErrorNotice message={resource.error} retry={resource.reload} />
    {topic && <>
      <AdminSectionHeader title={topic.title} description={<span className="flex flex-wrap items-center gap-x-2">{[`Propuesta #${topic.id}`, topic.academic_period?.name ?? 'Sin período', topic.section ? `Paralelo ${topic.section.name}` : 'Sin paralelo'].map((part, index) => <span key={part} className="flex items-center gap-2">{index > 0 && <span aria-hidden="true">·</span>}{part}</span>)}</span>} actions={<div className="flex flex-col items-start gap-1 sm:items-end"><DegreeStatusBadge status={topic.status} /><span className="text-xs text-muted-foreground">Presentada el {formatDegreeDate(topic.proposed_at)}</span></div>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard icon={FileTextIcon} title="Descripción de la propuesta" description={`Presentada el ${formatDegreeDate(topic.proposed_at)}`}><p className="whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{topic.description || 'El estudiante no registró una descripción.'}</p></SectionCard>
        <SectionCard icon={UserIcon} tone="blue" title="Estudiante" description={topic.student ? 'Datos de contacto del estudiante' : 'Sin estudiante vinculado'}>
          <dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Nombre</dt><dd className="font-medium">{topic.student?.name ?? 'Sin registrar'}</dd></div><div><dt className="text-muted-foreground">Correo</dt><dd className="[overflow-wrap:anywhere]">{topic.student?.email ?? 'Sin registrar'}</dd></div><div><dt className="text-muted-foreground">Cédula</dt><dd>{topic.student?.identification ?? 'Sin registrar'}</dd></div><div><dt className="text-muted-foreground">Teléfono</dt><dd>{topic.student?.phone || 'Sin registrar'}</dd></div></dl>
        </SectionCard>
      </div>
      <SectionCard icon={ClipboardListIcon} title="Revisión y seguimiento" description={topic.reviewer ? `Revisada por ${topic.reviewer.name} el ${formatDegreeDate(topic.reviewed_at)}` : 'La propuesta todavía no ha sido revisada.'}>
        <div className="flex flex-col gap-4">
          {(topic.status === 'pendiente' || topic.status === 'aprobado') && <ErrorNotice message={teachers.error} retry={teachers.reload} />}
          {topic.status === 'pendiente' && !teachers.loading && !teachers.error && !approvalPossible && <Alert><AlertDescription>Se necesitan al menos dos docentes activos: uno como tutor y otro como par académico. Registra o activa docentes antes de aprobar la propuesta.</AlertDescription></Alert>}
          {topic.status === 'aprobado' && !teachers.loading && !teachers.error && !peerChangePossible && <Alert><AlertDescription>No hay docentes activos disponibles diferentes del tutor. Activa o registra otro docente para gestionar los pares académicos.</AlertDescription></Alert>}
          <div className="flex flex-wrap gap-3">
            {topic.status === 'pendiente' && <><Button type="button" disabled={operation.pending || !approvalPossible} onClick={() => openAction('approve')}><CheckIcon data-icon="inline-start" />Aprobar propuesta</Button><Button type="button" variant="destructive" disabled={operation.pending} onClick={() => openAction('reject')}><XIcon data-icon="inline-start" />Rechazar propuesta</Button></>}
            {topic.status === 'aprobado' && <Button type="button" disabled={operation.pending || !peerChangePossible} onClick={() => openAction('peers')}><UsersIcon data-icon="inline-start" />Gestionar pares académicos</Button>}
            <Button type="button" variant="outline" disabled={operation.pending} onClick={() => openAction('observe')}><MessageSquareIcon data-icon="inline-start" />Registrar observación</Button>
          </div>
        </div>
      </SectionCard>
      <SectionCard icon={UsersIcon} title="Docentes asignados" description="Tutor y pares académicos de esta propuesta.">
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-0 sm:divide-x">
          <div className="flex flex-col gap-3 sm:pr-6"><h4 className="text-sm text-muted-foreground">Tutor</h4>{tutor ? <div className="flex items-center gap-3"><InitialsAvatar name={tutor.name} tone="red" /><div className="flex min-w-0 flex-col"><span className="font-medium">{tutor.name}</span><span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{tutor.email}</span></div></div> : <p className="text-sm text-muted-foreground">Sin tutor asignado</p>}</div>
          <div className="flex flex-col gap-3 sm:pl-6"><h4 className="text-sm text-muted-foreground">Pares académicos</h4>{peers.length === 0 ? <p className="text-sm text-muted-foreground">Sin pares asignados.</p> : <ul className="flex flex-col gap-4">{peers.map((assignment) => <li key={assignment.id} className="flex items-center gap-3"><InitialsAvatar name={assignment.teacher?.name ?? 'Docente'} tone="blue" /><div className="flex min-w-0 flex-col"><span className="font-medium">{assignment.teacher?.name ?? 'Docente no disponible'}</span><span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{assignment.teacher?.email}</span><span className="text-xs text-muted-foreground">Desde {formatDegreeDate(assignment.assigned_at)}</span></div></li>)}</ul>}</div>
        </div>
      </SectionCard>
      <SectionCard icon={MessageSquareIcon} title="Observaciones" description="Mensajes disponibles para el estudiante." action={<Button type="button" variant="outline" disabled={operation.pending} onClick={() => openAction('observe')}><PlusCircleIcon data-icon="inline-start" />Agregar observación</Button>}>
        {topic.observations.length === 0 ? <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/50 px-6 py-8 text-center"><MessageSquareIcon aria-hidden="true" className="mb-1 size-7 text-muted-foreground" /><p className="text-sm font-medium">No hay observaciones registradas.</p><p className="text-xs text-muted-foreground">Las observaciones que registres serán visibles para el estudiante.</p></div> : <ol className="flex flex-col gap-5">{topic.observations.map((observation) => <li key={observation.id} className="flex flex-col gap-2 border-l-2 border-border pl-4"><p className="text-xs text-muted-foreground">{observation.coordinator?.name ?? 'Coordinación'} · {formatDegreeDate(observation.registered_at)}</p><p className="whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{observation.observation}</p></li>)}</ol>}
      </SectionCard>
    </>}
    <MutationDialog open={Boolean(action)} title={action ? ACTION_LABELS[action] : ''} description={topic?.title} pending={operation.pending} error={operation.error} dirty={JSON.stringify(draft) !== JSON.stringify(initialDraft)} onClose={() => setAction(null)} onSubmit={submit} submitLabel={action === 'peers' ? 'Guardar pares académicos' : action ? ACTION_LABELS[action] : 'Guardar'} submitDisabled={!canSubmit}>
      {action === 'approve' && <SelectField id="degree-tutor" label="Docente tutor" value={draft.tutorId} onChange={(value) => setDraft({ ...draft, tutorId: value, peerIds: draft.peerIds.filter((id) => id !== Number(value)) })}><option value="">Selecciona un tutor</option>{activeTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name} · {teacher.active_tutorships_count} tutorías asignadas</option>)}</SelectField>}
      {(action === 'approve' || action === 'peers') && <>
        {action === 'peers' && <p className="text-sm text-muted-foreground">Tutor actual: {tutor?.name ?? 'Sin tutor asignado'}.</p>}
        {action === 'peers' && hasUnavailablePeers && <Alert><AlertDescription>Los pares que ya no están activos deben reemplazarse. Selecciona los docentes que mantendrán la asignación.</AlertDescription></Alert>}
        <FieldSet><FieldLegend>Pares académicos</FieldLegend><FieldDescription>Selecciona al menos un docente diferente del tutor.</FieldDescription><FieldGroup className="max-h-64 gap-4 overflow-y-auto">{availablePeers.map((teacher) => <Field key={teacher.id} orientation="horizontal"><Checkbox id={`degree-peer-${teacher.id}`} checked={draft.peerIds.includes(teacher.id)} onCheckedChange={(checked) => setDraft({ ...draft, peerIds: checked === true ? [...draft.peerIds, teacher.id] : draft.peerIds.filter((id) => id !== teacher.id) })} /><FieldLabel htmlFor={`degree-peer-${teacher.id}`}><span className="flex flex-col gap-1"><span>{teacher.name}</span><span className="text-xs font-normal text-muted-foreground">{teacher.active_peer_reviews_count} revisiones asignadas</span></span></FieldLabel></Field>)}</FieldGroup></FieldSet>
      </>}
      {(action === 'reject' || action === 'observe') && <DegreeObservationField value={draft.observation} onChange={(value) => setDraft({ ...draft, observation: value })} rejection={action === 'reject'} />}
      {action === 'reject' && <Alert><AlertDescription>La propuesta quedará rechazada. Revisa el motivo antes de confirmar.</AlertDescription></Alert>}
    </MutationDialog>
  </section>
}
