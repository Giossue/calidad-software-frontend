import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { ArrowLeftIcon, BookOpenIcon, CalendarDaysIcon, CheckCircle2Icon, CheckIcon, ClockIcon, ListChecksIcon, PaperclipIcon, PlusIcon, PowerOffIcon } from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { TopicFileList } from '@/components/topic-file-list'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { IconAction } from '@/components/ui/icon-action'
import { Input } from '@/components/ui/input'
import { SelectInput } from '@/components/ui/select-field'
import { StatusBadge } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/textarea'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice } from '@/components/ui/error-notice'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { formatDate } from '@/lib/format'
import { TOPIC_FILE_ACCEPT, TOPIC_FILES_PER_TOPIC, topicFileError, type TopicFile } from '@/lib/topic-files'
import { teacherApi, type Activity, type Methodology, type TeacherTutoring, type TutoringSession, type TutoringTopic } from '@/lib/teacher-api'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { cn } from '@/lib/utils'
import { TeacherEmpty } from './teacher-shared'

type Kind = 'topic' | 'activity' | 'methodology'
type ContentRecord = TutoringTopic | Activity | Methodology
type Editing = { kind: Kind; record: ContentRecord | null }
/** Recurso en el formulario: ya subido (`stored`) o por subir al guardar (`upload`). */
type FormFile = { key: string | number; name: string; size: number; stored?: TopicFile; upload?: File }
const LABELS = { topic: 'tema', activity: 'actividad', methodology: 'metodología' }
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

