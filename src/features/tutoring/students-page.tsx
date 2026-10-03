import { useEffect, useState, type FormEvent } from 'react'
import {
  CalendarDaysIcon,
  CheckCircle2Icon,
  GraduationCapIcon,
  PlusIcon,
  Trash2Icon,
  UserMinusIcon,
  UserPlusIcon,
  UsersIcon,
  XCircleIcon,
} from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldCounter, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import type { Cycle } from '@/lib/api'
import { isValidEcuadorianCedula } from '@/lib/cedula'
import { sanitizeDigits, sanitizeLetters } from '@/lib/sanitize'
import {
  tutoringApi,
  type CoordinatorStudent,
  type CoordinatorStudentTutoring,
  type DegreeStudent,
  type Tutoring,
} from '@/lib/tutoring-api'
import { FilterBar } from './filter-bar'
import { useOperation } from './tutoring-hooks'
import { ErrorNotice, ModuleHeader, MutationDialog, RecordTable } from './tutoring-shared'

const EMPTY_STUDENT_FORM = {
  identification: '',
  name: '',
  email: '',
  phone: '',
  cycle_id: '',
  tutoring_id: '',
}

export function TutoringStudentsPage() {
  const list = usePaginatedCatalog((page, search) => tutoringApi.allStudents({ page, search }))
  const operation = useOperation()

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
          setCycles(loadedCycles.filter((c) => c.status))
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
    setForm(EMPTY_STUDENT_FORM)
    setInitialForm(EMPTY_STUDENT_FORM)
    operation.clearError()
    setCreateOpen(true)
  }

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = {
      identification: form.identification.trim(),
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || null,
      tutoring_id: form.tutoring_id ? Number(form.tutoring_id) : undefined,
    }

    void operation.run(
      () => tutoringApi.createCoordinatorStudent(input),
      'Estudiante registrado exitosamente.',
      async () => {
        setCreateOpen(false)
        await list.reload()
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
  const isCedulaValid = form.identification.length === 10 && isValidEcuadorianCedula(form.identification)
  const isEmailValid = form.email.endsWith('@ueb.edu.ec')

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
        enrolled: degreeFilter === '' ? undefined : degreeFilter === 'enrolled',
      }),
    degreeFilter,
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

  return (
    <div className="flex flex-col gap-6">
      <Tabs defaultValue="tutorings" className="w-full">
        <TabsList className="mb-2">
          <TabsTrigger value="tutorings" className="gap-2">
            <UsersIcon className="size-4" />
            <span>Estudiantes</span>
          </TabsTrigger>
          <TabsTrigger value="degree" className="gap-2">
            <GraduationCapIcon className="size-4" />
            <span>Titulación</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tutorings" className="flex flex-col gap-6">
      <ModuleHeader
        title="Estudiantes"
        description="Gestión global de estudiantes y asignación a las tutorías de la carrera."
        createLabel="Nuevo estudiante"
        onCreate={openCreateModal}
      />

      <div className="flex flex-col gap-3">
        <FilterBar
          id="tutoring-students-filter"
          search={list.searchInput}
          onSearch={list.setSearchInput}
          searchLabel="Buscar estudiante"
          searchPlaceholder="Busca por nombre, cédula o correo…"
          filters={[]}
          onClear={() => list.setSearchInput('')}
        />
      </div>

      <ErrorNotice message={list.error} retry={list.reload} />

      <RecordTable<CoordinatorStudent>
        rows={list.data}
        loading={list.isFetching || list.isInitialLoading}
        empty={
          <Empty className="border-none py-12">
            <EmptyMedia>
              <UsersIcon className="size-10 text-muted-foreground/60" />
            </EmptyMedia>
            <EmptyTitle>No se encontraron estudiantes</EmptyTitle>
            <EmptyDescription>
              {list.searchInput
                ? 'No hay estudiantes que coincidan con la búsqueda. Intenta con otros términos.'
                : 'Aún no hay estudiantes registrados. Registra nuevos estudiantes para asignarlos a tutorías.'}
            </EmptyDescription>
            {!list.searchInput && (
              <Button type="button" onClick={openCreateModal} className="mt-4">
                <PlusIcon data-icon="inline-start" />
                Registrar primer estudiante
              </Button>
            )}
          </Empty>
        }
        columns={[
          {
            label: 'Estudiante',
            render: (student) => (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{student.name}</span>
                  <StatusBadge active={student.is_active} />
                </div>
                <span className="text-xs text-muted-foreground">{student.email}</span>
              </div>
            ),
          },
          {
            label: 'Cédula',
            render: (student) => <span className="font-mono text-sm">{student.identification}</span>,
          },
          {
            label: 'Teléfono',
            render: (student) => (
              <span className="text-sm text-muted-foreground">{student.phone || '—'}</span>
            ),
          },
          {
            label: 'Tutorías Asignadas',
            render: (student) => {
              if (student.tutorings.length === 0) {
                return <span className="text-xs italic text-muted-foreground">Sin tutorías</span>
              }
              return (
                <div className="flex flex-wrap gap-1.5 max-w-md">
                  {student.tutorings.map((tutoring) => (
                    <Badge
                      key={tutoring.enrollment_id}
                      variant="secondary"
                      className="text-[11px] py-0.5 px-2 flex items-center gap-1.5"
                    >
                      <GraduationCapIcon className="size-3 text-muted-foreground" />
                      <span>{tutoring.subject_name}</span>
                      {tutoring.section_name && (
                        <span className="text-[10px] text-muted-foreground">
                          ({tutoring.section_name})
                        </span>
                      )}
                    </Badge>
                  ))}
                </div>
              )
            },
          },
          {
            label: 'Acciones',
            render: (student) => (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openAssignModal(student)}
                  className="gap-1.5 text-xs font-medium"
                >
                  <GraduationCapIcon className="size-3.5" />
                  Gestionar tutorías ({student.tutoring_count})
                </Button>
              </div>
            ),
          },
        ]}
      />

      <CatalogPagination
        label="estudiantes"
        page={list.page}
        lastPage={list.meta?.last_page ?? 1}
        disabled={list.isFetching}
        onChange={list.setPage}
      />

      {/* Modal: Registrar Nuevo Estudiante */}
      <MutationDialog
        open={createOpen}
        title="Registrar Nuevo Estudiante"
        description="Ingresa los datos personales del estudiante y, opcionalmente, asígnalo a una tutoría inicial."
        pending={operation.pending}
        error={operation.error}
        dirty={isFormDirty}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateSubmit}
        submitLabel="Registrar estudiante"
        submitDisabled={!isCedulaValid || !isEmailValid || !form.name.trim()}
      >
        <Field>
          <FieldLabel htmlFor="new-student-cedula">Cédula de Identidad *</FieldLabel>
          <Input
            id="new-student-cedula"
            required
            maxLength={10}
            value={form.identification}
            onChange={(e) => setForm({ ...form, identification: sanitizeDigits(e.target.value, 10) })}
            placeholder="0201234567"
          />
          <div className="flex justify-between items-center text-xs mt-1">
            <FieldDescription>Cédula ecuatoriana de 10 dígitos.</FieldDescription>
            <FieldCounter current={form.identification.length} max={10} />
          </div>
          {form.identification.length === 10 && !isCedulaValid && (
            <p className="text-xs text-destructive font-medium mt-1">La cédula no es válida.</p>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="new-student-name">Nombres y Apellidos *</FieldLabel>
          <Input
            id="new-student-name"
            required
            maxLength={150}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: sanitizeLetters(e.target.value, 150) })}
            placeholder="Juan Carlos Pérez Rodríguez"
          />
          <FieldDescription>Nombre completo del estudiante (solo letras y espacios).</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="new-student-email">Correo Institucional *</FieldLabel>
          <Input
            id="new-student-email"
            type="email"
            required
            maxLength={150}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value.trim() })}
            placeholder="jperez@ueb.edu.ec"
          />
          <FieldDescription>Debe pertenecer al dominio institucional (@ueb.edu.ec).</FieldDescription>
          {form.email && !isEmailValid && (
            <p className="text-xs text-destructive font-medium mt-1">
              El correo debe terminar en @ueb.edu.ec.
            </p>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="new-student-phone">Teléfono (opcional)</FieldLabel>
          <Input
            id="new-student-phone"
            maxLength={10}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: sanitizeDigits(e.target.value, 10) })}
            placeholder="0991234567"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="new-student-cycle">Ciclo (opcional)</FieldLabel>
          <NativeSelect
            id="new-student-cycle"
            value={form.cycle_id}
            onChange={(e) => handleCycleChange(e.target.value)}
            disabled={loadingCycles}
          >
            <option value="">-- Selecciona un ciclo --</option>
            {cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.name}{cycle.paralelo_name ? ` - Paralelo ${cycle.paralelo_name}` : ''}
              </option>
            ))}
          </NativeSelect>
          <FieldDescription>
            Selecciona el ciclo para ver las tutorías disponibles.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="new-student-tutoring">Tutoría (opcional)</FieldLabel>
          <NativeSelect
            id="new-student-tutoring"
            value={form.tutoring_id}
            onChange={(e) => setForm({ ...form, tutoring_id: e.target.value })}
            disabled={!form.cycle_id || loadingTutorings}
          >
            <option value="">
              {!form.cycle_id
                ? '-- Primero selecciona un ciclo --'
                : availableTutoringsForCycle.length === 0
                  ? '-- No hay tutorías activas en este ciclo --'
                  : '-- No asignar tutoría por ahora --'}
            </option>
            {availableTutoringsForCycle.map((tutoring) => (
              <option key={tutoring.id} value={tutoring.id}>
                {tutoring.subject_name}
                {tutoring.section_name ? ` (Paralelo ${tutoring.section_name})` : ''}
                {tutoring.teacher_name ? ` — Docente: ${tutoring.teacher_name}` : ''}
              </option>
            ))}
          </NativeSelect>
          <FieldDescription>
            {form.cycle_id
              ? 'Puedes inscribir al estudiante en una tutoría de este ciclo de inmediato o hacerlo después.'
              : 'Selecciona primero un ciclo para habilitar las tutorías.'}
          </FieldDescription>
        </Field>
      </MutationDialog>

      {/* Modal: Gestionar y Asignar Tutorías del Estudiante */}
      {assignStudent && (
        <Dialog
          open={Boolean(assignStudent)}
          title={`Tutorías de ${assignStudent.name}`}
          description={`Cédula: ${assignStudent.identification} | Correo: ${assignStudent.email}`}
          onClose={() => setAssignStudent(null)}
          maxWidth="max-w-2xl"
        >
          <div className="flex flex-col gap-6 p-1 max-h-[75vh] overflow-y-auto">
            {/* Lista de tutorías actualmente inscritas */}
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Tutorías actualmente inscritas ({assignStudent.tutorings.length})
              </h3>
              {assignStudent.tutorings.length === 0 ? (
                <p className="text-xs text-muted-foreground italic bg-muted/40 p-3 rounded-lg border border-dashed">
                  Este estudiante no se encuentra inscrito en ninguna tutoría actualmente.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {assignStudent.tutorings.map((tutoring) => (
                    <div
                      key={tutoring.enrollment_id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card text-card-foreground shadow-xs gap-3"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground">
                          {tutoring.subject_name}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{tutoring.cycle_name}</span>
                          {tutoring.section_name && <span>• Paralelo {tutoring.section_name}</span>}
                          <span>• {tutoring.period_name}</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2 gap-1 text-xs"
                        disabled={operation.pending}
                        onClick={() => setUnlinking({ student: assignStudent, tutoring })}
                      >
                        <Trash2Icon className="size-3.5" />
                        Desvincular
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <hr className="border-border" />

            {/* Asignar a nueva tutoría */}
            <form onSubmit={handleAssignSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <UserPlusIcon className="size-4 text-primary" />
                  Asignar a una nueva tutoría
                </h3>
                <p className="text-xs text-muted-foreground">
                  Selecciona una de las tutorías disponibles de la carrera para inscribir al estudiante.
                </p>
              </div>

              {loadingAvailable ? (
                <div className="flex items-center justify-center p-6 text-sm text-muted-foreground gap-2">
                  <Spinner className="size-4" />
                  Cargando tutorías disponibles…
                </div>
              ) : availableTutorings.length === 0 ? (
                <div className="p-4 rounded-lg bg-muted/40 border border-dashed text-xs text-muted-foreground text-center">
                  No hay más tutorías disponibles para inscribir a este estudiante.
                </div>
              ) : (
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="assign-tutoring-select">
                      Seleccionar tutoría disponible *
                    </FieldLabel>
                    <NativeSelect
                      id="assign-tutoring-select"
                      required
                      value={selectedTutoringId}
                      onChange={(e) => setSelectedTutoringId(e.target.value)}
                      disabled={operation.pending}
                    >
                      <option value="">-- Elige una tutoría --</option>
                      {filteredAvailableTutorings.map((tutoring) => (
                        <option key={tutoring.id} value={tutoring.id}>
                          {tutoring.subject_name} ({tutoring.cycle_name}
                          {tutoring.section_name ? ` - ${tutoring.section_name}` : ''})
                          {tutoring.teacher_name ? ` — Docente: ${tutoring.teacher_name}` : ''}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>

                  <ErrorNotice message={operation.error} />

                  <div className="flex justify-end gap-2 pt-2">
                    <DialogCancelButton disabled={operation.pending}>Cerrar</DialogCancelButton>
                    <Button
                      type="submit"
                      disabled={!selectedTutoringId || operation.pending}
                      className="gap-2"
                    >
                      {operation.pending && <Spinner className="size-4" />}
                      Inscribir en tutoría
                    </Button>
                  </div>
                </FieldGroup>
              )}
            </form>
          </div>
        </Dialog>
      )}

      {/* Modal Confirmación Desvinculación de Tutoría */}
      <ConfirmModal
        open={Boolean(unlinking)}
        title="¿Desvincular tutoría del estudiante?"
        description={`¿Estás seguro de que deseas retirar a ${unlinking?.student.name} de la tutoría de "${unlinking?.tutoring.subject_name}"? El estudiante perderá el acceso a las sesiones de esta tutoría.`}
        confirmLabel="Sí, desvincular"
        pending={operation.pending}
        onClose={() => setUnlinking(null)}
        onConfirm={handleUnenroll}
      />
        </TabsContent>

        <TabsContent value="degree" className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Matrícula en Titulación
              </h2>
              <p className="text-sm text-muted-foreground">
                Matricula a los estudiantes de la carrera en el período académico actual para habilitarles el acceso a la pestaña y módulo de titulación.
              </p>
            </div>
            {degreeList.meta?.current_period ? (
              <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground shadow-2xs">
                <CalendarDaysIcon className="size-4 text-primary shrink-0" />
                <span>Período actual:</span>
                <span className="font-semibold text-primary">{degreeList.meta.current_period.name}</span>
              </div>
            ) : !degreeList.isInitialLoading ? (
              <div className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                <span>Sin período académico activo</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            <FilterBar
              id="degree-students-filter"
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
          </div>

          <ErrorNotice message={degreeList.error} retry={degreeList.reload} />

          <RecordTable<DegreeStudent>
            rows={degreeList.data}
            loading={degreeList.isFetching || degreeList.isInitialLoading}
            empty={
              <Empty className="border-none py-12">
                <EmptyMedia>
                  <GraduationCapIcon className="size-10 text-muted-foreground/60" />
                </EmptyMedia>
                <EmptyTitle>No se encontraron estudiantes</EmptyTitle>
                <EmptyDescription>
                  {degreeList.searchInput || degreeFilter !== ''
                    ? 'No hay estudiantes que coincidan con los filtros aplicados. Intenta con otros términos.'
                    : 'Aún no hay estudiantes registrados en la carrera para este período académico.'}
                </EmptyDescription>
              </Empty>
            }
            columns={[
              {
                label: 'Estudiante',
                render: (student) => (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-foreground">{student.name}</span>
                    <span className="text-xs text-muted-foreground">{student.email}</span>
                  </div>
                ),
              },
              {
                label: 'Cédula',
                render: (student) => <span className="font-mono text-sm">{student.identification}</span>,
              },
              {
                label: 'Teléfono',
                render: (student) => (
                  <span className="text-sm text-muted-foreground">{student.phone || '—'}</span>
                ),
              },
              {
                label: 'Estado en Titulación',
                render: (student) =>
                  student.is_degree_enrolled ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 gap-1.5 font-medium text-xs py-1 px-2.5"
                    >
                      <CheckCircle2Icon className="size-3.5 text-emerald-600" />
                      Matriculado
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-border text-muted-foreground gap-1.5 text-xs py-1 px-2.5"
                    >
                      <XCircleIcon className="size-3.5 text-muted-foreground" />
                      No matriculado
                    </Badge>
                  ),
              },
              {
                label: 'Fecha Matrícula',
                render: (student) => (
                  <span className="text-sm text-muted-foreground">{student.enrolled_at || '—'}</span>
                ),
              },
              {
                label: 'Acciones',
                render: (student) => (
                  <div className="flex items-center gap-2">
                    {student.is_degree_enrolled ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setUnenrollTarget(student)}
                        disabled={degreeOperation.pending}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 text-xs font-medium"
                      >
                        <UserMinusIcon className="size-3.5" />
                        Dar de baja
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setEnrollTarget(student)}
                        disabled={degreeOperation.pending}
                        className="gap-1.5 text-xs font-medium"
                      >
                        <GraduationCapIcon className="size-3.5" />
                        Matricular en Titulación
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />

          <CatalogPagination
            label="estudiantes de titulación"
            page={degreeList.page}
            lastPage={degreeList.meta?.last_page ?? 1}
            disabled={degreeList.isFetching}
            onChange={degreeList.setPage}
          />
        </TabsContent>
      </Tabs>

      {/* Modal Confirmación Matrícula Titulación */}
      <ConfirmModal
        open={Boolean(enrollTarget)}
        title={`¿Matricular a ${enrollTarget?.name} en Titulación?`}
        description={`El estudiante quedará matriculado en titulación para el período ${degreeList.meta?.current_period?.name ?? 'actual'}. Se le habilitará inmediatamente la pestaña de titulación para presentar sus propuestas de grado.`}
        confirmLabel="Confirmar matrícula"
        pending={degreeOperation.pending}
        onClose={() => setEnrollTarget(null)}
        onConfirm={handleEnrollConfirm}
      />

      {/* Modal Confirmación Dar de Baja Titulación */}
      <ConfirmModal
        open={Boolean(unenrollTarget)}
        title={`¿Dar de baja a ${unenrollTarget?.name} de Titulación?`}
        description={`¿Estás seguro de que deseas retirar la matrícula de titulación a ${unenrollTarget?.name}? Se le deshabilitará el acceso a la pestaña de titulación para el período actual.`}
        confirmLabel="Sí, dar de baja"
        pending={degreeOperation.pending}
        onClose={() => setUnenrollTarget(null)}
        onConfirm={handleUnenrollConfirm}
      />
    </div>
  )
}
