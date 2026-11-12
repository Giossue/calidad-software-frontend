import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowLeftIcon,
  ArrowRightLeftIcon,
  GraduationCapIcon,
  UserMinusIcon,
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
import { SelectField } from '@/components/ui/select-field'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DetailPageSkeleton } from '@/components/ui/loading-skeletons'
import { useDetailParam } from '@/hooks/use-detail-param'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { isDegreeCycleNumber, maxCycleNumber } from '@/lib/academic-stage'
import type { Cycle } from '@/lib/api'
import { identificationMaxLength, isValidIdentification, sanitizeIdentification, shouldShowIdentificationStatus } from '@/lib/cedula'
import { institutionalEmailDomainsLabel, isInstitutionalEmail } from '@/lib/institutional-email'
import { formatSubjectName, sanitizeDigits, sanitizeLetters } from '@/lib/sanitize'
import {
  tutoringApi,
  type CoordinatorStudent,
  type DegreeStudent,
  type Tutoring,
} from '@/lib/tutoring-api'
import { FilterBar } from './filter-bar'
import { CareerBreadcrumb, CareerPicker } from './career-picker'
import { useOperation, useTutoringCatalogs } from './tutoring-hooks'
import { ErrorNotice } from '@/components/ui/error-notice'
import { CycleSelect, ModuleHeader, RecordTable, type TabbedScreen } from './tutoring-shared'
import { CAREER_PARAM } from './tutoring-navigation'
import type { Career } from '@/lib/api'
import { ListScreenSkeleton } from './tutoring-skeletons'

/** Esqueleto de Estudiantes: el mismo mientras cargan las carreras y la primera página. */
function StudentsSkeleton({ tabs }: Readonly<{ tabs?: number }>) {
  return <ListScreenSkeleton label="Cargando estudiantes" actions={2} filters={2} tabs={tabs} headers={['Estudiante', 'Correo', 'Teléfono', 'Estado']} />
}

/**
 * Carrera elegida, guardada en la URL (?carrera=) para que la pestaña Docentes la comparta y
 * la recarga la conserve. Con una sola carrera no hay nada que elegir: se entra directo a ella.
 */
function useCareerParam(careers: readonly Career[]) {
  const [params, setParams] = useSearchParams()
  const selectedId = Number(params.get(CAREER_PARAM))
  const single = careers.length === 1
  const career = careers.find((item) => item.id === selectedId) ?? (single ? careers[0] : undefined)
  function update(id: number | null) {
    const next = new URLSearchParams(params)
    if (id === null) next.delete(CAREER_PARAM)
    else next.set(CAREER_PARAM, String(id))
    setParams(next)
  }
  return { career, canChange: !single, select: (id: number) => update(id), clear: () => update(null) }
}

const EMPTY_STUDENT_FORM = {
  identification: '',
  name: '',
  email: '',
  phone: '',
  cycle_id: '',
  tutoring_id: '',
}

/** `screen`: se muestra como pestaña de «Usuarios» (su título y sus pestañas). */
export function TutoringStudentsPage({ screen }: Readonly<{ screen?: TabbedScreen }> = {}) {
  const catalogs = useTutoringCatalogs()
  const selection = useCareerParam(catalogs.careers)

  if (selection.career) {
    return <StudentsWorkspace catalogs={catalogs} careerId={selection.career.id} onBack={selection.canChange ? selection.clear : undefined} screen={screen} />
  }

  const picker = <CareerPicker catalogs={catalogs} title="Estudiantes" description={screen ? 'Elige la carrera cuyos estudiantes quieres ver.' : undefined} skeleton={<StudentsSkeleton tabs={screen?.tabCount} />} rowTitle={(career) => `Ver estudiantes de ${career.name}`} onSelect={(career) => selection.select(career.id)} tabs={screen?.tabs} />
  return picker
}

const WITHOUT_CYCLE = 'none'

