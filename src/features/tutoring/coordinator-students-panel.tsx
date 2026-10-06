import { useState, type FormEvent } from 'react'
import { PencilIcon, PlusIcon, PowerOffIcon, RotateCcwIcon } from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
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
import { sanitizeDigits, sanitizeLetters } from '@/lib/sanitize'
import { tutoringApi, type CoordinatorAvailableStudent, type CoordinatorEnrollment, type Tutoring } from '@/lib/tutoring-api'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { UsersIcon } from 'lucide-react'

const EMPTY_FORM = { identification: '', name: '', email: '', phone: '' }
type Mode = 'existing' | 'new'

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
        <Button className="h-10 shrink-0" disabled={operation.pending} onClick={() => openForm()}>
          <PlusIcon data-icon="inline-start" />Registrar estudiante
        </Button>
      </div>
      <ErrorNotice message={list.error} retry={list.reload} />
      {!open && <ErrorNotice message={operation.error} />}
      <RecordTable
        rows={list.data}
        loading={list.isFetching || list.isInitialLoading}
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
          {
            label: 'Acciones', render: (student) => (
              <div className="flex items-center gap-1">
                {student.can_edit_profile && (
                  <Button variant="ghost" size="icon-sm" title="Editar datos" aria-label={`Editar datos de ${student.name}`} disabled={operation.pending} onClick={() => openForm(student)}>
                    <PencilIcon />
                  </Button>
                )}
                {student.is_active
                  ? <Button variant="ghost" size="icon-sm" title="Deshabilitar inscripción" aria-label={`Deshabilitar a ${student.name}`} disabled={operation.pending} onClick={() => { operation.clearError(); setDeactivating(student) }}><PowerOffIcon /></Button>
                  : <Button variant="outline" size="sm" disabled={!student.student_is_active || operation.pending} onClick={() => void operation.run(() => tutoringApi.reenrollStudent(tutoring.id, student.id), 'Estudiante inscrito nuevamente.', list.reload)}><RotateCcwIcon data-icon="inline-start" />Reinscribir</Button>
                }
              </div>
            ),
          },
        ]}
      />
      <CatalogPagination label="estudiantes" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
      <MutationDialog
        open={open}
        title={editing ? 'Editar estudiante' : 'Registrar estudiante'}
        description={tutoring.subject_name}
        pending={operation.pending}
        error={operation.error}
        dirty={Boolean(selected) || JSON.stringify(form) !== JSON.stringify(initial)}
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel={editing ? 'Guardar cambios' : mode === 'new' ? 'Crear e inscribir' : 'Inscribir estudiante'}
        submitDisabled={!editing && mode === 'existing' && !selected}
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
            <Field>
              <FieldLabel htmlFor="coord-student-search">Estudiante</FieldLabel>
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
              <FieldDescription>Se listan los estudiantes del paralelo {tutoring.section_name ?? ''} que aún no están inscritos en esta tutoría (hasta 100).</FieldDescription>
            </Field>
            <ErrorNotice message={available.error} retry={available.reload} />
          </>
        )}
        {(editing || mode === 'new') && (
          <>
            {!editing && <p className="text-sm text-muted-foreground">Se creará la cuenta del estudiante, se lo asignará al paralelo {tutoring.section_name ?? ''} y se lo inscribirá en esta tutoría. Recibirá una contraseña provisional en su correo.</p>}
            <Field><div className="flex items-center justify-between"><FieldLabel htmlFor="coord-student-identification">Cédula</FieldLabel><FieldCounter current={form.identification.length} max={10} /></div><Input id="coord-student-identification" value={form.identification} onChange={(event) => setForm({ ...form, identification: sanitizeDigits(event.target.value, 10) })} inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required disabled={Boolean(editing)} placeholder="10 dígitos" /></Field>
            <Field><div className="flex items-center justify-between"><FieldLabel htmlFor="coord-student-name">Nombre completo</FieldLabel><FieldCounter current={form.name.length} max={150} /></div><Input id="coord-student-name" value={form.name} onChange={(event) => setForm({ ...form, name: sanitizeLetters(event.target.value, 150) })} maxLength={150} required placeholder="Apellidos y nombres" /></Field>
            <Field><div className="flex items-center justify-between"><FieldLabel htmlFor="coord-student-email">Correo institucional</FieldLabel><FieldCounter current={form.email.length} max={150} /></div><Input id="coord-student-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} maxLength={150} required disabled={Boolean(editing)} placeholder="estudiante@ueb.edu.ec" /></Field>
            <Field><div className="flex items-center justify-between"><FieldLabel htmlFor="coord-student-phone">Teléfono</FieldLabel><FieldCounter current={form.phone.length} max={10} /></div><Input id="coord-student-phone" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: sanitizeDigits(event.target.value, 10) })} maxLength={10} pattern="[0-9]{10}" placeholder="Opcional, 10 dígitos" /></Field>
          </>
        )}
      </MutationDialog>
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
              async () => { setDeactivating(null); await list.reload() },
            )
          }
        }}
      />
    </div>
  )
}
