import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2Icon, PaperclipIcon, PencilIcon, PlusIcon, PowerOffIcon, Trash2Icon, Undo2Icon, XIcon } from 'lucide-react'

import { TopicFileList } from '@/components/topic-file-list'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { IconAction } from '@/components/ui/icon-action'
import { Input } from '@/components/ui/input'
import { SelectInput } from '@/components/ui/select-field'
import { Textarea } from '@/components/ui/textarea'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice } from '@/components/ui/error-notice'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { Skeleton } from '@/components/ui/skeleton'
import { HeadedTableSkeleton } from '@/features/tutoring/tutoring-skeletons'
import { formatDate } from '@/lib/format'
import { TOPIC_FILE_ACCEPT, TOPIC_FILES_PER_TOPIC, topicFileError, type TopicFile } from '@/lib/topic-files'
import { teacherApi, type Activity, type Methodology, type TeacherTutoring, type TutoringSession, type TutoringTopic } from '@/lib/teacher-api'
import { serverFieldError } from './teacher-labels'
import { TeacherEmpty } from './teacher-shared'
import { ContentTabSkeleton } from './teacher-skeletons'

type Kind = 'topic' | 'activity' | 'methodology'
type ContentRecord = TutoringTopic | Activity | Methodology
type Editing = { kind: Kind; record: ContentRecord | null }
/** Recurso en el formulario: ya subido (`stored`) o por subir al guardar (`upload`). */
type FormFile = { key: string | number; name: string; size: number; stored?: TopicFile; upload?: File }
const LABELS = { topic: 'tema', activity: 'actividad', methodology: 'metodología' }
// Toasts propios de cada contenido (nada de un genérico «Contenido guardado»).
const SAVED = { topic: 'Tema guardado', activity: 'Actividad guardada', methodology: 'Metodología guardada' }
const SUBJECTS = { topic: 'El tema', activity: 'La actividad', methodology: 'La metodología' }
const DISABLED = { topic: 'Tema deshabilitado', activity: 'Actividad deshabilitada', methodology: 'Metodología deshabilitada' }
const shorten = (text: string, max = 60) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)
const EMPTY = { name: '', description: '', duration: '' }
const HOUR_OPTIONS = [0, 1, 2, 3, 4].map((hours) => ({ value: String(hours), label: hours === 1 ? '1 hora' : `${hours} horas` }))
const MINUTE_OPTIONS = [0, 10, 15, 20, 25, 30, 40, 45, 50].map((minutes) => ({ value: String(minutes), label: `${minutes} min` }))
const NAME_PLACEHOLDERS = { topic: 'Ej. Pruebas unitarias', activity: 'Ej. Diseñar casos de prueba', methodology: '' }
const DESCRIPTION_PLACEHOLDERS = { topic: '', activity: '', methodology: 'Ej. Trabajo colaborativo en parejas con revisión del docente' }

function parseDurationToTimer(duration: string): { hours: number; minutes: number } {
  if (!duration) return { hours: 0, minutes: 30 }
  const hMatch = duration.match(/(\d+)\s*h/i)
  const mMatch = duration.match(/(\d+)\s*m/i)
  let hours = hMatch ? parseInt(hMatch[1], 10) : 0
  let minutes = mMatch ? parseInt(mMatch[1], 10) : 0

  if (!hMatch && !mMatch) {
    const num = parseInt(duration, 10)
    if (!isNaN(num)) {
      if (num >= 60) {
        hours = Math.floor(num / 60)
        minutes = num % 60
      } else {
        minutes = num
      }
    }
  }
  return { hours, minutes }
}

function formatTimer(hours: number, minutes: number): string {
  if (hours === 0 && minutes === 0) return ''
  if (hours > 0 && minutes === 0) return `${hours} ${hours === 1 ? 'hora' : 'horas'}`
  if (hours === 0 && minutes > 0) return `${minutes} minutos`
  return `${hours} ${hours === 1 ? 'hora' : 'horas'} y ${minutes} minutos`
}

/**
 * El formulario del tema registra también sus actividades y las metodologías de cada una, para
 * no tener que entrar tema por tema y actividad por actividad. Lo que ya existía y se quita se
 * elimina al guardar; lo nuevo que se quita solo sale del formulario.
 */
type MethodologyDraft = { key: string; id?: number; description: string; removed?: boolean }
type ActivityDraft = { key: string; id?: number; name: string; hours: number; minutes: number; removed?: boolean; methodologies: MethodologyDraft[] }
let draftSeq = 0
const draftKey = () => `draft-${++draftSeq}`
const emptyMethodology = (): MethodologyDraft => ({ key: draftKey(), description: '' })
const emptyActivity = (): ActivityDraft => ({ key: draftKey(), name: '', hours: 0, minutes: 30, methodologies: [emptyMethodology()] })
function draftsOf(topic: TutoringTopic | null): ActivityDraft[] {
  if (!topic) return [emptyActivity()]
  return topic.activities.filter((item) => item.is_active).map((item) => {
    const { hours, minutes } = parseDurationToTimer(item.duration)
    return {
      key: `activity-${item.id}`,
      id: item.id,
      name: item.name,
      hours,
      minutes,
      methodologies: item.methodologies.filter((method) => method.is_active).map((method) => ({ key: `methodology-${method.id}`, id: method.id, description: method.description })),
    }
  })
}
/** Una fila nueva sin nombre ni metodologías escritas no cuenta: se ignora al guardar. */
const isBlankNew = (item: ActivityDraft) => !item.id && !item.name.trim() && item.methodologies.every((method) => !method.description.trim())
const durationOf = (item: ActivityDraft) => formatTimer(item.hours, item.minutes) || '30 minutos'

