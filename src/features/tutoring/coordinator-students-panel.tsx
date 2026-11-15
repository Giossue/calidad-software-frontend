import { useState, type FormEvent } from 'react'
import { PlusIcon, PowerOffIcon, RotateCcwIcon, UserXIcon } from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { AbandonmentDialog } from '@/components/abandonment-dialog'
import { Badge } from '@/components/ui/badge'
import { EnrollmentNumberTag } from '@/components/enrollment-number-tag'
import { PersonNameFields } from '@/components/person-name-fields'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { ErrorNotice } from '@/components/ui/error-notice'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { IconAction } from '@/components/ui/icon-action'
import { Input } from '@/components/ui/input'
import { SearchSelect } from '@/components/ui/search-select'
import { SelectField } from '@/components/ui/select-field'
import { StatusBadge } from '@/components/ui/status-badge'
import { useDegreeResource, useDegreeSearch } from '@/features/degree-coordination/degree-hooks'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { identificationMaxLength, isValidIdentification, sanitizeIdentification } from '@/lib/cedula'
import { DEFAULT_ENROLLMENT_NUMBER, ENROLLMENT_NUMBER_OPTIONS, ENROLLMENT_NUMBER_TIP, parseEnrollmentNumber } from '@/lib/enrollment-number'
import { firstNamesError, lastNamesError, normalizeName, splitStoredName } from '@/lib/person-name'
import { sanitizeDigits } from '@/lib/sanitize'
import { tutoringApi, type CoordinatorAvailableStudent, type CoordinatorEnrollment, type Tutoring } from '@/lib/tutoring-api'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { FilterBarSkeleton } from '@/components/ui/loading-skeletons'
import { Skeleton } from '@/components/ui/skeleton'
import { HeadedTableSkeleton } from '@/features/tutoring/tutoring-skeletons'

const EMPTY_FORM = { identification: '', first_names: '', last_names: '', email: '', phone: '', enrollment_number: String(DEFAULT_ENROLLMENT_NUMBER) }
type Mode = 'existing' | 'new'
type StudentForm = typeof EMPTY_FORM

