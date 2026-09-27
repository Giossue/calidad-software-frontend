import { useEffect, useState, type FormEvent } from 'react'
import { CalendarDaysIcon, LayersIcon, MoreVerticalIcon, PencilIcon, PowerOffIcon, RotateCcwIcon, UserPlusIcon } from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { tutoringApi, type AvailableTeacher, type Subject, type Tutoring } from '@/lib/tutoring-api'
import { TutoringDetail } from './tutoring-detail'
import { ErrorNotice, ModuleHeader, MutationDialog, RecordTable, ScopeNotice, SelectField } from './tutoring-shared'
import { describeError, useOperation, useTutoringCatalogs } from './tutoring-hooks'

type FormMode = 'create' | 'edit' | 'cycle' | 'teacher'
const EMPTY_FORM = { subject_id: '', cycle_id: '', period_id: '', modality_id: '', teacher_id: '' }
const TITLES: Record<FormMode, string> = { create: 'Registrar tutoría', edit: 'Editar tutoría', cycle: 'Asignar ciclo y paralelo', teacher: 'Asignar docente' }

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
  const [subjectsError, setSubjectsError] = useState<string | null>(null)
  const [subjectsLoading, setSubjectsLoading] = useState(true)
  const [subjectsRevision, setSubjectsRevision] = useState(0)
  const [mode, setMode] = useState<FormMode | null>(null)
  const [editing, setEditing] = useState<Tutoring | null>(null)
  const [detail, setDetail] = useState<Tutoring | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [initialForm, setInitialForm] = useState(EMPTY_FORM)
  const [deactivating, setDeactivating] = useState<Tutoring | null>(null)
  const [teacherSearch, setTeacherSearch] = useState('')
  const [teachers, setTeachers] = useState<readonly AvailableTeacher[]>([])
  const [teachersLoading, setTeachersLoading] = useState(false)
  const [teachersError, setTeachersError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setSubjectsLoading(true)
      setSubjectsError(null)
      try {
        const collected: Subject[] = []
        let page = 1
        let lastPage = 1
        do {
          const response = await tutoringApi.subjects({ page, per_page: 100 })
          if (cancelled) return
          collected.push(...response.data)
          lastPage = response.meta?.last_page ?? 1
          page += 1
        } while (page <= lastPage)
        setSubjects(collected)
      } catch (caught) {
        if (!cancelled) setSubjectsError(describeError(caught))
      } finally {
        if (!cancelled) setSubjectsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [subjectsRevision])

  useEffect(() => {
    if (mode !== 'teacher') return
    let cancelled = false
    const timer = window.setTimeout(() => {
      tutoringApi.availableTeachers(teacherSearch)
        .then((data) => { if (!cancelled) setTeachers(data) })
        .catch((caught: unknown) => { if (!cancelled) setTeachersError(describeError(caught)) })
        .finally(() => { if (!cancelled) setTeachersLoading(false) })
    }, 300)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [mode, teacherSearch])

  function openForm(nextMode: FormMode, tutoring: Tutoring | null = null) {
    const next = tutoring ? { subject_id: String(tutoring.subject_id ?? ''), cycle_id: String(tutoring.cycle_id), period_id: String(tutoring.period_id), modality_id: String(tutoring.modality_id), teacher_id: nextMode === 'teacher' ? '' : String(tutoring.teacher_id ?? '') } : EMPTY_FORM
    setEditing(tutoring)
    setForm(next)
    setInitialForm(next)
    operation.clearError()
    setTeachersLoading(nextMode === 'teacher')
    setTeachersError(null)
    setTeacherSearch('')
    setTeachers([])
    setMode(nextMode)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!mode) return
    const action = () => {
      if (mode === 'create') return tutoringApi.createTutoring({ subject_id: Number(form.subject_id), cycle_id: Number(form.cycle_id), period_id: Number(form.period_id), modality_id: Number(form.modality_id) })
      if (!editing) throw new Error('No se seleccionó una tutoría.')
      if (mode === 'cycle') return tutoringApi.assignTutoringCycle(editing.id, Number(form.cycle_id))
      if (mode === 'teacher') return tutoringApi.assignTeacher(editing.id, Number(form.teacher_id))
      return tutoringApi.updateTutoring(editing.id, { period_id: Number(form.period_id), modality_id: Number(form.modality_id) })
    }
    void operation.run(async () => {
      const updated = await action()
      if (detail?.id === updated.id) setDetail(updated)
    }, mode === 'create' ? 'Tutoría registrada.' : 'Tutoría actualizada.', async () => { setMode(null); await list.reload() })
  }

  function onCareerFilterChange(value: string) {
    setCareerFilter(value)
    const current = cycleFilter ? catalogs.cycles.find((cycle) => String(cycle.id) === cycleFilter) : null
    if (cycleFilter && (!current || (value && current.career_id !== Number(value)))) setCycleFilter('')
  }

  const hasActiveFilters = Boolean(list.searchInput || careerFilter || cycleFilter || statusFilter)
  function clearFilters() {
    list.setSearchInput('')
    setCareerFilter('')
    setCycleFilter('')
    setStatusFilter('')
  }

  const cycleFilterOptions = catalogs.cycles.filter((cycle) => !careerFilter || cycle.career_id === Number(careerFilter))
  const subject = subjects.find((item) => item.id === Number(form.subject_id))
  const availableCycles = catalogs.cycles.filter((cycle) => cycle.status && (subject ? cycle.career_id === subject.career_id && subject.cycle_ids.includes(cycle.id) : mode === 'cycle' && editing?.subject_id === null && cycle.career_id === editing.career_id))

  return <section className="flex flex-col gap-6">
    {detail ? <TutoringDetail tutoring={detail} onBack={() => setDetail(null)} onAssignTeacher={() => openForm('teacher', detail)} /> : <>
      <ModuleHeader title="Tutorías" description="Organiza las tutorías de tus carreras, asigna docentes y supervisa los horarios, asistencias e informes." createLabel="Registrar tutoría" onCreate={() => openForm('create')} disabled={operation.pending || catalogs.loading || subjectsLoading || !catalogs.careers.some((career) => career.status)} />
      <ScopeNotice catalogs={catalogs} />
      <Card>
        <CardContent className="pt-6">
          <FieldGroup className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            <Field className="flex-1 lg:min-w-[220px]"><FieldLabel htmlFor="tutorings-search">Buscar</FieldLabel><Input id="tutorings-search" type="search" placeholder="Busca por asignatura…" value={list.searchInput} onChange={(event) => list.setSearchInput(event.target.value)} /></Field>
            <Field className="lg:w-52"><FieldLabel htmlFor="tutorings-career-filter">Carrera</FieldLabel><NativeSelect id="tutorings-career-filter" value={careerFilter} onChange={(event) => onCareerFilterChange(event.target.value)}><option value="">Todas mis carreras</option>{catalogs.careers.map((career) => <option key={career.id} value={career.id}>{career.name}</option>)}</NativeSelect></Field>
            <Field className="lg:w-52"><FieldLabel htmlFor="tutorings-cycle-filter">Ciclo</FieldLabel><NativeSelect id="tutorings-cycle-filter" value={cycleFilter} onChange={(event) => setCycleFilter(event.target.value)}><option value="">Todos los ciclos</option>{cycleFilterOptions.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}{cycle.paralelo_name ? ` · ${cycle.paralelo_name}` : ''}</option>)}</NativeSelect></Field>
            <Field className="lg:w-40"><FieldLabel htmlFor="tutorings-status-filter">Estado</FieldLabel><NativeSelect id="tutorings-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as '' | 'active' | 'inactive')}><option value="">Todos</option><option value="active">Activas</option><option value="inactive">Inactivas</option></NativeSelect></Field>
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" disabled={!hasActiveFilters} onClick={clearFilters}><RotateCcwIcon data-icon="inline-start" />Limpiar filtros</Button>
          </FieldGroup>
        </CardContent>
      </Card>
      <ErrorNotice message={list.error} retry={list.reload} />
      <RecordTable rows={list.data} loading={list.isFetching || list.isInitialLoading} empty="No se encontraron tutorías para esta búsqueda." columns={[
        { label: 'Tutoría', render: (tutoring) => <div className="flex flex-col gap-1"><span className="font-medium">{tutoring.subject_name}</span><span className="text-xs text-muted-foreground">{tutoring.period_name} · {tutoring.modality_name}</span></div> },
        { label: 'Ciclo y paralelo', render: (tutoring) => <div className="flex flex-col gap-1"><span>{tutoring.cycle_name}{tutoring.section_name ? ` · ${tutoring.section_name}` : ''}</span><span className="text-xs text-muted-foreground">{catalogs.careers.find((career) => career.id === tutoring.career_id)?.name}</span></div> },
        { label: 'Docente', render: (tutoring) => <div className="flex flex-col gap-1"><span>{tutoring.teacher_name || 'Sin docente asignado'}</span>{tutoring.teacher_id && !tutoring.teacher_is_active ? <span className="text-xs text-destructive">Docente inactivo: requiere reasignación</span> : null}</div> },
        { label: 'Estado', render: (tutoring) => <StatusBadge active={tutoring.is_active} activeLabel="Activa" inactiveLabel="Inactiva" /> },
        {
          label: 'Acciones', render: (tutoring) => <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon-sm" title="Supervisar" aria-label={`Supervisar ${tutoring.subject_name}`} disabled={operation.pending} onClick={() => setDetail(tutoring)}><CalendarDaysIcon /></Button>
            {tutoring.is_active && <>
              <Button type="button" variant="ghost" size="icon-sm" title="Asignar docente" aria-label={`Asignar docente a ${tutoring.subject_name}`} disabled={operation.pending} onClick={() => openForm('teacher', tutoring)}><UserPlusIcon /></Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon-sm" aria-label={`Más acciones para ${tutoring.subject_name}`} disabled={operation.pending}><MoreVerticalIcon /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => openForm('edit', tutoring)}><PencilIcon />Editar</DropdownMenuItem>
                  <DropdownMenuItem disabled={subjectsLoading} onSelect={() => openForm('cycle', tutoring)}><LayersIcon />Ciclo y paralelo</DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={() => { operation.clearError(); setDeactivating(tutoring) }}><PowerOffIcon />Desactivar</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>}
          </div>,
        },
      ]} />
      <CatalogPagination label="tutorías" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
    </>}
    <MutationDialog open={Boolean(mode)} title={mode ? TITLES[mode] : ''} description={editing?.subject_name} pending={operation.pending} error={operation.error} dirty={JSON.stringify(form) !== JSON.stringify(initialForm)} onClose={() => setMode(null)} onSubmit={submit} submitLabel={mode === 'create' ? 'Registrar tutoría' : mode === 'teacher' ? 'Asignar docente' : 'Guardar cambios'} submitDisabled={mode === 'teacher' ? teachersLoading || Boolean(teachersError) || !form.teacher_id : (mode === 'create' || mode === 'cycle') && (subjectsLoading || Boolean(subjectsError))}>
      {(mode === 'create' || mode === 'cycle') && <ErrorNotice message={subjectsError} retry={() => setSubjectsRevision((value) => value + 1)} />}
      {mode === 'create' && <SelectField id="tutoring-subject" label="Asignatura" value={form.subject_id} onChange={(value) => setForm({ ...form, subject_id: value, cycle_id: '' })}><option value="">Selecciona una asignatura</option>{subjects.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name} · {item.career_name}</option>)}</SelectField>}
      {(mode === 'create' || mode === 'cycle') && <>
        <SelectField id="tutoring-cycle" label="Ciclo y paralelo" value={form.cycle_id} onChange={(value) => setForm({ ...form, cycle_id: value })}><option value="">Selecciona un ciclo</option>{availableCycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}{cycle.paralelo_name ? ` · ${cycle.paralelo_name}` : ''}</option>)}</SelectField>
        <p className="text-sm text-muted-foreground">El paralelo corresponde al ciclo seleccionado.{subject && availableCycles.length === 0 ? ' Asigna primero un ciclo activo a esta asignatura en la sección Asignaturas.' : ''}</p>
      </>}
      {(mode === 'create' || mode === 'edit') && <>
        <SelectField id="tutoring-period" label="Período académico" value={form.period_id} onChange={(value) => setForm({ ...form, period_id: value })}><option value="">Selecciona un período</option>{editing && !catalogs.periods.some((period) => period.id === editing.period_id) && <option value={editing.period_id}>{editing.period_name} (actual, inactivo)</option>}{catalogs.periods.filter((period) => period.is_active || String(period.id) === form.period_id).map((period) => <option key={period.id} value={period.id}>{period.name}{period.is_active ? '' : ' (inactivo)'}</option>)}</SelectField>
        <SelectField id="tutoring-modality" label="Modalidad" value={form.modality_id} onChange={(value) => setForm({ ...form, modality_id: value })}><option value="">Selecciona una modalidad</option>{editing && !catalogs.modalities.some((modality) => modality.id === editing.modality_id) && <option value={editing.modality_id}>{editing.modality_name} (actual, inactiva)</option>}{catalogs.modalities.filter((modality) => modality.is_active || String(modality.id) === form.modality_id).map((modality) => <option key={modality.id} value={modality.id}>{modality.name}{modality.is_active ? '' : ' (inactiva)'}</option>)}</SelectField>
      </>}
      {mode === 'teacher' && <>
        <Field><FieldLabel htmlFor="available-teacher-search">Buscar docente activo</FieldLabel><Input id="available-teacher-search" type="search" value={teacherSearch} onChange={(event) => { setTeacherSearch(event.target.value); setTeachersLoading(true); setTeachersError(null); setForm({ ...form, teacher_id: '' }) }} placeholder="Nombre o correo institucional" /><FieldDescription>Se muestran hasta 100 coincidencias. Refina la búsqueda para encontrar al docente.</FieldDescription></Field>
        <ErrorNotice message={teachersError} />
        {teachersLoading && <p role="status" className="flex items-center gap-2 text-sm"><Spinner aria-hidden="true" />Buscando docentes…</p>}
        <SelectField id="tutoring-teacher" label="Docente" value={form.teacher_id} onChange={(value) => setForm({ ...form, teacher_id: value })} disabled={teachersLoading || Boolean(teachersError)}><option value="">Selecciona un docente</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name} · {teacher.email}</option>)}</SelectField>
        {!teachersLoading && !teachersError && teachers.length === 0 && <p className="text-sm text-muted-foreground">No se encontraron docentes activos.</p>}
        {editing?.teacher_name && <p className="text-sm text-muted-foreground">Docente actual: {editing.teacher_name}.</p>}
      </>}
    </MutationDialog>
    <ConfirmModal open={Boolean(deactivating)} title="¿Desactivar tutoría?" description={`La tutoría de «${deactivating?.subject_name ?? ''}» dejará de recibir nuevas asignaciones. Podrás seguir consultando sus asistencias e informes.`} confirmLabel="Desactivar tutoría" pending={operation.pending} onClose={() => { if (!operation.pending) setDeactivating(null) }} onConfirm={() => { if (deactivating) void operation.run(() => tutoringApi.deactivateTutoring(deactivating.id), 'Tutoría desactivada.', async () => { setDeactivating(null); await list.reload() }) }} />
  </section>
}