/** Fila de la lista de Contenido: una sesión, o los temas que aún no se trataron en ninguna. */
type SessionRow = { readonly id: string; readonly session: TutoringSession | null; readonly topics: readonly TutoringTopic[] }
const NO_SESSION = 'none'

export function ContentPanel({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  const topicsRes = useDegreeResource(() => teacherApi.allTopics(tutoring.id), `teacher-topics-${tutoring.id}`)
  const sessionsRes = useDegreeResource(() => teacherApi.allSessions(tutoring.id), `teacher-sessions-${tutoring.id}`)
  // Solo la primera carga espera en el esqueleto; las recargas mantienen los datos a la vista.
  const [loadedOnce, setLoadedOnce] = useState(false)
  if (!loadedOnce && topicsRes.settled && sessionsRes.settled) setLoadedOnce(true)
  const allTopics = topicsRes.data ?? topicsRes.previous ?? []
  // Los temas deshabilitados no se listan; se deshabilitan desde «Editar tema».
  const topics = allTopics.filter((item) => item.is_active)
  // Cada vez que se toma asistencia nace una sesión; se listan de la primera a la última.
  const sessions = [...(sessionsRes.data ?? sessionsRes.previous ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  const sessionLabel = (session: TutoringSession) => `Sesión ${session.number ?? sessions.indexOf(session) + 1}`
  const topicsOf = (session: TutoringSession) => topics.filter((item) => session.topics.some((covered) => covered.id === item.id))
  const withoutSession = topics.filter((item) => !sessions.some((session) => session.topics.some((covered) => covered.id === item.id)))
  const rows: SessionRow[] = [
    ...sessions.map((session) => ({ id: String(session.id), session, topics: topicsOf(session) })),
    { id: NO_SESSION, session: null, topics: withoutSession },
  ]
  const [assigningSession, setAssigningSession] = useState<TutoringSession | null>(null)
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([])

  const operation = useOperation()
  // Sesión, tema y actividad abiertos van en la URL: son pantallas dentro de la pestaña y
  // el botón "atrás" del navegador vuelve al nivel anterior.
  const [params, setParams] = useSearchParams()
  const sessionParam = params.get('content-session')
  const openRow = sessionParam === null ? null : rows.find((row) => row.id === sessionParam) ?? null
  const openSession = openRow?.session ?? null
  const topicId = Number(params.get('topic')) || null
  const activityId = Number(params.get('activity')) || null
  function openLevel(nextSession: string | null, nextTopic: number | null = null, nextActivity: number | null = null) {
    const next = new URLSearchParams(params)
    if (nextSession) next.set('content-session', nextSession); else next.delete('content-session')
    if (nextTopic) next.set('topic', String(nextTopic)); else next.delete('topic')
    if (nextTopic && nextActivity) next.set('activity', String(nextActivity)); else next.delete('activity')
    setParams(next)
  }
  const reloadAll = () => Promise.all([topicsRes.reload(), sessionsRes.reload()])
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deactivating, setDeactivating] = useState<Editing | null>(null)
  const [deletingTopic, setDeletingTopic] = useState<TutoringTopic | null>(null)
  // Eliminar algo registrado por error: una sesión (con su asistencia), una actividad o una metodología.
  const [deletingSession, setDeletingSession] = useState<TutoringSession | null>(null)
  const [deletingActivity, setDeletingActivity] = useState<Activity | null>(null)
  const [deletingMethodology, setDeletingMethodology] = useState<Methodology | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [initial, setInitial] = useState(EMPTY)
  const [timerHours, setTimerHours] = useState(0)
  const [timerMinutes, setTimerMinutes] = useState(30)
  // Recursos del tema en el formulario: los nuevos se suben y los quitados se borran al guardar.
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [removedFileIds, setRemovedFileIds] = useState<number[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  // Actividades y metodologías del tema en su formulario.
  const [activityDrafts, setActivityDrafts] = useState<ActivityDraft[]>([])
  const [initialDrafts, setInitialDrafts] = useState<ActivityDraft[]>([])
  const topic = allTopics.find((item) => item.id === topicId)
  const activity = topic?.activities.find((item) => item.id === activityId)
  const kind: Kind = activity ? 'methodology' : topic ? 'activity' : 'topic'
  const canManage = tutoring.can_manage && (!topic || topic.is_active) && (!activity || activity.is_active)

  function updateTimer(h: number, m: number) {
    setTimerHours(h)
    setTimerMinutes(m)
    setForm((prev) => ({ ...prev, duration: formatTimer(h, m) }))
  }

  function openAssignModal(session: TutoringSession) {
    setSelectedTopicIds(session.topics.map((t) => t.id))
    setAssigningSession(session)
  }

  function toggleTopicSelection(id: number) {
    setSelectedTopicIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  function saveAssignedTopics(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!assigningSession) return
    void operation.run(
      () => teacherApi.updateSessionTopics(tutoring.id, assigningSession.id, selectedTopicIds),
      'Temas de la sesión guardados.',
      async () => {
        setAssigningSession(null)
        await reloadAll()
      }
    )
  }

  function openForm(nextKind: Kind, record: ContentRecord | null = null) {
    const next = record ? { name: 'name' in record ? record.name : '', description: 'description' in record ? record.description ?? '' : '', duration: 'duration' in record ? record.duration : '' } : EMPTY
    if (nextKind === 'activity') {
      const parsed = parseDurationToTimer(next.duration || '30 minutos')
      setTimerHours(parsed.hours)
      setTimerMinutes(parsed.minutes)
      if (!next.duration) {
        next.duration = formatTimer(parsed.hours, parsed.minutes)
      }
    }
    setForm(next); setInitial(next); operation.clearError(); setEditing({ kind: nextKind, record })
    setPendingFiles([]); setRemovedFileIds([]); setFileError(null)
    if (nextKind === 'topic') {
      const drafts = draftsOf(record as TutoringTopic | null)
      setActivityDrafts(drafts)
      setInitialDrafts(drafts)
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const command = () => {
      const id = editing.record?.id
      if (editing.kind === 'topic') return saveTopic(id)
      if (!topic) throw new Error('Selecciona un tema.')
      if (editing.kind === 'activity') return id ? teacherApi.updateActivity(tutoring.id, topic.id, id, { name: form.name.trim(), duration: form.duration.trim() || '30 minutos' }) : teacherApi.createActivity(tutoring.id, topic.id, { name: form.name.trim(), duration: form.duration.trim() || '30 minutos' })
      if (!activity) throw new Error('Selecciona una actividad.')
      return id ? teacherApi.updateMethodology(tutoring.id, topic.id, activity.id, id, { description: form.description.trim() }) : teacherApi.createMethodology(tutoring.id, topic.id, activity.id, { description: form.description.trim() })
    }
    void operation.run(command, SAVED[editing.kind], async () => { setEditing(null); await reloadAll() })
  }
  // Al cerrar un formulario, su error del servidor se va con él (no queda en la pestaña).
  function closeEditor() {
    setEditing(null)
    operation.clearError()
  }
  async function saveTopic(id: number | undefined) {
    const saved = id ? await teacherApi.updateTopic(tutoring.id, id, { name: form.name.trim(), description: '' }) : await teacherApi.createTopic(tutoring.id, { name: form.name.trim(), description: '' })
    // Si falla un archivo, el tema ya existe: reintentar debe editarlo, no crearlo otra vez.
    if (!id) setEditing({ kind: 'topic', record: saved })
    for (const fileId of removedFileIds) {
      await teacherApi.deleteTopicFile(tutoring.id, saved.id, fileId)
    }
    setRemovedFileIds([])
    for (const file of pendingFiles) {
      await teacherApi.uploadTopicFile(tutoring.id, saved.id, file)
      setPendingFiles((current) => current.filter((item) => item !== file))
    }
    // Un tema nuevo registrado dentro de una sesión queda en esa sesión.
    if (!id && openSession && !topic) {
      await teacherApi.updateSessionTopics(tutoring.id, openSession.id, [...openSession.topics.map((item) => item.id), saved.id])
    }
    await saveActivities(saved.id)
    return saved
  }
  /**
   * Guarda en orden las actividades y metodologías del formulario. Cada paso que se completa queda
   * reflejado en el formulario (lo creado guarda su id; lo quitado sale), así que si algo falla a la
   * mitad, reintentar no crea nada dos veces.
   */
  async function saveActivities(topicId: number) {
    const before = new Map(initialDrafts.map((item) => [item.id, item]))
    const work = activityDrafts.map((item) => ({ ...item, methodologies: item.methodologies.map((method) => ({ ...method })) }))
    const sync = () => setActivityDrafts(work.map((item) => ({ ...item, methodologies: [...item.methodologies] })))
    for (let index = 0; index < work.length; index++) {
      const item = work[index]
      if (item.removed || isBlankNew(item)) {
        if (item.id) await teacherApi.deleteActivity(tutoring.id, topicId, item.id)
        work.splice(index--, 1); sync()
        continue
      }
      const old = item.id ? before.get(item.id) : undefined
      if (!item.id) {
        const created = await teacherApi.createActivity(tutoring.id, topicId, { name: item.name.trim(), duration: durationOf(item) })
        item.id = created.id; sync()
      } else if (old && (old.name !== item.name || durationOf(old) !== durationOf(item))) {
        await teacherApi.updateActivity(tutoring.id, topicId, item.id, { name: item.name.trim(), duration: durationOf(item) })
      }
      const oldMethods = new Map((old?.methodologies ?? []).map((method) => [method.id, method]))
      for (let m = 0; m < item.methodologies.length; m++) {
        const method = item.methodologies[m]
        if (method.removed || (!method.id && !method.description.trim())) {
          if (method.id) await teacherApi.deleteMethodology(tutoring.id, topicId, item.id, method.id)
          item.methodologies.splice(m--, 1); sync()
          continue
        }
        if (!method.id) {
          const created = await teacherApi.createMethodology(tutoring.id, topicId, item.id, { description: method.description.trim() })
          method.id = created.id; sync()
        } else if (oldMethods.get(method.id)?.description !== method.description) {
          await teacherApi.updateMethodology(tutoring.id, topicId, item.id, method.id, { description: method.description.trim() })
        }
      }
    }
    setInitialDrafts(work)
  }
  function updateActivity(key: string, change: Partial<ActivityDraft>) {
    setActivityDrafts((current) => current.map((item) => (item.key === key ? { ...item, ...change } : item)))
  }
  function updateMethodology(activityKey: string, methodKey: string, change: Partial<MethodologyDraft>) {
    setActivityDrafts((current) => current.map((item) => (item.key !== activityKey ? item : {
      ...item,
      methodologies: item.methodologies.map((method) => (method.key === methodKey ? { ...method, ...change } : method)),
    })))
  }
  // Quitar algo nuevo lo saca del formulario; quitar algo guardado lo marca para eliminarlo al guardar.
  function removeActivity(item: ActivityDraft) {
    if (item.id) updateActivity(item.key, { removed: true })
    else setActivityDrafts((current) => current.filter((other) => other.key !== item.key))
  }
  function removeMethodology(activity: ActivityDraft, method: MethodologyDraft) {
    if (method.id) updateMethodology(activity.key, method.key, { removed: true })
    else updateActivity(activity.key, { methodologies: activity.methodologies.filter((other) => other.key !== method.key) })
  }
  const storedFiles = editing?.kind === 'topic' && editing.record && 'files' in editing.record ? editing.record.files ?? [] : []
  const formFiles: FormFile[] = [
    ...storedFiles.filter((file) => !removedFileIds.includes(file.id)).map((file) => ({ key: file.id, name: file.name, size: file.size, stored: file })),
    ...pendingFiles.map((file, index) => ({ key: `new-${index}-${file.name}`, name: file.name, size: file.size, upload: file })),
  ]
  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const chosen = [...(event.target.files ?? [])]
    event.target.value = ''
    const errors: string[] = []
    const accepted: File[] = []
    for (const file of chosen) {
      const error = topicFileError(file)
      if (error) errors.push(error)
      else if (formFiles.length + accepted.length >= TOPIC_FILES_PER_TOPIC) errors.push(`Un tema puede tener como máximo ${TOPIC_FILES_PER_TOPIC} archivos.`)
      else accepted.push(file)
    }
    setPendingFiles((current) => [...current, ...accepted])
    setFileError(errors.length > 0 ? [...new Set(errors)].join(' ') : null)
  }
  function removeFormFile(file: FormFile) {
    setFileError(null)
    const stored = file.stored
    if (stored) setRemovedFileIds((current) => [...current, stored.id])
    else setPendingFiles((current) => current.filter((item) => item !== file.upload))
  }
  // Un tema registrado por error se elimina por completo, con sus actividades, metodologías y archivos.
  function deleteTopic() {
    if (!deletingTopic) return
    const removed = deletingTopic
    void operation.run(() => teacherApi.deleteTopic(tutoring.id, removed.id), 'Tema eliminado', async () => { setDeletingTopic(null); openLevel(sessionParam); await reloadAll() })
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
    // Un tema deshabilitado ya no se lista: se vuelve a la sesión de la que se abrió.
    const leaveTopic = deactivating.kind === 'topic'
    void operation.run(command, DISABLED[deactivating.kind], async () => { setDeactivating(null); setEditing(null); if (leaveTopic) openLevel(sessionParam); await reloadAll() })
  }
  function deleteSession() {
    if (!deletingSession) return
    const removed = deletingSession
    void operation.run(() => teacherApi.deleteSession(tutoring.id, removed.id), 'Sesión eliminada', async () => { setDeletingSession(null); await reloadAll() })
  }
  function deleteActivity() {
    if (!deletingActivity || !topic) return
    const removed = deletingActivity
    const topicId = topic.id
    void operation.run(() => teacherApi.deleteActivity(tutoring.id, topicId, removed.id), 'Actividad eliminada', async () => { setDeletingActivity(null); await reloadAll() })
  }
  function deleteMethodology() {
    if (!deletingMethodology || !topic || !activity) return
    const removed = deletingMethodology
    const [topicId, activityId] = [topic.id, activity.id]
    void operation.run(() => teacherApi.deleteMethodology(tutoring.id, topicId, activityId, removed.id), 'Metodología eliminada', async () => { setDeletingMethodology(null); await reloadAll() })
  }
  // «Editar» una sesión abre su asistencia (presentes y ausentes) en la pestaña Asistencia.
  function editSession(session: TutoringSession) {
    const next = new URLSearchParams(params)
    for (const key of ['content-session', 'topic', 'activity']) next.delete(key)
    next.set('tab', 'attendance')
    next.set('session', session.date)
    setParams(next)
  }

  // Los botones de la fila no deben abrir además el modal de edición (clic de fila).
  function stopRow(content: ReactNode) {
    return <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>{content}</div>
  }
  /** Editar y Eliminar de una fila: botones con su nombre accesible, sin abrir la fila. */
  function rowActions(name: string, onEdit: () => void, onDelete: () => void) {
    if (!canManage) return <span className="text-muted-foreground">—</span>
    return stopRow(<>
      <Button type="button" variant="tertiary" size="icon" aria-label={`Editar ${name}`} disabled={operation.pending} onClick={onEdit}><PencilIcon /></Button>
      <Button type="button" variant="tertiary" tone="destructive" size="icon" aria-label={`Eliminar ${name}`} disabled={operation.pending} onClick={() => { operation.clearError(); onDelete() }}><Trash2Icon /></Button>
    </>)
  }
  function editRecord(record: ContentRecord, nextKind: Kind) {
    if (!canManage || !record.is_active || operation.pending) return
    openForm(nextKind, record)
  }
  const methodologyTitle = (record: Methodology) => canManage && record.is_active ? `Editar la metodología «${shorten(record.description)}»` : ''
  const openTitle = (record: TutoringTopic | Activity) => `Abrir ${record.name}`
  const rowName = (row: SessionRow) => (row.session ? sessionLabel(row.session) : 'Temas sin sesión')
  const openRowTitle = (row: SessionRow) => (row.session ? `Abrir la ${sessionLabel(row.session)}` : 'Abrir los temas sin sesión')
  const title = activity
    ? `Metodologías de ${activity.name}`
    : topic
      ? `Actividades de ${topic.name}`
      : openSession ? `${sessionLabel(openSession)} · ${formatDate(openSession.date)}` : 'Temas sin sesión'
  const visibleDrafts = activityDrafts.filter((item) => !item.removed)
  const activityProblem = (() => {
    for (const [index, item] of visibleDrafts.entries()) {
      if (isBlankNew(item)) continue
      if (!item.name.trim()) return `Escribe el nombre de la actividad ${index + 1}.`
      if (item.methodologies.some((method) => method.id && !method.removed && !method.description.trim())) return `Escribe la metodología de la actividad ${index + 1} o quítala.`
    }
    return null
  })()
  const contentBlockReason = editing?.kind === 'methodology'
    ? (form.description.trim() ? null : 'Escribe la descripción de la metodología.')
    : (form.name.trim() ? (editing?.kind === 'topic' ? activityProblem : null) : `Escribe el nombre del ${LABELS[editing?.kind ?? 'topic']}.`)
  const assignedIds = assigningSession?.topics.map((t) => t.id) ?? []
  const assignDirty = selectedTopicIds.length !== assignedIds.length || selectedTopicIds.some((id) => !assignedIds.includes(id))
  const dialogTitle = editing ? `${editing.record ? 'Editar' : 'Registrar'} ${LABELS[editing.kind]}` : ''

  const registerButton = (
    <Button className="shrink-0" disabled={!canManage || operation.pending} onClick={() => openForm(kind)}>
      <PlusIcon data-icon="inline-start" />
      Registrar {LABELS[kind]}
    </Button>
  )
  // La pantalla del tema (o de la actividad) lleva arriba la acción de editarlo.
  const parentKind: Kind = activity ? 'activity' : 'topic'
  const parentRecord = activity ?? topic
  const editParentButton = parentRecord && (
    <Button variant="tertiary" size="icon" className="shrink-0" aria-label={`Editar ${LABELS[parentKind]}`} disabled={!canManage || operation.pending} onClick={() => openForm(parentKind, parentRecord)}>
      <PencilIcon />
    </Button>
  )
  const showingList = !topic && !openRow

  // Al abrir un tema (o una actividad) desde la URL, mientras llega la lista se muestra su forma, no la de la lista.
  if (topicId !== null && !topic && !loadedOnce) return <ContentLevelSkeleton activity={activityId !== null} />
  // Primera carga de la lista de sesiones: un solo esqueleto.
  if (!loadedOnce) return <ContentTabSkeleton />

  return <div className="flex flex-col gap-5">
    {!showingList && (
      // Ruta de la pantalla: cada nivel anterior es un enlace y el último es la pantalla actual.
      <nav aria-label="Ruta" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Button type="button" variant="tertiary" size="sm" className="-ml-1.5 h-auto px-1.5 py-0.5" disabled={operation.pending} onClick={() => openLevel(null)}>Sesiones</Button>
        <span aria-hidden="true">/</span>
        {topic && openRow ? (
          <>
            <Button type="button" variant="tertiary" size="sm" className="h-auto px-1.5 py-0.5" disabled={operation.pending} onClick={() => openLevel(openRow.id)}>{rowName(openRow)}</Button>
            <span aria-hidden="true">/</span>
            {activity ? (
              <>
                <Button type="button" variant="tertiary" size="sm" className="h-auto px-1.5 py-0.5" disabled={operation.pending} onClick={() => openLevel(sessionParam, topic.id)}>{topic.name}</Button>
                <span aria-hidden="true">/</span>
                <span className="px-1.5 text-foreground" aria-current="page">{activity.name}</span>
              </>
            ) : <span className="px-1.5 text-foreground" aria-current="page">{topic.name}</span>}
          </>
        ) : <span className="px-1.5 text-foreground" aria-current="page">{openRow ? rowName(openRow) : ''}</span>}
      </nav>
    )}

    {!showingList && (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
        <div className="flex shrink-0 flex-wrap gap-2">
          {editParentButton}
          {topic && !activity && canManage && (
            <Button variant="secondary" tone="destructive" disabled={operation.pending} onClick={() => { operation.clearError(); setDeletingTopic(topic) }}>
              <Trash2Icon data-icon="inline-start" />
              Eliminar tema
            </Button>
          )}
          {!topic && openSession && canManage && (
            <Button variant="secondary" disabled={operation.pending} onClick={() => openAssignModal(openSession)}>
              <CheckCircle2Icon data-icon="inline-start" />
              Asignar temas
            </Button>
          )}
          {registerButton}
        </div>
      </div>
    )}

    {showingList && sessions.length === 0 && (
      <p className="text-sm text-muted-foreground">
        Las sesiones se habilitan al tomar asistencia. Luego podrás ver aquí el contenido de cada una.
      </p>
    )}

    <ErrorNotice message={topicsRes.error ?? sessionsRes.error} retry={() => void reloadAll()} />

    {activity ? (
      <RecordTable
        rows={activity.methodologies.filter((item) => item.is_active)}
        loading={topicsRes.loading}
        empty={<TeacherEmpty title="Esta actividad aún no tiene metodologías" />}
        onRowClick={(item) => editRecord(item, 'methodology')}
        rowTitle={methodologyTitle}
        columns={[
          { label: 'Metodología', render: (item) => <p className="whitespace-pre-wrap break-words">{item.description}</p> },
          { label: 'Acciones', render: (item) => rowActions(`la metodología «${shorten(item.description, 40)}»`, () => editRecord(item, 'methodology'), () => setDeletingMethodology(item)) },
        ]}
      />
    ) : topic ? (
      <RecordTable
        rows={topic.activities.filter((item) => item.is_active)}
        loading={topicsRes.loading}
        onRowClick={(item) => { if (!operation.pending) openLevel(sessionParam, topic.id, item.id) }}
        rowTitle={openTitle}
        empty={<TeacherEmpty title="Este tema aún no tiene actividades" />}
        columns={[
          { label: 'Actividad', render: (item) => item.name },
          { label: 'Duración', render: (item) => item.duration },
          { label: 'Metodologías', render: (item) => { const count = item.methodologies.filter((method) => method.is_active).length; return <span className="text-muted-foreground">{count === 1 ? '1 metodología' : `${count} metodologías`}</span> } },
          { label: 'Acciones', render: (item) => rowActions(`la actividad ${item.name}`, () => editRecord(item, 'activity'), () => setDeletingActivity(item)) },
        ]}
      />
    ) : openRow ? (
      <RecordTable
        rows={openRow.topics}
        loading={topicsRes.loading || sessionsRes.loading}
        onRowClick={(item) => { if (!operation.pending) openLevel(openRow.id, item.id) }}
        rowTitle={openTitle}
        empty={
          openSession ? (
            <TeacherEmpty
              title={`La ${sessionLabel(openSession)} aún no tiene temas`}
              description={canManage ? 'Registra un tema o pulsa «Asignar temas» para elegir los que trataste.' : undefined}
            />
          ) : (
            <TeacherEmpty title="No hay temas sin sesión" description={canManage ? 'Registra aquí los temas que planificas tratar.' : undefined} />
          )
        }
        columns={[
          { label: 'Tema', render: (item) => item.name },
          {
            label: 'Recursos',
            render: (item) => (item.files?.length ?? 0) > 0
              ? <span className="text-sm text-muted-foreground">{item.files?.length === 1 ? '1 archivo' : `${item.files?.length} archivos`}</span>
              : <span className="text-sm text-muted-foreground">—</span>,
          },
          { label: 'Acciones', render: (item) => rowActions(`el tema ${item.name}`, () => editRecord(item, 'topic'), () => setDeletingTopic(item)) },
        ]}
      />
    ) : (
      <RecordTable
        rows={rows}
        loading={topicsRes.loading || sessionsRes.loading}
        onRowClick={(row) => { if (!operation.pending) openLevel(row.id) }}
        rowTitle={openRowTitle}
        empty={null}
        columns={[
          { label: 'Sesión', render: (row) => row.session ? sessionLabel(row.session) : <span className="text-muted-foreground">Temas sin sesión</span> },
          { label: 'Fecha', render: (row) => row.session ? formatDate(row.session.date) : <span className="text-muted-foreground">—</span> },
          { label: 'Temas', render: (row) => row.topics.length === 0 ? <span className="text-muted-foreground">Sin temas</span> : row.topics.length },
          { label: 'Acciones', render: (row) => (row.session ? rowActions(`la ${sessionLabel(row.session)}`, () => editSession(row.session as TutoringSession), () => setDeletingSession(row.session)) : null) },
        ]}
      />
    )}
    <FormDialog
      open={Boolean(editing)}
      title={dialogTitle}
      description={activity?.name ?? topic?.name ?? tutoring.subject_name}
      pending={operation.pending}
      error={operation.error}
      errorModal={operation.errorModal}
      dirty={JSON.stringify(form) !== JSON.stringify(initial) || pendingFiles.length > 0 || removedFileIds.length > 0 || (editing?.kind === 'topic' && JSON.stringify(activityDrafts) !== JSON.stringify(initialDrafts))}
      maxWidth={editing?.kind === 'topic' ? 'max-w-3xl' : undefined}
      blockReason={contentBlockReason}
      onClose={closeEditor}
      onSubmit={submit}
      submitLabel={editing?.record ? 'Guardar cambios' : `Registrar ${editing ? LABELS[editing.kind] : ''}`}
      headerActions={editing?.record ? <IconAction label={`Deshabilitar ${LABELS[editing.kind]}`} icon={PowerOffIcon} tone="destructive" disabled={operation.pending} onClick={() => { operation.clearError(); setDeactivating(editing) }} /> : undefined}
    >
      {editing?.kind !== 'methodology' && (
        <FormField id="teacher-content-name" label="Nombre" required counter={{ current: form.name.length, max: 150 }} error={serverFieldError(operation, 'name')}>
          <Input
            id="teacher-content-name"
            aria-invalid={Boolean(serverFieldError(operation, 'name'))}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            maxLength={150}
            required
            placeholder={editing ? NAME_PLACEHOLDERS[editing.kind] : undefined}
          />
        </FormField>
      )}
      {editing?.kind === 'topic' && (
        <FormField id="teacher-topic-files" label="Recursos" optional error={fileError}>
          <div className="flex flex-col gap-2">
            <TopicFileList
              files={formFiles}
              onDownload={(file) => (file.stored && editing.record ? teacherApi.downloadTopicFile(tutoring.id, editing.record.id, file.stored) : Promise.resolve())}
              onRemove={removeFormFile}
              removeDisabled={operation.pending}
              pendingLabel={(file) => (file.upload ? 'Se subirá al guardar' : null)}
            />
            <input ref={fileInput} id="teacher-topic-files" type="file" multiple accept={TOPIC_FILE_ACCEPT} className="sr-only" tabIndex={-1} onChange={addFiles} />
            <Button type="button" variant="secondary" className="w-fit" disabled={operation.pending || formFiles.length >= TOPIC_FILES_PER_TOPIC} onClick={() => fileInput.current?.click()}>
              <PaperclipIcon data-icon="inline-start" />
              Adjuntar archivos
            </Button>
            <p className="text-xs text-muted-foreground">PDF, Word, PowerPoint, Excel o texto. Hasta 20 MB por archivo y {TOPIC_FILES_PER_TOPIC} por tema.</p>
          </div>
        </FormField>
      )}
      {editing?.kind === 'topic' && (
        <fieldset className="flex flex-col gap-3 border-t border-border pt-4">
          <legend className="sr-only">Actividades</legend>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">Actividades</span>
            <span className="text-xs text-muted-foreground">Opcional. Cada actividad puede tener una o más metodologías.</span>
          </div>
          {activityDrafts.map((item) => {
            const number = visibleDrafts.indexOf(item) + 1
            if (item.removed) {
              return <div key={item.key} className="flex flex-wrap items-center justify-between gap-2 border-l-2 border-destructive bg-muted px-3 py-2 text-sm">
                <span><span className="line-through">{item.name || 'Actividad'}</span> <span className="text-muted-foreground">· se eliminará al guardar</span></span>
                <Button type="button" variant="tertiary" size="sm" disabled={operation.pending} onClick={() => updateActivity(item.key, { removed: false })}><Undo2Icon data-icon="inline-start" />Deshacer</Button>
              </div>
            }
            return <section key={item.key} aria-label={`Actividad ${number}`} className="flex flex-col gap-3 border border-border bg-card p-3">
              <div className="flex items-start gap-2">
                <span className="mt-2 w-5 shrink-0 text-sm tabular-nums text-muted-foreground">{number}</span>
                <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
                  <FormField id={`activity-name-${item.key}`} label="Actividad">
                    <Input
                      id={`activity-name-${item.key}`}
                      value={item.name}
                      maxLength={150}
                      placeholder={NAME_PLACEHOLDERS.activity}
                      disabled={operation.pending}
                      onChange={(event) => updateActivity(item.key, { name: event.target.value })}
                    />
                  </FormField>
                  <FormField id={`activity-hours-${item.key}`} label="Horas">
                    <SelectInput id={`activity-hours-${item.key}`} ariaLabel={`Horas de la actividad ${number}`} value={String(item.hours)} onValueChange={(value) => updateActivity(item.key, { hours: Number(value) })} options={HOUR_OPTIONS} disabled={operation.pending} className="w-28" />
                  </FormField>
                  <FormField id={`activity-minutes-${item.key}`} label="Minutos">
                    <SelectInput id={`activity-minutes-${item.key}`} ariaLabel={`Minutos de la actividad ${number}`} value={String(item.minutes)} onValueChange={(value) => updateActivity(item.key, { minutes: Number(value) })} options={MINUTE_OPTIONS} disabled={operation.pending} className="w-28" />
                  </FormField>
                </div>
                <Button type="button" variant="tertiary" tone="destructive" size="icon" className="mt-6 shrink-0" aria-label={`Quitar la actividad ${number}`} disabled={operation.pending} onClick={() => removeActivity(item)}>
                  <Trash2Icon />
                </Button>
              </div>
              <div className="flex flex-col gap-2 pl-7">
                <span className="text-xs text-muted-foreground">Metodologías</span>
                {item.methodologies.map((method, methodIndex) => method.removed ? (
                  <div key={method.key} className="flex flex-wrap items-center justify-between gap-2 border-l-2 border-destructive bg-muted px-3 py-1.5 text-sm">
                    <span><span className="line-through">{shorten(method.description)}</span> <span className="text-muted-foreground">· se eliminará al guardar</span></span>
                    <Button type="button" variant="tertiary" size="sm" disabled={operation.pending} onClick={() => updateMethodology(item.key, method.key, { removed: false })}><Undo2Icon data-icon="inline-start" />Deshacer</Button>
                  </div>
                ) : (
                  <div key={method.key} className="flex items-start gap-2">
                    <Textarea
                      aria-label={`Metodología ${methodIndex + 1} de la actividad ${number}`}
                      className="min-h-10 flex-1"
                      rows={1}
                      value={method.description}
                      maxLength={255}
                      placeholder={DESCRIPTION_PLACEHOLDERS.methodology}
                      disabled={operation.pending}
                      onChange={(event) => updateMethodology(item.key, method.key, { description: event.target.value })}
                    />
                    <Button type="button" variant="tertiary" size="icon" className="shrink-0" aria-label={`Quitar la metodología ${methodIndex + 1} de la actividad ${number}`} disabled={operation.pending} onClick={() => removeMethodology(item, method)}>
                      <XIcon />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="tertiary" size="sm" className="w-fit" disabled={operation.pending} onClick={() => updateActivity(item.key, { methodologies: [...item.methodologies, emptyMethodology()] })}>
                  <PlusIcon data-icon="inline-start" />
                  Agregar metodología
                </Button>
              </div>
            </section>
          })}
          <Button type="button" variant="secondary" className="w-fit" disabled={operation.pending} onClick={() => setActivityDrafts((current) => [...current, emptyActivity()])}>
            <PlusIcon data-icon="inline-start" />
            Agregar actividad
          </Button>
        </fieldset>
      )}
      {editing?.kind === 'activity' && (
        <FormField id="activity-timer-hours" label="Duración de la actividad" error={serverFieldError(operation, 'duration')}>
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Horas</span>
                <SelectInput
                  id="activity-timer-hours"
                  ariaLabel="Horas"
                  value={String(timerHours)}
                  onValueChange={(value) => updateTimer(Number(value), timerMinutes)}
                  options={HOUR_OPTIONS}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Minutos</span>
                <SelectInput
                  id="activity-timer-minutes"
                  ariaLabel="Minutos"
                  value={String(timerMinutes)}
                  onValueChange={(value) => updateTimer(timerHours, Number(value))}
                  options={MINUTE_OPTIONS}
                />
              </div>
            </div>
          </div>
        </FormField>
      )}
      {editing?.kind === 'methodology' && (
        <FormField id="teacher-content-description" label="Descripción" required counter={{ current: form.description.length, max: 255 }} error={serverFieldError(operation, 'description')}>
          <Textarea
            id="teacher-content-description"
            aria-invalid={Boolean(serverFieldError(operation, 'description'))}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            maxLength={255}
            required
            placeholder={DESCRIPTION_PLACEHOLDERS.methodology}
          />
        </FormField>
      )}
    </FormDialog>
    <FormDialog
      open={Boolean(assigningSession)}
      title={assigningSession ? `Asignar temas a la ${sessionLabel(assigningSession)} · ${formatDate(assigningSession.date)}` : 'Asignar temas'}
      description="Marca los temas que trataste en esta sesión. Se marcarán como completados."
      pending={operation.pending}
      error={operation.error}
      errorModal={operation.errorModal}
      dirty={assignDirty}
      onClose={() => { setAssigningSession(null); operation.clearError() }}
      onSubmit={saveAssignedTopics}
      submitLabel="Guardar temas de la sesión"
    >
      <div className="flex max-h-80 flex-col gap-3 overflow-y-auto pr-1">
        {topics.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay temas registrados en esta tutoría.</p>
        ) : (
          topics
            .map((t) => (
              <label key={t.id} className="flex cursor-pointer items-start gap-3 text-sm">
                <Checkbox
                  checked={selectedTopicIds.includes(t.id)}
                  onCheckedChange={() => toggleTopicSelection(t.id)}
                  className="mt-0.5"
                />
                <span className="flex flex-col gap-0.5">
                  <span>{t.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.activities.length} {t.activities.length === 1 ? 'actividad planificada' : 'actividades planificadas'}
                  </span>
                </span>
              </label>
            ))
        )}
      </div>
    </FormDialog>
    <ConfirmModal open={Boolean(deletingSession)} title={deletingSession ? `¿Eliminar la ${sessionLabel(deletingSession)}?` : '¿Eliminar la sesión?'} description={deletingSession ? `Se borrará la sesión del ${formatDate(deletingSession.date)} con su asistencia${deletingSession.attendance.length > 0 ? ` (${deletingSession.attendance.length} ${deletingSession.attendance.length === 1 ? 'registro' : 'registros'})` : ''}. Sus temas se conservan y quedan sin sesión. No se puede deshacer.` : ''} pending={operation.pending} confirmLabel="Eliminar sesión" onClose={() => { if (!operation.pending) setDeletingSession(null) }} onConfirm={deleteSession} />
    <ConfirmModal open={Boolean(deletingActivity)} title="¿Eliminar la actividad?" description={deletingActivity ? `Se eliminará «${deletingActivity.name}»${deletingActivity.methodologies.some((method) => method.is_active) ? ' con sus metodologías' : ''}. No se puede deshacer.` : ''} pending={operation.pending} confirmLabel="Eliminar actividad" onClose={() => { if (!operation.pending) setDeletingActivity(null) }} onConfirm={deleteActivity} />
    <ConfirmModal open={Boolean(deletingMethodology)} title="¿Eliminar la metodología?" description={deletingMethodology ? `Se eliminará «${shorten(deletingMethodology.description)}». No se puede deshacer.` : ''} pending={operation.pending} confirmLabel="Eliminar metodología" onClose={() => { if (!operation.pending) setDeletingMethodology(null) }} onConfirm={deleteMethodology} />
    <ConfirmModal open={Boolean(deletingTopic)} title="¿Eliminar el tema?" description={`Se eliminará «${deletingTopic?.name ?? ''}» con sus actividades, metodologías y archivos, y se quitará de las sesiones. No se puede deshacer.`} pending={operation.pending} confirmLabel="Eliminar tema" onClose={() => { if (!operation.pending) setDeletingTopic(null) }} onConfirm={deleteTopic} />
    <ConfirmModal open={Boolean(deactivating)} title={`¿Deshabilitar ${deactivating ? LABELS[deactivating.kind] : 'contenido'}?`} description={`${deactivating ? SUBJECTS[deactivating.kind] : 'El contenido'} dejará de estar disponible para nuevas sesiones. Su historial se conservará.`} pending={operation.pending} confirmLabel={`Deshabilitar ${deactivating ? LABELS[deactivating.kind] : 'contenido'}`} onClose={() => { if (!operation.pending) setDeactivating(null) }} onConfirm={deactivate} />
  </div>
}

/** Pantalla de un tema o una actividad: volver, el título con sus acciones y la tabla del nivel. */
function ContentLevelSkeleton({ activity }: Readonly<{ activity: boolean }>) {
  return <div role="status" aria-label={activity ? 'Cargando actividad' : 'Cargando tema'} className="flex flex-col gap-5">
    <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
      <Skeleton className="h-8 w-24" />
      {activity && <Skeleton className="h-8 w-40" />}
    </div>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-hidden="true">
      <Skeleton className="h-7 w-80 max-w-full" />
      <div className="flex gap-2"><Skeleton className="size-9" /><Skeleton className="h-9 w-44" /></div>
    </div>
    <HeadedTableSkeleton headers={activity ? ['Metodología', 'Acciones'] : ['Actividad', 'Duración', 'Metodologías', 'Acciones']} />
  </div>
}
