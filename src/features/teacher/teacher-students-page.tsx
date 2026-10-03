import { useState, type FormEvent } from 'react'
import { GraduationCapIcon, PlusIcon, PowerOffIcon, RotateCcwIcon } from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Field, FieldCounter, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SearchSelect } from '@/components/ui/search-select'
import { StatusBadge } from '@/components/ui/status-badge'
import { useDegreeResource, useDegreeSearch } from '@/features/degree-coordination/degree-hooks'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice, MutationDialog, RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { isValidEcuadorianCedula } from '@/lib/cedula'
import { isValidGrade, sanitizeGradeInput } from '@/lib/grade-input'
import { sanitizeDigits, sanitizeLetters } from '@/lib/sanitize'
import { teacherApi, type AvailableStudent, type Enrollment, type GradeEntry, type GradeSettings, type TeacherTutoring } from '@/lib/teacher-api'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FilterBar } from '@/features/tutoring/filter-bar'
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

export function StudentsPanel({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('')
  const list = usePaginatedCatalog((page, search) => teacherApi.students(tutoring.id, { page, search, status: status || undefined }), `${tutoring.id}:${status}`)
  const operation = useOperation()
  const [open, setOpen] = useState(false)
  const [deactivating, setDeactivating] = useState<Enrollment | null>(null)
  const [gradingStudent, setGradingStudent] = useState<Enrollment | null>(null)
  const [gradesForm, setGradesForm] = useState(EMPTY_GRADES)
  const [initialGrades, setInitialGrades] = useState(EMPTY_GRADES)
  const [form, setForm] = useState(EMPTY_FORM)
  const [mode, setMode] = useState<Mode>('existing')
  const [selected, setSelected] = useState<AvailableStudent | null>(null)
  const search = useDegreeSearch()
  const searching = open && mode === 'existing'
  const available = useDegreeResource(() => searching ? teacherApi.availableStudents(tutoring.id, search.search) : Promise.resolve([]), `${searching}:${tutoring.id}:${search.search}`)
  const settingsResource = useDegreeResource(() => teacherApi.gradeSettings(), 'grade-settings')
  const settings = settingsResource.data ?? { minimum: 0, maximum: 10, groups: [] }

  function openForm() {
    setForm(EMPTY_FORM); setMode('existing'); setSelected(null); search.setInput(''); operation.clearError(); setOpen(true)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void operation.run(
      () => teacherApi.enrollStudent(tutoring.id, mode === 'new' ? { identification: form.identification, name: form.name.trim(), email: form.email.trim(), phone: form.phone || null } : { student_id: selected?.id ?? 0 }),
      mode === 'new' ? 'Estudiante creado e inscrito.' : 'Estudiante inscrito.',
      async () => { setOpen(false); await list.reload() }
    )
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

  const isCedulaValid = form.identification.length === 10 && isValidEcuadorianCedula(form.identification)
  const isEmailValid = form.email.endsWith('@ueb.edu.ec')

  const isDiagnosticValid = !gradesForm.diagnostic || isValidGrade(gradesForm.diagnostic, settings.maximum)
  const isPartialValid = !gradesForm.partial || isValidGrade(gradesForm.partial, settings.maximum)
  const isPartialTwoValid = !gradesForm.partial_two || isValidGrade(gradesForm.partial_two, settings.maximum)
  const isGradesValid = isDiagnosticValid && isPartialValid && isPartialTwoValid

  return <div className="flex flex-col gap-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex-1">
        <FilterBar id="teacher-students" search={list.searchInput} onSearch={list.setSearchInput} searchLabel="Buscar" searchPlaceholder="Busca por nombre, cédula o correo…" onClear={() => setStatus('')} filters={[
          { id: 'status', label: 'Estado', value: status, onChange: (value) => setStatus(value as '' | 'active' | 'inactive'), allLabel: 'Todos', options: [{ value: 'active', label: 'Activos' }, { value: 'inactive', label: 'Inactivos' }] },
        ]} />
      </div>
      <Button className="h-10 shrink-0" disabled={!tutoring.can_manage || operation.pending} onClick={() => openForm()}><PlusIcon data-icon="inline-start" />Registrar estudiante</Button>
    </div>
    <ErrorNotice message={list.error} retry={list.reload} />{!open && !gradingStudent && <ErrorNotice message={operation.error} />}
    <RecordTable rows={list.data} loading={list.isFetching || list.isInitialLoading} empty={<TeacherEmpty title="No hay estudiantes para mostrar" description="Registra un estudiante o revisa los filtros de búsqueda." />} columns={[
      { label: 'Estudiante', render: (student) => <div className="flex flex-col gap-1"><span className="font-medium">{student.name}</span><span className="text-xs text-muted-foreground">{student.identification}</span></div> },
      { label: 'Contacto', render: (student) => <div className="flex flex-col gap-1"><span className="break-all">{student.email}</span><span className="text-xs text-muted-foreground">{student.phone || 'Sin teléfono'}</span></div> },
      { label: 'Grupo de Conocimiento', render: (student) => {
        if (!student.knowledge_group) {
          return <span className="text-xs text-muted-foreground">Sin diagnóstico</span>
        }
        const key = student.knowledge_group.toLowerCase()
        const colorClass = key.includes('alto')
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
          : key.includes('medio')
          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
          : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
        return <Badge className={`font-semibold ${colorClass}`}>{student.knowledge_group}</Badge>
      } },
      { label: 'Calificaciones', render: (student) => <div className="flex flex-col gap-0.5 text-xs tabular-nums">
        <span>Diag: <span className="font-medium">{student.diagnostic_grade ?? '—'}</span></span>
        <span className="text-muted-foreground">P1: {student.partial_grade ?? '—'} · P2: {student.second_partial_grade ?? '—'}</span>
      </div> },
      { label: 'Inscripción', render: (student) => <StatusBadge active={student.is_active} activeLabel="Inscrito" inactiveLabel="Deshabilitado" /> },
      { label: 'Acciones', render: (student) => <div className="flex items-center gap-1">
        {student.is_active && <Button variant="ghost" size="icon-sm" title="Añadir notas" aria-label={`Añadir notas de ${student.name}`} disabled={!tutoring.can_manage || operation.pending} onClick={() => openGrades(student)}><GraduationCapIcon /></Button>}
        {student.is_active ? <Button variant="ghost" size="icon-sm" title="Deshabilitar inscripción" aria-label={`Deshabilitar a ${student.name}`} disabled={!tutoring.can_manage || operation.pending} onClick={() => { operation.clearError(); setDeactivating(student) }}><PowerOffIcon /></Button> : <Button variant="outline" size="sm" disabled={!tutoring.can_manage || !student.student_is_active || operation.pending} onClick={() => void operation.run(() => teacherApi.enrollStudent(tutoring.id, { student_id: student.student_id }), 'Estudiante inscrito nuevamente.', list.reload)}><RotateCcwIcon data-icon="inline-start" />Reinscribir</Button>}
      </div> },
    ]} />
    <CatalogPagination label="estudiantes" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />

    {/* Modal para registrar un estudiante nuevo o inscribir uno existente */}
    <MutationDialog open={open} title="Registrar estudiante" description={tutoring.subject_name} pending={operation.pending} error={operation.error} dirty={Boolean(selected) || JSON.stringify(form) !== JSON.stringify(EMPTY_FORM)} onClose={() => setOpen(false)} onSubmit={submit} submitLabel={mode === 'new' ? 'Crear e inscribir' : 'Inscribir estudiante'} submitDisabled={mode === 'existing' ? !selected : (!isCedulaValid || !isEmailValid || !form.name.trim())}>
      <Tabs value={mode} onValueChange={(value) => { setMode(value as Mode); operation.clearError() }}>
        <TabsList aria-label="Cómo registrar al estudiante">
          <TabsTrigger value="existing">Ya registrado</TabsTrigger>
          <TabsTrigger value="new">Estudiante nuevo</TabsTrigger>
        </TabsList>
      </Tabs>
      {mode === 'existing' && <>
        <Field>
          <FieldLabel htmlFor="teacher-student-search">Estudiante</FieldLabel>
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
          <FieldDescription>Se listan los estudiantes del paralelo {tutoring.section_name ?? ''} que aún no están inscritos en esta tutoría (hasta 100).</FieldDescription>
        </Field>
        <ErrorNotice message={available.error} retry={available.reload} />
      </>}
      {mode === 'new' && <>
        <p className="text-sm text-muted-foreground">Se creará la cuenta del estudiante, se lo asignará al paralelo {tutoring.section_name ?? ''} y se lo inscribirá en esta tutoría. Recibirá una contraseña provisional en su correo.</p>
        <Field>
          <FieldLabel htmlFor="teacher-student-identification">Cédula de Identidad *</FieldLabel>
          <Input
            id="teacher-student-identification"
            value={form.identification}
            onChange={(event) => setForm({ ...form, identification: sanitizeDigits(event.target.value, 10) })}
            maxLength={10}
            required
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
          <FieldLabel htmlFor="teacher-student-name">Nombres y Apellidos *</FieldLabel>
          <Input
            id="teacher-student-name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: sanitizeLetters(event.target.value, 150) })}
            maxLength={150}
            required
            placeholder="Juan Carlos Pérez Rodríguez"
          />
          <FieldDescription>Nombre completo del estudiante (solo letras y espacios).</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="teacher-student-email">Correo Institucional *</FieldLabel>
          <Input
            id="teacher-student-email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value.trim() })}
            maxLength={150}
            required
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
          <FieldLabel htmlFor="teacher-student-phone">Teléfono (opcional)</FieldLabel>
          <Input
            id="teacher-student-phone"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: sanitizeDigits(event.target.value, 10) })}
            maxLength={10}
            placeholder="0991234567"
          />
        </Field>
      </>}
    </MutationDialog>

    {/* Modal para añadir o corregir notas del estudiante */}
    <MutationDialog
      open={Boolean(gradingStudent)}
      title="Calificaciones del estudiante"
      description={gradingStudent ? `${gradingStudent.name} (${gradingStudent.identification}) · ${tutoring.subject_name}` : undefined}
      pending={operation.pending}
      error={operation.error}
      dirty={JSON.stringify(gradesForm) !== JSON.stringify(initialGrades)}
      onClose={() => setGradingStudent(null)}
      onSubmit={submitGrades}
      submitLabel="Guardar calificaciones"
      submitDisabled={!isGradesValid}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Ingresa o actualiza las calificaciones correspondientes a cada etapa.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="teacher-grade-diagnostic">Diagnóstico</FieldLabel>
            <Input
              id="teacher-grade-diagnostic"
              className="text-center tabular-nums"
              inputMode="decimal"
              maxLength={5}
              placeholder="0.00"
              aria-label={`Diagnóstico de ${gradingStudent?.name ?? ''}`}
              aria-invalid={gradesForm.diagnostic !== '' && !isDiagnosticValid}
              value={gradesForm.diagnostic}
              onChange={(e) => setGradesForm({ ...gradesForm, diagnostic: sanitizeGradeInput(e.target.value, gradesForm.diagnostic, settings.maximum) })}
              onBlur={() => { if (gradesForm.diagnostic !== '') setGradesForm((prev) => ({ ...prev, diagnostic: normalizeGrade(prev.diagnostic) })) }}
            />
            <FieldDescription>
              {groupFor(gradesForm.diagnostic, settings) ? `Grupo: ${groupFor(gradesForm.diagnostic, settings)}` : `Hasta ${settings.maximum}.00`}
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="teacher-grade-partial">Parcial 1</FieldLabel>
            <Input
              id="teacher-grade-partial"
              className="text-center tabular-nums"
              inputMode="decimal"
              maxLength={5}
              placeholder="0.00"
              aria-label={`Parcial 1 de ${gradingStudent?.name ?? ''}`}
              aria-invalid={gradesForm.partial !== '' && !isPartialValid}
              value={gradesForm.partial}
              onChange={(e) => setGradesForm({ ...gradesForm, partial: sanitizeGradeInput(e.target.value, gradesForm.partial, settings.maximum) })}
              onBlur={() => { if (gradesForm.partial !== '') setGradesForm((prev) => ({ ...prev, partial: normalizeGrade(prev.partial) })) }}
            />
            <FieldDescription>{`Hasta ${settings.maximum}.00`}</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="teacher-grade-partial-two">Parcial 2</FieldLabel>
            <Input
              id="teacher-grade-partial-two"
              className="text-center tabular-nums"
              inputMode="decimal"
              maxLength={5}
              placeholder="0.00"
              aria-label={`Parcial 2 de ${gradingStudent?.name ?? ''}`}
              aria-invalid={gradesForm.partial_two !== '' && !isPartialTwoValid}
              value={gradesForm.partial_two}
              onChange={(e) => setGradesForm({ ...gradesForm, partial_two: sanitizeGradeInput(e.target.value, gradesForm.partial_two, settings.maximum) })}
              onBlur={() => { if (gradesForm.partial_two !== '') setGradesForm((prev) => ({ ...prev, partial_two: normalizeGrade(prev.partial_two) })) }}
            />
            <FieldDescription>{`Hasta ${settings.maximum}.00`}</FieldDescription>
          </Field>
        </div>
      </div>
    </MutationDialog>

    <ConfirmModal open={Boolean(deactivating)} title="¿Deshabilitar inscripción?" description={`${deactivating?.name ?? 'El estudiante'} dejará de participar en esta tutoría. Se conservarán sus notas y asistencias.`} confirmLabel="Deshabilitar inscripción" pending={operation.pending} onClose={() => { if (!operation.pending) setDeactivating(null) }} onConfirm={() => { if (deactivating) void operation.run(() => teacherApi.deactivateStudent(tutoring.id, deactivating.id), 'Inscripción deshabilitada.', async () => { setDeactivating(null); await list.reload() }) }} />
  </div>
}
