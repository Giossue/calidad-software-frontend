import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckIcon, PlusIcon, PowerIcon, Trash2Icon, XIcon } from 'lucide-react'
import { toast } from '@/lib/toast'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { ErrorModal } from '@/components/ui/error-modal'
import { ErrorNotice } from '@/components/ui/error-notice'
import { FieldError } from '@/components/ui/field'
import { FormDialog, type FormStep } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { IconAction } from '@/components/ui/icon-action'
import { Input } from '@/components/ui/input'
import { SelectField, SelectInput } from '@/components/ui/select-field'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { useDetailParam } from '@/hooks/use-detail-param'
import { DetailPageSkeleton } from '@/components/ui/loading-skeletons'
import type { Section } from '@/lib/api'
import { sanitizeLetters } from '@/lib/sanitize'
import { findScheduleConflicts, type ScheduleConflict } from '@/lib/schedule-conflicts'
import { DAY_LABELS, tutoringApi, WEEK_DAYS, type AvailableTeacher, type Cycle, type Subject, type Tutoring, type TutoringSchedule, type TutoringScheduleItem } from '@/lib/tutoring-api'
import { cn } from '@/lib/utils'
import { TutoringDetail } from './tutoring-detail'
import { CareerBreadcrumb, CareerPicker, useSelectedCareer } from './career-picker'
import { FilterBar } from './filter-bar'
import { RosterImportButton } from './roster-import-dialog'
import { ModuleHeader, RecordTable } from './tutoring-shared'
import { describeError, errorFieldOf, useOperation, useTutoringCatalogs } from './tutoring-hooks'
import { ListScreenSkeleton } from './tutoring-skeletons'

const SCHEDULE_TIME_OPTIONS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00',
]

export interface TutoringRowItem {
  id: string
  subject_id: number | null
  subject_name: string
  code: string | null
  career_id: number
  career_name: string
  cycle_id: number
  cycle_name: string
  period_name: string
  modality_name: string
  section_name: string | null
  parallels: string[]
  teacher_id: number | null
  teacher_name: string | null
  teacher_is_active: boolean | null
  schedules?: readonly TutoringSchedule[]
  is_active: boolean
  tutoring: Tutoring | null
  subject: Subject | null
}

export function TutoringsPage() {
  const catalogs = useTutoringCatalogs()
  const selection = useSelectedCareer(catalogs.careers)

  if (selection.career) {
    return <TutoringsWorkspace catalogs={catalogs} careerId={selection.career.id} onBack={selection.canChange ? selection.clear : undefined} />
  }

  return <CareerPicker catalogs={catalogs} title="Tutorías" skeleton={<TutoringsSkeleton />} rowTitle={(career) => `Ver tutorías de ${career.name}`} onSelect={(career) => selection.select(career.id)} />
}

const TUTORING_HEADERS = ['Asignatura', 'Modalidad', 'Ciclo', 'Paralelo', 'Docente', 'Estado'] as const

/** Única línea que avisa que el período mostrado ya pasó. */
const READ_ONLY_NOTICE = 'Período pasado: solo consulta.'

/** Esqueleto de Tutorías: el mismo mientras cargan las carreras y la primera página. */
function TutoringsSkeleton() {
  return <ListScreenSkeleton label="Cargando tutorías" actions={2} filters={2} headers={TUTORING_HEADERS} />
}

/** Error del servidor de uno de estos campos (p. ej. `teacher_id`), para mostrarlo bajo el campo. */
function serverFieldError(error: string | null, field: string | undefined, ...names: readonly string[]): string | null {
  return error && field && names.some((name) => field === name || field.startsWith(`${name}.`)) ? error : null
}

/** Período elegido en la URL (`?periodo=<id>`); sin él se muestra el período vigente. */
const PERIOD_PARAM = 'periodo'

