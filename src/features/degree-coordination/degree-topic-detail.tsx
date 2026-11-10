import { useState, type FormEvent } from 'react'
import { ArrowLeftIcon, CheckIcon, MessageSquareIcon, SaveIcon, UsersIcon, XIcon, type LucideIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ErrorNotice } from '@/components/ui/error-notice'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { SearchInput } from '@/components/ui/search-input'
import { SearchSelect } from '@/components/ui/search-select'
import { Skeleton } from '@/components/ui/skeleton'
import { HeaderSkeleton, TabsSkeleton } from '@/features/tutoring/tutoring-skeletons'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { degreeCoordinationApi, type DegreeAssignment, type DegreeTeacher } from '@/lib/degree-coordination-api'
import { formatDegreeDate } from './degree-format'
import { useDegreeResource, useDegreeSearch } from './degree-hooks'
import { DegreeObservationField, DegreeStatusBadge, InitialsAvatar } from './degree-shared'

type ReviewAction = 'approve' | 'reject' | 'observe' | 'peers'
const ACTION_ICONS: Record<ReviewAction, LucideIcon> = { approve: CheckIcon, reject: XIcon, observe: MessageSquareIcon, peers: SaveIcon }
const ACTION_LABELS: Record<ReviewAction, string> = { approve: 'Aprobar propuesta', reject: 'Rechazar propuesta', observe: 'Registrar observación', peers: 'Gestionar pares académicos' }
type ReviewDraft = { tutorId: string; peerIds: readonly number[]; observation: string }
const EMPTY_DRAFT: ReviewDraft = { tutorId: '', peerIds: [], observation: '' }
type PickedTeacher = Pick<DegreeTeacher, 'id' | 'name'> & Partial<Pick<DegreeTeacher, 'careers' | 'active_tutorships_count' | 'active_peer_reviews_count'>>

function describeCareers(teacher: PickedTeacher): string {
  if (!teacher.careers) return ''
  return teacher.careers.length > 0
    ? teacher.careers.map((career) => career.faculty_name ? `${career.name} · ${career.faculty_name}` : career.name).join(', ')
    : 'Sin carrera registrada'
}

function describePeer(teacher: PickedTeacher): string {
  return [
    describeCareers(teacher),
    teacher.active_peer_reviews_count === undefined ? '' : `${teacher.active_peer_reviews_count} revisiones asignadas`,
  ].filter(Boolean).join(' · ')
}

/**
 * Pantalla de una propuesta: se abre al pulsar su fila. Arriba lo esencial y las acciones
 * de revisión; debajo, la información separada en pestañas (propuesta, docentes, observaciones).
 * `onChanged` avisa al listado que debe recargarse tras una acción confirmada.
 */
