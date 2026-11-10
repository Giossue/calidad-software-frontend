import { useRef, useState, type FormEvent } from 'react'
import { PlusIcon, PowerOffIcon, RotateCcwIcon, UserPlusIcon } from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { FormDialog } from '@/components/ui/form-dialog'
import { FieldDescription } from '@/components/ui/field'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { IconAction } from '@/components/ui/icon-action'
import { SearchSelect } from '@/components/ui/search-select'
import { SelectInput } from '@/components/ui/select-field'
import { StatusBadge } from '@/components/ui/status-badge'
import { useDegreeResource, useDegreeSearch } from '@/features/degree-coordination/degree-hooks'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice } from '@/components/ui/error-notice'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { identificationMaxLength, isValidIdentification, sanitizeIdentification, shouldShowIdentificationStatus } from '@/lib/cedula'
import { institutionalEmailDomainsLabel, isInstitutionalEmail } from '@/lib/institutional-email'
import { isValidGrade, sanitizeGradeInput } from '@/lib/grade-input'
import { sanitizeDigits, sanitizeLetters } from '@/lib/sanitize'
import { teacherApi, type AvailableStudent, type Enrollment, type FinalResult, type GradeEntry, type GradeSettings, type TeacherTutoring } from '@/lib/teacher-api'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { serverFieldError } from './teacher-labels'
import { TeacherEmpty } from './teacher-shared'

const EMPTY_FORM = { identification: '', name: '', email: '', phone: '' }
const EMPTY_GRADES = { diagnostic: '', partial: '', partial_two: '' }
type Mode = 'existing' | 'new'

function normalizeGrade(value: string): string {
  return /^\d{1,2}(\.\d{0,2})?$/.test(value) ? Number(value).toFixed(2) : value
}

function groupFor(value: string, settings: GradeSettings): string | null {
  if (!isValidGrade(value, settings.maximum)) return null
  const number = Number(value)
  return settings.groups.find((group) => number >= group.min && number <= group.max)?.label ?? null
}

const FINAL_RESULT_LABELS: Record<FinalResult, string> = { approved: 'Aprobó', failed: 'Reprobó' }
const FINAL_RESULT_OPTIONS = [{ value: 'approved', label: 'Aprobó' }, { value: 'failed', label: 'Reprobó' }]