function TutoringsWorkspace({ catalogs, careerId, onBack }: Readonly<{ catalogs: ReturnType<typeof useTutoringCatalogs>; careerId: number; onBack?: () => void }>) {
  const [cycleFilter, setCycleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('')
  const [searchParams, setSearchParams] = useSearchParams()
  const rawPeriod = Number(searchParams.get(PERIOD_PARAM))
  const selectedPeriodId = Number.isInteger(rawPeriod) && rawPeriod > 0 ? rawPeriod : null
  const activePeriod = catalogs.periods.find((period) => period.is_active) ?? null
  const list = usePaginatedCatalog(
    (page, search) => tutoringApi.tutorings({
      page,
      search,
      career_id: careerId,
      cycle_number: Number(cycleFilter) || undefined,
      status: statusFilter || undefined,
      period_id: selectedPeriodId ?? undefined,
    }),
    `${careerId}|${cycleFilter}|${statusFilter}|${selectedPeriodId ?? ''}`,
  )
  // Período mostrado: el elegido o el vigente (según los catálogos o lo que dice la lista).
  const catalogPeriod = selectedPeriodId === null ? activePeriod : catalogs.periods.find((period) => period.id === selectedPeriodId) ?? null
  const shownPeriod = catalogPeriod ?? list.meta?.period ?? null
  // Las tutorías de un período pasado son solo de consulta.
  const readOnly = shownPeriod !== null && !shownPeriod.is_active
  const noActivePeriod = selectedPeriodId === null && shownPeriod === null && !list.isInitialLoading

  function choosePeriod(value: string) {
    const next = new URLSearchParams(searchParams)
    if (!value || Number(value) === activePeriod?.id) next.delete(PERIOD_PARAM)
    else next.set(PERIOD_PARAM, value)
    setSearchParams(next, { replace: true })
  }
  const [choosingTutoring, setChoosingTutoring] = useState(false)
  const [chooserSubjectId, setChooserSubjectId] = useState('')
  const operation = useOperation()
  const [deletingTutoring, setDeletingTutoring] = useState<Tutoring | null>(null)
  const [subjects, setSubjects] = useState<readonly Subject[]>([])
  const [subjectsRevision, setSubjectsRevision] = useState(0)
  // Tutoría abierta en la URL (?tutoria=<id>) para que "Atrás" vuelva a la lista. Se busca en
  // las filas para mostrar siempre los datos recién cargados.
  const detail = useDetailParam('tutoria')
  const [careerTutorings, setCareerTutorings] = useState<readonly Tutoring[] | null>(null)

  // Create Tutoring per Subject modal state
  const [creatingTutoringSubject, setCreatingTutoringSubject] = useState<Subject | null>(null)
  const [creatingTutoringCycle, setCreatingTutoringCycle] = useState<Cycle | null>(null)
  const [createTeacherId, setCreateTeacherId] = useState('')
  const [createTeachers, setCreateTeachers] = useState<readonly AvailableTeacher[]>([])
  const [createTeachersLoading, setCreateTeachersLoading] = useState(false)
  const [createTeachersError, setCreateTeachersError] = useState<string | null>(null)
  const [createScheduleRows, setCreateScheduleRows] = useState<ScheduleRow[]>(defaultScheduleRows)
  // Los errores de validación en rojo aparecen solo tras intentar enviar.
  const [createAttempted, setCreateAttempted] = useState(false)
  // Paralelo de la tutoría: una fila de ciclo ya usada (su id) o un paralelo del catálogo
  // (`p:<id>`), que se envía con la fila base del ciclo.
  const [createParallelIds, setCreateParallelIds] = useState<string[]>([])
  // Paralelos creados desde el formulario, mientras el catálogo no se recarga.
  const [createdSections, setCreatedSections] = useState<readonly Section[]>([])
  const allSections = [...catalogs.sections, ...createdSections.filter((created) => !catalogs.sections.some((section) => section.id === created.id))]
  const [createInitialParallelIds, setCreateInitialParallelIds] = useState<string[]>([])
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createErrorField, setCreateErrorField] = useState<string | undefined>(undefined)

  // Edit Tutoring modal state
  const [editingTutoringItem, setEditingTutoringItem] = useState<TutoringRowItem | null>(null)
  const [editTeacherId, setEditTeacherId] = useState('')
  const [editTeachers, setEditTeachers] = useState<readonly AvailableTeacher[]>([])
  const [editTeachersLoading, setEditTeachersLoading] = useState(false)
  const [editTeachersError, setEditTeachersError] = useState<string | null>(null)
  const [editScheduleRows, setEditScheduleRows] = useState<ScheduleRow[]>(defaultScheduleRows)
  const [editAttempted, setEditAttempted] = useState(false)
  const [editOriginalSchedules, setEditOriginalSchedules] = useState<readonly TutoringSchedule[]>([])
  const [editParallelIds, setEditParallelIds] = useState<string[]>([])
  // Estado inicial del formulario de edición, para saber si hay cambios reales.
  const [editInitial, setEditInitial] = useState({ teacherId: '', schedule: '', parallel: '' })

  // Aviso previo de choques: el mismo docente no puede tener dos tutorías a la misma hora.
  const createSchedules = toScheduleItems(createScheduleRows)
  const createConflicts = findScheduleConflicts(
    createTeachers.find((t) => String(t.id) === createTeacherId)?.busy_schedules ?? [],
    createSchedules,
    undefined,
    creatingTutoringSubject?.name,
  )
  const editSchedules = toScheduleItems(editScheduleRows)
  const editConflicts = findScheduleConflicts(
    editTeachers.find((t) => String(t.id) === editTeacherId)?.busy_schedules ?? [],
    editSchedules,
    editingTutoringItem?.tutoring?.id,
    editingTutoringItem?.tutoring?.subject_name,
  )
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editErrorField, setEditErrorField] = useState<string | undefined>(undefined)

  // Collapsible cycle groups state

  // View Parallels and Schedules modals state

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const collected: Subject[] = []
        let page = 1
        let lastPage = 1
        do {
          const response = await tutoringApi.subjects({ page, per_page: 100, status: 'active' })
          if (cancelled) return
          collected.push(...response.data.filter((s) => s.is_active))
          lastPage = response.meta?.last_page ?? 1
          page += 1
        } while (page <= lastPage)
        setSubjects(collected.filter((s) => s.is_active))
      } catch {
        // Ignored
      }
    }
    void load()
    return () => { cancelled = true }
  }, [subjectsRevision])


  // Los docentes de la carrera se cargan al abrir el formulario: se eligen junto con la asignatura.
  useEffect(() => {
    if (!choosingTutoring) return
    let cancelled = false
    setCreateTeachersLoading(true)
    setCreateTeachersError(null)
    // Solo los docentes vinculados a la carrera.
    Promise.resolve(tutoringApi.availableTeachers('', undefined, careerId))
      .then((data) => { if (!cancelled) setCreateTeachers(Array.isArray(data) ? data : []) })
      .catch((caught: unknown) => { if (!cancelled) setCreateTeachersError(describeError(caught)) })
      .finally(() => { if (!cancelled) setCreateTeachersLoading(false) })
    return () => { cancelled = true }
  }, [choosingTutoring, careerId])

  function openCreateTutoring(subject: Subject, cycle: Cycle) {
    if (!subject.is_active) {
      toast.error('No se puede crear tutoría para una asignatura deshabilitada.')
      return
    }
    setCreatingTutoringSubject(subject)
    setCreatingTutoringCycle(cycle)
    setCreateScheduleRows(defaultScheduleRows())
    setCreateAttempted(false)
    setCreateError(null)
    setCreateErrorField(undefined)

    // Cada paralelo es una tutoría con su propio docente: se elige uno solo.
    const options = tutoringParallelOptions(catalogs.cycles, allSections, subject.career_id, cycle.number)
    const initialParallels = options.length === 1 ? [options[0].value] : []
    setCreateParallelIds(initialParallels)
    setCreateInitialParallelIds(initialParallels)
  }

  async function handleCreateTutoringSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!creatingTutoringSubject || !creatingTutoringCycle) return

    if (!creatingTutoringSubject.is_active) {
      setCreateError('La asignatura seleccionada está deshabilitada y no puede tener nuevas tutorías.')
      return
    }

    // Lo que falta se marca en línea bajo cada campo (y en el tooltip del botón bloqueado).
    if (validateTutoringForm({ teacherId: createTeacherId, rows: createScheduleRows, parallelRequired: true, parallelIds: createParallelIds, conflicts: createConflicts })) {
      setCreateAttempted(true)
      return
    }

    setCreateSaving(true)
    setCreateError(null)
    setCreateErrorField(undefined)

    try {
      const activeModality = catalogs.modalities.find((m) => m.is_active) ?? catalogs.modalities[0]
      const modalityId = Number(creatingTutoringSubject.modality_id || activeModality?.id)

      // Tutoría, docente y horarios se guardan juntos: si algo falla, no se crea nada. El
      // paralelo es la fila de ciclo elegida o, si aún no tiene fila, la fila base del ciclo con
      // el paralelo del catálogo; la tutoría es del período vigente.
      const choice = createParallelIds[0] ?? ''
      const placement = choice.startsWith(CATALOG_PARALLEL)
        ? { cycle_id: baseCycleId(catalogs.cycles, creatingTutoringSubject.career_id, creatingTutoringCycle), parallel_id: Number(choice.slice(CATALOG_PARALLEL.length)) }
        : { cycle_id: Number(choice) }
      await tutoringApi.createTutoring({
        subject_id: creatingTutoringSubject.id,
        ...placement,
        period_id: activePeriod?.id,
        modality_id: modalityId,
        teacher_id: Number(createTeacherId),
        schedules: createSchedules,
      })

      toast.success('Tutoría creada')
      setCreatingTutoringSubject(null)
      setCreatingTutoringCycle(null)
      setChoosingTutoring(false)
      await list.reload()
      setSubjectsRevision((prev) => prev + 1)
    } catch (caught) {
      setCreateError(describeError(caught))
      setCreateErrorField(errorFieldOf(caught))
    } finally {
      setCreateSaving(false)
    }
  }

  function openEditTutoring(item: TutoringRowItem) {
    if (!item.tutoring) return
    setEditingTutoringItem(item)
    setEditTeacherId(item.teacher_id ? String(item.teacher_id) : '')
    setEditAttempted(false)
    setEditError(null)
    setEditErrorField(undefined)

    // Initial teacher list with current teacher
    if (item.teacher_id && item.teacher_name) {
      setEditTeachers([{
        id: item.teacher_id,
        name: item.teacher_name,
        email: '',
        is_active: item.teacher_is_active ?? true,
      }])
    } else {
      setEditTeachers([])
    }

    setEditTeachersLoading(true)
    setEditTeachersError(null)
    Promise.resolve(tutoringApi.availableTeachers('', undefined, careerId))
      .then((data) => {
        if (!data || !Array.isArray(data)) return
        const map = new Map<number, AvailableTeacher>()
        if (item.teacher_id && item.teacher_name) {
          map.set(item.teacher_id, {
            id: item.teacher_id,
            name: item.teacher_name,
            email: '',
            is_active: item.teacher_is_active ?? true,
          })
        }
        data.forEach((t) => map.set(t.id, t))
        setEditTeachers(Array.from(map.values()))
      })
      .catch((caught: unknown) => setEditTeachersError(describeError(caught)))
      .finally(() => setEditTeachersLoading(false))

    // Set initial schedules
    const existing = (item.tutoring.schedules || item.schedules || []).filter((s) => s.is_active)
    const initialRows = existing.length > 0 ? rowsFromSchedules(existing) : defaultScheduleRows()
    setEditScheduleRows(initialRows)
    setEditOriginalSchedules(existing)

    Promise.resolve(tutoringApi.schedules(item.tutoring.id))
      .then((data) => {
        if (!data || !Array.isArray(data)) return
        const freshActive = data.filter((s) => s.is_active)
        setEditOriginalSchedules(freshActive)
        if (freshActive.length > 0) {
          const freshRows = rowsFromSchedules(freshActive)
          setEditScheduleRows(freshRows)
          setEditInitial((prev) => ({ ...prev, schedule: scheduleSignature(freshRows) }))
        }
      })
      .catch(() => {})

    // Paralelo actual: la fila de ciclo de la tutoría.
    const parallelIds = [String(item.cycle_id)]
    setEditParallelIds(parallelIds)
    setEditInitial({ teacherId: item.teacher_id ? String(item.teacher_id) : '', schedule: scheduleSignature(initialRows), parallel: parallelIds.join(',') })
  }

  async function handleEditTutoringSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingTutoringItem || !editingTutoringItem.tutoring) return
    const currentTutoring = editingTutoringItem.tutoring

    if (validateTutoringForm({ teacherId: editTeacherId, rows: editScheduleRows, parallelRequired: editSubjectParallels.length > 0, parallelIds: editParallelIds, conflicts: editConflicts })) {
      setEditAttempted(true)
      return
    }

    setEditSaving(true)
    setEditError(null)
    setEditErrorField(undefined)

    try {
      const targetCycleId = Number(editParallelIds[0]) || null

      // Docente, paralelo y horarios se guardan juntos: si algo falla, no cambia nada.
      await tutoringApi.configureTutoring(currentTutoring.id, {
        teacher_id: Number(editTeacherId),
        ...(targetCycleId && targetCycleId !== currentTutoring.cycle_id ? { cycle_id: targetCycleId } : {}),
        schedules: editSchedules.map((schedule) => ({
          ...schedule,
          room: editOriginalSchedules.find((s) => s.day === schedule.day && s.is_active)?.room || undefined,
        })),
      })

      toast.success('Tutoría actualizada')
      setEditingTutoringItem(null)
      await list.reload()
      setSubjectsRevision((prev) => prev + 1)
    } catch (caught) {
      setEditError(describeError(caught))
      setEditErrorField(errorFieldOf(caught))
    } finally {
      setEditSaving(false)
    }
  }



  function clearFilters() {
    setCycleFilter('')
    setStatusFilter('')
  }

  const careerName = catalogs.careers.find((career) => career.id === careerId)?.name ?? 'Tutorías'
  const cycleLevels = Array.from(
    new Map(catalogs.cycles.filter((cycle) => cycle.status && cycle.career_id === careerId).map((cycle) => [cycle.number, cycle])).values(),
  ).sort((a, b) => a.number - b.number)

  function toRow(t: Tutoring): TutoringRowItem {
      const subj = subjects.find((item) => item.id === t.subject_id) ?? null
      // Cada tutoría tiene un solo paralelo: el suyo (o, si no lo trae, el de su ciclo).
      const ownParallel = t.section_name ?? catalogs.cycles.find((c) => c.id === t.cycle_id)?.paralelo_name ?? null
      const parallelNames = ownParallel ? [ownParallel] : []
      return {
        id: `tutoring-${t.id}`,
        subject_id: t.subject_id,
        subject_name: t.subject_name,
        code: subj?.code ?? null,
        career_id: t.career_id,
        career_name: careerName,
        cycle_id: t.cycle_id,
        cycle_name: t.cycle_name,
        period_name: t.period_name,
        modality_name: t.modality_name,
        section_name: t.section_name ?? null,
        parallels: parallelNames,
        teacher_id: t.teacher_id,
        teacher_name: t.teacher_name,
        teacher_is_active: t.teacher_is_active,
        schedules: t.schedules,
        is_active: t.is_active,
        tutoring: t,
        subject: subj,
      }
  }

  const rows: TutoringRowItem[] = list.data
    .filter((t) => t.subject_is_active !== false)
    .map(toRow)

  // Abierta desde la URL y fuera de la página actual: se busca entre las tutorías de la carrera.
  const listLoading = list.isFetching || list.isInitialLoading
  const inList = detail.id !== null && list.data.some((t) => t.id === detail.id)
  useEffect(() => {
    if (detail.id === null || inList || listLoading) return
    let cancelled = false
    tutoringApi.tutorings({ career_id: careerId, per_page: 100, period_id: selectedPeriodId ?? undefined })
      .then((response) => { if (!cancelled) setCareerTutorings(response.data) })
      .catch(() => { if (!cancelled) setCareerTutorings([]) })
    return () => { cancelled = true }
  }, [detail.id, inList, listLoading, careerId, selectedPeriodId])

  // La asignatura ya trae su ciclo de la malla: solo se elige la asignatura (por ciclo y nombre).
  const chooserSubjects = subjects
    .filter((subj) => subj.career_id === careerId && subj.is_active && cycleLevels.some((level) => level.number === subj.cycle_number))
    .toSorted((a, b) => (a.cycle_number ?? 0) - (b.cycle_number ?? 0) || a.name.localeCompare(b.name))

  function openCreateChooser() {
    setChooserSubjectId('')
    setCreateTeacherId('')
    setCreateAttempted(false)
    setCreatingTutoringSubject(null)
    setCreatingTutoringCycle(null)
    setCreateError(null)
    setCreateErrorField(undefined)
    setChoosingTutoring(true)
  }

  function closeCreateDialog() {
    if (createSaving) return
    setCreatingTutoringSubject(null)
    setCreatingTutoringCycle(null)
    setChoosingTutoring(false)
    setCreateError(null)
    setCreateErrorField(undefined)
  }

  /** Al elegir la asignatura se prepara la segunda fase (horario y paralelo). */
  function chooseSubject(subjectId: string) {
    setChooserSubjectId(subjectId)
    const subject = chooserSubjects.find((item) => String(item.id) === subjectId)
    const level = cycleLevels.find((item) => item.number === subject?.cycle_number)
    if (subject && level) openCreateTutoring(subject, level)
  }

  // Paralelos para la tutoría: los que ya usa el ciclo en la carrera y los demás del catálogo.
  const subjectParallelsForModal = creatingTutoringSubject && creatingTutoringCycle
    ? tutoringParallelOptions(catalogs.cycles, allSections, creatingTutoringSubject.career_id, creatingTutoringCycle.number)
    : []

  /** Crea un paralelo en el catálogo sin salir del formulario y lo deja elegido. */
  async function createParallelForTutoring(name: string) {
    if (!creatingTutoringSubject || !creatingTutoringCycle) return
    const section = await tutoringApi.createSection(name)
    if (!allSections.some((item) => item.id === section.id)) setCreatedSections((prev) => [...prev, section])
    const existing = catalogs.cycles.find((c) => c.career_id === creatingTutoringSubject.career_id && c.number === creatingTutoringCycle.number && c.paralelo_id === section.id)
    setCreateParallelIds([existing ? String(existing.id) : `${CATALOG_PARALLEL}${section.id}`])
    toast.success(`Paralelo ${section.name} creado`)
  }

  // Al editar: los paralelos del mismo número de ciclo (y el actual, aunque ya no esté activo).
  const editCurrentCycle = editingTutoringItem ? catalogs.cycles.find((c) => c.id === editingTutoringItem.cycle_id) : undefined
  const editCycleOptions = editingTutoringItem && editCurrentCycle ? parallelCycles(catalogs.cycles, editingTutoringItem.career_id, editCurrentCycle.number) : []
  const editSubjectParallels = !editingTutoringItem || !editCurrentCycle || editCycleOptions.some((option) => option.value === String(editCurrentCycle.id))
    ? editCycleOptions
    : [...editCycleOptions, { value: String(editCurrentCycle.id), name: editingTutoringItem.section_name ?? editCurrentCycle.paralelo_name ?? editCurrentCycle.name }]


  const columns = [
    {
      label: 'Asignatura',
      render: (item: TutoringRowItem) => item.subject_name,
    },
    { label: 'Modalidad', render: (item: TutoringRowItem) => item.modality_name || 'Presencial' },
    ...(cycleFilter === '' ? [{
      label: 'Ciclo',
      render: (item: TutoringRowItem) => {
        const number = catalogs.cycles.find((cycle) => cycle.id === item.cycle_id)?.number
        return number ? `${number}°` : <span className="text-muted-foreground">—</span>
      },
    }] : []),
    {
      label: 'Paralelo',
      render: (item: TutoringRowItem) => item.parallels.length > 0
        ? item.parallels.map((name) => name.replace(/^Paralelo\s+/i, '')).join(', ')
        : <span className="text-muted-foreground">—</span>,
    },
    {
      label: 'Docente',
      render: (item: TutoringRowItem) => (
        <div className="flex flex-col gap-1 items-start">
          {item.teacher_name ? (
            <>
              <span>{item.teacher_name}</span>
              {item.teacher_id && !item.teacher_is_active && (
                <span className="text-xs text-destructive">Docente inactivo: requiere reasignación</span>
              )}
            </>
          ) : (
            <span className="text-xs text-warning">Sin docente asignado</span>
          )}
        </div>
      ),
    },
    {
      label: 'Estado',
      render: (item: TutoringRowItem) => <StatusBadge active={item.is_active} activeLabel="Activa" inactiveLabel="Inactiva" />,
    },
  ]

  const detailTutoring = detail.id === null
    ? null
    : list.data.find((t) => t.id === detail.id) ?? careerTutorings?.find((t) => t.id === detail.id) ?? null
  const detailItem = detailTutoring ? toRow(detailTutoring) : null
  const tutoringNotFound = detail.id !== null && !detailTutoring && careerTutorings !== null && !listLoading

  const creatingStep2 = Boolean(creatingTutoringSubject && creatingTutoringCycle)
  const chooserBlockReason = !chooserSubjectId ? 'Selecciona una asignatura.' : !createTeacherId ? 'Selecciona un docente para la tutoría.' : null
  const createBlockReason = creatingStep2
    ? validateTutoringForm({ teacherId: createTeacherId, rows: createScheduleRows, parallelRequired: true, parallelIds: createParallelIds, conflicts: createConflicts })
    : chooserBlockReason
  const createDirty = createTeacherId !== '' || (creatingStep2 && (
    scheduleSignature(createScheduleRows) !== scheduleSignature(defaultScheduleRows())
    || createParallelIds.join(',') !== createInitialParallelIds.join(',')
  ))

  const editLocked = Boolean(editingTutoringItem && !editingTutoringItem.tutoring?.is_active)
  const editDirty = Boolean(editingTutoringItem) && (
    editTeacherId !== editInitial.teacherId
    || scheduleSignature(editScheduleRows) !== editInitial.schedule
    || editParallelIds.join(',') !== editInitial.parallel
  )
  const editBlockReason = editLocked
    ? 'Activa la tutoría para poder editarla.'
    : validateTutoringForm({ teacherId: editTeacherId, rows: editScheduleRows, parallelRequired: editSubjectParallels.length > 0, parallelIds: editParallelIds, conflicts: editConflicts })

  const cycleLabel = (cycleId: number, fallback: string) => {
    const number = catalogs.cycles.find((cycle) => cycle.id === cycleId)?.number
    return number ? `${number}° ciclo` : fallback
  }
  const createFieldError = (...names: readonly string[]) => serverFieldError(createError, createErrorField, ...names)
  const editFieldError = (...names: readonly string[]) => serverFieldError(editError, editErrorField, ...names)

  const createSteps: readonly FormStep[] = [
    {
      title: 'Asignatura y docente',
      blockReason: chooserBlockReason,
      fields: ['subject_id', 'teacher_id'],
      content: (
        <>
          <SelectField
            id="create-tutoring-subject"
            label="Asignatura"
            required
            value={chooserSubjectId}
            onValueChange={chooseSubject}
            placeholder="Selecciona una asignatura"
            error={createFieldError('subject_id')}
            options={chooserSubjects.map((subj) => ({ value: String(subj.id), label: `${subj.name} · ${subj.cycle_number}° ciclo` }))}
          />
          {chooserSubjects.length === 0 && <p className="text-xs text-muted-foreground">La carrera aún no tiene asignaturas activas. Regístralas primero en la Malla curricular.</p>}
          <TeacherSection
            prefix="create"
            teachers={createTeachers}
            loading={createTeachersLoading}
            error={createTeachersError}
            fieldError={createFieldError('teacher_id')}
            value={createTeacherId}
            onChange={setCreateTeacherId}
          />
        </>
      ),
    },
    {
      title: 'Horario y paralelo',
      // `cycle_id` y `parallel_id` son la fila de ciclo y el paralelo elegidos en este paso.
      fields: ['schedules', 'cycle_id', 'parallel_id', 'parallel_ids'],
      content: creatingTutoringSubject && creatingTutoringCycle ? (
        <>
          <ScheduleSection
            prefix="create"
            rows={createScheduleRows}
            error={createFieldError('schedules')}
            showErrors={createAttempted}
            onChange={setCreateScheduleRows}
          />
          <ScheduleConflictNotice conflicts={createConflicts} />
          <ParallelField prefix="create" parallels={subjectParallelsForModal} value={createParallelIds} onChange={setCreateParallelIds} onCreate={createParallelForTutoring} showErrors={createAttempted} serverError={createFieldError('cycle_id', 'parallel_id', 'parallel_ids')} />
        </>
      ) : null,
    },
  ]

  // Una tutoría abierta es de solo consulta si no es del período vigente.
  const detailReadOnly = Boolean(detailItem?.tutoring && detailItem.tutoring.period_id !== activePeriod?.id)

  return <section className="flex flex-col gap-6">
    {detailItem?.tutoring ? <TutoringDetail tutoring={detailItem.tutoring} schedules={detailItem.schedules ?? []} onBack={detail.close} onEdit={detailReadOnly ? undefined : () => openEditTutoring(detailItem)} onDelete={detailReadOnly ? undefined : () => setDeletingTutoring(detailItem.tutoring ?? null)} readOnly={detailReadOnly} /> : tutoringNotFound ? (
      <div className="flex flex-col items-start gap-4">
        <p className="text-sm text-muted-foreground">No encontramos esta tutoría en la carrera.</p>
        <Button type="button" variant="secondary" onClick={detail.close}>Volver a tutorías</Button>
      </div>
    ) : detail.id !== null ? <DetailPageSkeleton label="Cargando tutoría" /> : list.isInitialLoading ? <TutoringsSkeleton /> : <>
      <CareerBreadcrumb root="Tutorías" career={careerName} onBack={onBack} />
      <ModuleHeader
        title={shownPeriod ? `Tutorías - Período ${shownPeriod.name}` : 'Tutorías'}
        description={readOnly ? READ_ONLY_NOTICE : `Asigna docente, horario y paralelo a las tutorías de ${careerName}. Haz clic en una para abrirla.`}
        {...(readOnly || noActivePeriod ? {} : {
          createLabel: 'Crear tutoría',
          onCreate: openCreateChooser,
          extraActions: <RosterImportButton careerId={careerId} onFinished={list.reload} />,
        })}
        disabled={operation.pending || catalogs.loading || subjects.length === 0}
      />
      <FilterBar
        id="tutorings"
        search={list.searchInput}
        onSearch={list.setSearchInput}
        searchPlaceholder="Busca por asignatura…"
        onClear={clearFilters}
        leading={catalogs.periods.length > 0 ? (
          <SelectInput
            id="tutorings-period"
            ariaLabel="Período"
            value={shownPeriod ? String(shownPeriod.id) : ''}
            onValueChange={choosePeriod}
            placeholder="Elige un período"
            options={catalogs.periods.map((period) => ({ value: String(period.id), label: period.name }))}
            className="min-w-40 flex-1 sm:w-48 sm:flex-none"
          />
        ) : undefined}
        filters={[
          { id: 'cycle', label: 'Ciclo', value: cycleFilter, onChange: setCycleFilter, allLabel: 'Todos los ciclos', options: cycleLevels.map((level) => ({ value: String(level.number), label: `${level.number}° ciclo` })) },
          { id: 'status', label: 'Estado', value: statusFilter, onChange: (value) => setStatusFilter(value as '' | 'active' | 'inactive'), allLabel: 'Todos los estados', options: [{ value: 'active', label: 'Activas' }, { value: 'inactive', label: 'Inactivas' }] },
        ]}
      />
      <ErrorNotice message={list.error} retry={list.reload} />

      <RecordTable
        rows={rows}
        loading={list.isFetching || list.isInitialLoading}
        empty={noActivePeriod
          ? 'No hay un período académico activo. Pide al administrador que active uno.'
          : readOnly
            ? 'Este período no tuvo tutorías con estos filtros.'
            : 'Aún no hay tutorías para esta búsqueda. Usa «Crear tutoría» para registrar una.'}
        columns={columns}
        onRowClick={(item) => (item.tutoring ? detail.open(item.tutoring.id) : openEditTutoring(item))}
        rowTitle={(item) => `Abrir la tutoría de ${item.subject_name}`}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {listLoading ? <span /> : <p className="text-sm text-muted-foreground">
          Mostrando {rows.length} de {list.meta?.total ?? rows.length} {(list.meta?.total ?? rows.length) === 1 ? 'tutoría' : 'tutorías'}
        </p>}
        <CatalogPagination label="tutorías" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
      </div>
    </>}

    {/* Crear tutoría por pasos: primero asignatura y docente; luego horario y paralelo */}
    <FormDialog
      open={choosingTutoring}
      title="Crear tutoría"
      description={creatingTutoringSubject && creatingTutoringCycle ? `${creatingTutoringSubject.name} · ${creatingTutoringCycle.number}° ciclo` : undefined}
      pending={createSaving}
      error={createError}
      // El campo rechazado por el servidor lleva al paso donde se corrige (p. ej. `teacher_id` al paso 1).
      errorModal={createError && createErrorField ? { title: '', description: createError, field: createErrorField } : null}
      dirty={createDirty}
      requireChanges
      blockReason={createBlockReason}
      onClose={closeCreateDialog}
      onSubmit={(event) => void handleCreateTutoringSubmit(event)}
      submitLabel="Crear tutoría"
      maxWidth="max-w-2xl"
      steps={createSteps}
    />

    {/* Editar tutoría (y activarla si está inactiva) */}
    <FormDialog
      open={Boolean(editingTutoringItem)}
      title="Editar tutoría"
      description={editingTutoringItem ? [editingTutoringItem.subject_name, editingTutoringItem.code, cycleLabel(editingTutoringItem.cycle_id, editingTutoringItem.cycle_name)].filter(Boolean).join(' · ') : ''}
      pending={editSaving}
      error={editError}
      dirty={editDirty}
      blockReason={editBlockReason}
      headerActions={editLocked && editingTutoringItem?.tutoring ? (
        <IconAction
          label="Activar tutoría"
          icon={PowerIcon}
          disabled={operation.pending}
          onClick={() => {
            const target = editingTutoringItem.tutoring
            if (!target) return
            void operation.run(
              () => tutoringApi.activateTutoring(target.id),
              'Tutoría activada.',
              async () => { setEditingTutoringItem(null); await list.reload() },
            )
          }}
        />
      ) : undefined}
      onClose={() => {
        if (!editSaving) {
          setEditingTutoringItem(null)
          setEditError(null)
          setEditErrorField(undefined)
        }
      }}
      onSubmit={(event) => void handleEditTutoringSubmit(event)}
      maxWidth="max-w-2xl"
    >
      {editingTutoringItem && (
        <>
          <TeacherSection
            prefix="edit"
            teachers={editTeachers}
            loading={editTeachersLoading}
            error={editTeachersError}
            fieldError={editFieldError('teacher_id')}
            value={editTeacherId}
            onChange={setEditTeacherId}
            conflicts={editConflicts}
            disabled={editLocked}
          />
          <ScheduleSection
            prefix="edit"
            rows={editScheduleRows}
            error={editFieldError('schedules')}
            showErrors={editAttempted}
            onChange={setEditScheduleRows}
            disabled={editLocked}
          />
          <ParallelField prefix="edit" parallels={editSubjectParallels} value={editParallelIds} onChange={setEditParallelIds} disabled={editLocked} showErrors={editAttempted} serverError={editFieldError('parallel_ids', 'cycle_id')} />
        </>
      )}
    </FormDialog>

    <ConfirmModal
      open={Boolean(deletingTutoring)}
      title="¿Eliminar tutoría?"
      description={`Se eliminará «${deletingTutoring?.subject_name ?? ''}${deletingTutoring?.section_name ? ` · Paralelo ${deletingTutoring.section_name}` : ''}» con sus horarios. Si ya tiene estudiantes o registros no se puede eliminar: desactívala.`}
      confirmLabel="Eliminar tutoría"
      pending={operation.pending}
      onClose={() => { if (!operation.pending) setDeletingTutoring(null) }}
      onConfirm={() => {
        const target = deletingTutoring
        if (!target) return
        void operation.run(
          () => tutoringApi.deleteTutoring(target.id),
          'Tutoría eliminada',
          async () => { detail.close(); await list.reload() },
        ).finally(() => setDeletingTutoring(null))
      }}
    />
    <ErrorModal open={Boolean(operation.errorModal)} onClose={operation.clearErrorModal} title={operation.errorModal?.title} description={operation.errorModal?.description} />
  </section>
}