export function DegreeTopicDetail({ topicId, onBack, onChanged }: Readonly<{ topicId: number; onBack: () => void; onChanged?: () => void }>) {
  const resource = useDegreeResource(() => degreeCoordinationApi.topic(topicId), String(topicId))
  const teachers = useDegreeResource(() => degreeCoordinationApi.teachers())
  const operation = useOperation()
  const [action, setAction] = useState<ReviewAction | null>(null)
  const [draft, setDraft] = useState<ReviewDraft>(EMPTY_DRAFT)
  const [initialDraft, setInitialDraft] = useState<ReviewDraft>(EMPTY_DRAFT)
  // Búsqueda en tiempo real de docentes de todas las carreras y facultades.
  const tutorSearch = useDegreeSearch()
  const peerSearch = useDegreeSearch()
  const tutorResults = useDegreeResource(
    () => action === 'approve' ? degreeCoordinationApi.teachers(tutorSearch.search) : Promise.resolve([]),
    `tutor:${action}:${tutorSearch.search}`,
  )
  const peerResults = useDegreeResource(
    () => action === 'approve' || action === 'peers' ? degreeCoordinationApi.teachers(peerSearch.search) : Promise.resolve([]),
    `peers:${action}:${peerSearch.search}`,
  )
  const [picked, setPicked] = useState<Readonly<Record<number, PickedTeacher>>>({})
  const topic = resource.data
  const activeTeachers = (teachers.data ?? []).filter((teacher) => teacher.is_active)
  const assignments = topic?.assignments.filter((assignment) => assignment.is_active !== false) ?? []
  const tutor = assignments.find((assignment) => assignment.role === 'tutor')?.teacher
  const peers = assignments.filter((assignment) => assignment.role === 'par_academico')
  const selectedTutor = draft.tutorId ? picked[Number(draft.tutorId)] ?? null : null
  // Los pares elegidos se mantienen visibles aunque la búsqueda ya no los incluya.
  const selectedPeers = draft.peerIds.flatMap((id) => {
    const teacher = peerResults.data?.find((item) => item.id === id) ?? picked[id]
    return teacher ? [teacher] : []
  })
  const peerOptions: readonly PickedTeacher[] = [
    ...selectedPeers,
    ...(peerResults.data ?? []).filter((teacher) => teacher.is_active && !draft.peerIds.includes(teacher.id)),
  ].filter((teacher) => teacher.id !== Number(draft.tutorId))
  const selectedPeersValid = draft.peerIds.length > 0 && !draft.peerIds.includes(Number(draft.tutorId))
  const approvalPossible = !teachers.loading && !teachers.error && activeTeachers.length >= 2
  const peerChangePossible = !teachers.loading && !teachers.error && activeTeachers.some((teacher) => teacher.id !== tutor?.id)
  const hasUnavailablePeers = peers.some((assignment) => assignment.teacher && !activeTeachers.some((teacher) => teacher.id === assignment.teacher?.id))
  const observationLength = draft.observation.trim().length
  const observationError = action === 'observe' && draft.observation !== '' && observationLength < 3 ? 'La observación debe tener al menos 3 caracteres.' : null
  const blockReason = reviewBlockReason()
  const canSubmit = action !== null && blockReason === null
  const draftChanged = draft.tutorId !== initialDraft.tutorId || draft.observation !== initialDraft.observation
    || draft.peerIds.length !== initialDraft.peerIds.length || draft.peerIds.some((id) => !initialDraft.peerIds.includes(id))

  /** Primer motivo por el que la acción abierta todavía no puede confirmarse. */
  function reviewBlockReason(): string | null {
    switch (action) {
      case 'approve':
        if (!approvalPossible) return 'Se necesitan al menos dos docentes activos.'
        if (selectedTutor === null) return 'Selecciona el docente tutor.'
        if (draft.peerIds.length === 0) return 'Selecciona al menos un par académico.'
        return selectedPeersValid ? null : 'El par académico debe ser distinto del tutor.'
      case 'peers':
        if (!peerChangePossible) return 'No hay docentes activos disponibles distintos del tutor.'
        return selectedPeersValid ? null : 'Selecciona al menos un par académico distinto del tutor.'
      case 'observe':
        if (observationLength < 3) return 'La observación debe tener al menos 3 caracteres.'
        return draft.observation.length > 1000 ? 'La observación no puede superar 1000 caracteres.' : null
      case 'reject':
        return draft.observation.length > 1000 ? 'El motivo no puede superar 1000 caracteres.' : null
      default:
        return null
    }
  }

  function openAction(nextAction: ReviewAction) {
    const next = nextAction === 'peers' ? {
      tutorId: String(tutor?.id ?? ''),
      peerIds: peers.flatMap((assignment) => assignment.teacher && activeTeachers.some((teacher) => teacher.id === assignment.teacher?.id) ? [assignment.teacher.id] : []),
      observation: '',
    } : EMPTY_DRAFT
    setDraft(next)
    setInitialDraft(next)
    setPicked(Object.fromEntries(peers.flatMap((assignment) => assignment.teacher ? [[assignment.teacher.id, assignment.teacher]] : [])))
    tutorSearch.setInput('')
    peerSearch.setInput('')
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
    void operation.run(mutation, message, () => { setAction(null); resource.reload(); teachers.reload(); onChanged?.() })
  }

  const tutorField = (
    <FormField id="degree-tutor" label="Docente tutor" required tip="Incluye docentes de todas las carreras y facultades.">
      <SearchSelect
        id="degree-tutor"
        query={tutorSearch.input}
        onQueryChange={tutorSearch.setInput}
        loading={tutorResults.loading}
        placeholder="Busca por nombre, cédula, carrera o facultad"
        emptyMessage="No se encontraron docentes activos."
        options={(tutorResults.data ?? []).filter((teacher) => teacher.is_active).map((teacher) => ({
          value: String(teacher.id),
          label: teacher.name,
          description: [describeCareers(teacher), `${teacher.active_tutorships_count} tutorías asignadas`].filter(Boolean).join(' · '),
        }))}
        selected={selectedTutor ? { value: String(selectedTutor.id), label: selectedTutor.name } : null}
        onSelect={(option) => {
          const teacher = option ? tutorResults.data?.find((item) => String(item.id) === option.value) : undefined
          if (teacher) setPicked((current) => ({ ...current, [teacher.id]: teacher }))
          setDraft({ ...draft, tutorId: teacher ? String(teacher.id) : '', peerIds: draft.peerIds.filter((id) => id !== teacher?.id) })
        }}
      />
      <ErrorNotice message={tutorResults.error} retry={tutorResults.reload} />
    </FormField>
  )
  const peersFields = (
    <>
      {action === 'peers' && <p className="text-sm text-muted-foreground">Tutor actual: {tutor?.name ?? 'Sin tutor asignado'}.</p>}
      {action === 'peers' && hasUnavailablePeers && <p className="text-sm text-warning">Los pares que ya no están activos deben reemplazarse. Selecciona los docentes que mantendrán la asignación.</p>}
      <FormField id="degree-peer-search" label="Pares académicos" required tip="Selecciona al menos un docente diferente del tutor. Puedes buscar en todas las carreras y facultades.">
        <SearchInput id="degree-peer-search" placeholder="Buscar por nombre, cédula, carrera o facultad" value={peerSearch.input} onValueChange={peerSearch.setInput} loading={peerResults.loading} />
      </FormField>
      <ErrorNotice message={peerResults.error} retry={peerResults.reload} />
      <FieldGroup className="max-h-64 gap-4 overflow-y-auto">
        {peerOptions.length === 0 && !peerResults.loading && <p className="text-sm text-muted-foreground">No se encontraron docentes con esa búsqueda.</p>}
        {peerOptions.map((teacher) => <Field key={teacher.id} orientation="horizontal"><Checkbox id={`degree-peer-${teacher.id}`} checked={draft.peerIds.includes(teacher.id)} onCheckedChange={(checked) => {
          if (checked === true) setPicked((current) => ({ ...current, [teacher.id]: teacher }))
          setDraft({ ...draft, peerIds: checked === true ? [...draft.peerIds, teacher.id] : draft.peerIds.filter((id) => id !== teacher.id) })
        }} /><FieldLabel htmlFor={`degree-peer-${teacher.id}`}><span className="flex flex-col gap-1"><span>{teacher.name}</span>{describePeer(teacher) && <span className="text-xs font-normal text-muted-foreground">{describePeer(teacher)}</span>}</span></FieldLabel></Field>)}
      </FieldGroup>
    </>
  )
  // Al aprobar, el tutor y los pares se eligen en dos pasos; las demás acciones son de un solo campo.
  const tutorStepReason = !approvalPossible ? 'Se necesitan al menos dos docentes activos.' : selectedTutor === null ? 'Selecciona el docente tutor.' : null

  const context = topic ? [`Propuesta #${topic.id}`, topic.student?.name ?? 'Sin estudiante', topic.section ? `Paralelo ${topic.section.name}` : 'Sin paralelo', `Presentada el ${formatDegreeDate(topic.proposed_at)}`].join(' · ') : undefined

  return <section className="flex flex-col gap-6" data-tour-view="detail">
    <div><Button type="button" variant="tertiary" onClick={onBack} disabled={operation.pending}><ArrowLeftIcon data-icon="inline-start" />Volver a propuestas</Button></div>
    {resource.loading && <TopicDetailSkeleton />}
    <ErrorNotice message={resource.error} retry={resource.reload} />
    {topic && <>
      <AdminSectionHeader title={topic.title} description={context} actions={<div className="flex flex-wrap items-center gap-2">
        <DegreeStatusBadge status={topic.status} />
        {topic.status === 'pendiente' && <><Button type="button" tone="destructive" variant="secondary" disabled={operation.pending} onClick={() => openAction('reject')}><XIcon data-icon="inline-start" />Rechazar propuesta</Button><Button type="button" disabled={operation.pending || !approvalPossible} onClick={() => openAction('approve')}><CheckIcon data-icon="inline-start" />Aprobar propuesta</Button></>}
        {topic.status === 'aprobado' && <Button type="button" variant="secondary" disabled={operation.pending || !peerChangePossible} onClick={() => openAction('peers')}><UsersIcon data-icon="inline-start" />Gestionar pares académicos</Button>}
        <Button type="button" variant="secondary" disabled={operation.pending} onClick={() => openAction('observe')}><MessageSquareIcon data-icon="inline-start" />Registrar observación</Button>
      </div>} />
      {(topic.status === 'pendiente' || topic.status === 'aprobado') && <ErrorNotice message={teachers.error} retry={teachers.reload} />}
      {topic.status === 'pendiente' && !teachers.loading && !teachers.error && !approvalPossible && <Alert><AlertDescription>Se necesitan al menos dos docentes activos: uno como tutor y otro como par académico. Registra o activa docentes antes de aprobar la propuesta.</AlertDescription></Alert>}
      {topic.status === 'aprobado' && !teachers.loading && !teachers.error && !peerChangePossible && <Alert><AlertDescription>No hay docentes activos disponibles diferentes del tutor. Activa o registra otro docente para gestionar los pares académicos.</AlertDescription></Alert>}
      <Tabs defaultValue="proposal">
        <TabsList aria-label="Secciones de la propuesta">
          <TabsTrigger value="proposal">Propuesta</TabsTrigger>
          <TabsTrigger value="teachers">Docentes</TabsTrigger>
          <TabsTrigger value="observations">Observaciones ({topic.observations.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="proposal">
          <Card><CardContent className="flex flex-col gap-6 pt-6">
            <p className="whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{topic.description || 'El estudiante no registró una descripción.'}</p>
            <dl className="grid gap-4 border-t pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Detail label="Estudiante" value={topic.student?.name ?? 'Sin registrar'} />
              <Detail label="Cédula" value={topic.student?.identification ?? 'Sin registrar'} />
              <Detail label="Correo" value={topic.student?.email ?? 'Sin registrar'} />
              <Detail label="Teléfono" value={topic.student?.phone || 'Sin registrar'} />
              <Detail label="Período" value={topic.academic_period?.name ?? 'Sin período'} />
              <Detail label="Revisión" value={topic.reviewer ? `${topic.reviewer.name} · ${formatDegreeDate(topic.reviewed_at)}` : 'Aún sin revisar'} />
            </dl>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="teachers">
          <Card><CardContent className="grid gap-6 pt-6 sm:grid-cols-2 sm:gap-0 sm:divide-x">
            <div className="flex flex-col gap-3 sm:pr-6"><h2 className="text-sm text-muted-foreground">Tutor</h2>{tutor ? <TeacherLine name={tutor.name} email={tutor.email} /> : <p className="text-sm text-muted-foreground">Sin tutor asignado</p>}</div>
            <div className="flex flex-col gap-3 sm:pl-6"><h2 className="text-sm text-muted-foreground">Pares académicos</h2>{peers.length === 0 ? <p className="text-sm text-muted-foreground">Sin pares asignados.</p> : <ul className="flex flex-col gap-4">{peers.map((assignment) => <li key={assignment.id}><PeerLine assignment={assignment} /></li>)}</ul>}</div>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="observations">
          <Card><CardContent className="pt-6">
            {topic.observations.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay observaciones registradas.</p> : <ol className="flex flex-col gap-5">{topic.observations.map((observation) => <li key={observation.id} className="flex flex-col gap-2 border-l-2 border-border pl-4"><p className="text-xs text-muted-foreground">{observation.coordinator?.name ?? 'Coordinación'} · {formatDegreeDate(observation.registered_at)}</p><p className="whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{observation.observation}</p></li>)}</ol>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </>}
    <FormDialog open={Boolean(action)} title={action ? ACTION_LABELS[action] : ''} description={action === 'reject' ? 'La propuesta quedará rechazada y el estudiante podrá proponer otro tema.' : topic?.title} pending={operation.pending} error={operation.error} dirty={draftChanged} requireChanges={action === 'peers'} blockReason={blockReason} onClose={() => setAction(null)} onSubmit={submit} submitIcon={action ? ACTION_ICONS[action] : undefined} submitLabel={action === 'peers' ? 'Guardar pares académicos' : action ? ACTION_LABELS[action] : 'Guardar'} steps={action === 'approve' ? [
      { title: 'Tutor', blockReason: tutorStepReason, content: tutorField },
      { title: 'Revisión por pares', content: peersFields },
    ] : undefined}>
      {action === 'peers' && peersFields}
      {(action === 'reject' || action === 'observe') && <DegreeObservationField value={draft.observation} onChange={(value) => setDraft({ ...draft, observation: value })} rejection={action === 'reject'} error={observationError} />}
    </FormDialog>
  </section>
}

function Detail({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div className="flex min-w-0 flex-col gap-0.5"><dt className="text-muted-foreground">{label}</dt><dd className="[overflow-wrap:anywhere]">{value}</dd></div>
}

function TeacherLine({ name, email, extra }: Readonly<{ name: string; email?: string | null; extra?: string }>) {
  return <div className="flex items-center gap-3"><InitialsAvatar name={name} /><div className="flex min-w-0 flex-col"><span className="font-medium">{name}</span>{email && <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{email}</span>}{extra && <span className="text-xs text-muted-foreground">{extra}</span>}</div></div>
}

function PeerLine({ assignment }: Readonly<{ assignment: DegreeAssignment }>) {
  return <TeacherLine name={assignment.teacher?.name ?? 'Docente no disponible'} email={assignment.teacher?.email} extra={`Desde ${formatDegreeDate(assignment.assigned_at)}`} />
}

/** Encabezado con estado y acciones, pestañas y la tarjeta de la propuesta (descripción y datos). */
function TopicDetailSkeleton() {
  return <div role="status" aria-label="Cargando propuesta" className="flex flex-col gap-6">
    <HeaderSkeleton badge actions={2} />
    <TabsSkeleton tabs={3} />
    <Card><CardContent className="flex flex-col gap-6 pt-6" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/5" />
      </div>
      <div className="grid gap-4 border-t pt-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-36 max-w-full" />
        </div>)}
      </div>
    </CardContent></Card>
  </div>
}
