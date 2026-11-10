import { useEffect, useState, type FormEvent } from 'react'
import {
  ArrowLeftIcon,
  ArrowRightLeftIcon,
  GraduationCapIcon,
  UserMinusIcon,
  UserPlusIcon,
} from 'lucide-react'

import { BulkImportButton } from '@/components/bulk-import-dialog'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { RowActionsMenu } from '@/components/ui/row-actions-menu'
import { SelectField } from '@/components/ui/select-field'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { isDegreeCycleNumber, maxCycleNumber } from '@/lib/academic-stage'
import type { Cycle } from '@/lib/api'
import { identificationMaxLength, isValidIdentification, sanitizeIdentification, shouldShowIdentificationStatus } from '@/lib/cedula'
import { institutionalEmailDomainsLabel, isInstitutionalEmail } from '@/lib/institutional-email'
import { formatSubjectName, sanitizeDigits, sanitizeLetters } from '@/lib/sanitize'
import {
  tutoringApi,
  type CoordinatorStudent,
  type CoordinatorStudentTutoring,
  type DegreeStudent,
  type Tutoring,
} from '@/lib/tutoring-api'
import { FilterBar } from './filter-bar'
import { CareerBreadcrumb, CareerPicker, useSelectedCareer } from './career-picker'
import { useOperation, useTutoringCatalogs } from './tutoring-hooks'
import { ErrorNotice } from '@/components/ui/error-notice'
import { CycleSelect, ModuleHeader, RecordTable } from './tutoring-shared'

const EMPTY_STUDENT_FORM = {
  identification: '',
  name: '',
  email: '',
  phone: '',
  cycle_id: '',
  tutoring_id: '',
}

export function TutoringStudentsPage() {
  const catalogs = useTutoringCatalogs()
  const selection = useSelectedCareer(catalogs.careers)

  if (selection.career) {
    return <StudentsWorkspace catalogs={catalogs} careerId={selection.career.id} onBack={selection.canChange ? selection.clear : undefined} />
  }

  return <CareerPicker catalogs={catalogs} title="Estudiantes" rowTitle={(career) => `Ver estudiantes de ${career.name}`} onSelect={(career) => selection.select(career.id)} />
}

const WITHOUT_CYCLE = 'none'