const DEFAULT_TIMES = { start_time: '08:00', end_time: '10:00' }

/** Una franja del horario: un día con su hora de inicio y de fin (una sola por día). */
type ScheduleRow = { day: string; start_time: string; end_time: string }

const defaultScheduleRows = (): ScheduleRow[] => [{ day: 'lunes', ...DEFAULT_TIMES }]

/** Franjas guardadas: una por día, en el orden en que llegan (la última de cada día manda). */
function rowsFromSchedules(schedules: readonly TutoringSchedule[]): ScheduleRow[] {
  const rows: ScheduleRow[] = []
  for (const schedule of schedules) {
    const row = { day: schedule.day, start_time: schedule.start_time.slice(0, 5), end_time: schedule.end_time.slice(0, 5) }
    const index = rows.findIndex((item) => item.day === schedule.day)
    if (index >= 0) rows[index] = row
    else rows.push(row)
  }
  return rows
}

// Huella del horario (orden de las filas irrelevante) para detectar cambios reales.
function scheduleSignature(rows: readonly ScheduleRow[]): string {
  return JSON.stringify(rows.map((row) => [row.day, row.start_time, row.end_time].join('|')).sort())
}

// Primer error de validación del formulario de tutoría (o null si es válido).
function validateTutoringForm({ teacherId, rows, parallelRequired, parallelIds, conflicts }: Readonly<{
  teacherId: string
  rows: readonly ScheduleRow[]
  parallelRequired: boolean
  parallelIds: readonly string[]
  conflicts: readonly ScheduleConflict[]
}>): string | null {
  if (!teacherId) return 'Selecciona un docente para la tutoría.'
  if (rows.length === 0) return 'Agrega al menos un horario para la tutoría.'
  for (const [index, row] of rows.entries()) {
    if (!row.day) return 'Selecciona el día de cada horario.'
    const dayLabel = DAY_LABELS[row.day] ?? row.day
    if (rows.findIndex((item) => item.day === row.day) !== index) return `El día ${dayLabel} ya tiene un horario.`
    if (!row.start_time || !row.end_time) return `Selecciona la hora de inicio y fin para el día ${dayLabel}.`
    if (row.start_time >= row.end_time) return `En ${dayLabel}, la hora de fin debe ser posterior a la hora de inicio.`
  }
  if (parallelRequired && parallelIds.length === 0) return 'Selecciona el paralelo de la tutoría.'
  if (conflicts.length > 0) return describeConflicts(conflicts)
  return null
}

