import { useRef, useState, type FormEvent } from 'react'
import { PlusIcon, PowerOffIcon, RotateCcwIcon, UserPlusIcon, UserXIcon } from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { AbandonmentDialog } from '@/components/abandonment-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { IconAction } from '@/components/ui/icon-action'
import { EnrollmentNumberTag } from '@/components/enrollment-number-tag'
import { PersonNameFields } from '@/components/person-name-fields'
import { SearchSelect } from '@/components/ui/search-select'
import { SelectField } from '@/components/ui/select-field'
import { StatusBadge } from '@/components/ui/status-badge'
import { useDegreeResource, useDegreeSearch } from '@/features/degree-coordination/degree-hooks'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice } from '@/components/ui/error-notice'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { identificationMaxLength, isValidIdentification, sanitizeIdentification, shouldShowIdentificationStatus } from '@/lib/cedula'
import { institutionalEmailDomainsLabel, isInstitutionalEmail } from '@/lib/institutional-email'
import { DEFAULT_ENROLLMENT_NUMBER, ENROLLMENT_NUMBER_OPTIONS, ENROLLMENT_NUMBER_TIP, parseEnrollmentNumber } from '@/lib/enrollment-number'
import { firstNamesError, lastNamesError, normalizeName } from '@/lib/person-name'
import { sanitizeDigits } from '@/lib/sanitize'
import { teacherApi, type AvailableStudent, type Enrollment, type TeacherTutoring } from '@/lib/teacher-api'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { serverFieldError } from './teacher-labels'
import { TeacherEmpty } from './teacher-shared'
import { StudentsTabSkeleton } from './teacher-skeletons'

const EMPTY_FORM = { identification: '', first_names: '', last_names: '', email: '', phone: '' }
const NO_NAMES_TOUCHED = { first_names: false, last_names: false }

type Mode = 'existing' | 'new'

