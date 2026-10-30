import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowRightIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  EyeIcon,
  PlusIcon,
  PowerIcon,
  UserPlusIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { ErrorModal } from '@/components/ui/error-modal'
import { ErrorNotice } from '@/components/ui/error-notice'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { IconAction } from '@/components/ui/icon-action'
import { SelectField } from '@/components/ui/select-field'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { findScheduleConflicts, type ScheduleConflict } from '@/lib/schedule-conflicts'
import { DAY_LABELS, tutoringApi, WEEK_DAYS, type AvailableTeacher, type Cycle, type Subject, type Tutoring, type TutoringSchedule, type TutoringScheduleItem } from '@/lib/tutoring-api'
import { cn } from '@/lib/utils'
import { TutoringDetail } from './tutoring-detail'
import { CareerBreadcrumb, CareerPicker, useSelectedCareer } from './career-picker'
import { FilterBar } from './filter-bar'
import { ModuleHeader, RecordTable } from './tutoring-shared'
import { describeError, useOperation, useTutoringCatalogs } from './tutoring-hooks'

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

  return <CareerPicker catalogs={catalogs} title="Tutorías" rowTitle={(career) => `Ver tutorías de ${career.name}`} onSelect={(career) => selection.select(career.id)} />
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
  const [detail, setDetail] = useState<Tutoring | null>(null)

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
  )
  const editSchedules = toScheduleItems(editScheduleDays, editDayTimes)
  const editConflicts = findScheduleConflicts(
    editTeachers.find((t) => String(t.id) === editTeacherId)?.busy_schedules ?? [],
    editSchedules,
    editingTutoringItem?.tutoring?.id,
  )
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Collapsible cycle groups state

  // View Parallels and Schedules modals state
  const [viewingScheduleItem, setViewingScheduleItem] = useState<TutoringRowItem | null>(null)

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


  useEffect(() => {
    if (!creatingTutoringSubject) return
    let cancelled = false
    setCreateTeachersLoading(true)
    setCreateTeachersError(null)
    tutoringApi.availableTeachers('')
      .then((data) => { if (!cancelled) setCreateTeachers(data) })
      .catch((caught: unknown) => { if (!cancelled) setCreateTeachersError(describeError(caught)) })
      .finally(() => { if (!cancelled) setCreateTeachersLoading(false) })
    return () => { cancelled = true }
  }, [creatingTutoringSubject])

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

      toast.success('Tutoría creada con éxito con docente y horario asignados.')
      setCreatingTutoringSubject(null)
      setCreatingTutoringCycle(null)
      setChoosingTutoring(false)
      await list.reload()
      setSubjectsRevision((prev) => prev + 1)
    } catch (caught) {
      setCreateError(describeError(caught))
    } finally {
      setCreateSaving(false)
    }
  }

  function openEditTutoring(item: TutoringRowItem) {
    if (!item.tutoring) return
    setEditingTutoringItem(item)
    setEditTeacherId(item.teacher_id ? String(item.teacher_id) : '')
    setEditError(null)

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
    Promise.resolve(tutoringApi.availableTeachers(''))
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

      toast.success('Tutoría actualizada con éxito.')
      setEditingTutoringItem(null)
      await list.reload()
      setSubjectsRevision((prev) => prev + 1)
    } catch (caught) {
      setEditError(describeError(caught))
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

  const rows: TutoringRowItem[] = list.data
    .filter((t) => t.subject_is_active !== false)
    .map((t) => {
      const subj = subjects.find((item) => item.id === t.subject_id) ?? null
      const parallelNames = Array.from(new Set([
        ...catalogs.cycles
          .filter((c) => c.career_id === careerId && c.number === (catalogs.cycles.find((cycle) => cycle.id === t.cycle_id)?.number) && subj?.cycle_ids.includes(c.id) && c.paralelo_name)
          .map((c) => c.paralelo_name!),
        ...(t.section_name ? [t.section_name] : []),
      ]))
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
    })

  const chooserLevel = cycleLevels.find((level) => String(level.number) === chooserCycle)
  const chooserCycleIds = chooserLevel
    ? catalogs.cycles.filter((c) => c.career_id === careerId && c.number === chooserLevel.number).map((c) => c.id)
    : []
  const chooserSubjects = subjects.filter((subj) => subj.career_id === careerId && subj.is_active && subj.cycle_ids.some((id) => chooserCycleIds.includes(id)))

  function openCreateChooser() {
    setChooserCycle(cycleFilter && cycleLevels.some((level) => String(level.number) === cycleFilter) ? cycleFilter : '')
    setChooserSubjectId('')
    setCreateError(null)
    setChoosingTutoring(true)
  }

  function closeCreateDialog() {
    if (createSaving) return
    setCreatingTutoringSubject(null)
    setCreatingTutoringCycle(null)
    setChoosingTutoring(false)
    setCreateError(null)
  }

  function continueCreate() {
    const subject = chooserSubjects.find((item) => String(item.id) === chooserSubjectId)
    if (!subject || !chooserLevel) return
    openCreateTutoring(subject, chooserLevel)
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
      render: (item: TutoringRowItem) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">{item.subject_name}</span>
          <span className="text-xs text-muted-foreground">{item.modality_name || 'Presencial'}</span>
        </div>
      ),
    },
    ...(cycleFilter === '' ? [{
      label: 'Ciclo',
      render: (item: TutoringRowItem) => {
        const number = catalogs.cycles.find((cycle) => cycle.id === item.cycle_id)?.number
        return number ? <Badge variant="outline">{number}°</Badge> : <span className="text-muted-foreground">—</span>
      },
    }] : []),
    {
      label: 'Paralelo(s)',
      render: (item: TutoringRowItem) => item.parallels.length > 0
        ? <div className="flex flex-wrap gap-1.5">{item.parallels.map((name) => <Badge key={name} variant="outline" title={`Paralelo ${name}`}>{name.replace(/^Paralelo\s+/i, '')}</Badge>)}</div>
        : <span className="text-muted-foreground">—</span>,
    },
    {
      label: 'Docente',
      render: (item: TutoringRowItem) => (
        <div className="flex flex-col gap-1 items-start">
          {item.teacher_name ? (
            <>
              <span className="font-medium text-foreground">{item.teacher_name}</span>
              {item.teacher_id && !item.teacher_is_active && (
                <span className="text-xs text-destructive">Docente inactivo: requiere reasignación</span>
              )}
            </>
          ) : (
            <span className="text-xs text-amber-600 dark:text-amber-400">Sin docente asignado</span>
          )}
        </div>
      ),
    },
    {
      label: 'Estado',
      render: (item: TutoringRowItem) => <StatusBadge active={item.is_active} activeLabel="Activa" inactiveLabel="Inactiva" />,
    },
    {
      // Acciones de dominio (ver horario, supervisar): editar y activar viven en el modal de la fila.
      label: 'Acciones',
      render: (item: TutoringRowItem) => (
        <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
          <IconAction label={`Ver horario de ${item.subject_name}`} icon={CalendarClockIcon} onClick={() => setViewingScheduleItem(item)} />
          <IconAction label={`Supervisar ${item.subject_name}`} icon={EyeIcon} disabled={operation.pending || !item.tutoring} onClick={() => setDetail(item.tutoring)} />
        </div>
      ),
    },
  ]

  const creatingStep2 = Boolean(creatingTutoringSubject && creatingTutoringCycle)
  const createBlockReason = creatingStep2
    ? validateTutoringForm({ teacherId: createTeacherId, days: createScheduleDays, times: createDayTimes, parallelRequired: true, parallelIds: createParallelIds, conflicts: createConflicts })
    : !chooserCycle ? 'Selecciona un ciclo.' : !chooserSubjectId ? 'Selecciona una asignatura.' : null
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

  return <section className="flex flex-col gap-6">
    {detail ? <TutoringDetail tutoring={detail} onBack={() => setDetail(null)} /> : <>
      <CareerBreadcrumb root="Tutorías" career={careerName} onBack={onBack} />
      <ModuleHeader
        title={careerName}
        createLabel="Crear tutoría"
        onCreate={openCreateChooser}
        disabled={operation.pending || catalogs.loading || subjects.length === 0}
      />
      <FilterBar
        id="tutorings"
        search={list.searchInput}
        onSearch={list.setSearchInput}
        searchPlaceholder="Busca por asignatura…"
        onClear={clearFilters}
        filters={[
          { id: 'cycle', label: 'Ciclo', value: cycleFilter, onChange: setCycleFilter, allLabel: 'Todos', options: cycleLevels.map((level) => ({ value: String(level.number), label: `${level.number}° ${level.name}` })) },
          { id: 'status', label: 'Estado', value: statusFilter, onChange: (value) => setStatusFilter(value as '' | 'active' | 'inactive'), allLabel: 'Todos', options: [{ value: 'active', label: 'Activas' }, { value: 'inactive', label: 'Inactivas' }] },
        ]}
      />
      <ErrorNotice message={list.error} retry={list.reload} />

      <RecordTable
        rows={rows}
        loading={list.isFetching || list.isInitialLoading}
        empty="Aún no hay tutorías para esta búsqueda. Usa «Crear tutoría» para registrar una."
        columns={columns}
        onRowClick={openEditTutoring}
        rowTitle={(item) => `Editar tutoría de ${item.subject_name}`}
        isRowSelected={(item) => editingTutoringItem?.id === item.id}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Mostrando {rows.length} de {list.meta?.total ?? rows.length} {(list.meta?.total ?? rows.length) === 1 ? 'tutoría' : 'tutorías'}
        </p>
        <CatalogPagination label="tutorías" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
      </div>
    </>}

    {/* Crear tutoría: primero se elige ciclo y asignatura, luego docente, horario y paralelo */}
    <FormDialog
      open={choosingTutoring}
      title="Crear tutoría"
      description={creatingTutoringSubject && creatingTutoringCycle ? `${creatingTutoringSubject.name} · ${creatingTutoringCycle.name}` : 'Elige el ciclo y la asignatura de la tutoría.'}
      pending={createSaving}
      error={createError}
      dirty={createDirty}
      requireChanges={creatingStep2}
      blockReason={createBlockReason}
      onClose={closeCreateDialog}
      onSubmit={creatingStep2 ? (event) => void handleCreateTutoringSubmit(event) : (event) => { event.preventDefault(); continueCreate() }}
      submitLabel={creatingStep2 ? 'Crear tutoría' : 'Continuar'}
      submitIcon={creatingStep2 ? PlusIcon : ArrowRightIcon}
      maxWidth="max-w-2xl"
    >
      {!creatingStep2 && (
        <>
          <SelectField
            id="create-tutoring-cycle"
            label="Ciclo"
            value={chooserCycle}
            onValueChange={(value) => { setChooserCycle(value); setChooserSubjectId('') }}
            placeholder="Selecciona un ciclo"
            options={cycleLevels.map((level) => ({ value: String(level.number), label: `${level.number}° ${level.name}` }))}
          />
          <SelectField
            id="create-tutoring-subject"
            label="Asignatura"
            value={chooserSubjectId}
            onValueChange={setChooserSubjectId}
            disabled={!chooserCycle}
            placeholder={chooserCycle ? 'Selecciona una asignatura' : 'Primero elige un ciclo'}
            options={chooserSubjects.map((subj) => ({ value: String(subj.id), label: subj.name }))}
          />
          {chooserCycle && chooserSubjects.length === 0 && <p className="text-xs text-muted-foreground">Este ciclo aún no tiene asignaturas activas. Regístralas primero en Asignaturas.</p>}
        </>
      )}
      {creatingTutoringSubject && creatingTutoringCycle && (
        <>
          <SubjectSummary
            name={creatingTutoringSubject.name}
            code={creatingTutoringSubject.code}
            cycle={creatingTutoringCycle.name}
            career={catalogs.careers.find((c) => c.id === creatingTutoringSubject.career_id)?.name}
            period={catalogs.periods.find((p) => p.is_active)?.name ?? 'PAO actual'}
          />
          <TeacherSection
            prefix="create"
            title="Asignar docente"
            teachers={createTeachers}
            loading={createTeachersLoading}
            error={createTeachersError}
            value={createTeacherId}
            onChange={setCreateTeacherId}
            conflicts={createConflicts}
          />
          <ScheduleSection
            prefix="create"
            days={createScheduleDays}
            times={createDayTimes}
            onChange={(days, times) => { setCreateScheduleDays(days); setCreateDayTimes(times) }}
          />
          <ParallelField prefix="create" parallels={subjectParallelsForModal} value={createParallelIds} onChange={setCreateParallelIds} />
        </>
      )}
    </FormDialog>

    {/* Editar tutoría (y activarla si está inactiva) */}
    <FormDialog
      open={Boolean(editingTutoringItem)}
      title="Editar tutoría"
      description={editingTutoringItem ? `${editingTutoringItem.subject_name} · ${editingTutoringItem.cycle_name}` : ''}
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
        }
      }}
      onSubmit={(event) => void handleEditTutoringSubmit(event)}
      maxWidth="max-w-2xl"
    >
      {editingTutoringItem && (
        <>
          <SubjectSummary
            name={editingTutoringItem.subject_name}
            code={editingTutoringItem.code}
            cycle={editingTutoringItem.cycle_name}
            career={editingTutoringItem.career_name}
            period={editingTutoringItem.period_name || catalogs.periods.find((p) => p.is_active)?.name || 'PAO actual'}
          />
          <TeacherSection
            prefix="edit"
            title="Docente"
            teachers={editTeachers}
            loading={editTeachersLoading}
            error={editTeachersError}
            value={editTeacherId}
            onChange={setEditTeacherId}
            conflicts={editConflicts}
            disabled={editLocked}
          />
          <ScheduleSection
            prefix="edit"
            days={editScheduleDays}
            times={editDayTimes}
            onChange={(days, times) => { setEditScheduleDays(days); setEditDayTimes(times) }}
            disabled={editLocked}
          />
          <ParallelField prefix="edit" parallels={editSubjectParallels} value={editParallelIds} onChange={setEditParallelIds} disabled={editLocked} />
        </>
      )}
    </FormDialog>

    {/* Horarios de la tutoría (solo lectura) */}
    <Dialog
      open={Boolean(viewingScheduleItem)}
      title="Horarios de la asignatura"
      description={viewingScheduleItem ? `${viewingScheduleItem.subject_name} · ${viewingScheduleItem.cycle_name}` : ''}
      confirmClose={false}
      onClose={() => setViewingScheduleItem(null)}
      maxWidth="max-w-md"
    >
      {viewingScheduleItem && (() => {
        const activeSchedules = viewingScheduleItem.schedules?.filter((s) => s.is_active) ?? []

        return (
          <div className="flex flex-col gap-4">
            {activeSchedules.length > 0 ? (
              <div className="flex flex-col gap-2" role="list" aria-label="Lista de horarios">
                {activeSchedules.map((s) => (
                  <Card
                    key={s.id}
                    role="listitem"
                    className="flex items-center justify-between p-3 shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-medium text-sm">
                        <CalendarClockIcon className="size-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">
                          {DAY_LABELS[s.day] ?? s.day}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                          {s.room && s.room !== 'Por asignar' ? ` · Aula: ${s.room}` : ''}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-muted/30 border border-dashed text-center">
                <p className="text-sm text-muted-foreground">Esta asignatura no tiene horarios registrados aún.</p>
              </div>
            )}

            <div className="flex items-center justify-end pt-2 border-t">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setViewingScheduleItem(null)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        )
      })()}
    </Dialog>
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

function SubjectSummary({ name, code, cycle, career, period }: Readonly<{ name: string; code: string | null; cycle: string; career?: string; period: string }>) {
  return (
    <div className="rounded-lg bg-muted/40 p-3.5 border flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">Materia seleccionada</span>
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-foreground">{name}</span>
        {code && <Badge variant="secondary" className="font-mono text-xs">{code}</Badge>}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{cycle}</span>
        <span>·</span>
        <span>{career}</span>
        <span>·</span>
        <span>{period}</span>
      </div>
    </div>
  )
}

function TeacherSection({ prefix, title, teachers, loading, error, value, onChange, conflicts, disabled = false }: Readonly<{
  prefix: 'create' | 'edit'
  title: string
  teachers: readonly AvailableTeacher[]
  loading: boolean
  error: string | null
  value: string
  onChange: (value: string) => void
  conflicts: readonly ScheduleConflict[]
  disabled?: boolean
}>) {
  return (
    <Card className="flex flex-col gap-3 p-3.5 shadow-none">
      <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
        <UserPlusIcon className="size-4 text-primary" />
        {title}
      </h4>
      {error && <ErrorNotice message={error} />}
      {loading && <Skeleton role="status" aria-label="Cargando docentes" className="h-4 w-40" />}
      <SelectField
        id={`${prefix}-tutoring-teacher`}
        label="Docente"
        value={value}
        onValueChange={onChange}
        disabled={loading || disabled}
        placeholder="Selecciona un docente"
        options={teachers.map((teacher) => ({ value: String(teacher.id), label: teacher.name }))}
      />
      {!loading && teachers.length === 0 && (
        <p className="text-xs text-muted-foreground">No se encontraron docentes activos.</p>
      )}
      <ScheduleConflictNotice conflicts={conflicts} />
    </Card>
  )
}

const CHIP_BASE = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium cursor-pointer transition-colors select-none'
const CHIP_ON = 'bg-primary/10 border-primary text-primary dark:bg-primary/20'
const CHIP_OFF = 'bg-background hover:bg-accent text-foreground border-input'

function ScheduleSection({ prefix, days, times, onChange, disabled = false }: Readonly<{
  prefix: 'create' | 'edit'
  days: readonly string[]
  times: DayTimes
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

  return (
    <Card className="flex flex-col gap-3 p-3.5 shadow-none">
      <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
        <CalendarClockIcon className="size-4 text-primary" />
        Horario de tutoría
      </h4>

      <FormField id={`${prefix}-schedule-days`} label="Selección de días" tip="Puedes seleccionar varios días y configurar horas diferentes según el día.">
        <div id={`${prefix}-schedule-days`} className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Días de la semana">
          {WEEK_DAYS.map((day) => {
            const isChecked = days.includes(day)
            return (
              <label key={day} className={cn(CHIP_BASE, isChecked ? CHIP_ON : CHIP_OFF, disabled && 'pointer-events-none opacity-60')}>
                <input
                  type="checkbox"
                  value={day}
                  checked={isChecked}
                  disabled={disabled}
                  onChange={() => toggleDay(day)}
                  className="size-4 rounded border-input text-primary focus:ring-primary/20"
                />
                <span>{DAY_LABELS[day]}</span>
              </label>
            )
          })}
        </div>
      </FormField>

      <div className="flex flex-col gap-3 pt-1">
        {days.map((day) => {
          const dayLabel = DAY_LABELS[day] ?? day
          const currentTimes = times[day] ?? DEFAULT_TIMES
          return (
            <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-muted/20">
              <div className="sm:w-28 flex items-center gap-2 font-medium text-sm text-foreground shrink-0">
                <CalendarDaysIcon className="size-4 text-primary" />
                <span>{dayLabel}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 flex-1">
                <SelectField
                  id={`${prefix}-schedule-start-${day}`}
                  label={days.length === 1 ? 'Hora de inicio' : `Hora de inicio (${dayLabel})`}
                  value={currentTimes.start_time}
                  onValueChange={(value) => setTime(day, 'start_time', value)}
                  placeholder="Selecciona hora"
                  disabled={disabled}
                  options={timeOptions(currentTimes.start_time)}
                />
                <SelectField
                  id={`${prefix}-schedule-end-${day}`}
                  label={days.length === 1 ? 'Hora de fin' : `Hora de fin (${dayLabel})`}
                  value={currentTimes.end_time}
                  onValueChange={(value) => setTime(day, 'end_time', value)}
                  placeholder="Selecciona hora"
                  disabled={disabled}
                  options={timeOptions(currentTimes.end_time)}
                />
              </div>
            </div>
          )
        })}
        {days.length === 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Selecciona al menos un día arriba para configurar su horario.
          </p>
        )}
      </div>
    </Card>
  )
}

function ParallelField({ prefix, parallels, value, onChange, disabled = false }: Readonly<{
  prefix: 'create' | 'edit'
  parallels: readonly { id: number; name: string }[]
  value: readonly string[]
  onChange: (value: string[]) => void
  disabled?: boolean
}>) {
  return (
    <FormField
      id={`${prefix}-tutoring-parallels`}
      label="Paralelo de la tutoría"
      tip="Cada paralelo es una tutoría con su propio docente."
      error={parallels.length > 0 && value.length === 0 ? 'Selecciona el paralelo de la tutoría.' : null}
    >
      {parallels.length > 0 ? (
        <div id={`${prefix}-tutoring-parallels`} className="flex flex-wrap gap-2 pt-1" role="radiogroup" aria-label="Paralelo">
          {parallels.map((parallel) => {
            const isChecked = value.includes(String(parallel.id))
            return (
              <label key={parallel.id} className={cn(CHIP_BASE, isChecked ? CHIP_ON : CHIP_OFF, disabled && 'pointer-events-none opacity-60')}>
                <input
                  type="radio"
                  name={`${prefix}-tutoring-parallel`}
                  value={parallel.id}
                  checked={isChecked}
                  disabled={disabled}
                  onChange={() => onChange([String(parallel.id)])}
                  className="size-4 border-input text-primary focus:ring-primary/20"
                />
                <span>Paralelo {parallel.name}</span>
              </label>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
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
    <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
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