/**
 * Error en línea de una franja. Un rango imposible (fin antes del inicio) se marca en cuanto se
 * elige; lo que falta, solo tras intentar enviar.
 */
function scheduleRowError(row: ScheduleRow, showMissing: boolean): string | null {
  if (row.start_time && row.end_time && row.start_time >= row.end_time) return 'La hora de fin debe ser posterior a la de inicio.'
  if (!showMissing) return null
  if (!row.day) return 'Selecciona el día.'
  if (!row.start_time || !row.end_time) return 'Selecciona la hora de inicio y de fin.'
  return null
}

function timeOptions(current: string) {
  const all = current && !SCHEDULE_TIME_OPTIONS.includes(current) ? [...SCHEDULE_TIME_OPTIONS, current].sort() : SCHEDULE_TIME_OPTIONS
  return all.map((time) => ({ value: time, label: time }))
}

function TeacherSection({ prefix, teachers, loading, error, fieldError = null, value, onChange, conflicts = [], disabled = false }: Readonly<{
  prefix: 'create' | 'edit'
  teachers: readonly AvailableTeacher[]
  loading: boolean
  error: string | null
  /** Error del servidor sobre el docente (p. ej. un cruce de horario). */
  fieldError?: string | null
  value: string
  onChange: (value: string) => void
  /** Cruces de horario del docente elegido (al crear se muestran junto al horario). */
  conflicts?: readonly ScheduleConflict[]
  disabled?: boolean
}>) {
  return (
    <div className="flex flex-col gap-3">
      <ErrorNotice message={error} />
      <SelectField
        id={`${prefix}-tutoring-teacher`}
        label="Docente"
        required
        value={value}
        onValueChange={onChange}
        disabled={loading || disabled}
        placeholder={loading ? 'Cargando docentes…' : 'Selecciona un docente'}
        error={fieldError}
        options={teachers.map((teacher) => ({ value: String(teacher.id), label: teacher.name }))}
      />
      {loading && <span role="status" aria-label="Cargando docentes" className="sr-only">Cargando docentes</span>}
      {!loading && teachers.length === 0 && (
        <p className="text-sm text-muted-foreground">No se encontraron docentes activos.</p>
      )}
      <ScheduleConflictNotice conflicts={conflicts} />
    </div>
  )
}