function StudentsWorkspace({ catalogs, careerId, onBack }: Readonly<{ catalogs: ReturnType<typeof useTutoringCatalogs>; careerId: number; onBack?: () => void }>) {
  const careerCycles = catalogs.cycles.filter((cycle) => cycle.status && cycle.career_id === careerId)
  // Una pestaña por ciclo de la carrera (los paralelos de un mismo ciclo comparten pestaña).
  const cycleLevels = Array.from(new Map(careerCycles.map((cycle) => [cycle.number, cycle])).values()).sort((a, b) => a.number - b.number)
  // Titulación es el último ciclo (número más alto) de la carrera.
  const careerMaxCycle = maxCycleNumber(careerCycles)
  const [cycleTab, setCycleTab] = useState('')
  const activeTab = cycleTab || (cycleLevels[0] ? String(cycleLevels[0].number) : WITHOUT_CYCLE)
  const tabCycleNumber = activeTab === WITHOUT_CYCLE ? undefined : Number(activeTab)
  // En el último ciclo los estudiantes están en titulación: se gestiona su matrícula en lugar de tutorías.
  const isDegreeTab = isDegreeCycleNumber(tabCycleNumber, careerMaxCycle)
  const tabLevel = cycleLevels.find((level) => level.number === tabCycleNumber)

  const [tutoringStatus, setTutoringStatus] = useState<'' | 'with' | 'without'>('')
  const list = usePaginatedCatalog(
    (page, search) => tutoringApi.allStudents({ page, search, career_id: careerId, cycle_number: tabCycleNumber, without_cycle: activeTab === WITHOUT_CYCLE, tutoring_status: tutoringStatus || undefined }),
    `${careerId}|${activeTab}|${tutoringStatus}`,
  )
  const operation = useOperation()
  const careerName = catalogs.careers.find((career) => career.id === careerId)?.name ?? 'Estudiantes'

  // Modal: Cambiar el ciclo de un estudiante
  const [cycleTarget, setCycleTarget] = useState<{ id: number; name: string; cycle_id?: number | null } | null>(null)
  const [targetCycleId, setTargetCycleId] = useState('')

  // Modal: Crear Estudiante
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_STUDENT_FORM)
  const [initialForm, setInitialForm] = useState(EMPTY_STUDENT_FORM)
  const [cycles, setCycles] = useState<readonly Cycle[]>([])
  const [loadingCycles, setLoadingCycles] = useState(false)
  const [allTutorings, setAllTutorings] = useState<readonly Tutoring[]>([])
  const [loadingTutorings, setLoadingTutorings] = useState(false)

  // Modal: Asignar Tutorías a Estudiante
  const [assignStudent, setAssignStudent] = useState<CoordinatorStudent | null>(null)
  const [availableTutorings, setAvailableTutorings] = useState<readonly Tutoring[]>([])
  const [loadingAvailable, setLoadingAvailable] = useState(false)
  const [selectedTutoringId, setSelectedTutoringId] = useState('')
  const [tutoringSearch, setTutoringSearch] = useState('')

  // Modal de confirmación para desvincular tutoría
  const [unlinking, setUnlinking] = useState<{ student: CoordinatorStudent; tutoring: CoordinatorStudentTutoring } | null>(null)

  // Cargar lista de ciclos y tutorías activas al abrir creación
  useEffect(() => {
    if (!createOpen) return
    let cancelled = false
    setLoadingTutorings(true)
    setLoadingCycles(true)
    Promise.all([
      tutoringApi.cycles().catch(() => []),
      tutoringApi.tutorings({ per_page: 100 })
        .then((res) => res.data.filter((t) => t.is_active))
        .catch(() => []),
    ])
      .then(([loadedCycles, loadedTutorings]) => {
        if (cancelled) return
        if (loadedCycles.length > 0) {
          // Solo los ciclos de la carrera elegida: el ciclo del estudiante debe pertenecer a ella.
          setCycles(loadedCycles.filter((c) => c.status && c.career_id === careerId))
        } else {
          const derived = Array.from(
            new Map(
              loadedTutorings.map((t) => [
                t.cycle_id,
                {
                  id: t.cycle_id,
                  career_id: t.career_id,
                  name: t.cycle_name,
                  number: 1,
                  paralelo_id: t.section_id,
                  paralelo_name: t.section_name,
                  status: true,
                } as Cycle,
              ]),
            ).values(),
          )
          setCycles(derived)
        }
        setAllTutorings(loadedTutorings)
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingCycles(false)
          setLoadingTutorings(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [createOpen])

  // Cargar tutorías disponibles al seleccionar un estudiante para asignación
  const loadAvailableForStudent = async (studentId: number, search = '') => {
    setLoadingAvailable(true)
    try {
      const res = await tutoringApi.availableTutoringsForStudent(studentId, search)
      setAvailableTutorings(res.data ?? [])
    } catch {
      setAvailableTutorings([])
    } finally {
      setLoadingAvailable(false)
    }
  }

  function openCreateModal() {
    // Con un solo paralelo en el ciclo de la pestaña, el ciclo queda elegido de antemano.
    const options = careerCycles.filter((cycle) => tabCycleNumber === undefined || cycle.number === tabCycleNumber)
    const preset = { ...EMPTY_STUDENT_FORM, cycle_id: options.length === 1 ? String(options[0].id) : '' }
    setForm(preset)
    setInitialForm(preset)
    operation.clearError()
    setCreateOpen(true)
  }

  function openCycleModal(student: { id: number; name: string; cycle_id?: number | null }) {
    setCycleTarget(student)
    setTargetCycleId(student.cycle_id ? String(student.cycle_id) : '')
    operation.clearError()
  }

  function handleCycleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!cycleTarget || !targetCycleId) return
    void operation.run(
      async () => {
        const response = await tutoringApi.updateStudentCycle(cycleTarget.id, Number(targetCycleId))
        // La pantalla del estudiante abierta refleja su nuevo ciclo.
        const updated = response?.data
        if (updated) setAssignStudent((current) => (current && current.id === updated.id ? { ...current, ...updated } : current))
      },
      `Ciclo de ${cycleTarget.name} actualizado.`,
      async () => {
        setCycleTarget(null)
        await Promise.all([list.reload(), degreeList.reload()])
      },
    )
  }

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = {
      identification: form.identification.trim(),
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || null,
      cycle_id: Number(form.cycle_id),
      tutoring_id: form.tutoring_id && !isDegreeCycle ? Number(form.tutoring_id) : undefined,
      career_id: careerId,
    }

    void operation.run(
      () => tutoringApi.createCoordinatorStudent(input),
      'Estudiante registrado exitosamente.',
      async () => {
        setCreateOpen(false)
        await Promise.all([list.reload(), degreeList.reload()])
      },
    )
  }

  function openAssignModal(student: CoordinatorStudent) {
    setAssignStudent(student)
    setSelectedTutoringId('')
    setTutoringSearch('')
    operation.clearError()
    void loadAvailableForStudent(student.id)
  }

  function handleAssignSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!assignStudent || !selectedTutoringId) return

    void operation.run(
      () => tutoringApi.enrollStudentInTutoring(assignStudent.id, Number(selectedTutoringId)),
      'Estudiante asignado a la tutoría exitosamente.',
      async () => {
        setSelectedTutoringId('')
        await loadAvailableForStudent(assignStudent.id, tutoringSearch)
        await list.reload()
        const updatedList = await tutoringApi.allStudents({ search: assignStudent.identification })
        const updated = updatedList.data.find((s) => s.id === assignStudent.id)
        if (updated) setAssignStudent(updated)
      },
    )
  }

  function handleUnenroll() {
    if (!unlinking) return
    const { student, tutoring } = unlinking

    void operation.run(
      () => tutoringApi.unenrollStudentFromTutoring(student.id, tutoring.enrollment_id),
      'Tutoría desvinculada del estudiante.',
      async () => {
        setUnlinking(null)
        await list.reload()
        if (assignStudent?.id === student.id) {
          const updatedList = await tutoringApi.allStudents({ search: student.identification })
          const updated = updatedList.data.find((s) => s.id === student.id)
          if (updated) setAssignStudent(updated)
          await loadAvailableForStudent(student.id, tutoringSearch)
        }
      },
    )
  }

  const isFormDirty = JSON.stringify(form) !== JSON.stringify(initialForm)
  const isCedulaValid = isValidIdentification(form.identification)
  const isEmailValid = isInstitutionalEmail(form.email)

  // Primer error de validación: bloquea "Registrar estudiante" y se muestra en su tooltip.
  const createBlockReason =
    (!form.identification ? 'La cédula o pasaporte es obligatoria.' : !isCedulaValid ? 'La cédula o pasaporte no es válido.' : null) ??
    (!form.name.trim() ? 'El nombre es obligatorio.' : null) ??
    (!form.email ? 'El correo institucional es obligatorio.' : !isEmailValid ? `El correo debe terminar en ${institutionalEmailDomainsLabel}.` : null) ??
    (!form.cycle_id ? 'Selecciona el ciclo que cursa el estudiante.' : null)

  function handleCycleChange(cycleId: string) {
    setForm((prev) => ({
      ...prev,
      cycle_id: cycleId,
      tutoring_id: '',
    }))
  }

  const availableTutoringsForCycle = form.cycle_id
    ? allTutorings.filter((t) => t.cycle_id === Number(form.cycle_id))
    : []
  // En el último ciclo de la carrera los estudiantes están en titulación: no se inscriben en tutorías.
  const createModalMaxCycle = maxCycleNumber(cycles)
  const isLastCycle = (cycle: Cycle) => isDegreeCycleNumber(cycle.number, createModalMaxCycle)
  const selectedCycle = cycles.find((cycle) => String(cycle.id) === form.cycle_id)
  const isDegreeCycle = selectedCycle ? isLastCycle(selectedCycle) : false

  const filteredAvailableTutorings = availableTutorings.filter((t) => {
    if (!tutoringSearch.trim()) return true
    const term = tutoringSearch.toLowerCase()
    return (
      t.subject_name.toLowerCase().includes(term) ||
      (t.cycle_name && t.cycle_name.toLowerCase().includes(term)) ||
      (t.teacher_name && t.teacher_name.toLowerCase().includes(term)) ||
      (t.section_name && t.section_name.toLowerCase().includes(term))
    )
  })

  // Matrícula de Titulación
  const [degreeFilter, setDegreeFilter] = useState<'' | 'enrolled' | 'not_enrolled'>('')
  const degreeList = usePaginatedCatalog(
    (page, search) =>
      tutoringApi.degreeStudents({
        page,
        search,
        career_id: careerId,
        cycle_number: isDegreeTab ? tabCycleNumber : undefined,
        enrolled: degreeFilter === '' ? undefined : degreeFilter === 'enrolled',
      }),
    `${careerId}|${isDegreeTab ? tabCycleNumber : ''}|${degreeFilter}`,
  )
  const degreeOperation = useOperation()
  const [enrollTarget, setEnrollTarget] = useState<DegreeStudent | null>(null)
  const [unenrollTarget, setUnenrollTarget] = useState<DegreeStudent | null>(null)

  function handleEnrollConfirm() {
    if (!enrollTarget) return
    void degreeOperation.run(
      () => tutoringApi.enrollDegreeStudent(enrollTarget.student_id),
      `Estudiante ${enrollTarget.name} matriculado en titulación exitosamente.`,
      async () => {
        setEnrollTarget(null)
        await degreeList.reload()
      },
    )
  }

  function handleUnenrollConfirm() {
    if (!unenrollTarget) return
    void degreeOperation.run(
      () => tutoringApi.unenrollDegreeStudent(unenrollTarget.student_id),
      `Se dio de baja a ${unenrollTarget.name} de titulación.`,
      async () => {
        setUnenrollTarget(null)
        await degreeList.reload()
      },
    )
  }

  // El ciclo encabeza la fila de filtros en las dos vistas (tutorías y titulación).
  const cycleSelect = (
    <CycleSelect
      id="tutoring-students-cycle"
      levels={cycleLevels}
      value={activeTab}
      onChange={setCycleTab}
      degreeCycleNumber={careerMaxCycle}
      extraOptions={[{ value: WITHOUT_CYCLE, label: 'Sin ciclo' }]}
    />
  )

  const sectionLabel = (name?: string | null) => (name ? `Paralelo ${name.replace(/^Paralelo\s+/i, '')}` : null)
  const studentCycleText = (student: CoordinatorStudent) =>
    student.cycle_number
      ? [`${student.cycle_number}° ciclo${isDegreeCycleNumber(student.cycle_number, careerMaxCycle) ? ' · Titulación' : ''}`, sectionLabel(student.section_name)].filter(Boolean).join(' · ')
      : 'Sin ciclo asignado'
  const hasStudentFilters = Boolean(list.searchInput || tutoringStatus)

  return (
    <div className="flex flex-col gap-6">
      {assignStudent ? (
        // Pantalla del estudiante: se abre al pulsar su fila. Arriba el ciclo y la acción de
        // cambiarlo; debajo, sus tutorías y sus datos en pestañas.
        <div className="flex flex-col gap-6" data-tour-view="detail">
          <div>
            <Button type="button" variant="tertiary" onClick={() => setAssignStudent(null)}>
              <ArrowLeftIcon data-icon="inline-start" />
              Volver a estudiantes
            </Button>
          </div>

          <AdminSectionHeader
            title={assignStudent.name}
            description={studentCycleText(assignStudent)}
            actions={
              <div className="flex items-center gap-2">
                <StatusBadge active={assignStudent.is_active} />
                <Button type="button" variant="secondary" onClick={() => openCycleModal(assignStudent)}>
                  <ArrowRightLeftIcon data-icon="inline-start" />
                  {assignStudent.cycle_id ? 'Cambiar ciclo' : 'Asignar ciclo'}
                </Button>
              </div>
            }
          />

          <Tabs defaultValue="tutorings">
            <TabsList aria-label="Secciones del estudiante">
              <TabsTrigger value="tutorings">Tutorías</TabsTrigger>
              <TabsTrigger value="data">Datos</TabsTrigger>
            </TabsList>
            <TabsContent value="tutorings" className="flex flex-col gap-4">
              {(assignStudent.pending_subjects ?? []).length > 0 && (
                <p className="text-sm text-warning">
                  Arrastra: {(assignStudent.pending_subjects ?? []).map((subject) => formatSubjectName(subject.name)).join(', ')}. No se le inscribe en las asignaturas que las continúan hasta que las apruebe.
                </p>
              )}
              {loadingAvailable ? (
                <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner />
                  Cargando tutorías disponibles…
                </p>
              ) : availableTutorings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay más tutorías disponibles para inscribir a este estudiante.</p>
              ) : (
                <form onSubmit={handleAssignSubmit} aria-label="Inscribir en una tutoría" className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <SelectField
                    id="assign-tutoring-select"
                    label="Inscribir en una tutoría"
                    className="sm:max-w-xl sm:flex-1"
                    value={selectedTutoringId}
                    onValueChange={setSelectedTutoringId}
                    disabled={operation.pending}
                    placeholder="Elige una tutoría disponible"
                    options={filteredAvailableTutorings.map((tutoring) => ({
                      value: String(tutoring.id),
                      label: `${tutoring.subject_name} (${tutoring.cycle_name}${tutoring.section_name ? ` - ${tutoring.section_name}` : ''})${tutoring.teacher_name ? ` — Docente: ${tutoring.teacher_name}` : ''}`,
                    }))}
                  />
                  <Button type="submit" disabled={!selectedTutoringId || operation.pending}>
                    {operation.pending ? <Spinner data-icon="inline-start" /> : <UserPlusIcon data-icon="inline-start" />}
                    Inscribir en tutoría
                  </Button>
                </form>
              )}
              <RecordTable
                rows={assignStudent.tutorings.map((tutoring) => ({ ...tutoring, id: tutoring.enrollment_id }))}
                loading={false}
                empty="Aún no está inscrito en ninguna tutoría."
                columns={[
                  { label: 'Asignatura', render: (tutoring) => <span className="font-medium text-foreground">{formatSubjectName(tutoring.subject_name)}</span> },
                  { label: 'Ciclo', render: (tutoring) => tutoring.cycle_name },
                  { label: 'Paralelo', render: (tutoring) => tutoring.section_name ?? '—' },
                  { label: 'Período', render: (tutoring) => tutoring.period_name },
                  {
                    label: 'Acciones',
                    render: (tutoring) => (
                      <RowActionsMenu
                        name={tutoring.subject_name}
                        disabled={operation.pending}
                        actions={[{ label: 'Desvincular', icon: UserMinusIcon, tone: 'destructive', onSelect: () => setUnlinking({ student: assignStudent, tutoring }) }]}
                      />
                    ),
                  },
                ]}
              />
            </TabsContent>
            <TabsContent value="data">
              <dl className="grid max-w-2xl gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                <StudentDatum label="Cédula o pasaporte" value={assignStudent.identification} />
                <StudentDatum label="Correo institucional" value={assignStudent.email} />
                <StudentDatum label="Teléfono" value={assignStudent.phone || 'Sin teléfono'} />
                <StudentDatum label="Ciclo" value={studentCycleText(assignStudent)} />
              </dl>
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <>
          <CareerBreadcrumb root="Estudiantes" career={careerName} onBack={onBack} />
          <ModuleHeader
            title={careerName}
            description={
              isDegreeTab
                ? 'Matricula en titulación a los estudiantes del último ciclo para el período vigente.'
                : tabLevel
                  ? 'Registra a los estudiantes y ubícalos en su ciclo. Haz clic en uno para ver sus tutorías.'
                  : 'Estudiantes sin ciclo asignado: haz clic en uno para asignarle el ciclo que cursa.'
            }
            createLabel="Nuevo estudiante"
            onCreate={openCreateModal}
            extraActions={<BulkImportButton type="students" title="Carga masiva de estudiantes" description="Cada estudiante recibirá su contraseña provisional por correo y completará sus datos al ingresar. En «asignaturas_pendientes» escribe, separadas por «|», las asignaturas de ciclos anteriores que arrastra (código o nombre): no se le inscribirá en las que las continúan hasta que las apruebe. Si el estudiante ya está registrado, solo se actualizan sus pendientes." onFinished={list.reload} />}
          />

          {!isDegreeTab && (
            <>
              <FilterBar
                id="tutoring-students-filter"
                leading={cycleSelect}
                search={list.searchInput}
                onSearch={list.setSearchInput}
                searchLabel="Buscar estudiante"
                searchPlaceholder="Busca por nombre, cédula o correo…"
                filters={[
                  { id: 'tutoring-status', label: 'Tutorías', value: tutoringStatus, onChange: (value) => setTutoringStatus(value as '' | 'with' | 'without'), allLabel: 'Con y sin tutorías', options: [{ value: 'with', label: 'Con tutorías' }, { value: 'without', label: 'Sin tutorías' }] },
                ]}
                onClear={() => { list.setSearchInput(''); setTutoringStatus('') }}
              />

              <ErrorNotice message={list.error} retry={list.reload} />

              <RecordTable<CoordinatorStudent>
                rows={list.data}
                numberFrom={list.meta?.from}
                loading={list.isFetching || list.isInitialLoading}
                onRowClick={openAssignModal}
                rowTitle={(student) => `Abrir a ${student.name}`}
                empty={
                  hasStudentFilters
                    ? 'No hay estudiantes con estos filtros.'
                    : activeTab === WITHOUT_CYCLE
                      ? 'Todos los estudiantes de la carrera tienen un ciclo asignado.'
                      : 'Aún no hay estudiantes en este ciclo. Regístralos con «Nuevo estudiante».'
                }
                columns={[
                  {
                    label: 'Estudiante',
                    render: (student) => (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-foreground">{student.name}</span>
                        <span className="text-xs text-muted-foreground">{student.email}</span>
                        {(student.pending_subjects ?? []).length > 0 && (
                          <span className="text-xs text-warning">
                            Arrastra: {(student.pending_subjects ?? []).map((subject) => formatSubjectName(subject.name)).join(', ')}
                          </span>
                        )}
                      </div>
                    ),
                  },
                  {
                    label: 'Cédula / Teléfono',
                    render: (student) => (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-sm">{student.identification}</span>
                        <span className="text-xs text-muted-foreground">{student.phone || 'Sin teléfono'}</span>
                      </div>
                    ),
                  },
                  {
                    label: 'Tutorías',
                    render: (student) => (
                      <span className={cn('text-sm', student.tutorings.length === 0 && 'text-muted-foreground')}>
                        {student.tutorings.length === 0 ? 'Sin tutorías' : student.tutorings.length === 1 ? '1 tutoría' : `${student.tutorings.length} tutorías`}
                      </span>
                    ),
                  },
                  { label: 'Estado', render: (student) => <span className={cn('text-sm', !student.is_active && 'text-muted-foreground')}>{student.is_active ? 'Activo' : 'Inactivo'}</span> },
                ]}
              />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Mostrando {list.data.length} de {list.meta?.total ?? list.data.length} {(list.meta?.total ?? list.data.length) === 1 ? 'estudiante' : 'estudiantes'}
                </p>
                <CatalogPagination
                  label="estudiantes"
                  page={list.page}
                  lastPage={list.meta?.last_page ?? 1}
                  disabled={list.isFetching}
                  onChange={list.setPage}
                />
              </div>
            </>
          )}

          {isDegreeTab && (
            <>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Matrícula en Titulación</h2>
              <FilterBar
                id="degree-students-filter"
                leading={cycleSelect}
                search={degreeList.searchInput}
                onSearch={degreeList.setSearchInput}
                searchLabel="Buscar estudiante"
                searchPlaceholder="Busca por nombre, cédula o correo…"
                filters={[
                  {
                    id: 'enrollment-status',
                    label: 'Estado de matrícula',
                    value: degreeFilter,
                    onChange: (val) => setDegreeFilter(val as '' | 'enrolled' | 'not_enrolled'),
                    allLabel: 'Todos los estudiantes',
                    options: [
                      { label: 'Matriculados en Titulación', value: 'enrolled' },
                      { label: 'Sin matrícula en Titulación', value: 'not_enrolled' },
                    ],
                  },
                ]}
                onClear={() => {
                  degreeList.setSearchInput('')
                  setDegreeFilter('')
                }}
              />

              <ErrorNotice message={degreeList.error} retry={degreeList.reload} />

              <RecordTable<DegreeStudent>
                numberFrom={degreeList.meta?.from}
                rows={degreeList.data}
                loading={degreeList.isFetching || degreeList.isInitialLoading}
                empty={
                  degreeList.searchInput || degreeFilter !== ''
                    ? 'No hay estudiantes con estos filtros.'
                    : 'Aún no hay estudiantes en el ciclo de titulación. Regístralos o cámbialos de ciclo.'
                }
                columns={[
                  {
                    label: 'Estudiante',
                    render: (student) => (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-foreground">{student.name}</span>
                        <span className="text-xs text-muted-foreground">{student.email}</span>
                      </div>
                    ),
                  },
                  {
                    label: 'Cédula / Teléfono',
                    render: (student) => (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-sm">{student.identification}</span>
                        <span className="text-xs text-muted-foreground">{student.phone || 'Sin teléfono'}</span>
                      </div>
                    ),
                  },
                  {
                    label: 'Ciclo',
                    render: (student) => (
                      <span className="text-sm text-muted-foreground">
                        {student.cycle_number ? `Ciclo ${student.cycle_number}${student.academic_stage === 'titulacion' ? ' · Titulación' : ''}` : 'Sin registrar'}
                      </span>
                    ),
                  },
                  {
                    label: 'Estado en Titulación',
                    render: (student) =>
                      student.is_degree_enrolled
                        ? <Badge variant="success">Matriculado{student.enrolled_at ? ` · ${student.enrolled_at}` : ''}</Badge>
                        : <Badge variant="inactive">No matriculado</Badge>,
                  },
                  {
                    label: 'Acciones',
                    render: (student) => (
                      // Solo se matriculan en titulación los estudiantes del último ciclo de la carrera.
                      <RowActionsMenu
                        name={student.name}
                        disabled={degreeOperation.pending}
                        actions={[
                          { label: 'Matricular en titulación', icon: GraduationCapIcon, onSelect: () => setEnrollTarget(student), visible: !student.is_degree_enrolled, disabled: student.academic_stage !== 'titulacion' },
                          { label: 'Cambiar ciclo', icon: ArrowRightLeftIcon, onSelect: () => openCycleModal({ id: student.student_id, name: student.name, cycle_id: student.cycle_id }) },
                          { label: 'Dar de baja de titulación', icon: UserMinusIcon, tone: 'destructive', onSelect: () => setUnenrollTarget(student), visible: student.is_degree_enrolled },
                        ]}
                      />
                    ),
                  },
                ]}
              />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Mostrando {degreeList.data.length} de {degreeList.meta?.total ?? degreeList.data.length} {(degreeList.meta?.total ?? degreeList.data.length) === 1 ? 'estudiante' : 'estudiantes'}
                </p>
                <CatalogPagination
                  label="estudiantes de titulación"
                  page={degreeList.page}
                  lastPage={degreeList.meta?.last_page ?? 1}
                  disabled={degreeList.isFetching}
                  onChange={degreeList.setPage}
                />
              </div>
            </>
          )}
        </>
      )}

      <FormDialog
        open={createOpen}
        title="Registrar estudiante"
        description="Ingresa sus datos y, si quieres, inscríbelo en una tutoría de su ciclo."
        pending={operation.pending}
        error={operation.error}
        dirty={isFormDirty}
        blockReason={createBlockReason}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateSubmit}
        submitIcon={UserPlusIcon}
        submitLabel="Registrar estudiante"
      >
        <FormField
          id="new-student-cedula"
          label="Cédula o pasaporte"
          tip="Cédula ecuatoriana de 10 dígitos o pasaporte de 6 a 9 caracteres."
          counter={{ current: form.identification.length, max: identificationMaxLength(form.identification) }}
          error={shouldShowIdentificationStatus(form.identification) && !isCedulaValid ? 'La cédula o pasaporte no es válido.' : null}
        >
          <Input
            id="new-student-cedula"
            required
            maxLength={10}
            value={form.identification}
            onChange={(e) => setForm({ ...form, identification: sanitizeIdentification(e.target.value) })}
            placeholder="0201234567 o AB1234567"
          />
        </FormField>

        <FormField id="new-student-name" label="Nombres y apellidos" tip="Nombre completo del estudiante (solo letras y espacios)." counter={{ current: form.name.length, max: 150 }}>
          <Input
            id="new-student-name"
            required
            maxLength={150}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: sanitizeLetters(e.target.value, 150) })}
            placeholder="Juan Carlos Pérez Rodríguez"
          />
        </FormField>

        <FormField
          id="new-student-email"
          label="Correo institucional"
          tip={`Debe pertenecer al dominio institucional (${institutionalEmailDomainsLabel}).`}
          counter={{ current: form.email.length, max: 150 }}
          error={form.email && !isEmailValid ? `El correo debe terminar en ${institutionalEmailDomainsLabel}.` : null}
        >
          <Input
            id="new-student-email"
            type="email"
            required
            maxLength={150}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value.trim() })}
            placeholder="jperez@ueb.edu.ec"
          />
        </FormField>

        <FormField id="new-student-phone" label="Teléfono" optional counter={{ current: form.phone.length, max: 10 }}>
          <Input
            id="new-student-phone"
            maxLength={10}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: sanitizeDigits(e.target.value, 10) })}
            placeholder="0991234567"
          />
        </FormField>

        <SelectField
          id="new-student-cycle"
          label="Ciclo"
          tip="Ciclo que cursa el estudiante. El último ciclo de la carrera es de titulación; los anteriores, de tutorías."
          value={form.cycle_id}
          onValueChange={handleCycleChange}
          disabled={loadingCycles}
          placeholder="Selecciona un ciclo"
          options={cycles.filter((cycle) => tabCycleNumber === undefined || cycle.number === tabCycleNumber).map((cycle) => ({
            value: String(cycle.id),
            label: `${cycle.name}${cycle.paralelo_name ? ` - Paralelo ${cycle.paralelo_name}` : ''}${isLastCycle(cycle) ? ' · Titulación' : ''}`,
          }))}
        />

        <SelectField
          id="new-student-tutoring"
          label="Tutoría"
          optional
          tip={
            isDegreeCycle
              ? 'En el último ciclo de la carrera los estudiantes solo acceden a titulación, con matrícula vigente.'
              : form.cycle_id
                ? 'Puedes inscribir al estudiante en una tutoría de este ciclo de inmediato o hacerlo después.'
                : 'Selecciona primero un ciclo para habilitar las tutorías.'
          }
          value={form.tutoring_id}
          onValueChange={(value) => setForm({ ...form, tutoring_id: value })}
          disabled={!form.cycle_id || isDegreeCycle || loadingTutorings}
          emptyLabel={form.cycle_id && !isDegreeCycle && availableTutoringsForCycle.length > 0 ? 'No asignar tutoría por ahora' : undefined}
          placeholder={
            !form.cycle_id
              ? 'Primero selecciona un ciclo'
              : isDegreeCycle
                ? 'Ciclo de titulación: sin tutorías'
                : availableTutoringsForCycle.length === 0
                  ? 'No hay tutorías activas en este ciclo'
                  : 'No asignar tutoría por ahora'
          }
          options={availableTutoringsForCycle.map((tutoring) => ({
            value: String(tutoring.id),
            label: `${tutoring.subject_name}${tutoring.section_name ? ` (Paralelo ${tutoring.section_name})` : ''}${tutoring.teacher_name ? ` — Docente: ${tutoring.teacher_name}` : ''}`,
          }))}
        />
      </FormDialog>

      <ConfirmModal
        open={Boolean(unlinking)}
        title="¿Desvincular tutoría del estudiante?"
        description={`${unlinking?.student.name ?? 'El estudiante'} dejará la tutoría de «${unlinking?.tutoring.subject_name ?? ''}» y perderá el acceso a sus sesiones.`}
        confirmLabel="Desvincular tutoría"
        pending={operation.pending}
        onClose={() => setUnlinking(null)}
        onConfirm={handleUnenroll}
      />

      <FormDialog
        open={Boolean(cycleTarget)}
        title={cycleTarget?.cycle_id ? 'Cambiar ciclo' : 'Asignar ciclo'}
        description={cycleTarget?.name}
        pending={operation.pending}
        error={operation.error}
        dirty={targetCycleId !== (cycleTarget?.cycle_id ? String(cycleTarget.cycle_id) : '')}
        blockReason={targetCycleId ? null : 'Selecciona el ciclo que cursa el estudiante.'}
        onClose={() => setCycleTarget(null)}
        onSubmit={handleCycleSubmit}
        submitLabel="Guardar ciclo"
      >
        <SelectField
          id="student-cycle"
          label="Ciclo que cursa"
          tip="Pasa a ese ciclo y a su paralelo. Sus tutorías actuales se conservan."
          value={targetCycleId}
          onValueChange={setTargetCycleId}
          placeholder="Selecciona un ciclo"
          options={[...careerCycles].sort((a, b) => a.number - b.number).map((cycle) => ({
            value: String(cycle.id),
            label: `${cycle.number}° ${cycle.name}${cycle.paralelo_name ? ` - Paralelo ${cycle.paralelo_name}` : ''}${isDegreeCycleNumber(cycle.number, careerMaxCycle) ? ' · Titulación' : ''}`,
          }))}
        />
      </FormDialog>

      <ConfirmModal
        open={Boolean(enrollTarget)}
        title={`¿Matricular a ${enrollTarget?.name} en titulación?`}
        description="Quedará matriculado en titulación en el período vigente y se le habilitará el módulo de titulación para presentar sus propuestas."
        confirmLabel="Matricular en titulación"
        pending={degreeOperation.pending}
        onClose={() => setEnrollTarget(null)}
        onConfirm={handleEnrollConfirm}
      />

      <ConfirmModal
        open={Boolean(unenrollTarget)}
        title={`¿Dar de baja a ${unenrollTarget?.name} de titulación?`}
        description={`${unenrollTarget?.name ?? 'El estudiante'} perderá su matrícula y el acceso al módulo de titulación en el período vigente.`}
        confirmLabel="Dar de baja de titulación"
        pending={degreeOperation.pending}
        onClose={() => setUnenrollTarget(null)}
        onConfirm={handleUnenrollConfirm}
      />
    </div>
  )
}

function StudentDatum({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground [overflow-wrap:anywhere]">{value}</dd>
    </div>
  )
}