/** Grupo de conocimiento con un color semántico (alto, medio, bajo). */
export function StudentsPanel({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('')
  const list = usePaginatedCatalog((page, search) => teacherApi.students(tutoring.id, { page, search, status: status || undefined }), `${tutoring.id}:${status}`)
  const operation = useOperation()

  function recordFinalResult(student: Enrollment, result: FinalResult | null) {
    void operation.run(
      () => teacherApi.setFinalResult(tutoring.id, student.id, result),
      result === 'approved'
        ? `${student.name} aprobó. Si existe la tutoría de la asignatura siguiente, quedó inscrito en ella.`
        : result === 'failed' ? `${student.name} reprobó.` : 'Resultado final quitado.',
      list.reload,
    )
  }
  const [open, setOpen] = useState(false)
  const [deactivating, setDeactivating] = useState<Enrollment | null>(null)
  const [reenrolling, setReenrolling] = useState<Enrollment | null>(null)
  const [gradingStudent, setGradingStudent] = useState<Enrollment | null>(null)
  const [gradesForm, setGradesForm] = useState(EMPTY_GRADES)
  const [initialGrades, setInitialGrades] = useState(EMPTY_GRADES)
  const [form, setForm] = useState(EMPTY_FORM)
  const [mode, setMode] = useState<Mode>('existing')
  const [selected, setSelected] = useState<AvailableStudent | null>(null)
  // La cédula se valida en línea al salir del campo (o al completar su longitud).
  const [identificationTouched, setIdentificationTouched] = useState(false)
  const registerButton = useRef<HTMLButtonElement>(null)
  const search = useDegreeSearch()
  const searching = open && mode === 'existing'
  const available = useDegreeResource(() => searching ? teacherApi.availableStudents(tutoring.id, search.search) : Promise.resolve([]), `${searching}:${tutoring.id}:${search.search}`)
  const settingsResource = useDegreeResource(() => teacherApi.gradeSettings(), 'grade-settings')
  const settings = settingsResource.data ?? { minimum: 0, maximum: 10, groups: [] }

  function openForm() {
    setForm(EMPTY_FORM); setMode('existing'); setSelected(null); setIdentificationTouched(false); search.setInput(''); operation.clearError(); setOpen(true)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void operation.run(
      () => teacherApi.enrollStudent(tutoring.id, mode === 'new' ? { identification: form.identification, name: form.name.trim(), email: form.email.trim(), phone: form.phone || null } : { student_id: selected?.id ?? 0 }),
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
  const canGrade = (student: Enrollment) => tutoring.can_manage && student.is_active && !operation.pending
  const canReenroll = (student: Enrollment) => tutoring.can_manage && !student.is_active && student.student_is_active && !operation.pending

  function openStudent(student: Enrollment) {
    if (canGrade(student)) openGrades(student)
    else if (canReenroll(student)) { operation.clearError(); setReenrolling(student) }
  }

  function openGrades(student: Enrollment) {
    const current = {
      diagnostic: student.diagnostic_grade ?? '',
      partial: student.partial_grade ?? '',
      partial_two: student.second_partial_grade ?? '',
    }
    setGradingStudent(student)
    setGradesForm(current)
    setInitialGrades(current)
    operation.clearError()
  }

  function submitGrades(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!gradingStudent || operation.pending) return

    const payload: GradeEntry = {
      enrollment_id: gradingStudent.id,
      diagnostic: gradesForm.diagnostic ? normalizeGrade(gradesForm.diagnostic) : undefined,
      partial: gradesForm.partial ? normalizeGrade(gradesForm.partial) : undefined,
      partial_two: gradesForm.partial_two ? normalizeGrade(gradesForm.partial_two) : undefined,
    }

    void operation.run(
      () => teacherApi.saveGrades(tutoring.id, [payload]),
      'Calificaciones guardadas.',
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
  const shownNameError = serverFieldError(operation, 'name')
  const shownPhoneError = serverFieldError(operation, 'phone')
  const shownStudentError = serverFieldError(operation, 'student_id')
  const registerBlockReason = mode === 'existing'
    ? (selected ? null : 'Selecciona un estudiante.')
    : (form.name.trim() ? null : 'Escribe los nombres y apellidos.')
      ?? (!form.identification ? 'Escribe la cédula o pasaporte.' : identificationError)
      ?? (!form.email ? 'Escribe el correo institucional.' : emailError)

  const isDiagnosticValid = !gradesForm.diagnostic || isValidGrade(gradesForm.diagnostic, settings.maximum)
  const isPartialValid = !gradesForm.partial || isValidGrade(gradesForm.partial, settings.maximum)
  const isPartialTwoValid = !gradesForm.partial_two || isValidGrade(gradesForm.partial_two, settings.maximum)
  const isGradesValid = isDiagnosticValid && isPartialValid && isPartialTwoValid
  const gradePlaceholder = `0.00 – ${settings.maximum.toFixed(2)}`
  const gradesBlockReason = isGradesValid ? null : `Las calificaciones deben estar entre ${settings.minimum} y ${settings.maximum}.`

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
    <RecordTable rows={list.data} numberFrom={list.meta?.from} loading={list.isFetching || list.isInitialLoading} onRowClick={openStudent} rowTitle={(student) => (canGrade(student) ? `Añadir notas de ${student.name}` : canReenroll(student) ? `Reinscribir a ${student.name}` : '')} empty={<TeacherEmpty title="No hay estudiantes para mostrar" description="Registra un estudiante o revisa los filtros de búsqueda." />} columns={[
      { label: 'Estudiante', render: (student) => <div className="flex flex-col gap-1"><span>{student.name}</span><span className="text-xs text-muted-foreground">{student.identification}</span></div> },
      { label: 'Contacto', render: (student) => <div className="flex flex-col gap-1"><span className="break-all">{student.email}</span><span className="text-xs text-muted-foreground">{student.phone || 'Sin teléfono'}</span></div> },
      { label: 'Grupo de Conocimiento', render: (student) => student.knowledge_group
        ? <span>{student.knowledge_group}</span>
        : <span className="text-xs text-muted-foreground">Sin diagnóstico</span> },
      { label: 'Calificaciones', render: (student) => <div className="flex flex-col gap-0.5 text-xs tabular-nums">
        <span>Diag: {student.diagnostic_grade ?? '—'}</span>
        <span className="text-muted-foreground">P1: {student.partial_grade ?? '—'} · P2: {student.second_partial_grade ?? '—'}</span>
      </div> },
      // El desplegable vive dentro de una fila que abre las notas: sus clics no deben llegar a la fila.
      { label: 'Resultado final', render: (student) => <div className="flex min-w-36 flex-col gap-1" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <SelectInput
          ariaLabel={`Resultado final de ${student.name}`}
          value={student.final_result ?? ''}
          onValueChange={(value) => recordFinalResult(student, (value || null) as FinalResult | null)}
          emptyLabel="Sin registrar"
          options={FINAL_RESULT_OPTIONS}
          disabled={!tutoring.can_manage || !student.is_active || operation.pending}
        />
        {!student.final_result && student.suggested_result && <span className="text-xs text-muted-foreground">Sugerido: {FINAL_RESULT_LABELS[student.suggested_result]}</span>}
      </div> },
      { label: 'Inscripción', render: (student) => <StatusBadge active={student.is_active} activeLabel="Inscrito" inactiveLabel="Deshabilitado" /> },
    ]} />
    <CatalogPagination label="estudiantes" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />

    {/* Modal para registrar un estudiante nuevo o inscribir uno existente */}
    <FormDialog open={open} title="Registrar estudiante" description={tutoring.subject_name} pending={operation.pending} error={operation.error} errorModal={operation.errorModal} dirty={Boolean(selected) || JSON.stringify(form) !== JSON.stringify(EMPTY_FORM)} requireChanges={false} blockReason={registerBlockReason} onClose={closeForm} onSubmit={submit} submitLabel={mode === 'new' ? 'Crear e inscribir' : 'Inscribir estudiante'} submitIcon={UserPlusIcon}>
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
        <FormField id="teacher-student-name" label="Nombres y apellidos" required counter={{ current: form.name.length, max: 150 }} error={shownNameError}>
          <Input
            id="teacher-student-name"
            aria-invalid={Boolean(shownNameError)}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: sanitizeLetters(event.target.value, 150) })}
            maxLength={150}
            required
            placeholder="Juan Carlos Pérez Rodríguez"
          />
        </FormField>

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
    </FormDialog>

    {/* Modal para añadir o corregir notas del estudiante */}
    <FormDialog
      open={Boolean(gradingStudent)}
      title="Calificaciones del estudiante"
      description={gradingStudent ? `${gradingStudent.name} (${gradingStudent.identification}) · ${tutoring.subject_name}` : undefined}
      pending={operation.pending}
      error={operation.error}
      dirty={JSON.stringify(gradesForm) !== JSON.stringify(initialGrades)}
      errorModal={operation.errorModal}
      onClose={() => { setGradingStudent(null); operation.clearError() }}
      onSubmit={submitGrades}
      submitLabel="Guardar calificaciones"
      blockReason={gradesBlockReason}
      headerActions={gradingStudent ? <IconAction label="Deshabilitar inscripción" icon={PowerOffIcon} tone="destructive" disabled={operation.pending} onClick={() => { operation.clearError(); setDeactivating(gradingStudent) }} /> : undefined}
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="teacher-grade-diagnostic" label="Diagnóstico">
            <Input
              id="teacher-grade-diagnostic"
              className="text-center tabular-nums"
              inputMode="decimal"
              maxLength={5}
              placeholder={gradePlaceholder}
              aria-label={`Diagnóstico de ${gradingStudent?.name ?? ''}`}
              aria-invalid={gradesForm.diagnostic !== '' && !isDiagnosticValid}
              value={gradesForm.diagnostic}
              onChange={(e) => setGradesForm({ ...gradesForm, diagnostic: sanitizeGradeInput(e.target.value, gradesForm.diagnostic, settings.maximum) })}
              onBlur={() => { if (gradesForm.diagnostic !== '') setGradesForm((prev) => ({ ...prev, diagnostic: normalizeGrade(prev.diagnostic) })) }}
            />
            {groupFor(gradesForm.diagnostic, settings) && <FieldDescription>{`Grupo: ${groupFor(gradesForm.diagnostic, settings)}`}</FieldDescription>}
          </FormField>

          <FormField id="teacher-grade-partial" label="Parcial 1">
            <Input
              id="teacher-grade-partial"
              className="text-center tabular-nums"
              inputMode="decimal"
              maxLength={5}
              placeholder={gradePlaceholder}
              aria-label={`Parcial 1 de ${gradingStudent?.name ?? ''}`}
              aria-invalid={gradesForm.partial !== '' && !isPartialValid}
              value={gradesForm.partial}
              onChange={(e) => setGradesForm({ ...gradesForm, partial: sanitizeGradeInput(e.target.value, gradesForm.partial, settings.maximum) })}
              onBlur={() => { if (gradesForm.partial !== '') setGradesForm((prev) => ({ ...prev, partial: normalizeGrade(prev.partial) })) }}
            />
          </FormField>

          <FormField id="teacher-grade-partial-two" label="Parcial 2">
            <Input
              id="teacher-grade-partial-two"
              className="text-center tabular-nums"
              inputMode="decimal"
              maxLength={5}
              placeholder={gradePlaceholder}
              aria-label={`Parcial 2 de ${gradingStudent?.name ?? ''}`}
              aria-invalid={gradesForm.partial_two !== '' && !isPartialTwoValid}
              value={gradesForm.partial_two}
              onChange={(e) => setGradesForm({ ...gradesForm, partial_two: sanitizeGradeInput(e.target.value, gradesForm.partial_two, settings.maximum) })}
              onBlur={() => { if (gradesForm.partial_two !== '') setGradesForm((prev) => ({ ...prev, partial_two: normalizeGrade(prev.partial_two) })) }}
            />
          </FormField>
        </div>
      </div>
    </FormDialog>

    <ConfirmModal open={Boolean(deactivating)} title="¿Deshabilitar inscripción?" description={`${deactivating?.name ?? 'El estudiante'} dejará de participar en esta tutoría. Se conservarán sus notas y asistencias.`} confirmLabel="Deshabilitar inscripción" pending={operation.pending} onClose={() => { if (!operation.pending) setDeactivating(null) }} onConfirm={() => { if (deactivating) void operation.run(() => teacherApi.deactivateStudent(tutoring.id, deactivating.id), 'Inscripción deshabilitada.', async () => { setDeactivating(null); setGradingStudent(null); await list.reload() }) }} />
    <ConfirmModal open={Boolean(reenrolling)} variant="default" confirmIcon={RotateCcwIcon} title={`¿Reinscribir a ${reenrolling?.name ?? 'el estudiante'}?`} description="Volverá a participar en esta tutoría con sus notas y asistencias anteriores." confirmLabel="Reinscribir estudiante" pending={operation.pending} onClose={() => { if (!operation.pending) setReenrolling(null) }} onConfirm={() => { if (reenrolling) void operation.run(() => teacherApi.enrollStudent(tutoring.id, { student_id: reenrolling.student_id }), 'Estudiante inscrito nuevamente.', async () => { setReenrolling(null); await list.reload() }) }} />
  </div>
}