/**
 * Horario: una fila por franja (día, desde, hasta y quitar) y «Agregar horario» debajo. Cada día
 * admite una sola franja, así que un día ya usado se ve deshabilitado en las demás filas.
 */
function ScheduleSection({ prefix, rows, onChange, disabled = false, error = null, showErrors = false }: Readonly<{
  prefix: 'create' | 'edit'
  rows: readonly ScheduleRow[]
  error?: string | null
  /** Tras intentar enviar: marca en rojo lo que falta en cada fila. */
  showErrors?: boolean
  onChange: (rows: ScheduleRow[]) => void
  disabled?: boolean
}>) {
  const numbered = rows.length > 1
  const suffix = (index: number) => (numbered ? ` (horario ${index + 1})` : '')
  const allDaysUsed = WEEK_DAYS.every((day) => rows.some((row) => row.day === day))

  function update(index: number, patch: Partial<ScheduleRow>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function add() {
    // La fila nueva toma las horas de la anterior: casi siempre solo cambia el día.
    const last = rows.at(-1)
    onChange([...rows, { day: '', start_time: last?.start_time || DEFAULT_TIMES.start_time, end_time: last?.end_time || DEFAULT_TIMES.end_time }])
  }

  return (
    <FormField id={`${prefix}-schedule-day-0`} label="Horario" required error={error}>
      <div className="flex flex-col gap-2">
        {rows.map((row, index) => {
          const rowError = scheduleRowError(row, showErrors)
          const usedElsewhere = new Set(rows.filter((_, i) => i !== index).map((item) => item.day))
          return (
            // Filas sin identidad propia: todos sus campos son controlados, así que la posición basta.
            <div key={index} className="flex flex-col gap-1">
              <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_minmax(0,1fr)_2rem] items-center gap-2">
                <SelectInput
                  id={`${prefix}-schedule-day-${index}`}
                  ariaLabel={`Día${suffix(index)}`}
                  value={row.day}
                  onValueChange={(day) => update(index, { day })}
                  placeholder="Día"
                  disabled={disabled}
                  invalid={Boolean(rowError) && !row.day}
                  options={WEEK_DAYS.map((day) => ({ value: day, label: DAY_LABELS[day] ?? day, disabled: usedElsewhere.has(day) }))}
                />
                <SelectInput
                  id={`${prefix}-schedule-start-${index}`}
                  ariaLabel={`Hora de inicio${suffix(index)}`}
                  value={row.start_time}
                  onValueChange={(value) => update(index, { start_time: value })}
                  placeholder="Desde"
                  disabled={disabled}
                  invalid={Boolean(rowError) && Boolean(row.day)}
                  options={timeOptions(row.start_time)}
                />
                <span className="text-sm text-muted-foreground">a</span>
                <SelectInput
                  id={`${prefix}-schedule-end-${index}`}
                  ariaLabel={`Hora de fin${suffix(index)}`}
                  value={row.end_time}
                  onValueChange={(value) => update(index, { end_time: value })}
                  placeholder="Hasta"
                  disabled={disabled}
                  invalid={Boolean(rowError) && Boolean(row.day)}
                  options={timeOptions(row.end_time)}
                />
                {numbered ? (
                  <Button type="button" variant="tertiary" tone="destructive" size="icon-sm" aria-label="Quitar horario" disabled={disabled} onClick={() => onChange(rows.filter((_, i) => i !== index))}>
                    <Trash2Icon />
                  </Button>
                ) : <span aria-hidden="true" />}
              </div>
              {rowError && <FieldError>{rowError}</FieldError>}
            </div>
          )
        })}
      </div>
      <Button type="button" variant="secondary" size="sm" className="self-start" disabled={disabled || allDaysUsed} onClick={add}>
        <PlusIcon data-icon="inline-start" />
        Agregar horario
      </Button>
    </FormField>
  )
}