function StudentsWorkspace({ catalogs, careerId, onBack, screen }: Readonly<{ catalogs: ReturnType<typeof useTutoringCatalogs>; careerId: number; onBack?: () => void; screen?: TabbedScreen }>) {
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

  // Estudiante abierto en la URL (?estudiante=<id>) para que "Atrás" vuelva a la lista.
  const detail = useDetailParam('estudiante')
  const [openedStudent, setOpenedStudent] = useState<CoordinatorStudent | null>(null)
  const [openedDegree, setOpenedDegree] = useState<DegreeStudent | null>(null)
  // Abierto desde la URL y fuera de la página actual: se busca entre los estudiantes de la carrera.
  const [careerStudents, setCareerStudents] = useState<{ id: number; students: readonly CoordinatorStudent[]; degree: readonly DegreeStudent[] } | null>(null)
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
        if (updated && assignStudent && assignStudent.id === updated.id) setOpenedStudent({ ...assignStudent, ...updated })
      },
      `Ciclo de ${cycleTarget.name} actualizado`,
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
      'Estudiante registrado',
      async () => {
        setCreateOpen(false)
        await Promise.all([list.reload(), degreeList.reload()])
      },
    )
  }

  function openAssignModal(student: CoordinatorStudent) {
    setOpenedStudent(student)
    setOpenedDegree(null)
    operation.clearError()
    detail.open(student.id)
  }

  function openDegreeStudent(student: DegreeStudent) {
    setOpenedDegree(student)
    setOpenedStudent(null)
    operation.clearError()
    detail.open(student.student_id)
  }

  const isFormDirty = JSON.stringify(form) !== JSON.stringify(initialForm)
  const isCedulaValid = isValidIdentification(form.identification)
  const isEmailValid = isInstitutionalEmail(form.email)

  // Primer error de validación: bloquea "Registrar estudiante" y se muestra en su tooltip.
  // En el orden de los campos: nombre, cédula y correo.
  const dataBlockReason =
    (!form.name.trim() ? 'El nombre es obligatorio.' : null) ??
    (!form.identification ? 'La cédula o pasaporte es obligatoria.' : !isCedulaValid ? 'La cédula o pasaporte no es válido.' : null) ??
    (!form.email ? 'El correo institucional es obligatorio.' : !isEmailValid ? `El correo debe terminar en ${institutionalEmailDomainsLabel}.` : null)
  const createBlockReason = dataBlockReason ?? (!form.cycle_id ? 'Selecciona el ciclo que cursa el estudiante.' : null)

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
      'Estudiante matriculado en titulación',
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
      'Estudiante dado de baja de titulación',
      async () => {
        setUnenrollTarget(null)
        await degreeList.reload()
      },
    )
  }

  const detailId = detail.id
  const assignStudent: CoordinatorStudent | null = detailId === null
    ? null
    : (openedStudent?.id === detailId ? openedStudent : null)
      ?? list.data.find((student) => student.id === detailId)
      ?? (careerStudents?.id === detailId ? careerStudents.students.find((student) => student.id === detailId) : undefined)
      ?? null
  const degreeStudent: DegreeStudent | null = detailId === null || openedStudent?.id === detailId
    ? null
    : degreeList.data.find((student) => student.student_id === detailId)
      ?? (openedDegree?.student_id === detailId ? openedDegree : null)
      ?? (careerStudents?.id === detailId ? careerStudents.degree.find((student) => student.student_id === detailId) : undefined)
      ?? null
  // En el ciclo de titulación se gestiona la matrícula; en los demás, sus tutorías.
  const showDegree = Boolean(degreeStudent) && (!assignStudent || openedDegree?.student_id === detailId)
  const listsLoading = list.isFetching || list.isInitialLoading || degreeList.isFetching || degreeList.isInitialLoading
  const foundInPage = Boolean(assignStudent || degreeStudent)
  const studentNotFound = detailId !== null && !foundInPage && careerStudents?.id === detailId && !listsLoading

  useEffect(() => {
    if (detailId === null || foundInPage || listsLoading) return
    let cancelled = false
    Promise.all([
      tutoringApi.allStudents({ career_id: careerId }).then((response) => response.data).catch(() => []),
      Promise.resolve(tutoringApi.degreeStudents({ career_id: careerId })).then((response) => response?.data ?? []).catch(() => []),
    ]).then(([students, degree]) => { if (!cancelled) setCareerStudents({ id: detailId, students, degree }) })
    return () => { cancelled = true }
  }, [detailId, foundInPage, listsLoading, careerId])


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
      {showDegree && degreeStudent ? (
        // Pantalla de un estudiante del ciclo de titulación: arriba cambiar ciclo (ícono) y su
        // matrícula (acción con texto y confirmación); debajo, sus datos.
        <div className="flex flex-col gap-6" data-tour-view="detail">
          <div>
            <Button type="button" variant="tertiary" onClick={detail.close}>
              <ArrowLeftIcon data-icon="inline-start" />
              Volver a estudiantes
            </Button>
          </div>
          <AdminSectionHeader
            title={degreeStudent.name}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {degreeStudent.is_degree_enrolled
                  ? <Badge variant="success">Matriculado{degreeStudent.enrolled_at ? ` · ${degreeStudent.enrolled_at}` : ''}</Badge>
                  : <Badge variant="inactive">No matriculado</Badge>}
                <Button type="button" variant="tertiary" size="icon" aria-label={degreeStudent.cycle_id ? 'Cambiar ciclo' : 'Asignar ciclo'} onClick={() => openCycleModal({ id: degreeStudent.student_id, name: degreeStudent.name, cycle_id: degreeStudent.cycle_id })}>
                  <ArrowRightLeftIcon />
                </Button>
                {degreeStudent.is_degree_enrolled ? (
                  <Button type="button" variant="secondary" disabled={degreeOperation.pending} onClick={() => setUnenrollTarget(degreeStudent)}>
                    <UserMinusIcon data-icon="inline-start" />
                    Dar de baja de titulación
                  </Button>
                ) : degreeStudent.academic_stage === 'titulacion' ? (
                  <Button type="button" disabled={degreeOperation.pending} onClick={() => setEnrollTarget(degreeStudent)}>
                    <GraduationCapIcon data-icon="inline-start" />
                    Matricular en titulación
                  </Button>
                ) : (
                  // Solo se matriculan en titulación los estudiantes del último ciclo de la carrera.
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="inline-flex rounded-md outline-hidden focus-visible:ring-3 focus-visible:ring-ring/50">
                        <Button type="button" disabled>
                          <GraduationCapIcon data-icon="inline-start" />
                          Matricular en titulación
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Solo se matricula en titulación a estudiantes del último ciclo de la carrera.</TooltipContent>
                  </Tooltip>
                )}
              </div>
            }
          />
          <dl className="grid max-w-2xl gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <StudentDatum label="Cédula o pasaporte" value={degreeStudent.identification} />
            <StudentDatum label="Correo institucional" value={degreeStudent.email} />
            <StudentDatum label="Teléfono" value={degreeStudent.phone || 'Sin teléfono'} />
            <StudentDatum label="Ciclo" value={degreeCycleText(degreeStudent)} />
            <StudentDatum label="Período de matrícula" value={degreeStudent.period_name ?? 'Sin período vigente'} />
          </dl>
        </div>
      ) : assignStudent ? (
        // Pantalla del estudiante: se abre al pulsar su fila. Arriba el ciclo y la acción de
        // cambiarlo; debajo, sus tutorías y sus datos en pestañas.
        <div className="flex flex-col gap-6" data-tour-view="detail">
          <div>
            <Button type="button" variant="tertiary" onClick={detail.close}>
              <ArrowLeftIcon data-icon="inline-start" />
              Volver a estudiantes
            </Button>
          </div>

          <AdminSectionHeader
            title={assignStudent.name}
            actions={
              <div className="flex items-center gap-2">
                <StatusBadge active={assignStudent.is_active} />
                <Button type="button" variant="tertiary" size="icon" aria-label={assignStudent.cycle_id ? 'Cambiar ciclo' : 'Asignar ciclo'} onClick={() => openCycleModal(assignStudent)}>
                  <ArrowRightLeftIcon />
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
              <RecordTable
                rows={assignStudent.tutorings.map((tutoring) => ({ ...tutoring, id: tutoring.enrollment_id }))}
                loading={false}
                empty="Aún no está inscrito en ninguna tutoría. Las inscripciones se hacen desde Tutorías."
                columns={[
                  { label: 'Asignatura', render: (tutoring) => formatSubjectName(tutoring.subject_name) },
                  { label: 'Ciclo', render: (tutoring) => tutoring.cycle_name },
                  { label: 'Paralelo', render: (tutoring) => tutoring.section_name ?? '—' },
                  { label: 'Período', render: (tutoring) => tutoring.period_name },
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
      ) : studentNotFound ? (
        <div className="flex flex-col items-start gap-4">
          <p className="text-sm text-muted-foreground">No encontramos este estudiante en la carrera.</p>
          <Button type="button" variant="secondary" onClick={detail.close}>Volver a estudiantes</Button>
        </div>
      ) : detailId !== null ? (
        <DetailPageSkeleton label="Cargando estudiante" tabs={2} />
      ) : list.isInitialLoading ? (
        <StudentsSkeleton tabs={screen?.tabCount} />
      ) : (
        <>
          <CareerBreadcrumb root="Estudiantes" career={careerName} onBack={onBack} />
          <ModuleHeader
            title="Estudiantes"
            description={`Registra a los estudiantes de ${careerName}, ubícalos en su ciclo y matricula en titulación a los del último. Haz clic en uno para abrirlo.`}
            createLabel="Registrar estudiante"
            onCreate={openCreateModal}
            extraActions={<BulkImportButton type="students" title="Carga masiva de estudiantes" description="Cada estudiante recibirá su contraseña provisional por correo y completará sus datos al ingresar. En «asignaturas_pendientes» escribe, separadas por «|», las asignaturas de ciclos anteriores que arrastra (código o nombre): no se le inscribirá en las que las continúan hasta que las apruebe. Si el estudiante ya está registrado, solo se actualizan sus pendientes." onFinished={list.reload} />}
          />
          {screen?.tabs}

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
                loading={list.isFetching || list.isInitialLoading}
                onRowClick={openAssignModal}
                rowTitle={(student) => `Abrir a ${student.name}`}
                empty={
                  hasStudentFilters
                    ? 'No hay estudiantes con estos filtros.'
                    : activeTab === WITHOUT_CYCLE
                      ? 'Todos los estudiantes de la carrera tienen un ciclo asignado.'
                      : 'Aún no hay estudiantes en este ciclo. Regístralos con «Registrar estudiante».'
                }
                columns={[
                  {
                    label: 'Estudiante',
                    render: (student) => (
                      <div className="flex flex-col gap-0.5">
                        <span>{student.name}</span>
                        {(student.pending_subjects ?? []).length > 0 && (
                          <span className="text-xs text-warning">
                            Arrastra: {(student.pending_subjects ?? []).map((subject) => formatSubjectName(subject.name)).join(', ')}
                          </span>
                        )}
                      </div>
                    ),
                  },
                  { label: 'Correo', render: (student) => student.email },
                  { label: 'Teléfono', render: (student) => <span className="whitespace-nowrap">{student.phone || 'Sin teléfono'}</span> },
                  { label: 'Estado', render: (student) => <StatusBadge active={student.is_active} /> },
                ]}
              />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {list.isFetching || list.isInitialLoading ? <span /> : <p className="text-sm text-muted-foreground">
                  Mostrando {list.data.length} de {list.meta?.total ?? list.data.length} {(list.meta?.total ?? list.data.length) === 1 ? 'estudiante' : 'estudiantes'}
                </p>}
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
                    allLabel: 'Con y sin matrícula',
                    options: [
                      { label: 'Matriculados', value: 'enrolled' },
                      { label: 'Sin matrícula', value: 'not_enrolled' },
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
                rows={degreeList.data}
                loading={degreeList.isFetching || degreeList.isInitialLoading}
                onRowClick={openDegreeStudent}
                rowTitle={(student) => `Abrir a ${student.name}`}
                empty={
                  degreeList.searchInput || degreeFilter !== ''
                    ? 'No hay estudiantes con estos filtros.'
                    : 'Aún no hay estudiantes en el ciclo de titulación. Regístralos o cámbialos de ciclo.'
                }
                columns={[
                  {
                    label: 'Estudiante',
                    render: (student) => student.name,
                  },
                  { label: 'Correo', render: (student) => student.email },
                  { label: 'Teléfono', render: (student) => <span className="whitespace-nowrap">{student.phone || 'Sin teléfono'}</span> },
                  {
                    label: 'Estado en Titulación',
                    render: (student) =>
                      student.is_degree_enrolled
                        ? <Badge variant="success">Matriculado{student.enrolled_at ? ` · ${student.enrolled_at}` : ''}</Badge>
                        : <Badge variant="inactive">No matriculado</Badge>,
                  },
                ]}
              />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {degreeList.isFetching || degreeList.isInitialLoading ? <span /> : <p className="text-sm text-muted-foreground">
                  Mostrando {degreeList.data.length} de {degreeList.meta?.total ?? degreeList.data.length} {(degreeList.meta?.total ?? degreeList.data.length) === 1 ? 'estudiante' : 'estudiantes'}
                </p>}
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
        errorModal={operation.errorModal}
        dirty={isFormDirty}
        blockReason={createBlockReason}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateSubmit}
        submitLabel="Registrar estudiante"
        steps={[
          {
            title: 'Datos del estudiante',
            blockReason: dataBlockReason,
            fields: ['name', 'identification', 'email', 'phone'],
            content: (
              <>
                <FormField id="new-student-name" label="Nombres y apellidos" required counter={{ current: form.name.length, max: 150 }} error={operation.fieldError('name')}>
                  <Input
                    id="new-student-name"
                    aria-invalid={Boolean(operation.fieldError('name'))}
                    required
                    maxLength={150}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: sanitizeLetters(e.target.value, 150) })}
                    placeholder="Juan Carlos Pérez Rodríguez"
                  />
                </FormField>

                <FormField
                  id="new-student-cedula"
                  label="Cédula o pasaporte"
                  required
                 
                  counter={{ current: form.identification.length, max: identificationMaxLength(form.identification) }}
                  error={operation.fieldError('identification') ?? (shouldShowIdentificationStatus(form.identification) && !isCedulaValid ? 'La cédula o pasaporte no es válido.' : null)}
                >
                  <Input
                    id="new-student-cedula"
                    aria-invalid={Boolean(operation.fieldError('identification') ?? (shouldShowIdentificationStatus(form.identification) && !isCedulaValid))}
                    required
                    maxLength={10}
                    value={form.identification}
                    onChange={(e) => setForm({ ...form, identification: sanitizeIdentification(e.target.value) })}
                    placeholder="0201234567 o AB1234567"
                  />
                </FormField>

                <FormField
                  id="new-student-email"
                  label="Correo institucional"
                  required
                 
                  counter={{ current: form.email.length, max: 150 }}
                  error={operation.fieldError('email') ?? (form.email && !isEmailValid ? `El correo debe terminar en ${institutionalEmailDomainsLabel}.` : null)}
                >
                  <Input
                    id="new-student-email"
                    aria-invalid={Boolean(operation.fieldError('email') ?? (form.email && !isEmailValid))}
                    type="email"
                    required
                    maxLength={150}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value.trim() })}
                    placeholder="jperez@ueb.edu.ec"
                  />
                </FormField>

                <FormField id="new-student-phone" label="Teléfono" optional counter={{ current: form.phone.length, max: 10 }} error={operation.fieldError('phone')}>
                  <Input
                    id="new-student-phone"
                    aria-invalid={Boolean(operation.fieldError('phone'))}
                    maxLength={10}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: sanitizeDigits(e.target.value, 10) })}
                    placeholder="0991234567"
                  />
                </FormField>

              </>
            ),
          },
          {
            title: 'Ciclo y tutoría',
            fields: ['cycle_id', 'tutoring_id'],
            content: (
              <>
                <SelectField
                  id="new-student-cycle"
                  label="Ciclo"
                  required
                  error={operation.fieldError('cycle_id')}
                  value={form.cycle_id}
                  onValueChange={handleCycleChange}
                  disabled={loadingCycles}
                  placeholder="Selecciona un ciclo"
                  options={cycles.filter((cycle) => tabCycleNumber === undefined || cycle.number === tabCycleNumber).map((cycle) => ({
                    value: String(cycle.id),
                    label: `${cycle.number}° ciclo${cycle.paralelo_name ? ` · Paralelo ${cycle.paralelo_name}` : ''}${isLastCycle(cycle) ? ' · Titulación' : ''}`,
                  }))}
                />

                <SelectField
                  id="new-student-tutoring"
                  label="Tutoría"
                  optional
                  tip={isDegreeCycle ? 'En el último ciclo de la carrera los estudiantes solo acceden a titulación, con matrícula vigente.' : undefined}
                  error={operation.fieldError('tutoring_id')}
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
              </>
            ),
          },
        ]}
      >
        {null}
      </FormDialog>

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
          error={operation.fieldError('cycle_id')}
          value={targetCycleId}
          onValueChange={setTargetCycleId}
          placeholder="Selecciona un ciclo"
          options={[...careerCycles].sort((a, b) => a.number - b.number).map((cycle) => ({
            value: String(cycle.id),
            label: `${cycle.number}° ciclo${cycle.paralelo_name ? ` · Paralelo ${cycle.paralelo_name}` : ''}${isDegreeCycleNumber(cycle.number, careerMaxCycle) ? ' · Titulación' : ''}`,
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

function degreeCycleText(student: DegreeStudent): string {
  if (!student.cycle_number) return 'Sin ciclo asignado'
  const section = student.section_name ? `Paralelo ${student.section_name.replace(/^Paralelo\s+/i, '')}` : null
  return [`${student.cycle_number}° ciclo${student.academic_stage === 'titulacion' ? ' · Titulación' : ''}`, section].filter(Boolean).join(' · ')
}

function StudentDatum({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground [overflow-wrap:anywhere]">{value}</dd>
    </div>
  )
}
