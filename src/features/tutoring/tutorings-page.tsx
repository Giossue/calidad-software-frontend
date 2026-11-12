import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  PlusIcon,
  PowerIcon,
} from 'lucide-react'
import { toast } from '@/lib/toast'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Button } from '@/components/ui/button'
import { ErrorModal } from '@/components/ui/error-modal'
import { ErrorNotice } from '@/components/ui/error-notice'
import { FormDialog, type FormStep } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { IconAction } from '@/components/ui/icon-action'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { useDetailParam } from '@/hooks/use-detail-param'
import { DetailPageSkeleton } from '@/components/ui/loading-skeletons'
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

/** Esqueleto de Tutorías: el mismo mientras cargan las carreras y la primera página. */
function TutoringsSkeleton() {
  return <ListScreenSkeleton label="Cargando tutorías" actions={2} filters={2} headers={TUTORING_HEADERS} />
}

/** Error del servidor de uno de estos campos (p. ej. `teacher_id`), para mostrarlo bajo el campo. */
function serverFieldError(error: string | null, field: string | undefined, ...names: readonly string[]): string | null {
  return error && field && names.some((name) => field === name || field.startsWith(`${name}.`)) ? error : null
}

function TutoringsWorkspace({ catalogs, careerId, onBack }: Readonly<{ catalogs: ReturnType<typeof useTutoringCatalogs>; careerId: number; onBack?: () => void }>) {
  const [cycleFilter, setCycleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('')
  const list = usePaginatedCatalog(
    (page, search) => tutoringApi.tutorings({
      page,
      search,
      career_id: careerId,
      cycle_number: Number(cycleFilter) || undefined,
      status: statusFilter || undefined,
    }),
    `${careerId}|${cycleFilter}|${statusFilter}`,
  )
  const [choosingTutoring, setChoosingTutoring] = useState(false)
  const [chooserCycle, setChooserCycle] = useState('')
  const [chooserSubjectId, setChooserSubjectId] = useState('')
  const operation = useOperation()
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
  const [createScheduleDays, setCreateScheduleDays] = useState<string[]>(['lunes'])
  const [createDayTimes, setCreateDayTimes] = useState<Record<string, { start_time: string; end_time: string }>>({
    lunes: { start_time: '08:00', end_time: '10:00' },
  })
  const [createParallelIds, setCreateParallelIds] = useState<string[]>([])
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
  const [editScheduleDays, setEditScheduleDays] = useState<string[]>(['lunes'])
  const [editDayTimes, setEditDayTimes] = useState<Record<string, { start_time: string; end_time: string }>>({
    lunes: { start_time: '08:00', end_time: '10:00' },
  })
  const [editOriginalSchedules, setEditOriginalSchedules] = useState<readonly TutoringSchedule[]>([])
  const [editParallelIds, setEditParallelIds] = useState<string[]>([])
  // Estado inicial del formulario de edición, para saber si hay cambios reales.
  const [editInitial, setEditInitial] = useState({ teacherId: '', schedule: '', parallel: '' })

  // Aviso previo de choques: el mismo docente no puede tener dos tutorías a la misma hora.
  const createSchedules = toScheduleItems(createScheduleDays, createDayTimes)
  const createConflicts = findScheduleConflicts(
    createTeachers.find((t) => String(t.id) === createTeacherId)?.busy_schedules ?? [],
    createSchedules,
    undefined,
    creatingTutoringSubject?.name,
  )
  const editSchedules = toScheduleItems(editScheduleDays, editDayTimes)
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


  // Volver a cargar docentes solo al cambiar de asignatura, no al actualizarla (p. ej. al crear un paralelo).
  const creatingSubjectId = creatingTutoringSubject?.id
  useEffect(() => {
    if (!creatingSubjectId) return
    let cancelled = false
    setCreateTeachersLoading(true)
    setCreateTeachersError(null)
    // Solo los docentes vinculados a la carrera.
    tutoringApi.availableTeachers('', undefined, careerId)
      .then((data) => { if (!cancelled) setCreateTeachers(data) })
      .catch((caught: unknown) => { if (!cancelled) setCreateTeachersError(describeError(caught)) })
      .finally(() => { if (!cancelled) setCreateTeachersLoading(false) })
    return () => { cancelled = true }
  }, [creatingSubjectId, careerId])

  /** Crea un paralelo para la asignatura sin salir del formulario y lo deja elegido. */
  async function createParallelForTutoring(name: string) {
    if (!creatingTutoringSubject || !creatingTutoringCycle) return
    const subject = creatingTutoringSubject
    const level = creatingTutoringCycle
    const subjectCycle = catalogs.cycles.find((cycle) => subject.cycle_ids.includes(cycle.id) && cycle.number === level.number) ?? level
    const before = new Set(subject.parallel_ids ?? [])
    const updated = await tutoringApi.assignSubjectParallel(subject.id, { new_parallel_name: name, cycle_id: subjectCycle.id })
    setCreatingTutoringSubject(updated)
    catalogs.reload()
    const created = (updated.parallel_ids ?? []).find((id) => !before.has(id))
    if (created) setCreateParallelIds([String(created)])
    toast.success(`Paralelo ${name} creado`)
  }

  function openCreateTutoring(subject: Subject, cycle: Cycle) {
    if (!subject.is_active) {
      toast.error('No se puede crear tutoría para una asignatura deshabilitada.')
      return
    }
    setCreatingTutoringSubject(subject)
    setCreatingTutoringCycle(cycle)
    setCreateTeacherId('')
    setCreateScheduleDays(['lunes'])
    setCreateDayTimes({
      lunes: { start_time: '08:00', end_time: '10:00' },
    })
    setCreateError(null)
    setCreateErrorField(undefined)

    const cycleIdsForLevel = catalogs.cycles
      .filter((c) => c.career_id === subject.career_id && (c.number === cycle.number || c.name === cycle.name))
      .map((c) => c.id)

    const subjParallelIds = catalogs.cycles
      .filter((c) => cycleIdsForLevel.includes(c.id) && subject.cycle_ids.includes(c.id) && c.paralelo_id)
      .map((c) => String(c.paralelo_id!))

    const directParallelIds = (subject.parallel_ids ?? []).map(String)
    const allRegisteredIds = Array.from(new Set([...subjParallelIds, ...directParallelIds]))

    // Cada paralelo es una tutoría con su propio docente: se elige uno solo.
    const initialParallels = allRegisteredIds.length === 1 ? allRegisteredIds : []
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

    const invalid = validateTutoringForm({ teacherId: createTeacherId, days: createScheduleDays, times: createDayTimes, parallelRequired: true, parallelIds: createParallelIds, conflicts: createConflicts })
    if (invalid) {
      setCreateError(invalid)
      return
    }

    setCreateSaving(true)
    setCreateError(null)
    setCreateErrorField(undefined)

    try {
      const activePeriod = catalogs.periods.find((p) => p.is_active) ?? catalogs.periods[0]
      const activeModality = catalogs.modalities.find((m) => m.is_active) ?? catalogs.modalities[0]

      const periodId = Number(creatingTutoringSubject.period_id || activePeriod?.id)
      const modalityId = Number(creatingTutoringSubject.modality_id || activeModality?.id)

      // Tutoría, docente y horarios se guardan juntos: si algo falla, no se crea nada.
      await tutoringApi.createTutoring({
        subject_id: creatingTutoringSubject.id,
        cycle_id: creatingTutoringCycle.id,
        parallel_ids: createParallelIds.map(Number),
        period_id: periodId,
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
    const days: string[] = []
    const dayTimes: Record<string, { start_time: string; end_time: string }> = {}
    existing.forEach((s) => {
      if (!days.includes(s.day)) days.push(s.day)
      dayTimes[s.day] = {
        start_time: s.start_time.slice(0, 5),
        end_time: s.end_time.slice(0, 5),
      }
    })
    setEditScheduleDays(days.length > 0 ? days : ['lunes'])
    setEditDayTimes(days.length > 0 ? dayTimes : { lunes: { start_time: '08:00', end_time: '10:00' } })
    setEditOriginalSchedules(existing)
    const initialDays = days.length > 0 ? days : DEFAULT_DAYS
    const initialTimes = days.length > 0 ? dayTimes : DEFAULT_TIMES_BY_DAY

    Promise.resolve(tutoringApi.schedules(item.tutoring.id))
      .then((data) => {
        if (!data || !Array.isArray(data)) return
        const freshActive = data.filter((s) => s.is_active)
        setEditOriginalSchedules(freshActive)
        if (freshActive.length > 0) {
          const freshDays: string[] = []
          const freshTimes: Record<string, { start_time: string; end_time: string }> = {}
          freshActive.forEach((s) => {
            if (!freshDays.includes(s.day)) freshDays.push(s.day)
            freshTimes[s.day] = {
              start_time: s.start_time.slice(0, 5),
              end_time: s.end_time.slice(0, 5),
            }
          })
          setEditScheduleDays(freshDays)
          setEditDayTimes(freshTimes)
          setEditInitial((prev) => ({ ...prev, schedule: scheduleSignature(freshDays, freshTimes) }))
        }
      })
      .catch(() => {})

    // Set initial parallels
    const parallelIds: string[] = []
    if (item.tutoring.section_id) {
      parallelIds.push(String(item.tutoring.section_id))
    }
    const currentCycle = catalogs.cycles.find((c) => c.id === item.cycle_id)
    if (currentCycle?.paralelo_id && !parallelIds.includes(String(currentCycle.paralelo_id))) {
      parallelIds.push(String(currentCycle.paralelo_id))
    }
    item.parallels.forEach((pName) => {
      const match = catalogs.sections.find((s) => s.name === pName)
      if (match && !parallelIds.includes(String(match.id))) {
        parallelIds.push(String(match.id))
      }
      const cycleMatch = catalogs.cycles.find((c) => c.paralelo_name === pName && c.paralelo_id)
      if (cycleMatch?.paralelo_id && !parallelIds.includes(String(cycleMatch.paralelo_id))) {
        parallelIds.push(String(cycleMatch.paralelo_id))
      }
    })
    setEditParallelIds(parallelIds.slice(0, 1))
    setEditInitial({ teacherId: item.teacher_id ? String(item.teacher_id) : '', schedule: scheduleSignature(initialDays, initialTimes), parallel: parallelIds.slice(0, 1).join(',') })
  }

  async function handleEditTutoringSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingTutoringItem || !editingTutoringItem.tutoring) return
    const currentTutoring = editingTutoringItem.tutoring

    const invalid = validateTutoringForm({ teacherId: editTeacherId, days: editScheduleDays, times: editDayTimes, parallelRequired: editSubjectParallels.length > 0, parallelIds: editParallelIds, conflicts: editConflicts })
    if (invalid) {
      setEditError(invalid)
      return
    }

    setEditSaving(true)
    setEditError(null)
    setEditErrorField(undefined)

    try {
      const targetParallelId = Number(editParallelIds[0])
      const matchingCycle = editParallelIds.length > 0
        ? catalogs.cycles.find((c) => c.career_id === editingTutoringItem.career_id && c.paralelo_id === targetParallelId)
        : undefined

      // Docente, paralelo y horarios se guardan juntos: si algo falla, no cambia nada.
      await tutoringApi.configureTutoring(currentTutoring.id, {
        teacher_id: Number(editTeacherId),
        ...(matchingCycle && matchingCycle.id !== currentTutoring.cycle_id ? { cycle_id: matchingCycle.id } : {}),
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
    tutoringApi.tutorings({ career_id: careerId, per_page: 100 })
      .then((response) => { if (!cancelled) setCareerTutorings(response.data) })
      .catch(() => { if (!cancelled) setCareerTutorings([]) })
    return () => { cancelled = true }
  }, [detail.id, inList, listLoading, careerId])

  const chooserLevel = cycleLevels.find((level) => String(level.number) === chooserCycle)
  const chooserCycleIds = chooserLevel
    ? catalogs.cycles.filter((c) => c.career_id === careerId && c.number === chooserLevel.number).map((c) => c.id)
    : []
  const chooserSubjects = subjects.filter((subj) => subj.career_id === careerId && subj.is_active && subj.cycle_ids.some((id) => chooserCycleIds.includes(id)))

  function openCreateChooser() {
    setChooserCycle(cycleFilter && cycleLevels.some((level) => String(level.number) === cycleFilter) ? cycleFilter : '')
    setChooserSubjectId('')
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

  /** Al elegir la asignatura se prepara la segunda fase (docente, horario y paralelo). */
  function chooseSubject(subjectId: string) {
    setChooserSubjectId(subjectId)
    const subject = chooserSubjects.find((item) => String(item.id) === subjectId)
    if (subject && chooserLevel) openCreateTutoring(subject, chooserLevel)
  }

  function chooseCycle(value: string) {
    setChooserCycle(value)
    setChooserSubjectId('')
    setCreatingTutoringSubject(null)
    setCreatingTutoringCycle(null)
  }

  const subjectParallelsForModal = useMemo(() => {
    if (!creatingTutoringSubject || !creatingTutoringCycle) return []

    const cycleIdsForLevel = catalogs.cycles
      .filter(
        (c) =>
          c.career_id === creatingTutoringSubject.career_id &&
          (c.number === creatingTutoringCycle.number || c.name === creatingTutoringCycle.name),
      )
      .map((c) => c.id)

    const fromCycles = catalogs.cycles
      .filter(
        (c) =>
          cycleIdsForLevel.includes(c.id) &&
          creatingTutoringSubject.cycle_ids.includes(c.id) &&
          c.paralelo_id &&
          c.paralelo_name,
      )
      .map((c) => ({
        id: c.paralelo_id!,
        name: c.paralelo_name!,
      }))

    const directParallels = (creatingTutoringSubject.parallel_ids ?? []).map((id) => {
      const section = catalogs.sections.find((s) => s.id === id)
      const cycleMatch = catalogs.cycles.find((c) => c.paralelo_id === id)
      return {
        id,
        name: section?.name || cycleMatch?.paralelo_name || String(id),
      }
    })

    const map = new Map<number, { id: number; name: string }>()
    fromCycles.forEach((p) => map.set(p.id, p))
    directParallels.forEach((p) => map.set(p.id, p))

    return Array.from(map.values())
  }, [creatingTutoringSubject, creatingTutoringCycle, catalogs.cycles, catalogs.sections])

  const editSubjectParallels = useMemo(() => {
    if (!editingTutoringItem) return []

    const targetSubject = editingTutoringItem.subject || subjects.find((s) => s.id === editingTutoringItem.subject_id)
    const targetCycle = catalogs.cycles.find((c) => c.id === editingTutoringItem.cycle_id)

    const cycleIdsForLevel = targetCycle
      ? catalogs.cycles
          .filter(
            (c) =>
              c.career_id === editingTutoringItem.career_id &&
              (c.number === targetCycle.number || c.name === targetCycle.name),
          )
          .map((c) => c.id)
      : [editingTutoringItem.cycle_id]

    const fromCycles = catalogs.cycles
      .filter(
        (c) =>
          cycleIdsForLevel.includes(c.id) &&
          (targetSubject ? targetSubject.cycle_ids.includes(c.id) : true) &&
          c.paralelo_id &&
          c.paralelo_name,
      )
      .map((c) => ({
        id: c.paralelo_id!,
        name: c.paralelo_name!,
      }))

    const directParallels = ((targetSubject?.parallel_ids) ?? []).map((id) => {
      const section = catalogs.sections.find((s) => s.id === id)
      const cycleMatch = catalogs.cycles.find((c) => c.paralelo_id === id)
      return {
        id,
        name: section?.name || cycleMatch?.paralelo_name || String(id),
      }
    })

    const map = new Map<number, { id: number; name: string }>()
    fromCycles.forEach((p) => map.set(p.id, p))
    directParallels.forEach((p) => map.set(p.id, p))

    if (editingTutoringItem.tutoring?.section_id && editingTutoringItem.tutoring?.section_name) {
      map.set(editingTutoringItem.tutoring.section_id, {
        id: editingTutoringItem.tutoring.section_id,
        name: editingTutoringItem.tutoring.section_name,
      })
    }

    return Array.from(map.values())
  }, [editingTutoringItem, subjects, catalogs.cycles, catalogs.sections])


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
  const chooserBlockReason = !chooserCycle ? 'Selecciona un ciclo.' : !chooserSubjectId ? 'Selecciona una asignatura.' : null
  const createBlockReason = creatingStep2
    ? validateTutoringForm({ teacherId: createTeacherId, days: createScheduleDays, times: createDayTimes, parallelRequired: true, parallelIds: createParallelIds, conflicts: createConflicts })
    : chooserBlockReason
  const createDirty = creatingStep2 && (
    createTeacherId !== ''
    || scheduleSignature(createScheduleDays, createDayTimes) !== scheduleSignature(DEFAULT_DAYS, DEFAULT_TIMES_BY_DAY)
    || createParallelIds.join(',') !== createInitialParallelIds.join(',')
  )

  const editLocked = Boolean(editingTutoringItem && !editingTutoringItem.tutoring?.is_active)
  const editDirty = Boolean(editingTutoringItem) && (
    editTeacherId !== editInitial.teacherId
    || scheduleSignature(editScheduleDays, editDayTimes) !== editInitial.schedule
    || editParallelIds.join(',') !== editInitial.parallel
  )
  const editBlockReason = editLocked
    ? 'Activa la tutoría para poder editarla.'
    : validateTutoringForm({ teacherId: editTeacherId, days: editScheduleDays, times: editDayTimes, parallelRequired: editSubjectParallels.length > 0, parallelIds: editParallelIds, conflicts: editConflicts })

  const cycleLabel = (cycleId: number, fallback: string) => {
    const number = catalogs.cycles.find((cycle) => cycle.id === cycleId)?.number
    return number ? `${number}° ciclo` : fallback
  }
  const createFieldError = (...names: readonly string[]) => serverFieldError(createError, createErrorField, ...names)
  const editFieldError = (...names: readonly string[]) => serverFieldError(editError, editErrorField, ...names)

  const createSteps: readonly FormStep[] = [
    {
      title: 'Ciclo y asignatura',
      blockReason: chooserBlockReason,
      fields: ['cycle_id', 'subject_id'],
      content: (
        <>
          <SelectField
            id="create-tutoring-cycle"
            label="Ciclo"
            required
            value={chooserCycle}
            onValueChange={chooseCycle}
            placeholder="Selecciona un ciclo"
            error={createFieldError('cycle_id')}
            options={cycleLevels.map((level) => ({ value: String(level.number), label: `${level.number}° ciclo` }))}
          />
          <SelectField
            id="create-tutoring-subject"
            label="Asignatura"
            required
            value={chooserSubjectId}
            onValueChange={chooseSubject}
            disabled={!chooserCycle}
            placeholder={chooserCycle ? 'Selecciona una asignatura' : 'Primero elige un ciclo'}
            error={createFieldError('subject_id')}
            options={chooserSubjects.map((subj) => ({ value: String(subj.id), label: subj.name }))}
          />
          {chooserCycle && chooserSubjects.length === 0 && <p className="text-xs text-muted-foreground">Este ciclo aún no tiene asignaturas activas. Regístralas primero en la Malla curricular.</p>}
        </>
      ),
    },
    {
      title: 'Docente, horario y paralelo',
      fields: ['teacher_id', 'schedules', 'parallel_ids'],
      content: creatingTutoringSubject && creatingTutoringCycle ? (
        <>
          <TeacherSection
            prefix="create"
            teachers={createTeachers}
            loading={createTeachersLoading}
            error={createTeachersError}
            fieldError={createFieldError('teacher_id')}
            value={createTeacherId}
            onChange={setCreateTeacherId}
            conflicts={createConflicts}
          />
          <ScheduleSection
            prefix="create"
            days={createScheduleDays}
            times={createDayTimes}
            error={createFieldError('schedules')}
            onChange={(days, times) => { setCreateScheduleDays(days); setCreateDayTimes(times) }}
          />
          <ParallelField prefix="create" parallels={subjectParallelsForModal} value={createParallelIds} onChange={setCreateParallelIds} onCreate={createParallelForTutoring} serverError={createFieldError('parallel_ids')} />
        </>
      ) : null,
    },
  ]

  return <section className="flex flex-col gap-6">
    {detailItem?.tutoring ? <TutoringDetail tutoring={detailItem.tutoring} schedules={detailItem.schedules ?? []} onBack={detail.close} onEdit={() => openEditTutoring(detailItem)} /> : tutoringNotFound ? (
      <div className="flex flex-col items-start gap-4">
        <p className="text-sm text-muted-foreground">No encontramos esta tutoría en la carrera.</p>
        <Button type="button" variant="secondary" onClick={detail.close}>Volver a tutorías</Button>
      </div>
    ) : detail.id !== null ? <DetailPageSkeleton label="Cargando tutoría" /> : list.isInitialLoading ? <TutoringsSkeleton /> : <>
      <CareerBreadcrumb root="Tutorías" career={careerName} onBack={onBack} />
      <ModuleHeader
        title="Tutorías"
        description={`Asigna docente, horario y paralelo a las tutorías de ${careerName}. Haz clic en una para abrirla.`}
        createLabel="Crear tutoría"
        onCreate={openCreateChooser}
        disabled={operation.pending || catalogs.loading || subjects.length === 0}
        extraActions={<RosterImportButton careerId={careerId} onFinished={list.reload} />}
      />
      <FilterBar
        id="tutorings"
        search={list.searchInput}
        onSearch={list.setSearchInput}
        searchPlaceholder="Busca por asignatura…"
        onClear={clearFilters}
        filters={[
          { id: 'cycle', label: 'Ciclo', value: cycleFilter, onChange: setCycleFilter, allLabel: 'Todos los ciclos', options: cycleLevels.map((level) => ({ value: String(level.number), label: `${level.number}° ciclo` })) },
          { id: 'status', label: 'Estado', value: statusFilter, onChange: (value) => setStatusFilter(value as '' | 'active' | 'inactive'), allLabel: 'Todos los estados', options: [{ value: 'active', label: 'Activas' }, { value: 'inactive', label: 'Inactivas' }] },
        ]}
      />
      <ErrorNotice message={list.error} retry={list.reload} />

      <RecordTable
        rows={rows}
        loading={list.isFetching || list.isInitialLoading}
        empty="Aún no hay tutorías para esta búsqueda. Usa «Crear tutoría» para registrar una."
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

    {/* Crear tutoría por pasos: primero ciclo y asignatura; luego docente, horario y paralelo */}
    <FormDialog
      open={choosingTutoring}
      title="Crear tutoría"
      description={creatingTutoringSubject && creatingTutoringCycle ? `${creatingTutoringSubject.name} · ${creatingTutoringCycle.number}° ciclo` : undefined}
      pending={createSaving}
      error={createError}
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
            days={editScheduleDays}
            times={editDayTimes}
            error={editFieldError('schedules')}
            onChange={(days, times) => { setEditScheduleDays(days); setEditDayTimes(times) }}
            disabled={editLocked}
          />
          <ParallelField prefix="edit" parallels={editSubjectParallels} value={editParallelIds} onChange={setEditParallelIds} disabled={editLocked} serverError={editFieldError('parallel_ids', 'cycle_id')} />
        </>
      )}
    </FormDialog>

    <ErrorModal open={Boolean(operation.errorModal)} onClose={operation.clearErrorModal} title={operation.errorModal?.title} description={operation.errorModal?.description} />
  </section>
}

const DEFAULT_TIMES = { start_time: '08:00', end_time: '10:00' }
const DEFAULT_DAYS = ['lunes']
const DEFAULT_TIMES_BY_DAY: DayTimes = { lunes: DEFAULT_TIMES }

type DayTimes = Record<string, { start_time: string; end_time: string }>

// Huella del horario (orden de días irrelevante) para detectar cambios reales.
function scheduleSignature(days: readonly string[], times: Readonly<Record<string, { start_time: string; end_time: string } | undefined>>): string {
  return JSON.stringify([...days].sort().map((day) => [day, times[day]?.start_time ?? DEFAULT_TIMES.start_time, times[day]?.end_time ?? DEFAULT_TIMES.end_time]))
}

// Primer error de validación del formulario de tutoría (o null si es válido).
function validateTutoringForm({ teacherId, days, times, parallelRequired, parallelIds, conflicts }: Readonly<{
  teacherId: string
  days: readonly string[]
  times: Readonly<Record<string, { start_time: string; end_time: string } | undefined>>
  parallelRequired: boolean
  parallelIds: readonly string[]
  conflicts: readonly ScheduleConflict[]
}>): string | null {
  if (!teacherId) return 'Selecciona un docente para la tutoría.'
  if (days.length === 0) return 'Selecciona al menos un día para el horario de la tutoría.'
  for (const day of days) {
    const dayTimes = times[day]
    const dayLabel = DAY_LABELS[day] ?? day
    if (!dayTimes?.start_time || !dayTimes?.end_time) return `Selecciona la hora de inicio y fin para el día ${dayLabel}.`
    if (dayTimes.start_time >= dayTimes.end_time) return `En ${dayLabel}, la hora de fin debe ser posterior a la hora de inicio.`
  }
  if (parallelRequired && parallelIds.length === 0) return 'Selecciona el paralelo de la tutoría.'
  if (conflicts.length > 0) return describeConflicts(conflicts)
  return null
}

function timeOptions(current: string) {
  const all = current && !SCHEDULE_TIME_OPTIONS.includes(current) ? [...SCHEDULE_TIME_OPTIONS, current].sort() : SCHEDULE_TIME_OPTIONS
  return all.map((time) => ({ value: time, label: time }))
}

function TeacherSection({ prefix, teachers, loading, error, fieldError = null, value, onChange, conflicts, disabled = false }: Readonly<{
  prefix: 'create' | 'edit'
  teachers: readonly AvailableTeacher[]
  loading: boolean
  error: string | null
  /** Error del servidor sobre el docente (p. ej. un cruce de horario). */
  fieldError?: string | null
  value: string
  onChange: (value: string) => void
  conflicts: readonly ScheduleConflict[]
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
 * Horario: se marcan los días y, por cada día marcado, su hora de inicio y de fin en una
 * sola línea. Sin recuadros anidados.
 */
function ScheduleSection({ prefix, days, times, onChange, disabled = false, error = null }: Readonly<{
  prefix: 'create' | 'edit'
  days: readonly string[]
  times: DayTimes
  error?: string | null
  onChange: (days: string[], times: DayTimes) => void
  disabled?: boolean
}>) {
  function toggleDay(day: string) {
    if (days.includes(day)) {
      onChange(days.filter((d) => d !== day), times)
      return
    }
    const ref = days[0] ? times[days[0]] : undefined
    onChange([...days, day], { ...times, [day]: times[day] ?? { start_time: ref?.start_time || DEFAULT_TIMES.start_time, end_time: ref?.end_time || DEFAULT_TIMES.end_time } })
  }

  function setTime(day: string, key: 'start_time' | 'end_time', value: string) {
    onChange([...days], { ...times, [day]: { ...(times[day] ?? DEFAULT_TIMES), [key]: value } })
  }

  // Los días marcados se listan en el orden de la semana.
  const orderedDays = WEEK_DAYS.filter((day) => days.includes(day))

  return (
    <FormField id={`${prefix}-schedule-days`} label="Horario" required error={error}>
      <div id={`${prefix}-schedule-days`} className="flex flex-wrap gap-x-4 gap-y-2" role="group" aria-label="Días de la semana">
        {WEEK_DAYS.map((day) => (
          <label key={day} className={cn('inline-flex items-center gap-2 text-sm', disabled && 'opacity-50')}>
            <input
              type="checkbox"
              value={day}
              checked={days.includes(day)}
              disabled={disabled}
              onChange={() => toggleDay(day)}
              className="size-4 accent-primary"
            />
            {DAY_LABELS[day]}
          </label>
        ))}
      </div>
      {orderedDays.length > 0 ? (
        <div className="flex flex-col gap-2">
          {orderedDays.map((day) => {
            const dayLabel = DAY_LABELS[day] ?? day
            const currentTimes = times[day] ?? DEFAULT_TIMES
            return (
              <div key={day} className="grid grid-cols-[6rem_1fr_auto_1fr] items-center gap-2">
                <span className="text-sm font-medium">{dayLabel}</span>
                <SelectField
                  id={`${prefix}-schedule-start-${day}`}
                  label={days.length === 1 ? 'Hora de inicio' : `Hora de inicio (${dayLabel})`}
                  labelClassName="sr-only"
                  value={currentTimes.start_time}
                  onValueChange={(value) => setTime(day, 'start_time', value)}
                  placeholder="Inicio"
                  disabled={disabled}
                  options={timeOptions(currentTimes.start_time)}
                />
                <span className="text-sm text-muted-foreground">a</span>
                <SelectField
                  id={`${prefix}-schedule-end-${day}`}
                  label={days.length === 1 ? 'Hora de fin' : `Hora de fin (${dayLabel})`}
                  labelClassName="sr-only"
                  value={currentTimes.end_time}
                  onValueChange={(value) => setTime(day, 'end_time', value)}
                  placeholder="Fin"
                  disabled={disabled}
                  options={timeOptions(currentTimes.end_time)}
                />
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-warning">Marca al menos un día.</p>
      )}
    </FormField>
  )
}

function ParallelField({ prefix, parallels, value, onChange, disabled = false, onCreate, serverError = null }: Readonly<{
  serverError?: string | null
  prefix: 'create' | 'edit'
  parallels: readonly { id: number; name: string }[]
  value: readonly string[]
  onChange: (value: string[]) => void
  disabled?: boolean
  /** Si la asignatura no tiene paralelos, permite crear uno aquí mismo. */
  onCreate?: (name: string) => Promise<void>
}>) {
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  async function create() {
    const name = newName.trim().toUpperCase()
    if (!onCreate || !name || creating) return
    setCreating(true)
    setCreateError(null)
    try {
      await onCreate(name)
      setNewName('')
    } catch (caught) {
      setCreateError(describeError(caught))
    } finally {
      setCreating(false)
    }
  }

  return (
    <FormField
      id={`${prefix}-tutoring-parallels`}
      label="Paralelo"
      // Igual que la validación: al crear siempre; al editar, si la asignatura tiene paralelos.
      required={prefix === 'create' || parallels.length > 0}
     
      error={serverError ?? (parallels.length > 0 && value.length === 0 ? 'Selecciona el paralelo de la tutoría.' : null)}
    >
      {parallels.length > 0 ? (
        <div id={`${prefix}-tutoring-parallels`} className="flex flex-wrap gap-x-4 gap-y-2" role="radiogroup" aria-label="Paralelo">
          {parallels.map((parallel) => {
            const isChecked = value.includes(String(parallel.id))
            return (
              <label key={parallel.id} className={cn('inline-flex items-center gap-2 text-sm', disabled && 'opacity-50')}>
                <input
                  type="radio"
                  name={`${prefix}-tutoring-parallel`}
                  value={parallel.id}
                  checked={isChecked}
                  disabled={disabled}
                  onChange={() => onChange([String(parallel.id)])}
                  className="size-4 accent-primary"
                />
                <span>Paralelo {parallel.name}</span>
              </label>
            )
          })}
        </div>
      ) : onCreate ? (
        <div className="flex flex-col gap-2 pt-1">
          <p className="text-sm text-warning">
            Esta asignatura aún no tiene paralelos. Crea uno para continuar.
          </p>
          <div className="flex items-start gap-2">
            <Input
              id={`${prefix}-tutoring-new-parallel`}
              aria-label="Nombre del nuevo paralelo"
              value={newName}
              onChange={(event) => { setNewName(sanitizeLetters(event.target.value, 50)); setCreateError(null) }}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void create() } }}
              placeholder="Ej. A"
              maxLength={50}
              disabled={disabled || creating}
              aria-invalid={Boolean(createError)}
              className="max-w-40"
            />
            <Button type="button" variant="secondary" disabled={disabled || creating || !newName.trim()} onClick={() => void create()}>
              {creating ? <Spinner data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
              Crear paralelo
            </Button>
          </div>
          {createError && <p role="alert" className="text-xs text-destructive">{createError}</p>}
        </div>
      ) : (
        <p className="text-sm text-warning">
          Esta asignatura no tiene paralelos registrados previamente.
        </p>
      )}
    </FormField>
  )
}

function toScheduleItems(
  days: readonly string[],
  times: Readonly<Record<string, { start_time: string; end_time: string } | undefined>>,
): TutoringScheduleItem[] {
  return days.map((day) => ({
    day,
    start_time: (times[day]?.start_time ?? '08:00').slice(0, 5),
    end_time: (times[day]?.end_time ?? '10:00').slice(0, 5),
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