export function ContentPanel({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('')
  const list = usePaginatedCatalog((page, search) => teacherApi.topics(tutoring.id, { page, search, status: status || undefined }), `${tutoring.id}:${status}`)
  const sessionsRes = useDegreeResource(() => teacherApi.allSessions(tutoring.id), `teacher-sessions-${tutoring.id}`)
  // Cada vez que se toma asistencia nace una sesión; se listan de la primera a la última.
  const sessions = [...(sessionsRes.data ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  const sessionLabel = (session: TutoringSession) => `Sesión ${session.number ?? sessions.indexOf(session) + 1}`
  /** Sesiones en que se trató cada tema. */
  const topicSessions = (topicItem: TutoringTopic) => sessions.filter((session) => session.topics.some((item) => item.id === topicItem.id))
  const [selectedSessionDate, setSelectedSessionDate] = useState<string>('all')
  const [assigningSession, setAssigningSession] = useState<TutoringSession | null>(null)
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([])

  const activeSession = selectedSessionDate !== 'all' ? sessions.find((s) => s.date === selectedSessionDate) : null

  const operation = useOperation()
  const [topicId, setTopicId] = useState<number | null>(null)
  const [activityId, setActivityId] = useState<number | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deactivating, setDeactivating] = useState<Editing | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [initial, setInitial] = useState(EMPTY)
  const [timerHours, setTimerHours] = useState(0)
  const [timerMinutes, setTimerMinutes] = useState(30)
  // Recursos del tema en el formulario: los nuevos se suben y los quitados se borran al guardar.
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [removedFileIds, setRemovedFileIds] = useState<number[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const topic = list.data.find((item) => item.id === topicId)
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
        await Promise.all([sessionsRes.reload(), list.reload()])
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
    void operation.run(command, 'Contenido guardado.', async () => { setEditing(null); await list.reload(); await sessionsRes.reload() })
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
    return saved
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
    void operation.run(command, 'Contenido deshabilitado.', async () => { setDeactivating(null); setEditing(null); await list.reload(); await sessionsRes.reload() })
  }
  function toggleTopicCoverage(topicItem: TutoringTopic) {
    if (!canManage || !topicItem.is_active || operation.pending) return
    const nextCovered = !topicItem.is_covered
    void operation.run(
      async () => {
        await teacherApi.toggleTopicCovered(tutoring.id, topicItem.id, nextCovered)
        if (selectedSessionDate !== 'all' && activeSession) {
          const currentIds = activeSession.topics.map((t) => t.id)
          const nextIds = nextCovered
            ? (currentIds.includes(topicItem.id) ? currentIds : [...currentIds, topicItem.id])
            : currentIds.filter((id) => id !== topicItem.id)
          await teacherApi.updateSessionTopics(tutoring.id, activeSession.id, nextIds)
        }
      },
      nextCovered ? 'Tema marcado como completado.' : 'Tema marcado como pendiente.',
      async () => { await Promise.all([list.reload(), sessionsRes.reload()]) }
    )
  }

  // Los botones de la fila no deben abrir además el modal de edición (clic de fila).
  function stopRow(content: ReactNode) {
    return <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>{content}</div>
  }
  function editRecord(record: ContentRecord, nextKind: Kind) {
    if (!canManage || !record.is_active || operation.pending) return
    openForm(nextKind, record)
  }
  const rowTitle = (record: ContentRecord) => canManage && record.is_active ? 'Editar' : ''
  const title = activity ? `Metodologías de ${activity.name}` : topic ? `Actividades de ${topic.name}` : 'Temas de la tutoría'
  const contentBlockReason = editing?.kind === 'methodology'
    ? (form.description.trim() ? null : 'Escribe la descripción de la metodología.')
    : (form.name.trim() ? null : `Escribe el nombre del ${LABELS[editing?.kind ?? 'topic']}.`)
  const assignedIds = assigningSession?.topics.map((t) => t.id) ?? []
  const assignDirty = selectedTopicIds.length !== assignedIds.length || selectedTopicIds.some((id) => !assignedIds.includes(id))
  const dialogTitle = editing ? `${editing.record ? 'Editar' : 'Registrar'} ${LABELS[editing.kind]}` : ''

  return <div className="flex flex-col gap-5">
    {topic && <div className="flex flex-wrap items-center gap-2"><Button variant="tertiary" size="sm" disabled={operation.pending} onClick={() => { setTopicId(null); setActivityId(null) }}><ArrowLeftIcon data-icon="inline-start" />Temas</Button>{activity && <Button variant="tertiary" size="sm" disabled={operation.pending} onClick={() => setActivityId(null)}><ArrowLeftIcon data-icon="inline-start" />Actividades</Button>}<span className="text-sm text-muted-foreground">{topic.name}{activity ? ` / ${activity.name}` : ''}</span></div>}
    
    {!topic && !activity && (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <FilterBar
            id="teacher-content"
            search={list.searchInput}
            onSearch={list.setSearchInput}
            searchPlaceholder="Busca por tema…"
            onClear={() => setStatus('')}
            filters={[
              {
                id: 'status',
                label: 'Estado',
                value: status,
                onChange: (value) => setStatus(value as '' | 'active' | 'inactive'),
                allLabel: 'Todos los estados',
                options: [
                  { value: 'active', label: 'Activos' },
                  { value: 'inactive', label: 'Inactivos' },
                ],
              },
            ]}
          />
        </div>
        <Button className="shrink-0" disabled={!canManage || operation.pending} onClick={() => openForm(kind)}>
          <PlusIcon data-icon="inline-start" />
          Registrar {LABELS[kind]}
        </Button>
      </div>
    )}

    {topic && (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <h3 className="flex h-10 items-center font-display text-lg font-semibold">{title}</h3>
        </div>
        <Button className="shrink-0" disabled={!canManage || operation.pending} onClick={() => openForm(kind)}>
          <PlusIcon data-icon="inline-start" />
          Registrar {LABELS[kind]}
        </Button>
      </div>
    )}

    {!topic && !activity && !sessionsRes.loading && sessions.length === 0 && (
      <p className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3.5 py-2.5 text-sm text-muted-foreground">
        <CalendarDaysIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        Las sesiones se habilitan al tomar asistencia. Luego podrás ver aquí el contenido de cada una.
      </p>
    )}

    {!topic && !activity && sessions.length > 0 && (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-2.5" role="group" aria-label="Sesiones">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDaysIcon className="size-3.5 text-primary" />
            <span>Sesión:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={selectedSessionDate === 'all' ? 'primary' : 'secondary'}
              aria-pressed={selectedSessionDate === 'all'}
              onClick={() => setSelectedSessionDate('all')}
            >
              {selectedSessionDate === 'all' && <CheckIcon data-icon="inline-start" />}
              Todas
            </Button>
            {sessions.map((s) => {
              const isSelected = selectedSessionDate === s.date
              return (
                <Button
                  key={s.id}
                  type="button"
                  size="sm"
                  variant={isSelected ? 'primary' : 'secondary'}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedSessionDate(s.date)}
                >
                  {isSelected && <CheckIcon data-icon="inline-start" />}
                  <span>{sessionLabel(s)} · {formatDate(s.date)}</span>
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.2 rounded-full font-medium',
                      isSelected
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {s.topics.length === 0 ? 'sin temas' : `${s.topics.length} ${s.topics.length === 1 ? 'tema' : 'temas'}`}
                  </span>
                </Button>
              )
            })}
          </div>
        </div>
        {selectedSessionDate !== 'all' && activeSession && canManage && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openAssignModal(activeSession)}
          >
            <CheckCircle2Icon data-icon="inline-start" />
            <span>Asignar temas a esta sesión</span>
          </Button>
        )}
      </div>
    )}

    {!topic && !activity && selectedSessionDate !== 'all' && activeSession && (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3.5 py-2 text-xs">
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="size-4 text-primary shrink-0" />
          <span>Contenido de la <strong>{sessionLabel(activeSession)}</strong> · {formatDate(activeSession.date)}</span>
        </div>
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          onClick={() => setSelectedSessionDate('all')}
        >
          Ver todas las sesiones
        </Button>
      </div>
    )}

    <ErrorNotice message={list.error} retry={list.reload} />
    {!editing && <ErrorNotice message={operation.error} />}

    {activity ? (
      <RecordTable
        rows={activity.methodologies}
        loading={list.isFetching}
        empty={<TeacherEmpty title="Esta actividad aún no tiene metodologías" />}
        onRowClick={(item) => editRecord(item, 'methodology')}
        rowTitle={rowTitle}
        columns={[
          { label: 'Metodología', render: (item) => <p className="whitespace-pre-wrap break-words">{item.description}</p> },
          { label: 'Estado', render: (item) => <StatusBadge active={item.is_active} /> },
        ]}
      />
    ) : topic ? (
      <RecordTable
        rows={topic.activities}
        loading={list.isFetching}
        onRowClick={(item) => editRecord(item, 'activity')}
        rowTitle={rowTitle}
        empty={<TeacherEmpty title="Este tema aún no tiene actividades" />}
        columns={[
          { label: 'Actividad', render: (item) => <span className="font-medium">{item.name}</span> },
          { label: 'Duración', render: (item) => item.duration },
          { label: 'Estado', render: (item) => <StatusBadge active={item.is_active} /> },
          {
            label: 'Acciones',
            render: (item) => stopRow(<IconAction label={`Metodologías de ${item.name}`} icon={ListChecksIcon} disabled={operation.pending} onClick={() => setActivityId(item.id)} />),
          },
        ]}
      />
    ) : (
      <>
        <RecordTable
          rows={
            selectedSessionDate === 'all'
              ? list.data
              : list.data.filter((item) => activeSession?.topics.some((st) => st.id === item.id))
          }
          loading={list.isFetching || list.isInitialLoading}
          onRowClick={(item) => editRecord(item, 'topic')}
          rowTitle={rowTitle}
          empty={
            selectedSessionDate !== 'all' && activeSession ? (
              <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
                <p className="text-foreground">La {sessionLabel(activeSession)} ({formatDate(activeSession.date)}) aún no tiene temas.</p>
                <p className="max-w-md">Asocia los temas que trataste en esta sesión.</p>
                {canManage && (
                  <Button size="sm" onClick={() => openAssignModal(activeSession)}>
                    <PlusIcon data-icon="inline-start" />
                    Asignar temas a esta sesión
                  </Button>
                )}
              </div>
            ) : (
              <TeacherEmpty
                title="Aún no hay temas en esta tutoría"
                description="Registra el primer tema para planificar sus actividades y metodologías."
              />
            )
          }
          columns={[
            { label: 'Tema', render: (item) => <span className="font-medium">{item.name}</span> },
            ...(selectedSessionDate === 'all' && sessions.length > 0 ? [{
              label: 'Sesión',
              render: (item: TutoringTopic) => {
                const found = topicSessions(item)
                return found.length > 0
                  ? <span className="whitespace-nowrap text-sm">{found.map(sessionLabel).join(', ')}</span>
                  : <span className="text-sm text-muted-foreground">Sin sesión</span>
              },
            }] : []),
            {
              label: 'Recursos',
              render: (item) => (item.files?.length ?? 0) > 0
                ? <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground" title={item.files?.map((file) => file.name).join('\n')}><PaperclipIcon className="size-3.5" aria-hidden="true" />{item.files?.length === 1 ? '1 archivo' : `${item.files?.length} archivos`}</span>
                : <span className="text-sm text-muted-foreground">—</span>,
            },
            {
              label: 'Estado',
              render: (item) => stopRow(
                <Button
                  type="button"
                  size="sm"
                  variant={item.is_covered ? 'primary' : 'secondary'}
                  disabled={!canManage || !item.is_active || operation.pending}
                  onClick={() => toggleTopicCoverage(item)}
                  title={canManage && item.is_active ? (item.is_covered ? 'Tema completado. Clic para cambiar a Pendiente' : 'Tema pendiente. Clic para marcar como Completado') : undefined}
                >
                  {item.is_covered ? <CheckCircle2Icon data-icon="inline-start" /> : <ClockIcon data-icon="inline-start" />}
                  <span>{item.is_covered ? 'Completado' : 'Pendiente'}</span>
                </Button>
              ),
            },
            { label: 'Habilitado', render: (item) => <StatusBadge active={item.is_active} /> },
            {
              label: 'Acciones',
              render: (item) => stopRow(<>
                <IconAction
                  label={item.is_covered ? 'Marcar pendiente' : 'Marcar completado'}
                  icon={item.is_covered ? ClockIcon : CheckCircle2Icon}
                  disabled={!canManage || !item.is_active || operation.pending}
                  onClick={() => toggleTopicCoverage(item)}
                />
                <IconAction label={`Actividades de ${item.name}`} icon={BookOpenIcon} disabled={operation.pending} onClick={() => setTopicId(item.id)} />
              </>),
            },
          ]}
        />
        {selectedSessionDate === 'all' && (
          <CatalogPagination
            label="temas"
            page={list.page}
            lastPage={list.meta?.last_page ?? 1}
            disabled={list.isFetching}
            onChange={list.setPage}
          />
        )}
      </>
    )}
    <FormDialog
      open={Boolean(editing)}
      title={dialogTitle}
      description={activity?.name ?? topic?.name ?? tutoring.subject_name}
      pending={operation.pending}
      error={operation.error}
      dirty={JSON.stringify(form) !== JSON.stringify(initial) || pendingFiles.length > 0 || removedFileIds.length > 0}
      blockReason={contentBlockReason}
      onClose={() => setEditing(null)}
      onSubmit={submit}
      submitLabel={editing?.record ? 'Guardar cambios' : `Registrar ${editing ? LABELS[editing.kind] : ''}`}
      headerActions={editing?.record ? <IconAction label={`Deshabilitar ${LABELS[editing.kind]}`} icon={PowerOffIcon} tone="destructive" disabled={operation.pending} onClick={() => { operation.clearError(); setDeactivating(editing) }} /> : undefined}
    >
      {editing?.kind !== 'methodology' && (
        <FormField id="teacher-content-name" label="Nombre" counter={{ current: form.name.length, max: 150 }}>
          <Input
            id="teacher-content-name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            maxLength={150}
            required
            placeholder={editing ? NAME_PLACEHOLDERS[editing.kind] : undefined}
          />
        </FormField>
      )}
      {editing?.kind === 'topic' && (
        <FormField id="teacher-topic-files" label="Recursos" optional tip="Los estudiantes inscritos podrán descargarlos desde el contenido de la tutoría." error={fileError}>
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
      {editing?.kind === 'activity' && (
        <FormField id="activity-timer-hours" label="Duración de la actividad">
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Horas</span>
                <SelectInput
                  id="activity-timer-hours"
                  value={String(timerHours)}
                  onValueChange={(value) => updateTimer(Number(value), timerMinutes)}
                  options={HOUR_OPTIONS}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Minutos</span>
                <SelectInput
                  id="activity-timer-minutes"
                  value={String(timerMinutes)}
                  onValueChange={(value) => updateTimer(timerHours, Number(value))}
                  options={MINUTE_OPTIONS}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs text-muted-foreground mr-1">Rápido:</span>
              {[
                { label: '15m', h: 0, m: 15 },
                { label: '30m', h: 0, m: 30 },
                { label: '45m', h: 0, m: 45 },
                { label: '1h', h: 1, m: 0 },
                { label: '1h 30m', h: 1, m: 30 },
                { label: '2h', h: 2, m: 0 },
              ].map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  size="sm"
                  variant={timerHours === preset.h && timerMinutes === preset.m ? 'primary' : 'secondary'}
                  aria-pressed={timerHours === preset.h && timerMinutes === preset.m}
                  onClick={() => updateTimer(preset.h, preset.m)}
                >
                  {timerHours === preset.h && timerMinutes === preset.m && <CheckIcon data-icon="inline-start" />}
                  {preset.label}
                </Button>
              ))}
            </div>
            {form.duration && (
              <p className="text-xs text-primary mt-1">
                ⏱ Duración seleccionada: {form.duration}
              </p>
            )}
          </div>
        </FormField>
      )}
      {editing?.kind === 'methodology' && (
        <FormField id="teacher-content-description" label="Descripción" counter={{ current: form.description.length, max: 255 }}>
          <Textarea
            id="teacher-content-description"
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
      description="Selecciona los temas que fueron abordados en esta sesión de tutoría. Los temas seleccionados se marcarán automáticamente como completados."
      pending={operation.pending}
      error={operation.error}
      dirty={assignDirty}
      onClose={() => setAssigningSession(null)}
      onSubmit={saveAssignedTopics}
      submitLabel="Guardar temas de la sesión"
    >
      <div className="flex flex-col gap-2.5 py-2 max-h-80 overflow-y-auto pr-1">
        {list.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay temas registrados en esta tutoría.</p>
        ) : (
          list.data
            .filter((t) => t.is_active)
            .map((t) => (
              <label
                key={t.id}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                  selectedTopicIds.includes(t.id) ? 'bg-primary/5 border-primary/40' : 'hover:bg-muted/50 border-border'
                )}
              >
                <Checkbox
                  checked={selectedTopicIds.includes(t.id)}
                  onCheckedChange={() => toggleTopicSelection(t.id)}
                  className="mt-0.5"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{t.name}</span>
                  {t.description && <span className="text-xs text-muted-foreground">{t.description}</span>}
                  <span className="text-xs text-primary mt-1">
                    {t.activities.length} {t.activities.length === 1 ? 'actividad planificada' : 'actividades planificadas'}
                  </span>
                </div>
              </label>
            ))
        )}
      </div>
    </FormDialog>
    <ConfirmModal open={Boolean(deactivating)} title={`¿Deshabilitar ${deactivating ? LABELS[deactivating.kind] : 'contenido'}?`} description="El contenido dejará de estar disponible para nuevas sesiones. Su historial se conservará." pending={operation.pending} confirmLabel="Deshabilitar contenido" onClose={() => { if (!operation.pending) setDeactivating(null) }} onConfirm={deactivate} />
  </div>
}