// Errores de validación por campo; el primero bloquea "Guardar" en el diálogo.
// Al editar, los nombres y apellidos ya registrados no bloquean: solo se validan si cambian.
function validateStudentForm(form: StudentForm, editing: boolean, mode: Mode, selected: unknown, namesChanged: boolean): Partial<Record<keyof StudentForm | 'selected', string>> {
  const errors: Partial<Record<keyof StudentForm | 'selected', string>> = {}
  if (!editing && mode === 'existing') {
    if (!selected) errors.selected = 'Selecciona al estudiante que quieres inscribir.'
    return errors
  }
  if (namesChanged) {
    const firstNamesProblem = normalizeName(form.first_names) ? firstNamesError(form.first_names) : 'Los nombres son obligatorios.'
    const lastNamesProblem = normalizeName(form.last_names) ? lastNamesError(form.last_names) : 'Los apellidos son obligatorios.'
    if (firstNamesProblem) errors.first_names = firstNamesProblem
    if (lastNamesProblem) errors.last_names = lastNamesProblem
  }
  if (!editing && !isValidIdentification(form.identification)) errors.identification = /^\d{10}$/.test(form.identification) ? 'La cédula ingresada no es válida.' : 'Ingresa una cédula de 10 dígitos o un pasaporte de 6 a 9 letras o números.'
  if (!editing && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Escribe un correo electrónico válido.'
  if (form.phone && !/^\d{10}$/.test(form.phone)) errors.phone = 'El teléfono debe tener 10 dígitos numéricos.'
  return errors
}

/** `readOnly`: tutoría de un período pasado, se ven sus estudiantes sin inscribir ni editar. */
export function CoordinatorStudentsPanel({ tutoring, readOnly = false }: Readonly<{ tutoring: Tutoring; readOnly?: boolean }>) {
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('')
  const list = usePaginatedCatalog(
    (page, search) => tutoringApi.students(tutoring.id, { page, search, status: status || undefined }),
    `${tutoring.id}:${status}`,
  )
  const operation = useOperation()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CoordinatorEnrollment | null>(null)
  const [deactivating, setDeactivating] = useState<CoordinatorEnrollment | null>(null)
  const [abandoning, setAbandoning] = useState<CoordinatorEnrollment | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [initial, setInitial] = useState(EMPTY_FORM)
  const [mode, setMode] = useState<Mode>('existing')
  const [selected, setSelected] = useState<CoordinatorAvailableStudent | null>(null)
  const search = useDegreeSearch()
  const searching = open && !editing && mode === 'existing'
  const available = useDegreeResource(
    () => searching ? tutoringApi.availableStudents(tutoring.id, search.search).then((r) => r.data) : Promise.resolve([]),
    `${searching}:${tutoring.id}:${search.search}`,
  )

  const canEditFields = !editing || editing.can_edit_profile
  const namesChanged = !editing || form.first_names !== initial.first_names || form.last_names !== initial.last_names
  const errors = validateStudentForm(form, Boolean(editing), mode, selected, namesChanged)
  // Los errores por campo solo se muestran cuando el campo ya tiene contenido.
  const shown = {
    identification: form.identification ? errors.identification : undefined,
    first_names: form.first_names ? errors.first_names : undefined,
    last_names: form.last_names ? errors.last_names : undefined,
    email: form.email ? errors.email : undefined,
    phone: errors.phone,
  }
  const blockReason = Object.values(errors)[0] ?? null
  const numberChanged = form.enrollment_number !== initial.enrollment_number
  const dirty = editing ? JSON.stringify(form) !== JSON.stringify(initial) : mode === 'existing' ? Boolean(selected) || numberChanged : JSON.stringify(form) !== JSON.stringify(EMPTY_FORM)

  function openForm(student: CoordinatorEnrollment | null = null) {
    const next = student
      // Hay cuentas importadas sin cédula (o sin teléfono): el formulario trabaja con texto vacío.
      ? { identification: student.identification ?? '', first_names: splitStoredName(student.name).firstNames, last_names: splitStoredName(student.name).lastNames, email: student.email ?? '', phone: student.phone ?? '', enrollment_number: String(student.enrollment_number) }
      : EMPTY_FORM
    setEditing(student)
    setForm(next)
    setInitial(next)
    setMode('existing')
    setSelected(null)
    search.setInput('')
    operation.clearError()
    setOpen(true)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const names = { first_names: normalizeName(form.first_names), last_names: normalizeName(form.last_names) }
    const enrollmentNumber = parseEnrollmentNumber(form.enrollment_number)
    void operation.run(
      // Al editar, el nombre y la matrícula registrados se conservan si no se cambian.
      () => editing
        ? tutoringApi.updateStudent(tutoring.id, editing.id, { ...(namesChanged ? names : {}), phone: form.phone || null, ...(numberChanged ? { enrollment_number: enrollmentNumber } : {}) })
        : tutoringApi.enrollStudent(
            tutoring.id,
            mode === 'new'
              ? { identification: form.identification, ...names, email: form.email.trim(), phone: form.phone || null, enrollment_number: enrollmentNumber }
              : { student_id: selected?.id ?? 0, enrollment_number: enrollmentNumber },
          ),
      editing ? 'Datos del estudiante actualizados' : mode === 'new' ? 'Estudiante creado e inscrito' : 'Estudiante inscrito',
      async () => { setOpen(false); await list.reload() },
    )
  }

  // Primera carga de la pestaña: buscador, botón y tabla como esqueleto, sin controles reales.
  if (list.isInitialLoading) {
    return (
      <div className="flex flex-col gap-5">
        <span role="status" aria-label="Cargando estudiantes" className="sr-only">Cargando estudiantes</span>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start" aria-hidden="true">
          <div className="flex-1"><FilterBarSkeleton filters={1} /></div>
          <Skeleton className="h-9 w-44 shrink-0" />
        </div>
        <HeadedTableSkeleton headers={['#', 'Apellidos y nombres', 'Contacto', 'Inscripción']} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <FilterBar
            id="coordinator-students"
            search={list.searchInput}
            onSearch={list.setSearchInput}
            searchLabel="Buscar"
            searchPlaceholder="Busca por nombre, cédula o correo…"
            onClear={() => setStatus('')}
            filters={[
              { id: 'status', label: 'Estado', value: status, onChange: (value) => setStatus(value as '' | 'active' | 'inactive'), allLabel: 'Todos los estados', options: [{ value: 'active', label: 'Activos' }, { value: 'inactive', label: 'Inactivos' }] },
            ]}
          />
        </div>
        {!readOnly && (
          <Button className="shrink-0" disabled={operation.pending} onClick={() => openForm()}>
            <PlusIcon data-icon="inline-start" />Registrar estudiante
          </Button>
        )}
      </div>
      <ErrorNotice message={list.error} retry={list.reload} />
      <RecordTable
        numberFrom={list.meta?.from}
        rows={list.data}
        loading={list.isFetching || list.isInitialLoading}
        onRowClick={readOnly ? undefined : openForm}
        rowTitle={readOnly ? undefined : (student) => `Ver o editar a ${student.name}`}
        isRowSelected={(student) => open && editing?.id === student.id}
        empty={list.searchInput || status
          ? 'No hay estudiantes con estos filtros.'
          : 'Aún no hay estudiantes inscritos en esta tutoría.'}
        columns={[
          { label: 'Apellidos y nombres', render: (student) => <div className="flex flex-col gap-1"><span>{student.name}</span><span className="text-xs text-muted-foreground">{student.identification}</span><EnrollmentNumberTag enrollmentNumber={student.enrollment_number} attendanceRequired={student.attendance_required} /></div> },
          { label: 'Contacto', render: (student) => <div className="flex flex-col gap-1"><span className="break-all">{student.email}</span><span className="text-xs text-muted-foreground">{student.phone || 'Sin teléfono'}</span></div> },
          { label: 'Inscripción', render: (student) => <div className="flex flex-col items-start gap-1">
            <StatusBadge active={student.is_active} activeLabel="Inscrito" inactiveLabel="Deshabilitado" />
            {student.is_abandoned && <Badge variant="warning">Abandonó</Badge>}
          </div> },
        ]}
      />
      <CatalogPagination label="estudiantes" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
      <FormDialog
        open={open}
        title={editing ? 'Editar estudiante' : 'Registrar estudiante'}
        description={tutoring.subject_name}
        pending={operation.pending}
        error={operation.error}
        dirty={dirty}
        blockReason={blockReason}
        noChangesReason={editing && !editing.can_edit_profile ? 'Los datos de este estudiante no se pueden editar desde aquí.' : undefined}
        headerActions={editing ? (
          editing.is_active
            ? <>
              <IconAction label={editing.is_abandoned ? 'Ver abandono' : 'Registrar abandono'} icon={UserXIcon} disabled={operation.pending} onClick={() => { operation.clearError(); setAbandoning(editing) }} />
              <IconAction label="Deshabilitar inscripción" icon={PowerOffIcon} tone="destructive" disabled={operation.pending} onClick={() => { operation.clearError(); setDeactivating(editing) }} />
            </>
            : <IconAction label="Reinscribir estudiante" icon={RotateCcwIcon} disabled={!editing.student_is_active || operation.pending} onClick={() => void operation.run(() => tutoringApi.reenrollStudent(tutoring.id, editing.id), 'Estudiante inscrito nuevamente', async () => { setOpen(false); await list.reload() })} />
        ) : undefined}
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel={editing ? 'Guardar cambios' : mode === 'new' ? 'Crear e inscribir' : 'Inscribir estudiante'}
      >
        {!editing && (
          <div role="radiogroup" aria-label="Cómo registrar al estudiante" className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {([['existing', 'Ya registrado'], ['new', 'Estudiante nuevo']] as const).map(([value, label]) => (
              <label key={value} className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="coord-student-mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => { setMode(value); operation.clearError() }}
                  className="size-4 accent-primary"
                />
                {label}
              </label>
            ))}
          </div>
        )}
        {!editing && mode === 'existing' && (
          <>
            <FormField id="coord-student-search" label="Estudiante" required tip={`Se listan los estudiantes del paralelo ${tutoring.section_name ?? ''} que aún no están inscritos en esta tutoría (hasta 100).`}>
              <SearchSelect
                id="coord-student-search"
                query={search.input}
                onQueryChange={search.setInput}
                options={(available.data ?? []).map((student) => ({ value: String(student.id), label: student.name, description: `${student.identification} · ${student.email}` }))}
                selected={selected ? { value: String(selected.id), label: selected.name, description: `${selected.identification} · ${selected.email}` } : null}
                onSelect={(option) => setSelected(option ? (available.data ?? []).find((s) => String(s.id) === option.value) ?? null : null)}
                loading={available.loading}
                placeholder="Busca por nombre, cédula o correo…"
                emptyMessage="Ningún estudiante del paralelo coincide. Si no está registrado, usa «Estudiante nuevo»."
              />
            </FormField>
            <ErrorNotice message={available.error} retry={available.reload} />
          </>
        )}
        {(editing || mode === 'new') && (
          <>
            <PersonNameFields
              idPrefix="coord-student"
              firstNames={form.first_names}
              lastNames={form.last_names}
              onFirstNamesChange={(value) => setForm({ ...form, first_names: value })}
              onLastNamesChange={(value) => setForm({ ...form, last_names: value })}
              errors={{ first_names: shown.first_names ?? operation.fieldError('first_names'), last_names: shown.last_names ?? operation.fieldError('last_names') }}
              // Al editar solo son obligatorios si se cambian (un nombre que no se puede separar queda vacío).
              required={canEditFields && namesChanged}
              disabled={!canEditFields}
            />
            <FormField id="coord-student-identification" label="Cédula o pasaporte" required={!editing} counter={{ current: form.identification.length, max: identificationMaxLength(form.identification) }} error={shown.identification} tip={!editing ? `Se creará la cuenta del estudiante, se lo asignará al paralelo ${tutoring.section_name ?? ''} y se lo inscribirá en esta tutoría. Recibirá una contraseña provisional en su correo.` : undefined}>
              <Input id="coord-student-identification" value={form.identification} onChange={(event) => setForm({ ...form, identification: sanitizeIdentification(event.target.value) })} pattern="[0-9]{10}|[A-Z0-9]{6,9}" maxLength={10} required disabled={Boolean(editing)} aria-invalid={Boolean(shown.identification)} placeholder="Cédula (10 dígitos) o pasaporte" />
            </FormField>
            <FormField id="coord-student-email" label="Correo institucional" required={!editing} counter={{ current: form.email.length, max: 150 }} error={shown.email}>
              <Input id="coord-student-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} maxLength={150} required disabled={Boolean(editing)} aria-invalid={Boolean(shown.email)} placeholder="estudiante@ueb.edu.ec" />
            </FormField>
            <FormField id="coord-student-phone" label="Teléfono" optional counter={{ current: form.phone.length, max: 10 }} error={shown.phone}>
              <Input id="coord-student-phone" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: sanitizeDigits(event.target.value, 10) })} maxLength={10} pattern="[0-9]{10}" disabled={!canEditFields} aria-invalid={Boolean(shown.phone)} placeholder="10 dígitos" />
            </FormField>
          </>
        )}
        <SelectField id="coord-student-enrollment-number" label="Matrícula" required tip={ENROLLMENT_NUMBER_TIP} value={form.enrollment_number} onValueChange={(value) => setForm({ ...form, enrollment_number: value })} options={ENROLLMENT_NUMBER_OPTIONS} error={operation.fieldError('enrollment_number')} />
      </FormDialog>
      <AbandonmentDialog
        target={abandoning}
        subject={tutoring.subject_name}
        operation={operation}
        onClose={() => setAbandoning(null)}
        onSave={(reason) => tutoringApi.setAbandonment(tutoring.id, abandoning?.id ?? 0, { abandoned: true, reason })}
        onClear={() => tutoringApi.setAbandonment(tutoring.id, abandoning?.id ?? 0, { abandoned: false })}
        onChanged={async () => { setAbandoning(null); setOpen(false); await list.reload() }}
      />
      <ConfirmModal
        open={Boolean(deactivating)}
        title="¿Deshabilitar inscripción?"
        description={`${deactivating?.name ?? 'El estudiante'} dejará de participar en esta tutoría. Se conservarán sus notas y asistencias.`}
        confirmLabel="Deshabilitar inscripción"
        pending={operation.pending}
        onClose={() => { if (!operation.pending) setDeactivating(null) }}
        onConfirm={() => {
          if (deactivating) {
            void operation.run(
              () => tutoringApi.deactivateStudent(tutoring.id, deactivating.id),
              'Inscripción deshabilitada',
              async () => { setDeactivating(null); setOpen(false); await list.reload() },
            )
          }
        }}
      />
    </div>
  )
}
