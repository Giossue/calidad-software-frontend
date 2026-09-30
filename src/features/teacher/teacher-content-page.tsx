import { useState, type FormEvent } from 'react'
import { ArrowLeftIcon, BookOpenIcon, ChevronRightIcon, PencilIcon, PlusIcon, PowerOffIcon } from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/textarea'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice, MutationDialog, RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { teacherApi, type Activity, type Methodology, type TeacherTutoring, type TutoringTopic } from '@/lib/teacher-api'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { TeacherEmpty } from './teacher-shared'

type Kind = 'topic' | 'activity' | 'methodology'
type ContentRecord = TutoringTopic | Activity | Methodology
type Editing = { kind: Kind; record: ContentRecord | null }
const LABELS = { topic: 'tema', activity: 'actividad', methodology: 'metodología' }
const EMPTY = { name: '', description: '', duration: '' }
const NAME_PLACEHOLDERS = { topic: 'Ej. Pruebas unitarias', activity: 'Ej. Diseñar casos de prueba', methodology: '' }
const DESCRIPTION_PLACEHOLDERS = { topic: 'Opcional. Breve resumen de lo que se verá en este tema', activity: '', methodology: 'Ej. Trabajo colaborativo en parejas con revisión del docente' }


export function ContentPanel({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('')
  const list = usePaginatedCatalog((page, search) => teacherApi.topics(tutoring.id, { page, search, status: status || undefined }), `${tutoring.id}:${status}`)
  const operation = useOperation()
  const [topicId, setTopicId] = useState<number | null>(null)
  const [activityId, setActivityId] = useState<number | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deactivating, setDeactivating] = useState<Editing | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [initial, setInitial] = useState(EMPTY)
  const topic = list.data.find((item) => item.id === topicId)
  const activity = topic?.activities.find((item) => item.id === activityId)
  const kind: Kind = activity ? 'methodology' : topic ? 'activity' : 'topic'
  const canManage = tutoring.can_manage && (!topic || topic.is_active) && (!activity || activity.is_active)

  function openForm(nextKind: Kind, record: ContentRecord | null = null) {
    const next = record ? { name: 'name' in record ? record.name : '', description: 'description' in record ? record.description ?? '' : '', duration: 'duration' in record ? record.duration : '' } : EMPTY
    setForm(next); setInitial(next); operation.clearError(); setEditing({ kind: nextKind, record })
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const command = () => {
      const id = editing.record?.id
      if (editing.kind === 'topic') return id ? teacherApi.updateTopic(tutoring.id, id, { name: form.name.trim(), description: form.description.trim() }) : teacherApi.createTopic(tutoring.id, { name: form.name.trim(), description: form.description.trim() })
      if (!topic) throw new Error('Selecciona un tema.')
      if (editing.kind === 'activity') return id ? teacherApi.updateActivity(tutoring.id, topic.id, id, { name: form.name.trim(), duration: form.duration.trim() }) : teacherApi.createActivity(tutoring.id, topic.id, { name: form.name.trim(), duration: form.duration.trim() })
      if (!activity) throw new Error('Selecciona una actividad.')
      return id ? teacherApi.updateMethodology(tutoring.id, topic.id, activity.id, id, { description: form.description.trim() }) : teacherApi.createMethodology(tutoring.id, topic.id, activity.id, { description: form.description.trim() })
    }
    void operation.run(command, 'Contenido guardado.', async () => { setEditing(null); await list.reload() })
  }
  function deactivate() {
    const record = deactivating?.record
    if (!record || !deactivating) return
    const command = () => {
      if (deactivating.kind === 'topic') return teacherApi.deactivateTopic(tutoring.id, record.id)
      if (!topic) throw new Error('Selecciona un tema.')
      if (deactivating.kind === 'activity') return teacherApi.deactivateActivity(tutoring.id, topic.id, record.id)
      if (!activity) throw new Error('Selecciona una actividad.')
      return teacherApi.deactivateMethodology(tutoring.id, topic.id, activity.id, record.id)
    }
    void operation.run(command, 'Contenido deshabilitado.', async () => { setDeactivating(null); await list.reload() })
  }
  function actions(record: ContentRecord, nextKind: Kind, label: string) {
    return <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon-sm" title="Editar" aria-label={`Editar ${label}`} disabled={!canManage || !record.is_active || operation.pending} onClick={() => openForm(nextKind, record)}><PencilIcon /></Button>
      <Button variant="ghost" size="icon-sm" title="Deshabilitar" aria-label={`Deshabilitar ${label}`} disabled={!canManage || !record.is_active || operation.pending} onClick={() => { operation.clearError(); setDeactivating({ kind: nextKind, record }) }}><PowerOffIcon /></Button>
    </div>
  }
  const title = activity ? `Metodologías de ${activity.name}` : topic ? `Actividades de ${topic.name}` : 'Temas de la tutoría'
  const dialogTitle = editing ? `${editing.record ? 'Editar' : 'Registrar'} ${LABELS[editing.kind]}` : ''

  return <div className="flex flex-col gap-5">
    {topic && <div className="flex flex-wrap items-center gap-2"><Button variant="ghost" size="sm" disabled={operation.pending} onClick={() => { setTopicId(null); setActivityId(null) }}><ArrowLeftIcon data-icon="inline-start" />Temas</Button>{activity && <Button variant="ghost" size="sm" disabled={operation.pending} onClick={() => setActivityId(null)}><ArrowLeftIcon data-icon="inline-start" />Actividades</Button>}<span className="text-sm text-muted-foreground">{topic.name}{activity ? ` / ${activity.name}` : ''}</span></div>}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex-1">{topic
        ? <h3 className="flex h-10 items-center font-display text-lg font-semibold">{title}</h3>
        : <FilterBar id="teacher-content" search={list.searchInput} onSearch={list.setSearchInput} searchPlaceholder="Busca por tema…" onClear={() => setStatus('')} filters={[
          { id: 'status', label: 'Estado', value: status, onChange: (value) => setStatus(value as '' | 'active' | 'inactive'), allLabel: 'Todos', options: [{ value: 'active', label: 'Activos' }, { value: 'inactive', label: 'Inactivos' }] },
        ]} />}</div>
      <Button className="h-10 shrink-0" disabled={!canManage || operation.pending} onClick={() => openForm(kind)}><PlusIcon data-icon="inline-start" />Registrar {LABELS[kind]}</Button>
    </div>
    <ErrorNotice message={list.error} retry={list.reload} />{!editing && <ErrorNotice message={operation.error} />}
    {activity ? <RecordTable rows={activity.methodologies} loading={list.isFetching} empty={<TeacherEmpty title="Esta actividad aún no tiene metodologías" />} columns={[
      { label: 'Metodología', render: (item) => <p className="whitespace-pre-wrap break-words">{item.description}</p> }, { label: 'Estado', render: (item) => <StatusBadge active={item.is_active} /> }, { label: 'Acciones', render: (item) => actions(item, 'methodology', item.description) },
    ]} /> : topic ? <RecordTable rows={topic.activities} loading={list.isFetching} empty={<TeacherEmpty title="Este tema aún no tiene actividades" />} columns={[
      { label: 'Actividad', render: (item) => <span className="font-medium">{item.name}</span> }, { label: 'Duración', render: (item) => item.duration }, { label: 'Estado', render: (item) => <StatusBadge active={item.is_active} /> },
      { label: 'Acciones', render: (item) => <div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" disabled={operation.pending} onClick={() => setActivityId(item.id)}>Metodologías<ChevronRightIcon data-icon="inline-end" /></Button>{actions(item, 'activity', item.name)}</div> },
    ]} /> : <>
      <RecordTable rows={list.data} loading={list.isFetching || list.isInitialLoading} empty={<TeacherEmpty title="Aún no hay temas en esta tutoría" description="Registra el primer tema para planificar sus actividades y metodologías." />} columns={[
        { label: 'Tema', render: (item) => <div className="flex flex-col gap-1"><span className="font-medium">{item.name}</span>{item.description && <span className="text-sm text-muted-foreground">{item.description}</span>}</div> },
        { label: 'Avance', render: (item) => <Badge variant={item.is_covered ? 'default' : 'secondary'}>{item.is_covered ? 'Visto' : 'Pendiente'}</Badge> }, { label: 'Estado', render: (item) => <StatusBadge active={item.is_active} /> },
        { label: 'Acciones', render: (item) => <div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" disabled={operation.pending} onClick={() => setTopicId(item.id)}><BookOpenIcon data-icon="inline-start" />Actividades</Button>{actions(item, 'topic', item.name)}</div> },
      ]} />
      <CatalogPagination label="temas" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
    </>}
    <MutationDialog open={Boolean(editing)} title={dialogTitle} description={activity?.name ?? topic?.name ?? tutoring.subject_name} pending={operation.pending} error={operation.error} dirty={JSON.stringify(form) !== JSON.stringify(initial)} onClose={() => setEditing(null)} onSubmit={submit} submitLabel={editing?.record ? 'Guardar cambios' : `Registrar ${editing ? LABELS[editing.kind] : ''}`}>
      {editing?.kind !== 'methodology' && <Field><FieldLabel htmlFor="teacher-content-name">Nombre</FieldLabel><Input id="teacher-content-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={150} required placeholder={editing ? NAME_PLACEHOLDERS[editing.kind] : undefined} /></Field>}
      {editing?.kind === 'activity' ? <Field><FieldLabel htmlFor="teacher-content-duration">Duración</FieldLabel><Input id="teacher-content-duration" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} placeholder="Ej. 30 minutos" maxLength={50} required /></Field> : <Field><FieldLabel htmlFor="teacher-content-description">Descripción</FieldLabel><Textarea id="teacher-content-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={255} required={editing?.kind === 'methodology'} placeholder={editing ? DESCRIPTION_PLACEHOLDERS[editing.kind] : undefined} /></Field>}
    </MutationDialog>
    <ConfirmModal open={Boolean(deactivating)} title={`¿Deshabilitar ${deactivating ? LABELS[deactivating.kind] : 'contenido'}?`} description="El contenido dejará de estar disponible para nuevas sesiones. Su historial se conservará." pending={operation.pending} confirmLabel="Deshabilitar contenido" onClose={() => { if (!operation.pending) setDeactivating(null) }} onConfirm={deactivate} />
  </div>
}