/** Estudiantes de la tutoría: datos, grupo e inscripción. Las notas se registran en «Calificaciones». */
export function StudentsPanel({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('')
  const list = usePaginatedCatalog((page, search) => teacherApi.students(tutoring.id, { page, search, status: status || undefined }), `${tutoring.id}:${status}`)
  const operation = useOperation()

  const [open, setOpen] = useState(false)
  const [deactivating, setDeactivating] = useState<Enrollment | null>(null)
  const [reenrolling, setReenrolling] = useState<Enrollment | null>(null)
  const [gradingStudent, setGradingStudent] = useState<Enrollment | null>(null)
  const [abandoning, setAbandoning] = useState<Enrollment | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  // Matrícula elegida al inscribir y la que se edita en el registro del estudiante.
  const [enrollmentNumber, setEnrollmentNumber] = useState(String(DEFAULT_ENROLLMENT_NUMBER))
  const [gradingNumber, setGradingNumber] = useState(String(DEFAULT_ENROLLMENT_NUMBER))
  const [mode, setMode] = useState<Mode>('existing')
  const [selected, setSelected] = useState<AvailableStudent | null>(null)
  // La cédula se valida en línea al salir del campo (o al completar su longitud).
  const [identificationTouched, setIdentificationTouched] = useState(false)
  // Nombres y apellidos vacíos solo se marcan después de pasar por el campo.
  const [namesTouched, setNamesTouched] = useState(NO_NAMES_TOUCHED)
  const registerButton = useRef<HTMLButtonElement>(null)
  const search = useDegreeSearch()
  const searching = open && mode === 'existing'
  const available = useDegreeResource(() => searching ? teacherApi.availableStudents(tutoring.id, search.search) : Promise.resolve([]), `${searching}:${tutoring.id}:${search.search}`)

  function openForm() {
    setForm(EMPTY_FORM); setEnrollmentNumber(String(DEFAULT_ENROLLMENT_NUMBER)); setMode('existing'); setSelected(null); setIdentificationTouched(false); setNamesTouched(NO_NAMES_TOUCHED); search.setInput(''); operation.clearError(); setOpen(true)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void operation.run(
      () => teacherApi.enrollStudent(tutoring.id, {
        ...(mode === 'new' ? { identification: form.identification, first_names: normalizeName(form.first_names), last_names: normalizeName(form.last_names), email: form.email.trim(), phone: form.phone || null } : { student_id: selected?.id ?? 0 }),
        enrollment_number: parseEnrollmentNumber(enrollmentNumber),
      }),
      mode === 'new' ? 'Estudiante creado e inscrito.' : 'Estudiante inscrito.',
      async () => {
        setOpen(false)
        // Al crear, el foco vuelve al botón que abrió el formulario (no a la primera fila de la tabla).
        setTimeout(() => registerButton.current?.focus(), 0)
        await list.reload()
      }
    )
  }
  function closeForm() {
    setOpen(false)
    operation.clearError()
  }

  // La fila abre el registro del estudiante: sus notas si la inscripción está activa,
  // o la confirmación para reinscribirlo si está deshabilitada (sin columna de acciones).
  const canGrade = (student: Enrollment) => tutoring.can_manage && student.is_active && !student.is_abandoned && !operation.pending
  const canSeeAbandonment = (student: Enrollment) => tutoring.can_manage && student.is_active && Boolean(student.is_abandoned) && !operation.pending
  const canReenroll = (student: Enrollment) => tutoring.can_manage && !student.is_active && student.student_is_active && !operation.pending

  function openStudent(student: Enrollment) {
    if (canGrade(student)) openEnrollment(student)
    else if (canSeeAbandonment(student)) { operation.clearError(); setAbandoning(student) }
    else if (canReenroll(student)) { operation.clearError(); setReenrolling(student) }
  }

  function openEnrollment(student: Enrollment) {
    setGradingStudent(student)
    setGradingNumber(String(student.enrollment_number))
    operation.clearError()
  }

  function submitEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!gradingStudent || operation.pending) return
    const student = gradingStudent
    void operation.run(
      // El teléfono registrado se reenvía para conservarlo.
      () => teacherApi.updateStudent(tutoring.id, student.id, { phone: student.phone, enrollment_number: parseEnrollmentNumber(gradingNumber) }),
      'Matrícula actualizada.',
      async () => {
        setGradingStudent(null)
        await list.reload()
      }
    )
  }

  const isCedulaValid = isValidIdentification(form.identification)
  const isEmailValid = isInstitutionalEmail(form.email)
  const identificationError = form.identification && !isCedulaValid ? 'La cédula o pasaporte no es válido.' : null
  const emailError = form.email && !isEmailValid ? `El correo debe terminar en ${institutionalEmailDomainsLabel}.` : null
  // Lo que rechaza el servidor va bajo su campo; la validación local tiene prioridad.
  const shownIdentificationError = ((identificationTouched || shouldShowIdentificationStatus(form.identification)) ? identificationError : null) ?? serverFieldError(operation, 'identification')
  const shownEmailError = emailError ?? serverFieldError(operation, 'email')
  const firstNamesProblem = normalizeName(form.first_names) ? firstNamesError(form.first_names) : 'Los nombres son obligatorios.'
  const lastNamesProblem = normalizeName(form.last_names) ? lastNamesError(form.last_names) : 'Los apellidos son obligatorios.'
  const shownFirstNamesError = ((namesTouched.first_names || form.first_names) ? firstNamesProblem : null) ?? serverFieldError(operation, 'first_names')
  const shownLastNamesError = ((namesTouched.last_names || form.last_names) ? lastNamesProblem : null) ?? serverFieldError(operation, 'last_names')
  const shownPhoneError = serverFieldError(operation, 'phone')
  const shownStudentError = serverFieldError(operation, 'student_id')
  const registerBlockReason = mode === 'existing'
    ? (selected ? null : 'Selecciona un estudiante.')
    : firstNamesProblem
      ?? lastNamesProblem
      ?? (!form.identification ? 'Escribe la cédula o pasaporte.' : identificationError)
      ?? (!form.email ? 'Escribe el correo institucional.' : emailError)

  // Primera carga: filtros, botón y tabla son un solo esqueleto; al filtrar o paginar solo cargan las filas.
  if (list.isInitialLoading) return <StudentsTabSkeleton />

  return <div className="flex flex-col gap-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex-1">
        <FilterBar id="teacher-students" search={list.searchInput} onSearch={list.setSearchInput} searchLabel="Buscar" searchPlaceholder="Busca por nombre, cédula o correo…" onClear={() => setStatus('')} filters={[
          { id: 'status', label: 'Estado', value: status, onChange: (value) => setStatus(value as '' | 'active' | 'inactive'), allLabel: 'Todos los estados', options: [{ value: 'active', label: 'Activos' }, { value: 'inactive', label: 'Inactivos' }] },
        ]} />
      </div>
      <Button ref={registerButton} className="shrink-0" disabled={!tutoring.can_manage} onClick={() => openForm()}><PlusIcon data-icon="inline-start" />Registrar estudiante</Button>
    </div>
    <ErrorNotice message={list.error} retry={list.reload} />
    <RecordTable
      rows={list.data}
      numberFrom={list.meta?.from}
      loading={list.isFetching}
      onRowClick={(student) => openStudent(student)}
      rowTitle={(student) => (canGrade(student) ? `Abrir la inscripción de ${student.name}` : canSeeAbandonment(student) ? `Ver el abandono de ${student.name}` : canReenroll(student) ? `Reinscribir a ${student.name}` : '')}
      empty={<TeacherEmpty title="No hay estudiantes para mostrar" description="Registra un estudiante o revisa los filtros de búsqueda." />}
      columns={[
        { label: 'Apellidos y nombres', render: (student) => <div className="flex flex-col gap-1"><span>{student.name}</span><EnrollmentNumberTag enrollmentNumber={student.enrollment_number} attendanceRequired={student.attendance_required} /></div> },
        { label: 'Correo', render: (student) => <span className="break-all">{student.email}</span> },
        { label: 'Grupo de Conocimiento', render: (student) => student.knowledge_group
          ? <span>{student.knowledge_group}</span>
          : <span className="text-xs text-muted-foreground">Sin diagnóstico</span> },
        { label: 'Inscripción', render: (student) => <div className="flex flex-col items-start gap-1">
          <StatusBadge active={student.is_active} activeLabel="Inscrito" inactiveLabel="Deshabilitado" />
          {student.is_abandoned && <Badge variant="warning">Abandonó</Badge>}
        </div> },
      ]}
    />
    <CatalogPagination label="estudiantes" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />

    {/* Modal para registrar un estudiante nuevo o inscribir uno existente */}
    <FormDialog open={open} title="Registrar estudiante" description={tutoring.subject_name} pending={operation.pending} error={operation.error} errorModal={operation.errorModal} dirty={Boolean(selected) || JSON.stringify(form) !== JSON.stringify(EMPTY_FORM) || enrollmentNumber !== String(DEFAULT_ENROLLMENT_NUMBER)} requireChanges={false} blockReason={registerBlockReason} onClose={closeForm} onSubmit={submit} submitLabel={mode === 'new' ? 'Crear e inscribir' : 'Inscribir estudiante'} submitIcon={UserPlusIcon}>
      <Tabs value={mode} onValueChange={(value) => { setMode(value as Mode); operation.clearError() }}>
        <TabsList aria-label="Cómo registrar al estudiante">
          <TabsTrigger value="existing">Ya registrado</TabsTrigger>
          <TabsTrigger value="new">Estudiante nuevo</TabsTrigger>
        </TabsList>
      </Tabs>
      {mode === 'existing' && <>
        <FormField id="teacher-student-search" label="Estudiante" required error={shownStudentError} tip={`Se listan los estudiantes del paralelo ${tutoring.section_name ?? ''} que aún no están inscritos en esta tutoría (hasta 100).`}>
          <SearchSelect
            id="teacher-student-search"
            query={search.input}
            onQueryChange={search.setInput}
            options={(available.data ?? []).map((student) => ({ value: String(student.id), label: student.name, description: `${student.identification} · ${student.email}` }))}
            selected={selected ? { value: String(selected.id), label: selected.name, description: `${selected.identification} · ${selected.email}` } : null}
            onSelect={(option) => setSelected(option ? (available.data ?? []).find((student) => String(student.id) === option.value) ?? null : null)}
            loading={available.loading}
            placeholder="Busca por nombre, cédula o correo…"
            emptyMessage="Ningún estudiante del paralelo coincide. Si no está registrado, usa «Estudiante nuevo»."
          />
        </FormField>
        <ErrorNotice message={available.error} retry={available.reload} />
      </>}
      {mode === 'new' && <>
        <p className="text-sm text-muted-foreground">Se creará la cuenta del estudiante, se lo asignará al paralelo {tutoring.section_name ?? ''} y se lo inscribirá en esta tutoría. Recibirá una contraseña provisional en su correo.</p>
        <PersonNameFields
          idPrefix="teacher-student"
          firstNames={form.first_names}
          lastNames={form.last_names}
          onFirstNamesChange={(value) => setForm({ ...form, first_names: value })}
          onLastNamesChange={(value) => setForm({ ...form, last_names: value })}
          onBlur={(field) => setNamesTouched((touched) => ({ ...touched, [field]: true }))}
          errors={{ first_names: shownFirstNamesError, last_names: shownLastNamesError }}
          required
        />

        <FormField id="teacher-student-identification" label="Cédula o pasaporte" required counter={{ current: form.identification.length, max: identificationMaxLength(form.identification) }} error={shownIdentificationError}>
          <Input
            id="teacher-student-identification"
            aria-invalid={Boolean(shownIdentificationError)}
            value={form.identification}
            onChange={(event) => setForm({ ...form, identification: sanitizeIdentification(event.target.value) })}
            onBlur={() => setIdentificationTouched(form.identification !== '')}
            maxLength={10}
            required
            placeholder="0201234567 o AB1234567"
          />
        </FormField>

        <FormField id="teacher-student-email" label="Correo institucional" required counter={{ current: form.email.length, max: 150 }} error={shownEmailError}>
          <Input
            id="teacher-student-email"
            aria-invalid={Boolean(shownEmailError)}
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value.trim() })}
            maxLength={150}
            required
            placeholder="jperez@ueb.edu.ec"
          />
        </FormField>

        <FormField id="teacher-student-phone" label="Teléfono" optional counter={{ current: form.phone.length, max: 10 }} error={shownPhoneError}>
          <Input
            id="teacher-student-phone"
            aria-invalid={Boolean(shownPhoneError)}
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: sanitizeDigits(event.target.value, 10) })}
            maxLength={10}
            placeholder="0991234567"
          />
        </FormField>
      </>}
      <SelectField id="teacher-student-enrollment-number" label="Matrícula" required tip={ENROLLMENT_NUMBER_TIP} value={enrollmentNumber} onValueChange={setEnrollmentNumber} options={ENROLLMENT_NUMBER_OPTIONS} error={serverFieldError(operation, 'enrollment_number')} />
    </FormDialog>

    {/* Inscripción del estudiante: matrícula, abandono y deshabilitar. Las notas van en «Calificaciones». */}
    <FormDialog
      open={Boolean(gradingStudent)}
      title="Inscripción del estudiante"
      description={gradingStudent ? `${gradingStudent.name} (${gradingStudent.identification}) · ${tutoring.subject_name}` : undefined}
      pending={operation.pending}
      error={operation.error}
      dirty={gradingStudent !== null && gradingNumber !== String(gradingStudent.enrollment_number)}
      errorModal={operation.errorModal}
      onClose={() => { setGradingStudent(null); operation.clearError() }}
      onSubmit={submitEnrollment}
      submitLabel="Guardar cambios"
      headerActions={gradingStudent ? <>
        <IconAction label="Registrar abandono" icon={UserXIcon} disabled={operation.pending} onClick={() => { operation.clearError(); setAbandoning(gradingStudent) }} />
        <IconAction label="Deshabilitar inscripción" icon={PowerOffIcon} tone="destructive" disabled={operation.pending} onClick={() => { operation.clearError(); setDeactivating(gradingStudent) }} />
      </> : undefined}
    >
      <div className="flex flex-col gap-4">
        <SelectField id="teacher-grade-enrollment-number" label="Matrícula" tip={ENROLLMENT_NUMBER_TIP} value={gradingNumber} onValueChange={setGradingNumber} options={ENROLLMENT_NUMBER_OPTIONS} error={serverFieldError(operation, 'enrollment_number')} />
        <p className="text-sm text-muted-foreground">Las notas y el resultado final se registran en la pestaña «Calificaciones».</p>
      </div>
    </FormDialog>

    <AbandonmentDialog
      target={abandoning}
      subject={tutoring.subject_name}
      operation={operation}
      onClose={() => setAbandoning(null)}
      onSave={(reason) => teacherApi.setAbandonment(tutoring.id, abandoning?.id ?? 0, { abandoned: true, reason })}
      onClear={() => teacherApi.setAbandonment(tutoring.id, abandoning?.id ?? 0, { abandoned: false })}
      onChanged={async () => { setAbandoning(null); setGradingStudent(null); await list.reload() }}
    />
    <ConfirmModal open={Boolean(deactivating)} title="¿Deshabilitar inscripción?" description={`${deactivating?.name ?? 'El estudiante'} dejará de participar en esta tutoría. Se conservarán sus notas y asistencias.`} confirmLabel="Deshabilitar inscripción" pending={operation.pending} onClose={() => { if (!operation.pending) setDeactivating(null) }} onConfirm={() => { if (deactivating) void operation.run(() => teacherApi.deactivateStudent(tutoring.id, deactivating.id), 'Inscripción deshabilitada.', async () => { setDeactivating(null); setGradingStudent(null); await list.reload() }) }} />
    <ConfirmModal open={Boolean(reenrolling)} variant="default" confirmIcon={RotateCcwIcon} title={`¿Reinscribir a ${reenrolling?.name ?? 'el estudiante'}?`} description="Volverá a participar en esta tutoría con sus notas y asistencias anteriores." confirmLabel="Reinscribir estudiante" pending={operation.pending} onClose={() => { if (!operation.pending) setReenrolling(null) }} onConfirm={() => { if (reenrolling) void operation.run(() => teacherApi.enrollStudent(tutoring.id, { student_id: reenrolling.student_id, enrollment_number: reenrolling.enrollment_number }), 'Estudiante inscrito nuevamente.', async () => { setReenrolling(null); await list.reload() }) }} />
  </div>
}