type ParallelOption = { value: string; name: string }

/** Prefijo de la opción de un paralelo del catálogo que aún no tiene fila en el ciclo. */
const CATALOG_PARALLEL = 'p:'

const parallelLabel = (name: string) => name.replace(/^Paralelo\s+/i, '')

/** Paralelos del número de ciclo en la carrera: cada opción es la fila de ciclo con ese paralelo. */
function parallelCycles(cycles: readonly Cycle[], careerId: number, number: number): ParallelOption[] {
  return cycles
    .filter((c) => c.career_id === careerId && c.number === number && c.paralelo_id)
    .map((c) => ({ value: String(c.id), name: parallelLabel(c.paralelo_name ?? String(c.paralelo_id)) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/** Al crear: los paralelos que ya usa el ciclo (su fila) y los demás paralelos activos del catálogo. */
function tutoringParallelOptions(cycles: readonly Cycle[], sections: readonly Section[], careerId: number, number: number): ParallelOption[] {
  const used = new Set(cycles.filter((c) => c.career_id === careerId && c.number === number && c.paralelo_id).map((c) => c.paralelo_id))
  const fromCatalog = sections
    .filter((section) => section.is_active && !used.has(section.id))
    .map((section) => ({ value: `${CATALOG_PARALLEL}${section.id}`, name: parallelLabel(section.name) }))
  return [...parallelCycles(cycles, careerId, number), ...fromCatalog].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/** Fila base (sin paralelo) del número de ciclo; si no existe, cualquier fila de ese número sirve. */
function baseCycleId(cycles: readonly Cycle[], careerId: number, level: Cycle): number {
  return cycles.find((c) => c.career_id === careerId && c.number === level.number && c.status && !c.paralelo_id)?.id ?? level.id
}

function ParallelField({ prefix, parallels, value, onChange, disabled = false, onCreate, serverError = null, showErrors = false }: Readonly<{
  serverError?: string | null
  prefix: 'create' | 'edit'
  parallels: readonly ParallelOption[]
  value: readonly string[]
  onChange: (value: string[]) => void
  disabled?: boolean
  /** Al crear, permite registrar un paralelo nuevo aquí mismo (botón «+»). */
  onCreate?: (name: string) => Promise<void>
  /** Tras intentar enviar: marca en rojo si falta elegir el paralelo. */
  showErrors?: boolean
}>) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  function cancel() {
    setAdding(false)
    setNewName('')
    setCreateError(null)
  }

  async function create() {
    const name = newName.trim().toUpperCase()
    if (!onCreate || !name || creating) return
    setCreating(true)
    setCreateError(null)
    try {
      await onCreate(name)
      setNewName('')
      setAdding(false)
    } catch (caught) {
      setCreateError(describeError(caught))
    } finally {
      setCreating(false)
    }
  }

  const missing = showErrors && parallels.length > 0 && value.length === 0

  return (
    <FormField
      id={`${prefix}-tutoring-parallels`}
      label="Paralelo"
      // Igual que la validación: al crear siempre; al editar, si el ciclo tiene paralelos.
      required={prefix === 'create' || parallels.length > 0}
      error={serverError ?? (missing ? 'Selecciona el paralelo de la tutoría.' : null)}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {parallels.length > 0 ? (
          <div id={`${prefix}-tutoring-parallels`} className="flex flex-wrap gap-x-4 gap-y-2" role="radiogroup" aria-label="Paralelo">
            {parallels.map((parallel) => (
              <label key={parallel.value} className={cn('inline-flex items-center gap-2 text-sm', disabled && 'opacity-50')}>
                <input
                  type="radio"
                  name={`${prefix}-tutoring-parallel`}
                  value={parallel.value}
                  checked={value.includes(parallel.value)}
                  disabled={disabled}
                  onChange={() => onChange([parallel.value])}
                  className="size-4 accent-primary"
                />
                <span>Paralelo {parallel.name}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-warning">{onCreate ? 'Aún no hay paralelos registrados. Crea uno para continuar.' : 'Este ciclo aún no tiene paralelos registrados en la carrera.'}</p>
        )}
        {onCreate && !adding && (
          <Button type="button" variant="secondary" size="icon-sm" aria-label="Crear paralelo" disabled={disabled} onClick={() => setAdding(true)}>
            <PlusIcon />
          </Button>
        )}
      </div>
      {onCreate && adding && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <Input
              ref={inputRef}
              id={`${prefix}-tutoring-new-parallel`}
              aria-label="Nombre del nuevo paralelo"
              value={newName}
              onChange={(event) => { setNewName(sanitizeLetters(event.target.value, 50)); setCreateError(null) }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void create()
                } else if (event.key === 'Escape') {
                  // Escape cierra solo el campo, no el modal.
                  event.preventDefault()
                  event.stopPropagation()
                  if (!creating) cancel()
                }
              }}
              placeholder="Ej. C"
              maxLength={50}
              disabled={disabled || creating}
              aria-invalid={Boolean(createError)}
              className="h-8 max-w-40"
            />
            <Button type="button" variant="tertiary" size="icon-sm" aria-label="Guardar paralelo" disabled={disabled || creating || !newName.trim()} onClick={() => void create()}>
              {creating ? <Spinner /> : <CheckIcon />}
            </Button>
            <Button type="button" variant="tertiary" size="icon-sm" aria-label="Cancelar" disabled={creating} onClick={cancel}>
              <XIcon />
            </Button>
          </div>
          {createError && <p role="alert" className="text-xs text-destructive">{createError}</p>}
        </div>
      )}
    </FormField>
  )
}

function toScheduleItems(rows: readonly ScheduleRow[]): TutoringScheduleItem[] {
  return rows.filter((row) => row.day).map((row) => ({
    day: row.day,
    start_time: (row.start_time || DEFAULT_TIMES.start_time).slice(0, 5),
    end_time: (row.end_time || DEFAULT_TIMES.end_time).slice(0, 5),
  }))
}

function describeConflict(conflict: ScheduleConflict): string {
  return `${conflict.tutoring_name} (${DAY_LABELS[conflict.day] ?? conflict.day} de ${conflict.start_time} a ${conflict.end_time})`
}

function describeConflicts(conflicts: readonly ScheduleConflict[]): string {
  return `El docente ya tiene tutoría en ese horario: ${conflicts.map(describeConflict).join('; ')}. Elige otro horario u otro docente.`
}

function ScheduleConflictNotice({ conflicts }: Readonly<{ conflicts: readonly ScheduleConflict[] }>) {
  if (conflicts.length === 0) return null

  return (
    <div role="alert" className="rounded-md border border-notice-border bg-notice p-3 text-sm text-notice-foreground">
      <p className="font-semibold">El docente ya tiene tutoría en ese horario:</p>
      <ul className="mt-1 list-disc pl-4">
        {conflicts.map((conflict) => (
          <li key={`${conflict.tutoring_id}-${conflict.day}-${conflict.start_time}`}>{describeConflict(conflict)}</li>
        ))}
      </ul>
      <p className="mt-1">Elige otro horario u otro docente.</p>
    </div>
  )
}
