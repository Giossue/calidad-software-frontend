import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  BookOpenIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  PowerOffIcon,
  UserPlusIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { DAY_LABELS, tutoringApi, WEEK_DAYS, type AvailableTeacher, type Cycle, type Subject, type Tutoring, type TutoringSchedule } from '@/lib/tutoring-api'
import { cn } from '@/lib/utils'
import { TutoringDetail } from './tutoring-detail'
import { FilterBar } from './filter-bar'
import { ErrorNotice, ModuleHeader, RecordTable, ScopeNotice, SelectField } from './tutoring-shared'
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
  const [careerFilter, setCareerFilter] = useState('')
  const [cycleFilter, setCycleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('')
  const list = usePaginatedCatalog(
    (page, search) => tutoringApi.tutorings({
      page,
      search,
      career_id: Number(careerFilter) || undefined,
      cycle_id: Number(cycleFilter) || undefined,
      status: statusFilter || undefined,
    }),
    `${careerFilter}|${cycleFilter}|${statusFilter}`,
  )
  const operation = useOperation()
  const [subjects, setSubjects] = useState<readonly Subject[]>([])
  const [subjectsRevision, setSubjectsRevision] = useState(0)
  const [detail, setDetail] = useState<Tutoring | null>(null)
  const [deactivating, setDeactivating] = useState<Tutoring | null>(null)

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
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Collapsible cycle groups state
  const [expandedCycles, setExpandedCycles] = useState<Record<string, boolean>>({})

  // View Parallels and Schedules modals state
  const [viewingParallelsItem, setViewingParallelsItem] = useState<TutoringRowItem | null>(null)
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
    tutoringApi.availableTeachers('', undefined, creatingTutoringSubject.career_id)
      .then((data) => { if (!cancelled) setCreateTeachers(data) })
      .catch((caught: unknown) => { if (!cancelled) setCreateTeachersError(describeError(caught)) })
      .finally(() => { if (!cancelled) setCreateTeachersLoading(false) })
    return () => { cancelled = true }
  }, [creatingTutoringSubject])

  function isExpanded(cycleKey: string) {
    return expandedCycles[cycleKey] ?? true
  }

  function toggleExpand(cycleKey: string) {
    setExpandedCycles((prev) => ({
      ...prev,
      [cycleKey]: !(prev[cycleKey] ?? true),
    }))
  }

  function expandAll() {
    const next: Record<string, boolean> = {}
    uniqueCycleLevels.forEach((c) => {
      next[String(c.number || c.name)] = true
    })
    next['unassigned'] = true
    setExpandedCycles(next)
  }

  function collapseAll() {
    const next: Record<string, boolean> = {}
    uniqueCycleLevels.forEach((c) => {
      next[String(c.number || c.name)] = false
    })
    next['unassigned'] = false
    setExpandedCycles(next)
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

    const cycleIdsForLevel = catalogs.cycles
      .filter((c) => c.career_id === subject.career_id && (c.number === cycle.number || c.name === cycle.name))
      .map((c) => c.id)

    const subjParallelIds = catalogs.cycles
      .filter((c) => cycleIdsForLevel.includes(c.id) && subject.cycle_ids.includes(c.id) && c.paralelo_id)
      .map((c) => String(c.paralelo_id!))

    const directParallelIds = (subject.parallel_ids ?? []).map(String)
    const allRegisteredIds = Array.from(new Set([...subjParallelIds, ...directParallelIds]))

    setCreateParallelIds(allRegisteredIds)
  }

  async function handleCreateTutoringSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!creatingTutoringSubject || !creatingTutoringCycle) return

    if (!creatingTutoringSubject.is_active) {
      setCreateError('La asignatura seleccionada está deshabilitada y no puede tener nuevas tutorías.')
      return
    }

    if (!createTeacherId) {
      setCreateError('Selecciona un docente para la tutoría.')
      return
    }
    if (createScheduleDays.length === 0) {
      setCreateError('Selecciona al menos un día para el horario de la tutoría.')
      return
    }
    for (const day of createScheduleDays) {
      const times = createDayTimes[day]
      const dayLabel = DAY_LABELS[day] ?? day
      if (!times?.start_time || !times?.end_time) {
        setCreateError(`Selecciona la hora de inicio y fin para el día ${dayLabel}.`)
        return
      }
      if (times.start_time >= times.end_time) {
        setCreateError(`En ${dayLabel}, la hora de fin debe ser posterior a la hora de inicio.`)
        return
      }
    }
    if (createParallelIds.length === 0) {
      setCreateError('Selecciona al menos un paralelo para la tutoría.')
      return
    }

    setCreateSaving(true)
    setCreateError(null)

    try {
      const activePeriod = catalogs.periods.find((p) => p.is_active) ?? catalogs.periods[0]
      const activeModality = catalogs.modalities.find((m) => m.is_active) ?? catalogs.modalities[0]

      const periodId = Number(creatingTutoringSubject.period_id || activePeriod?.id)
      const modalityId = Number(creatingTutoringSubject.modality_id || activeModality?.id)

      // 1. Create the tutoring
      const created = await tutoringApi.createTutoring({
        subject_id: creatingTutoringSubject.id,
        cycle_id: creatingTutoringCycle.id,
        parallel_ids: createParallelIds.map(Number),
        period_id: periodId,
        modality_id: modalityId,
      })

      // 2. Assign the selected teacher
      await tutoringApi.assignTeacher(created.id, Number(createTeacherId))

      // 3. Create the schedule for each selected day
      for (const day of createScheduleDays) {
        const times = createDayTimes[day] ?? { start_time: '08:00', end_time: '10:00' }
        await tutoringApi.createSchedule(created.id, {
          day,
          start_time: times.start_time.slice(0, 5),
          end_time: times.end_time.slice(0, 5),
          room: 'Por asignar',
        })
      }

      toast.success('Tutoría creada con éxito con docente y horario asignados.')
      setCreatingTutoringSubject(null)
      setCreatingTutoringCycle(null)
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
    Promise.resolve(tutoringApi.availableTeachers('', undefined, item.career_id))
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
    setEditParallelIds(parallelIds)
  }

  async function handleEditTutoringSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingTutoringItem || !editingTutoringItem.tutoring) return
    const currentTutoring = editingTutoringItem.tutoring

    if (!editTeacherId) {
      setEditError('Selecciona un docente para la tutoría.')
      return
    }
    if (editScheduleDays.length === 0) {
      setEditError('Selecciona al menos un día para el horario de la tutoría.')
      return
    }
    for (const day of editScheduleDays) {
      const times = editDayTimes[day]
      const dayLabel = DAY_LABELS[day] ?? day
      if (!times?.start_time || !times?.end_time) {
        setEditError(`Selecciona la hora de inicio y fin para el día ${dayLabel}.`)
        return
      }
      if (times.start_time >= times.end_time) {
        setEditError(`En ${dayLabel}, la hora de fin debe ser posterior a la hora de inicio.`)
        return
      }
    }
    if (editSubjectParallels.length > 0 && editParallelIds.length === 0) {
      setEditError('Selecciona al menos un paralelo para la tutoría.')
      return
    }

    setEditSaving(true)
    setEditError(null)

    try {
      // 1. Assign/change teacher if changed
      if (Number(editTeacherId) !== currentTutoring.teacher_id) {
        await tutoringApi.assignTeacher(currentTutoring.id, Number(editTeacherId))
      }

      // 2. Assign/change parallel if changed
      if (editParallelIds.length > 0) {
        const targetParallelId = Number(editParallelIds[0])
        const matchingCycle = catalogs.cycles.find(
          (c) =>
            c.career_id === editingTutoringItem.career_id &&
            c.paralelo_id === targetParallelId,
        )
        if (matchingCycle && matchingCycle.id !== currentTutoring.cycle_id) {
          await tutoringApi.assignTutoringCycle(currentTutoring.id, matchingCycle.id)
        }
      }

      // 3. Update schedules
      const daysToKeep = new Set(editScheduleDays)
      for (const orig of editOriginalSchedules) {
        if (!daysToKeep.has(orig.day)) {
          await tutoringApi.deactivateSchedule(currentTutoring.id, orig.id)
        }
      }

      for (const day of editScheduleDays) {
        const times = editDayTimes[day] ?? { start_time: '08:00', end_time: '10:00' }
        const existing = editOriginalSchedules.find((s) => s.day === day && s.is_active)
        const startTime = times.start_time.slice(0, 5)
        const endTime = times.end_time.slice(0, 5)

        if (existing) {
          if (existing.start_time.slice(0, 5) !== startTime || existing.end_time.slice(0, 5) !== endTime) {
            await tutoringApi.updateSchedule(currentTutoring.id, existing.id, {
              day,
              start_time: startTime,
              end_time: endTime,
              room: existing.room || 'Por asignar',
            })
          }
        } else {
          await tutoringApi.createSchedule(currentTutoring.id, {
            day,
            start_time: startTime,
            end_time: endTime,
            room: 'Por asignar',
          })
        }
      }

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



  function onCareerFilterChange(value: string) {
    setCareerFilter(value)
    const current = cycleFilter ? catalogs.cycles.find((cycle) => String(cycle.id) === cycleFilter) : null
    if (cycleFilter && (!value || !current || current.career_id !== Number(value))) setCycleFilter('')
  }

  function clearFilters() {
    setCareerFilter('')
    setCycleFilter('')
    setStatusFilter('')
  }

  const currentCareerId = Number(careerFilter || catalogs.careers[0]?.id)

  const careerCycles = catalogs.cycles.filter(
    (cycle) => cycle.status && (currentCareerId ? cycle.career_id === currentCareerId : true),
  )
  const uniqueCycleLevels = Array.from(
    new Map(careerCycles.map((c) => [c.number || c.name, c])).values(),
  ).sort((a, b) => (a.number || 0) - (b.number || 0))

  const cycleGroups = uniqueCycleLevels.map((cycleLevel) => {
    const cycleIdsForLevel = catalogs.cycles
      .filter(
        (c) =>
          c.career_id === currentCareerId &&
          (c.number === cycleLevel.number || c.name === cycleLevel.name),
      )
      .map((c) => c.id)

    const parallelsInLevel = Array.from(
      new Map(
        catalogs.cycles
          .filter(
            (c) =>
              c.career_id === currentCareerId &&
              (c.number === cycleLevel.number || c.name === cycleLevel.name) &&
              c.paralelo_id &&
              c.paralelo_name,
          )
          .map((c) => [c.paralelo_id!, c.paralelo_name!]),
      ).values(),
    )

    const subjectsInCycle = subjects
      .filter((subj) => subj.is_active)
      .filter(
        (subj) => subj.cycle_ids && subj.cycle_ids.some((id) => cycleIdsForLevel.includes(id)),
      )

    const items: TutoringRowItem[] = []
    const attachedTutoringIds = new Set<number>()

    subjectsInCycle.forEach((subj) => {
      const matchingTutorings = list.data.filter(
        (t) => (t.subject_id === subj.id || (!t.subject_id && t.subject_name === subj.name)) && cycleIdsForLevel.includes(t.cycle_id),
      )

      const subjCycleParallels = catalogs.cycles
        .filter((c) => cycleIdsForLevel.includes(c.id) && subj.cycle_ids.includes(c.id) && c.paralelo_name)
        .map((c) => c.paralelo_name!)

      const subjDirectParallels = (subj.parallel_ids ?? []).map((id) => {
        const section = catalogs.sections.find((s) => s.id === id)
        const cycleMatch = catalogs.cycles.find((c) => c.paralelo_id === id)
        return section?.name || cycleMatch?.paralelo_name || String(id)
      })

      const subjParallels = Array.from(new Set([...subjCycleParallels, ...subjDirectParallels]))

      if (matchingTutorings.length > 0) {
        matchingTutorings.forEach((t) => {
          attachedTutoringIds.add(t.id)
          items.push({
            id: `tutoring-${t.id}`,
            subject_id: subj.id,
            subject_name: t.subject_name || subj.name,
            code: subj.code ?? null,
            career_id: t.career_id || subj.career_id,
            career_name: catalogs.careers.find((c) => c.id === (t.career_id || subj.career_id))?.name ?? subj.career_name,
            cycle_id: t.cycle_id,
            cycle_name: t.cycle_name,
            period_name: t.period_name || subj.period_name || '',
            modality_name: t.modality_name || subj.modality_name || '',
            section_name: t.section_name ?? null,
            parallels: subjParallels.length > 0 ? subjParallels : (t.section_name ? [t.section_name] : []),
            teacher_id: t.teacher_id,
            teacher_name: t.teacher_name,
            teacher_is_active: t.teacher_is_active,
            schedules: t.schedules,
            is_active: t.is_active,
            tutoring: t,
            subject: subj,
          })
        })
      } else {
        items.push({
          id: `subject-${subj.id}`,
          subject_id: subj.id,
          subject_name: subj.name,
          code: subj.code ?? null,
          career_id: subj.career_id,
          career_name: subj.career_name || (catalogs.careers.find((c) => c.id === subj.career_id)?.name ?? ''),
          cycle_id: cycleLevel.id,
          cycle_name: cycleLevel.name,
          period_name: subj.period_name || '',
          modality_name: subj.modality_name || '',
          section_name: null,
          parallels: subjParallels,
          teacher_id: null,
          teacher_name: null,
          teacher_is_active: null,
          schedules: [],
          is_active: subj.is_active,
          tutoring: null,
          subject: subj,
        })
      }
    })

    // Also include any tutorings returned for this cycle that were not attached to a subject in `subjects`
    list.data
      .filter((t) => cycleIdsForLevel.includes(t.cycle_id) && !attachedTutoringIds.has(t.id) && t.subject_is_active !== false)
      .forEach((t) => {
        items.push({
          id: `tutoring-${t.id}`,
          subject_id: t.subject_id,
          subject_name: t.subject_name,
          code: null,
          career_id: t.career_id,
          career_name: catalogs.careers.find((c) => c.id === t.career_id)?.name ?? '',
          cycle_id: t.cycle_id,
          cycle_name: t.cycle_name,
          period_name: t.period_name,
          modality_name: t.modality_name,
          section_name: t.section_name ?? null,
          parallels: t.section_name ? [t.section_name] : [],
          teacher_id: t.teacher_id,
          teacher_name: t.teacher_name,
          teacher_is_active: t.teacher_is_active,
          schedules: t.schedules,
          is_active: t.is_active,
          tutoring: t,
          subject: null,
        })
      })

    return {
      cycle: cycleLevel,
      cycleKey: String(cycleLevel.number || cycleLevel.name),
      cycleIds: cycleIdsForLevel,
      items,
      parallels: parallelsInLevel,
    }
  })

  const allLevelCycleIds = new Set(cycleGroups.flatMap((g) => g.cycleIds))
  const unassignedTutorings: TutoringRowItem[] = list.data
    .filter((t) => !allLevelCycleIds.has(t.cycle_id) && t.subject_is_active !== false)
    .map((t) => ({
      id: `tutoring-${t.id}`,
      subject_id: t.subject_id,
      subject_name: t.subject_name,
      code: null,
      career_id: t.career_id,
      career_name: catalogs.careers.find((c) => c.id === t.career_id)?.name ?? '',
      cycle_id: t.cycle_id,
      cycle_name: t.cycle_name,
      period_name: t.period_name,
      modality_name: t.modality_name,
      section_name: t.section_name ?? null,
      parallels: t.section_name ? [t.section_name] : [],
      teacher_id: t.teacher_id,
      teacher_name: t.teacher_name,
      teacher_is_active: t.teacher_is_active,
      schedules: t.schedules,
      is_active: t.is_active,
      tutoring: t,
      subject: null,
    }))

  const displayedGroups = cycleFilter
    ? cycleGroups.filter((g) => g.cycleIds.includes(Number(cycleFilter)))
    : cycleGroups

  const totalItemsCount = displayedGroups.reduce((acc, g) => acc + g.items.length, 0) + unassignedTutorings.length


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


  const cycleFilterOptions = careerFilter ? catalogs.cycles.filter((cycle) => cycle.career_id === Number(careerFilter)) : []

  const renderTutoringColumns = (groupCycle?: Cycle) => [
    {
      label: 'Código',
      render: (item: TutoringRowItem) =>
        item.code ? (
          <Badge variant="secondary" className="font-mono text-xs">{item.code}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      label: 'Asignatura',
      render: (item: TutoringRowItem) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">{item.subject_name}</span>
          <span className="text-xs text-muted-foreground">
            {item.period_name ? `${item.period_name} · ` : ''}{item.modality_name || 'Presencial'}
          </span>
        </div>
      ),
    },
    {
      label: 'Carrera',
      render: (item: TutoringRowItem) => item.career_name,
    },
    {
      label: 'Paralelo(s)',
      render: (item: TutoringRowItem) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setViewingParallelsItem(item)}
          aria-label={`Ver paralelos de ${item.subject_name}`}
          className="h-7 text-xs font-medium text-primary border-primary/30 hover:bg-primary/10"
        >
          Ver Paralelos
        </Button>
      ),
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
          ) : item.tutoring ? (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Sin docente asignado</span>
          ) : (
            <span className="text-xs text-muted-foreground italic">Sin tutoría</span>
          )}
        </div>
      ),
    },
    {
      label: 'Horario',
      render: (item: TutoringRowItem) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setViewingScheduleItem(item)}
          aria-label={`Ver horario de ${item.subject_name}`}
          className="h-7 text-xs font-medium text-primary border-primary/30 hover:bg-primary/10"
        >
          Ver Horario
        </Button>
      ),
    },
    {
      label: 'Estado',
      render: (item: TutoringRowItem) =>
        item.tutoring ? (
          <StatusBadge active={item.tutoring.is_active} activeLabel="Activa" inactiveLabel="Inactiva" />
        ) : (
          <Badge variant="outline" className="text-xs font-normal text-muted-foreground">Sin tutoría</Badge>
        ),
    },
    {
      label: 'Acciones',
      render: (item: TutoringRowItem) => {
        const targetCycle = groupCycle || catalogs.cycles.find((c) => c.id === item.cycle_id) || catalogs.cycles[0]
        const targetSubject: Subject = item.subject || {
          id: item.subject_id ?? 0,
          career_id: item.career_id,
          career_name: item.career_name,
          code: item.code,
          name: item.subject_name,
          is_active: item.is_active,
          cycle_ids: [item.cycle_id],
          modality_name: item.modality_name,
          period_name: item.period_name,
        }

        return (
          <div className="flex items-center gap-1">
            {targetSubject.is_active && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openCreateTutoring(targetSubject, targetCycle)}
                aria-label={`Crear tutoría para ${item.subject_name}`}
                className="h-8 text-xs font-medium gap-1 text-primary border-primary/30 hover:bg-primary/10"
              >
                <PlusIcon className="size-3.5" />
                Crear tutoría
              </Button>
            )}

            {item.tutoring && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="Supervisar"
                  aria-label={`Supervisar ${item.subject_name}`}
                  disabled={operation.pending}
                  onClick={() => setDetail(item.tutoring)}
                >
                  <CalendarDaysIcon />
                </Button>
                {item.tutoring.is_active && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Más acciones para ${item.subject_name}`}
                        disabled={operation.pending}
                      >
                        <MoreVerticalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => openEditTutoring(item)}>
                        <PencilIcon />Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => {
                          operation.clearError()
                          setDeactivating(item.tutoring)
                        }}
                      >
                        <PowerOffIcon />Desactivar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {!item.tutoring.is_active && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Activar ${item.subject_name}`}
                    disabled={operation.pending}
                    onClick={() =>
                      void operation.run(
                        () => tutoringApi.activateTutoring(item.tutoring!.id),
                        'Tutoría activada.',
                        list.reload,
                      )
                    }
                  >
                    <PowerIcon data-icon="inline-start" />
                    Activar
                  </Button>
                )}
              </>
            )}
          </div>
        )
      },
    },
  ]

  return <section className="flex flex-col gap-6">
    {detail ? <TutoringDetail tutoring={detail} onBack={() => setDetail(null)} /> : <>
      <ModuleHeader
        title="Tutorías"
        description="Organiza las tutorías de tus carreras organizadas por ciclo académico, asigna docentes y supervisa horarios y asistencias."
      />
      <ScopeNotice catalogs={catalogs} />
      <FilterBar
        id="tutorings"
        search={list.searchInput}
        onSearch={list.setSearchInput}
        searchPlaceholder="Busca por asignatura…"
        onClear={clearFilters}
        filters={[
          { id: 'career', label: 'Carrera', value: careerFilter, onChange: onCareerFilterChange, allLabel: 'Todas mis carreras', options: catalogs.careers.map((career) => ({ value: String(career.id), label: career.name })) },
          { id: 'cycle', label: 'Ciclo', value: cycleFilter, onChange: setCycleFilter, allLabel: careerFilter ? 'Todos los ciclos' : 'Primero selecciona una carrera', disabled: !careerFilter, disabledReason: 'Selecciona primero una carrera para filtrar por ciclo.', options: cycleFilterOptions.map((cycle) => ({ value: String(cycle.id), label: `${cycle.name}${cycle.paralelo_name ? ` · ${cycle.paralelo_name}` : ''}` })) },
          { id: 'status', label: 'Estado', value: statusFilter, onChange: (value) => setStatusFilter(value as '' | 'active' | 'inactive'), allLabel: 'Todos', options: [{ value: 'active', label: 'Activas' }, { value: 'inactive', label: 'Inactivas' }] },
        ]}
      />
      <ErrorNotice message={list.error} retry={list.reload} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-muted-foreground">
        <div>
          Mostrando <strong className="text-foreground">{totalItemsCount}</strong> {totalItemsCount === 1 ? 'materia' : 'materias'} distribuidas en <strong className="text-foreground">{displayedGroups.length}</strong> {displayedGroups.length === 1 ? 'ciclo' : 'ciclos'}
        </div>
        {displayedGroups.length > 0 && (
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <Button type="button" variant="outline" size="sm" onClick={expandAll} className="text-xs h-7 px-2.5">
              Expandir todos
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={collapseAll} className="text-xs h-7 px-2.5">
              Colapsar todos
            </Button>
          </div>
        )}
      </div>

      {displayedGroups.length > 0 ? (
        <div className="flex flex-col gap-4">
          {displayedGroups.map((group) => (
            <div key={group.cycleKey} className="rounded-xl border bg-card shadow-xs overflow-hidden transition-all duration-200">
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleExpand(group.cycleKey)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(group.cycleKey) } }}
                className="flex items-center justify-between p-4 sm:p-5 bg-card hover:bg-accent/40 cursor-pointer select-none transition-colors border-b last:border-b-0"
                aria-expanded={isExpanded(group.cycleKey)}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={cn(
                    'size-8 rounded-lg flex items-center justify-center text-muted-foreground transition-transform duration-200',
                    isExpanded(group.cycleKey) && 'rotate-180 text-foreground',
                  )}>
                    <ChevronDownIcon className="size-4" />
                  </div>
                  <h3 className="font-display font-semibold text-base sm:text-lg tracking-tight text-foreground">
                    {group.cycle.name}
                  </h3>
                </div>
              </div>

              {isExpanded(group.cycleKey) && (
                <div className="p-3 sm:p-4 bg-muted/10">
                  {group.items.length > 0 ? (
                    <RecordTable
                      rows={group.items}
                      loading={list.isFetching || list.isInitialLoading}
                      empty="No hay asignaturas en este ciclo para la búsqueda actual."
                      columns={renderTutoringColumns(group.cycle)}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center rounded-lg border border-dashed bg-card/60">
                      <div className="size-10 rounded-full bg-muted flex items-center justify-center mb-2 text-muted-foreground">
                        <BookOpenIcon className="size-5" />
                      </div>
                      <p className="text-sm font-medium text-foreground">No hay materias registradas en {group.cycle.name}</p>
                      <p className="text-xs text-muted-foreground max-w-sm mt-0.5">
                        Las asignaturas de este ciclo aparecerán aquí para gestionar sus tutorías.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {unassignedTutorings.length > 0 && (
            <div className="rounded-xl border bg-card shadow-xs overflow-hidden transition-all duration-200">
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleExpand('unassigned')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand('unassigned') } }}
                className="flex items-center justify-between p-4 sm:p-5 bg-card hover:bg-accent/40 cursor-pointer select-none transition-colors border-b last:border-b-0"
                aria-expanded={isExpanded('unassigned')}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={cn(
                    'size-8 rounded-lg flex items-center justify-center text-muted-foreground transition-transform duration-200',
                    isExpanded('unassigned') && 'rotate-180 text-foreground',
                  )}>
                    <ChevronDownIcon className="size-4" />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-display font-semibold text-base sm:text-lg tracking-tight text-foreground">
                      Otras tutorías / Sin ciclo asignado
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {unassignedTutorings.length} {unassignedTutorings.length === 1 ? 'tutoría' : 'tutorías'}
                  </Badge>
                </div>
              </div>

              {isExpanded('unassigned') && (
                <div className="p-3 sm:p-4 bg-muted/10">
                  <RecordTable
                    rows={unassignedTutorings}
                    loading={list.isFetching || list.isInitialLoading}
                    empty="No hay tutorías sin ciclo asignado."
                    columns={renderTutoringColumns()}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <RecordTable
          rows={[]}
          loading={list.isFetching || list.isInitialLoading}
          empty="No se encontraron asignaturas ni tutorías para esta búsqueda."
          columns={renderTutoringColumns()}
        />
      )}

      <CatalogPagination label="tutorías" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
    </>}


    <ConfirmModal open={Boolean(deactivating)} title="¿Desactivar tutoría?" description={`La tutoría de «${deactivating?.subject_name ?? ''}» dejará de recibir nuevas asignaciones. Podrás seguir consultando sus asistencias e informes.`} confirmLabel="Desactivar tutoría" pending={operation.pending} onClose={() => { if (!operation.pending) setDeactivating(null) }} onConfirm={() => { if (deactivating) void operation.run(() => tutoringApi.deactivateTutoring(deactivating.id), 'Tutoría desactivada.', async () => { setDeactivating(null); await list.reload() }) }} />

    {/* Create Tutoring per Subject Dialog */}
    <Dialog
      open={Boolean(creatingTutoringSubject && creatingTutoringCycle)}
      title="Crear tutoría"
      description={`${creatingTutoringSubject?.name ?? ''} · ${creatingTutoringCycle?.name ?? ''}`}
      confirmClose={false}
      onClose={() => {
        if (!createSaving) {
          setCreatingTutoringSubject(null)
          setCreatingTutoringCycle(null)
          setCreateError(null)
        }
      }}
      maxWidth="max-w-2xl"
    >
      {creatingTutoringSubject && creatingTutoringCycle && (
        <form onSubmit={(e) => void handleCreateTutoringSubmit(e)} aria-label="Crear tutoría" className="flex flex-col gap-4">
          <div className="rounded-lg bg-muted/40 p-3.5 border flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Materia seleccionada</span>
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-foreground">{creatingTutoringSubject.name}</span>
              {creatingTutoringSubject.code && (
                <Badge variant="secondary" className="font-mono text-xs">{creatingTutoringSubject.code}</Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{creatingTutoringCycle.name}</span>
              <span>·</span>
              <span>{catalogs.careers.find((c) => c.id === creatingTutoringSubject.career_id)?.name}</span>
              <span>·</span>
              <span>{catalogs.periods.find((p) => p.is_active)?.name ?? 'PAO actual'}</span>
            </div>
          </div>

          <ErrorNotice message={createError} />

          {/* Docente (recuperando de docentes) */}
          <div className="flex flex-col gap-3 rounded-lg border p-3.5 bg-card">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <UserPlusIcon className="size-4 text-primary" />
              Asignar docente
            </h4>
            {createTeachersError && <ErrorNotice message={createTeachersError} />}
            {createTeachersLoading && (
              <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner aria-hidden="true" /> Cargando docentes…
              </p>
            )}
            <SelectField
              id="create-tutoring-teacher"
              label="Docente"
              value={createTeacherId}
              onChange={(val) => setCreateTeacherId(val)}
              disabled={createTeachersLoading}
            >
              <option value="">Selecciona un docente</option>
              {createTeachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </SelectField>
            {!createTeachersLoading && createTeachers.length === 0 && (
              <p className="text-xs text-muted-foreground">No se encontraron docentes activos.</p>
            )}
          </div>

          {/* Horario (selección de días y horas) */}
          <div className="flex flex-col gap-3 rounded-lg border p-3.5 bg-card">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <CalendarClockIcon className="size-4 text-primary" />
              Horario de tutoría
            </h4>

            <Field>
              <FieldLabel htmlFor="create-schedule-days">
                Selección de días <span className="text-xs font-normal text-muted-foreground">(puedes seleccionar varios)</span>
              </FieldLabel>
              <div id="create-schedule-days" className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Días de la semana">
                {WEEK_DAYS.map((day) => {
                  const isChecked = createScheduleDays.includes(day)
                  return (
                    <label
                      key={day}
                      className={cn(
                        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium cursor-pointer transition-colors select-none',
                        isChecked
                          ? 'bg-primary/10 border-primary text-primary dark:bg-primary/20'
                          : 'bg-background hover:bg-accent text-foreground border-input',
                      )}
                    >
                      <input
                        type="checkbox"
                        value={day}
                        checked={isChecked}
                        onChange={() => {
                          setCreateScheduleDays((prev) => {
                            if (prev.includes(day)) {
                              return prev.filter((d) => d !== day)
                            } else {
                              const ref = prev[0] ? createDayTimes[prev[0]] : undefined
                              setCreateDayTimes((times) => ({
                                ...times,
                                [day]: times[day] ?? {
                                  start_time: ref?.start_time || '08:00',
                                  end_time: ref?.end_time || '10:00',
                                },
                              }))
                              return [...prev, day]
                            }
                          })
                        }}
                        className="size-4 rounded border-input text-primary focus:ring-primary/20"
                      />
                      <span>{DAY_LABELS[day]}</span>
                    </label>
                  )
                })}
              </div>
            </Field>

            {/* Horario configurado individualmente según el día */}
            <div className="flex flex-col gap-3 pt-1">
              <span className="text-xs font-medium text-muted-foreground">
                Horario por día (puedes configurar horas diferentes según el día):
              </span>
              {createScheduleDays.map((day) => {
                const dayLabel = DAY_LABELS[day] ?? day
                const currentTimes = createDayTimes[day] ?? { start_time: '08:00', end_time: '10:00' }
                return (
                  <div
                    key={day}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-muted/20"
                  >
                    <div className="sm:w-28 flex items-center gap-2 font-semibold text-sm text-foreground shrink-0">
                      <CalendarDaysIcon className="size-4 text-primary" />
                      <span>{dayLabel}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 flex-1">
                      <SelectField
                        id={`create-schedule-start-${day}`}
                        label={createScheduleDays.length === 1 ? 'Hora de inicio' : `Hora de inicio (${dayLabel})`}
                        value={currentTimes.start_time}
                        onChange={(val) => {
                          setCreateDayTimes((prev) => ({
                            ...prev,
                            [day]: { ...(prev[day] ?? { end_time: '10:00' }), start_time: val },
                          }))
                        }}
                        required
                      >
                        <option value="">Selecciona hora</option>
                        {SCHEDULE_TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </SelectField>
                      <SelectField
                        id={`create-schedule-end-${day}`}
                        label={createScheduleDays.length === 1 ? 'Hora de fin' : `Hora de fin (${dayLabel})`}
                        value={currentTimes.end_time}
                        onChange={(val) => {
                          setCreateDayTimes((prev) => ({
                            ...prev,
                            [day]: { ...(prev[day] ?? { start_time: '08:00' }), end_time: val },
                          }))
                        }}
                        required
                      >
                        <option value="">Selecciona hora</option>
                        {SCHEDULE_TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </SelectField>
                    </div>
                  </div>
                )
              })}
              {createScheduleDays.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Selecciona al menos un día arriba para configurar su horario.
                </p>
              )}
            </div>
          </div>

          {/* Paralelo(s) de la asignatura registrados previamente */}
          <Field>
            <FieldLabel htmlFor="create-tutoring-parallels">
              Paralelo(s) de la asignatura <span className="text-xs font-normal text-muted-foreground">(registrados previamente al crear la asignatura)</span>
            </FieldLabel>

            {subjectParallelsForModal.length > 0 ? (
              <div id="create-tutoring-parallels" className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Paralelos">
                {subjectParallelsForModal.map((parallel) => {
                  const isChecked = createParallelIds.includes(String(parallel.id))
                  return (
                    <label
                      key={parallel.id}
                      className={cn(
                        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium cursor-pointer transition-colors select-none',
                        isChecked
                          ? 'bg-primary/10 border-primary text-primary dark:bg-primary/20'
                          : 'bg-background hover:bg-accent text-foreground border-input',
                      )}
                    >
                      <input
                        type="checkbox"
                        value={parallel.id}
                        checked={isChecked}
                        onChange={() => {
                          setCreateParallelIds((prev) =>
                            prev.includes(String(parallel.id))
                              ? prev.filter((id) => id !== String(parallel.id))
                              : [...prev, String(parallel.id)],
                          )
                        }}
                        className="size-4 rounded border-input text-primary focus:ring-primary/20"
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

            {subjectParallelsForModal.length > 0 && createParallelIds.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Selecciona al menos un paralelo para la tutoría.</p>
            )}
          </Field>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <DialogCancelButton onClick={() => setCreatingTutoringSubject(null)}>
              Cancelar
            </DialogCancelButton>
            <Button
              type="submit"
              disabled={
                createSaving ||
                !createTeacherId ||
                createScheduleDays.length === 0 ||
                !createScheduleDays.every((d) => {
                  const t = createDayTimes[d]
                  return t && t.start_time && t.end_time && t.start_time < t.end_time
                }) ||
                createParallelIds.length === 0
              }
              className="bg-brand-red hover:bg-brand-red/90 text-white font-semibold"
            >
              {createSaving && <Spinner data-icon="inline-start" />}
              Crear tutoría
            </Button>
          </div>
        </form>
      )}
    </Dialog>

    {/* Edit Tutoring per Subject Dialog */}
    <Dialog
      open={Boolean(editingTutoringItem)}
      title="Editar tutoría"
      description={editingTutoringItem ? `${editingTutoringItem.subject_name} · ${editingTutoringItem.cycle_name}` : ''}
      confirmClose={false}
      onClose={() => {
        if (!editSaving) {
          setEditingTutoringItem(null)
          setEditError(null)
        }
      }}
      maxWidth="max-w-2xl"
    >
      {editingTutoringItem && (
        <form onSubmit={(e) => void handleEditTutoringSubmit(e)} aria-label="Editar tutoría" className="flex flex-col gap-4">
          <div className="rounded-lg bg-muted/40 p-3.5 border flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Materia seleccionada</span>
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-foreground">{editingTutoringItem.subject_name}</span>
              {editingTutoringItem.code && (
                <Badge variant="secondary" className="font-mono text-xs">{editingTutoringItem.code}</Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{editingTutoringItem.cycle_name}</span>
              <span>·</span>
              <span>{editingTutoringItem.career_name}</span>
              <span>·</span>
              <span>{editingTutoringItem.period_name || catalogs.periods.find((p) => p.is_active)?.name || 'PAO actual'}</span>
            </div>
          </div>

          <ErrorNotice message={editError} />

          {/* Docente */}
          <div className="flex flex-col gap-3 rounded-lg border p-3.5 bg-card">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <UserPlusIcon className="size-4 text-primary" />
              Docente
            </h4>
            {editTeachersError && <ErrorNotice message={editTeachersError} />}
            {editTeachersLoading && (
              <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner aria-hidden="true" /> Cargando docentes…
              </p>
            )}
            <SelectField
              id="edit-tutoring-teacher"
              label="Docente"
              value={editTeacherId}
              onChange={(val) => setEditTeacherId(val)}
              disabled={editTeachersLoading}
            >
              <option value="">Selecciona un docente</option>
              {editTeachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </SelectField>
            {!editTeachersLoading && editTeachers.length === 0 && (
              <p className="text-xs text-muted-foreground">No se encontraron docentes activos.</p>
            )}
          </div>

          {/* Horario (selección de días y horas) */}
          <div className="flex flex-col gap-3 rounded-lg border p-3.5 bg-card">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <CalendarClockIcon className="size-4 text-primary" />
              Horario de tutoría
            </h4>

            <Field>
              <FieldLabel htmlFor="edit-schedule-days">
                Selección de días <span className="text-xs font-normal text-muted-foreground">(puedes seleccionar varios)</span>
              </FieldLabel>
              <div id="edit-schedule-days" className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Días de la semana">
                {WEEK_DAYS.map((day) => {
                  const isChecked = editScheduleDays.includes(day)
                  return (
                    <label
                      key={day}
                      className={cn(
                        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium cursor-pointer transition-colors select-none',
                        isChecked
                          ? 'bg-primary/10 border-primary text-primary dark:bg-primary/20'
                          : 'bg-background hover:bg-accent text-foreground border-input',
                      )}
                    >
                      <input
                        type="checkbox"
                        value={day}
                        checked={isChecked}
                        onChange={() => {
                          setEditScheduleDays((prev) => {
                            if (prev.includes(day)) {
                              return prev.filter((d) => d !== day)
                            } else {
                              const ref = prev[0] ? editDayTimes[prev[0]] : undefined
                              setEditDayTimes((times) => ({
                                ...times,
                                [day]: times[day] ?? {
                                  start_time: ref?.start_time || '08:00',
                                  end_time: ref?.end_time || '10:00',
                                },
                              }))
                              return [...prev, day]
                            }
                          })
                        }}
                        className="size-4 rounded border-input text-primary focus:ring-primary/20"
                      />
                      <span>{DAY_LABELS[day]}</span>
                    </label>
                  )
                })}
              </div>
            </Field>

            {/* Horario por día */}
            <div className="flex flex-col gap-3 pt-1">
              <span className="text-xs font-medium text-muted-foreground">
                Horario por día (puedes configurar horas diferentes según el día):
              </span>
              {editScheduleDays.map((day) => {
                const dayLabel = DAY_LABELS[day] ?? day
                const currentTimes = editDayTimes[day] ?? { start_time: '08:00', end_time: '10:00' }
                return (
                  <div
                    key={day}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-muted/20"
                  >
                    <div className="sm:w-28 flex items-center gap-2 font-semibold text-sm text-foreground shrink-0">
                      <CalendarDaysIcon className="size-4 text-primary" />
                      <span>{dayLabel}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 flex-1">
                      <SelectField
                        id={`edit-schedule-start-${day}`}
                        label={editScheduleDays.length === 1 ? 'Hora de inicio' : `Hora de inicio (${dayLabel})`}
                        value={currentTimes.start_time}
                        onChange={(val) => {
                          setEditDayTimes((prev) => ({
                            ...prev,
                            [day]: { ...(prev[day] ?? { end_time: '10:00' }), start_time: val },
                          }))
                        }}
                        required
                      >
                        <option value="">Selecciona hora</option>
                        {SCHEDULE_TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </SelectField>
                      <SelectField
                        id={`edit-schedule-end-${day}`}
                        label={editScheduleDays.length === 1 ? 'Hora de fin' : `Hora de fin (${dayLabel})`}
                        value={currentTimes.end_time}
                        onChange={(val) => {
                          setEditDayTimes((prev) => ({
                            ...prev,
                            [day]: { ...(prev[day] ?? { start_time: '08:00' }), end_time: val },
                          }))
                        }}
                        required
                      >
                        <option value="">Selecciona hora</option>
                        {SCHEDULE_TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </SelectField>
                    </div>
                  </div>
                )
              })}
              {editScheduleDays.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Selecciona al menos un día arriba para configurar su horario.
                </p>
              )}
            </div>
          </div>

          {/* Paralelo(s) de la asignatura registrados previamente */}
          <Field>
            <FieldLabel htmlFor="edit-tutoring-parallels">
              Paralelo(s) de la asignatura <span className="text-xs font-normal text-muted-foreground">(registrados previamente al crear la asignatura)</span>
            </FieldLabel>

            {editSubjectParallels.length > 0 ? (
              <div id="edit-tutoring-parallels" className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Paralelos">
                {editSubjectParallels.map((parallel) => {
                  const isChecked = editParallelIds.includes(String(parallel.id))
                  return (
                    <label
                      key={parallel.id}
                      className={cn(
                        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium cursor-pointer transition-colors select-none',
                        isChecked
                          ? 'bg-primary/10 border-primary text-primary dark:bg-primary/20'
                          : 'bg-background hover:bg-accent text-foreground border-input',
                      )}
                    >
                      <input
                        type="checkbox"
                        value={parallel.id}
                        checked={isChecked}
                        onChange={() => {
                          setEditParallelIds((prev) =>
                            prev.includes(String(parallel.id))
                              ? prev.filter((id) => id !== String(parallel.id))
                              : [...prev, String(parallel.id)],
                          )
                        }}
                        className="size-4 rounded border-input text-primary focus:ring-primary/20"
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

            {editSubjectParallels.length > 0 && editParallelIds.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Selecciona al menos un paralelo para la tutoría.</p>
            )}
          </Field>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <DialogCancelButton onClick={() => setEditingTutoringItem(null)}>
              Cancelar
            </DialogCancelButton>
            <Button
              type="submit"
              disabled={
                editSaving ||
                !editTeacherId ||
                editScheduleDays.length === 0 ||
                !editScheduleDays.every((d) => {
                  const t = editDayTimes[d]
                  return t && t.start_time && t.end_time && t.start_time < t.end_time
                }) ||
                (editSubjectParallels.length > 0 && editParallelIds.length === 0)
              }
              className="bg-brand-red hover:bg-brand-red/90 text-white font-semibold"
            >
              {editSaving && <Spinner data-icon="inline-start" />}
              Guardar cambios
            </Button>
          </div>
        </form>
      )}
    </Dialog>

    {/* View Parallels Modal */}
    <Dialog
      open={Boolean(viewingParallelsItem)}
      title="Paralelos de la asignatura"
      description={viewingParallelsItem ? `${viewingParallelsItem.subject_name} · ${viewingParallelsItem.cycle_name}` : ''}
      confirmClose={false}
      onClose={() => setViewingParallelsItem(null)}
      maxWidth="max-w-md"
    >
      {viewingParallelsItem && (() => {
        const parallels = viewingParallelsItem.parallels.length > 0
          ? viewingParallelsItem.parallels
          : (viewingParallelsItem.section_name ? [viewingParallelsItem.section_name] : [])

        return (
          <div className="flex flex-col gap-4">
            {parallels.length > 0 ? (
              <div className="grid grid-cols-2 gap-2" role="list" aria-label="Lista de paralelos">
                {parallels.map((p) => (
                  <div
                    key={p}
                    role="listitem"
                    className="flex items-center gap-2.5 p-3 rounded-lg border bg-card text-card-foreground shadow-xs hover:border-primary/40 transition-colors"
                  >
                    <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                      {p}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-foreground truncate">Paralelo {p}</span>
                      <span className="text-xs text-muted-foreground">Activo en este ciclo</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-muted/30 border border-dashed text-center">
                <p className="text-sm text-muted-foreground">Esta asignatura no tiene paralelos registrados previamente en este ciclo.</p>
              </div>
            )}

            <div className="flex items-center justify-end pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setViewingParallelsItem(null)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        )
      })()}
    </Dialog>

    {/* View Schedules Modal */}
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
                  <div
                    key={s.id}
                    role="listitem"
                    className="flex items-center justify-between p-3 rounded-lg border bg-card text-card-foreground shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-sm">
                        <CalendarClockIcon className="size-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-foreground">
                          {DAY_LABELS[s.day] ?? s.day}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                          {s.room && s.room !== 'Por asignar' ? ` · Aula: ${s.room}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
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
                variant="outline"
                onClick={() => setViewingScheduleItem(null)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        )
      })()}
    </Dialog>
  </section>
}
