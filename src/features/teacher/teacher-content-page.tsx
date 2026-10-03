import { useState, type FormEvent } from 'react'
import { ArrowLeftIcon, BookOpenIcon, CalendarDaysIcon, CheckCircle2Icon, ChevronRightIcon, ClockIcon, PencilIcon, PlusIcon, PowerOffIcon } from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/textarea'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice, MutationDialog, RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { formatDate } from '@/lib/format'
import { teacherApi, type Activity, type Methodology, type TeacherTutoring, type TutoringSession, type TutoringTopic } from '@/lib/teacher-api'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { cn } from '@/lib/utils'
import { TeacherEmpty } from './teacher-shared'

type Kind = 'topic' | 'activity' | 'methodology'
type ContentRecord = TutoringTopic | Activity | Methodology
type Editing = { kind: Kind; record: ContentRecord | null }
const LABELS = { topic: 'tema', activity: 'actividad', methodology: 'metodología' }
const EMPTY = { name: '', description: '', duration: '' }
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
  const sessions = sessionsRes.data ?? []
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
      'Temas de la clase guardados.',
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
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const command = () => {
      const id = editing.record?.id
      if (editing.kind === 'topic') return id ? teacherApi.updateTopic(tutoring.id, id, { name: form.name.trim(), description: '' }) : teacherApi.createTopic(tutoring.id, { name: form.name.trim(), description: '' })
      if (!topic) throw new Error('Selecciona un tema.')
      if (editing.kind === 'activity') return id ? teacherApi.updateActivity(tutoring.id, topic.id, id, { name: form.name.trim(), duration: form.duration.trim() || '30 minutos' }) : teacherApi.createActivity(tutoring.id, topic.id, { name: form.name.trim(), duration: form.duration.trim() || '30 minutos' })
      if (!activity) throw new Error('Selecciona una actividad.')
      return id ? teacherApi.updateMethodology(tutoring.id, topic.id, activity.id, id, { description: form.description.trim() }) : teacherApi.createMethodology(tutoring.id, topic.id, activity.id, { description: form.description.trim() })
    }
    void operation.run(command, 'Contenido guardado.', async () => { setEditing(null); await list.reload(); await sessionsRes.reload() })
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
    void operation.run(command, 'Contenido deshabilitado.', async () => { setDeactivating(null); await list.reload(); await sessionsRes.reload() })
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
                allLabel: 'Todos',
                options: [
                  { value: 'active', label: 'Activos' },
                  { value: 'inactive', label: 'Inactivos' },
                ],
              },
            ]}
          />
        </div>
        <Button className="h-10 shrink-0" disabled={!canManage || operation.pending} onClick={() => openForm(kind)}>
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
        <Button className="h-10 shrink-0" disabled={!canManage || operation.pending} onClick={() => openForm(kind)}>
          <PlusIcon data-icon="inline-start" />
          Registrar {LABELS[kind]}
        </Button>
      </div>
    )}

    {!topic && !activity && sessions.length > 0 && (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <CalendarDaysIcon className="size-3.5 text-primary" />
            <span>Fecha de clase:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer',
                selectedSessionDate === 'all'
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs font-semibold'
                  : 'bg-card text-muted-foreground hover:text-foreground border-border'
              )}
              onClick={() => setSelectedSessionDate('all')}
            >
              Todas las clases
            </button>
            {sessions.map((s) => {
              const isSelected = selectedSessionDate === s.date
              return (
                <button
                  key={s.id}
                  type="button"
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer inline-flex items-center gap-1.5',
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs font-semibold'
                      : 'bg-card text-muted-foreground hover:text-foreground border-border'
                  )}
                  onClick={() => setSelectedSessionDate(s.date)}
                >
                  <span>{formatDate(s.date)}</span>
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.2 rounded-full font-medium',
                      isSelected
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {(s.topics.length > 0 ? s.topics.length : (list.data.filter((t) => t.is_covered).length || list.data.length))} {(s.topics.length > 0 ? s.topics.length : (list.data.filter((t) => t.is_covered).length || list.data.length)) === 1 ? 'tema' : 'temas'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        {selectedSessionDate !== 'all' && activeSession && canManage && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-8 cursor-pointer"
            onClick={() => openAssignModal(activeSession)}
          >
            <CheckCircle2Icon className="size-3.5 text-emerald-600" />
            <span>Asignar temas a esta clase</span>
          </Button>
        )}
      </div>
    )}

    {!topic && !activity && selectedSessionDate !== 'all' && activeSession && (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3.5 py-2 text-xs">
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="size-4 text-primary shrink-0" />
          <span>Mostrando temas tratados en la clase del <strong>{formatDate(activeSession.date)}</strong></span>
        </div>
        <button
          type="button"
          className="text-primary hover:underline font-medium cursor-pointer"
          onClick={() => setSelectedSessionDate('all')}
        >
          Ver todas las clases
        </button>
      </div>
    )}

    <ErrorNotice message={list.error} retry={list.reload} />
    {!editing && <ErrorNotice message={operation.error} />}

    {activity ? (
      <RecordTable
        rows={activity.methodologies}
        loading={list.isFetching}
        empty={<TeacherEmpty title="Esta actividad aún no tiene metodologías" />}
        columns={[
          { label: 'Metodología', render: (item) => <p className="whitespace-pre-wrap break-words">{item.description}</p> },
          { label: 'Estado', render: (item) => <StatusBadge active={item.is_active} /> },
          { label: 'Acciones', render: (item) => actions(item, 'methodology', item.description) },
        ]}
      />
    ) : topic ? (
      <RecordTable
        rows={topic.activities}
        loading={list.isFetching}
        empty={<TeacherEmpty title="Este tema aún no tiene actividades" />}
        columns={[
          { label: 'Actividad', render: (item) => <span className="font-medium">{item.name}</span> },
          { label: 'Duración', render: (item) => item.duration },
          { label: 'Estado', render: (item) => <StatusBadge active={item.is_active} /> },
          {
            label: 'Acciones',
            render: (item) => (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" disabled={operation.pending} onClick={() => setActivityId(item.id)}>
                  Metodologías
                  <ChevronRightIcon data-icon="inline-end" />
                </Button>
                {actions(item, 'activity', item.name)}
              </div>
            ),
          },
        ]}
      />
    ) : (
      <>
        <RecordTable
          rows={
            selectedSessionDate === 'all'
              ? list.data
              : (activeSession && activeSession.topics.length > 0
                  ? list.data.filter((item) => activeSession.topics.some((st) => st.id === item.id))
                  : (list.data.filter((item) => item.is_covered).length > 0 ? list.data.filter((item) => item.is_covered) : list.data))
          }
          loading={list.isFetching || list.isInitialLoading}
          empty={
            selectedSessionDate !== 'all' && activeSession ? (
              <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
                <p className="font-medium text-foreground">No hay temas asociados a la clase del {formatDate(activeSession.date)}.</p>
                <p className="max-w-md">Puedes asociar los temas o actividades abordados en esta fecha pulsando el botón a continuación.</p>
                {canManage && (
                  <Button variant="default" size="sm" onClick={() => openAssignModal(activeSession)}>
                    <PlusIcon data-icon="inline-start" />
                    Asignar temas a esta clase
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
            {
              label: 'Estado',
              render: (item) => (
                <button
                  type="button"
                  disabled={!canManage || !item.is_active || operation.pending}
                  onClick={() => toggleTopicCoverage(item)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all shadow-2xs',
                    item.is_covered
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25 hover:border-emerald-500/50'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25 hover:border-amber-500/50',
                    (!canManage || !item.is_active || operation.pending) ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                  )}
                  title={canManage && item.is_active ? (item.is_covered ? 'Tema completado. Clic para cambiar a Pendiente' : 'Tema pendiente. Clic para marcar como Completado') : undefined}
                >
                  {item.is_covered ? (
                    <>
                      <CheckCircle2Icon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Completado</span>
                    </>
                  ) : (
                    <>
                      <ClockIcon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Pendiente</span>
                    </>
                  )}
                </button>
              ),
            },
            { label: 'Habilitado', render: (item) => <StatusBadge active={item.is_active} /> },
            {
              label: 'Acciones',
              render: (item) => (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={item.is_covered ? 'outline' : 'default'}
                    size="sm"
                    className={cn('text-xs h-8', !item.is_covered && 'bg-emerald-600 hover:bg-emerald-700 text-white')}
                    disabled={!canManage || !item.is_active || operation.pending}
                    onClick={() => toggleTopicCoverage(item)}
                    title={item.is_covered ? 'Marcar tema como pendiente' : 'Marcar tema como completado'}
                  >
                    {item.is_covered ? (
                      <>
                        <ClockIcon data-icon="inline-start" className="h-3.5 w-3.5" />
                        Marcar pendiente
                      </>
                    ) : (
                      <>
                        <CheckCircle2Icon data-icon="inline-start" className="h-3.5 w-3.5" />
                        Marcar completado
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" disabled={operation.pending} onClick={() => setTopicId(item.id)}>
                    <BookOpenIcon data-icon="inline-start" />
                    Actividades
                  </Button>
                  {actions(item, 'topic', item.name)}
                </div>
              ),
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
    <MutationDialog open={Boolean(editing)} title={dialogTitle} description={activity?.name ?? topic?.name ?? tutoring.subject_name} pending={operation.pending} error={operation.error} dirty={JSON.stringify(form) !== JSON.stringify(initial)} onClose={() => setEditing(null)} onSubmit={submit} submitLabel={editing?.record ? 'Guardar cambios' : `Registrar ${editing ? LABELS[editing.kind] : ''}`}>
      {editing?.kind !== 'methodology' && (
        <Field>
          <FieldLabel htmlFor="teacher-content-name">Nombre</FieldLabel>
          <Input
            id="teacher-content-name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            maxLength={150}
            required
            placeholder={editing ? NAME_PLACEHOLDERS[editing.kind] : undefined}
          />
        </Field>
      )}
      {editing?.kind === 'activity' && (
        <Field>
          <FieldLabel htmlFor="activity-timer-hours">Duración de la actividad *</FieldLabel>
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Horas</span>
                <NativeSelect
                  id="activity-timer-hours"
                  value={String(timerHours)}
                  onChange={(e) => updateTimer(Number(e.target.value), timerMinutes)}
                >
                  <option value="0">0 horas</option>
                  <option value="1">1 hora</option>
                  <option value="2">2 horas</option>
                  <option value="3">3 horas</option>
                  <option value="4">4 horas</option>
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Minutos</span>
                <NativeSelect
                  id="activity-timer-minutes"
                  value={String(timerMinutes)}
                  onChange={(e) => updateTimer(timerHours, Number(e.target.value))}
                >
                  <option value="0">0 min</option>
                  <option value="10">10 min</option>
                  <option value="15">15 min</option>
                  <option value="20">20 min</option>
                  <option value="25">25 min</option>
                  <option value="30">30 min</option>
                  <option value="40">40 min</option>
                  <option value="45">45 min</option>
                  <option value="50">50 min</option>
                </NativeSelect>
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
                <button
                  key={preset.label}
                  type="button"
                  className={cn(
                    'px-2 py-0.5 rounded text-xs border font-medium transition-colors',
                    timerHours === preset.h && timerMinutes === preset.m
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => updateTimer(preset.h, preset.m)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {form.duration && (
              <p className="text-xs font-medium text-primary mt-1">
                ⏱ Duración seleccionada: {form.duration}
              </p>
            )}
          </div>
        </Field>
      )}
      {editing?.kind === 'methodology' && (
        <Field>
          <FieldLabel htmlFor="teacher-content-description">Descripción</FieldLabel>
          <Textarea
            id="teacher-content-description"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            maxLength={255}
            required
            placeholder={DESCRIPTION_PLACEHOLDERS.methodology}
          />
        </Field>
      )}
    </MutationDialog>
    <MutationDialog
      open={Boolean(assigningSession)}
      title={`Asignar temas a la clase del ${assigningSession ? formatDate(assigningSession.date) : ''}`}
      description="Selecciona los temas que fueron abordados en esta sesión de tutoría. Los temas seleccionados se marcarán automáticamente como completados."
      pending={operation.pending}
      error={operation.error}
      dirty={true}
      onClose={() => setAssigningSession(null)}
      onSubmit={saveAssignedTopics}
      submitLabel="Guardar temas de la clase"
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
                  <span className="text-sm font-semibold text-foreground">{t.name}</span>
                  {t.description && <span className="text-xs text-muted-foreground">{t.description}</span>}
                  <span className="text-xs text-primary font-medium mt-1">
                    {t.activities.length} {t.activities.length === 1 ? 'actividad planificada' : 'actividades planificadas'}
                  </span>
                </div>
              </label>
            ))
        )}
      </div>
    </MutationDialog>
    <ConfirmModal open={Boolean(deactivating)} title={`¿Deshabilitar ${deactivating ? LABELS[deactivating.kind] : 'contenido'}?`} description="El contenido dejará de estar disponible para nuevas sesiones. Su historial se conservará." pending={operation.pending} confirmLabel="Deshabilitar contenido" onClose={() => { if (!operation.pending) setDeactivating(null) }} onConfirm={deactivate} />
  </div>
}
