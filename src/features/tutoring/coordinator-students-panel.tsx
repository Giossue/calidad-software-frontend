import { useState, type FormEvent } from 'react'
import { PlusIcon, PowerOffIcon, RotateCcwIcon, SaveIcon, UserPlusIcon, UsersIcon } from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { ErrorNotice } from '@/components/ui/error-notice'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { IconAction } from '@/components/ui/icon-action'
import { Input } from '@/components/ui/input'
import { SearchSelect } from '@/components/ui/search-select'
import { StatusBadge } from '@/components/ui/status-badge'
import { useDegreeResource, useDegreeSearch } from '@/features/degree-coordination/degree-hooks'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { identificationMaxLength, isValidIdentification, sanitizeIdentification } from '@/lib/cedula'
import { sanitizeDigits, sanitizeLetters } from '@/lib/sanitize'
import { tutoringApi, type CoordinatorAvailableStudent, type CoordinatorEnrollment, type Tutoring } from '@/lib/tutoring-api'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

const EMPTY_FORM = { identification: '', name: '', email: '', phone: '' }
type Mode = 'existing' | 'new'
type StudentForm = typeof EMPTY_FORM

// Errores de validación por campo; el primero bloquea "Guardar" en el diálogo.
function validateStudentForm(form: StudentForm, editing: boolean, mode: Mode, selected: unknown): Partial<Record<keyof StudentForm | 'selected', string>> {
  const errors: Partial<Record<keyof StudentForm | 'selected', string>> = {}
  if (!editing && mode === 'existing') {
    if (!selected) errors.selected = 'Selecciona al estudiante que quieres inscribir.'
    return errors
  }
  if (!editing && !isValidIdentification(form.identification)) errors.identification = /^\d{10}$/.test(form.identification) ? 'La cédula ingresada no es válida.' : 'Ingresa una cédula de 10 dígitos o un pasaporte de 6 a 9 letras o números.'
  if (!form.name.trim()) errors.name = 'El nombre completo es obligatorio.'
  if (!editing && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Escribe un correo electrónico válido.'
  if (form.phone && !/^\d{10}$/.test(form.phone)) errors.phone = 'El teléfono debe tener 10 dígitos numéricos.'
  return errors
}

export function CoordinatorStudentsPanel({ tutoring }: Readonly<{ tutoring: Tutoring }>) {
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('')
  const list = usePaginatedCatalog(
    (page, search) => tutoringApi.students(tutoring.id, { page, search, status: status || undefined }),
    `${tutoring.id}:${status}`,
  )
  const operation = useOperation()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CoordinatorEnrollment | null>(null)
  const [deactivating, setDeactivating] = useState<CoordinatorEnrollment | null>(null)
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
  const errors = validateStudentForm(form, Boolean(editing), mode, selected)
  // Los errores por campo solo se muestran cuando el campo ya tiene contenido.
  const shown = {
    identification: form.identification ? errors.identification : undefined,
    name: form.name ? errors.name : undefined,
    email: form.email ? errors.email : undefined,
    phone: errors.phone,
  }
  const blockReason = Object.values(errors)[0] ?? null
  const dirty = editing ? JSON.stringify(form) !== JSON.stringify(initial) : mode === 'existing' ? Boolean(selected) : JSON.stringify(form) !== JSON.stringify(EMPTY_FORM)

  function openForm(student: CoordinatorEnrollment | null = null) {
    const next = student
      ? { identification: student.identification, name: student.name, email: student.email, phone: student.phone ?? '' }
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
    void operation.run(
      () => editing
        ? tutoringApi.updateStudent(tutoring.id, editing.id, { name: form.name.trim(), phone: form.phone || null })
        : tutoringApi.enrollStudent(
            tutoring.id,
            mode === 'new'
              ? { identification: form.identification, name: form.name.trim(), email: form.email.trim(), phone: form.phone || null }
              : { student_id: selected?.id ?? 0 },
          ),
      editing ? 'Datos del estudiante actualizados.' : mode === 'new' ? 'Estudiante creado e inscrito.' : 'Estudiante inscrito.',
      async () => { setOpen(false); await list.reload() },
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
              { id: 'status', label: 'Estado', value: status, onChange: (value) => setStatus(value as '' | 'active' | 'inactive'), allLabel: 'Todos', options: [{ value: 'active', label: 'Activos' }, { value: 'inactive', label: 'Inactivos' }] },
            ]}
          />
        </div>
        <Button className="shrink-0" disabled={operation.pending} onClick={() => openForm()}>
          <PlusIcon data-icon="inline-start" />Registrar estudiante
        </Button>
      </div>
      <ErrorNotice message={list.error} retry={list.reload} />
      {!open && <ErrorNotice message={operation.error} />}
      <RecordTable
        rows={list.data}
        loading={list.isFetching || list.isInitialLoading}
        onRowClick={openForm}
        rowTitle={(student) => `Ver o editar a ${student.name}`}
        isRowSelected={(student) => open && editing?.id === student.id}
        empty={
          <Empty className="border-none p-0">
            <EmptyMedia variant="icon"><UsersIcon /></EmptyMedia>
            <EmptyTitle>No hay estudiantes para mostrar</EmptyTitle>
            <EmptyDescription>Registra un estudiante o revisa los filtros de búsqueda.</EmptyDescription>
          </Empty>
        }
        columns={[
          { label: 'Estudiante', render: (student) => <div className="flex flex-col gap-1"><span className="font-medium">{student.name}</span><span className="text-xs text-muted-foreground">{student.identification}</span></div> },
          { label: 'Contacto', render: (student) => <div className="flex flex-col gap-1"><span className="break-all">{student.email}</span><span className="text-xs text-muted-foreground">{student.phone || 'Sin teléfono'}</span></div> },
          { label: 'Inscripción', render: (student) => <StatusBadge active={student.is_active} activeLabel="Inscrito" inactiveLabel="Deshabilitado" /> },
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
            ? <IconAction label="Deshabilitar inscripción" icon={PowerOffIcon} tone="destructive" disabled={operation.pending} onClick={() => { operation.clearError(); setDeactivating(editing) }} />
            : <IconAction label="Reinscribir estudiante" icon={RotateCcwIcon} disabled={!editing.student_is_active || operation.pending} onClick={() => void operation.run(() => tutoringApi.reenrollStudent(tutoring.id, editing.id), 'Estudiante inscrito nuevamente.', async () => { setOpen(false); await list.reload() })} />
        ) : undefined}
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitIcon={editing ? SaveIcon : UserPlusIcon} submitLabel={editing ? 'Guardar cambios' : mode === 'new' ? 'Crear e inscribir' : 'Inscribir estudiante'}
      >
        {!editing && (
          <Tabs value={mode} onValueChange={(value) => { setMode(value as Mode); operation.clearError() }}>
            <TabsList aria-label="Cómo registrar al estudiante">
              <TabsTrigger value="existing">Ya registrado</TabsTrigger>
              <TabsTrigger value="new">Estudiante nuevo</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {!editing && mode === 'existing' && (
          <>
            <FormField id="coord-student-search" label="Estudiante" tip={`Se listan los estudiantes del paralelo ${tutoring.section_name ?? ''} que aún no están inscritos en esta tutoría (hasta 100).`}>
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
            <FormField id="coord-student-identification" label="Cédula o pasaporte" counter={{ current: form.identification.length, max: identificationMaxLength(form.identification) }} error={shown.identification} tip={!editing ? `Se creará la cuenta del estudiante, se lo asignará al paralelo ${tutoring.section_name ?? ''} y se lo inscribirá en esta tutoría. Recibirá una contraseña provisional en su correo.` : undefined}>
              <Input id="coord-student-identification" value={form.identification} onChange={(event) => setForm({ ...form, identification: sanitizeIdentification(event.target.value) })} pattern="[0-9]{10}|[A-Z0-9]{6,9}" maxLength={10} required disabled={Boolean(editing)} aria-invalid={Boolean(shown.identification)} placeholder="Cédula (10 dígitos) o pasaporte" />
            </FormField>
            <FormField id="coord-student-name" label="Nombre completo" counter={{ current: form.name.length, max: 150 }} error={shown.name}>
              <Input id="coord-student-name" value={form.name} onChange={(event) => setForm({ ...form, name: sanitizeLetters(event.target.value, 150) })} maxLength={150} required disabled={!canEditFields} aria-invalid={Boolean(shown.name)} placeholder="Apellidos y nombres" />
            </FormField>
            <FormField id="coord-student-email" label="Correo institucional" counter={{ current: form.email.length, max: 150 }} error={shown.email}>
              <Input id="coord-student-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} maxLength={150} required disabled={Boolean(editing)} aria-invalid={Boolean(shown.email)} placeholder="estudiante@ueb.edu.ec" />
            </FormField>
            <FormField id="coord-student-phone" label="Teléfono" optional counter={{ current: form.phone.length, max: 10 }} error={shown.phone}>
              <Input id="coord-student-phone" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: sanitizeDigits(event.target.value, 10) })} maxLength={10} pattern="[0-9]{10}" disabled={!canEditFields} aria-invalid={Boolean(shown.phone)} placeholder="10 dígitos" />
            </FormField>
          </>
        )}
      </FormDialog>
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
              'Inscripción deshabilitada.',
              async () => { setDeactivating(null); setOpen(false); await list.reload() },
            )
          }
        }}
      />
    </div>
  )
}
