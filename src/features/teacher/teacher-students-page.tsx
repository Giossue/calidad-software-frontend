import { useState, type FormEvent } from 'react'
import { PencilIcon, PlusIcon, PowerOffIcon, RotateCcwIcon } from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { StatusBadge } from '@/components/ui/status-badge'
import { useDegreeResource, useDegreeSearch } from '@/features/degree-coordination/degree-hooks'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice, MutationDialog, RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { sanitizeDigits, sanitizeLetters } from '@/lib/sanitize'
import { teacherApi, type Enrollment, type TeacherTutoring } from '@/lib/teacher-api'
import { TeacherEmpty, TeacherFilters, TeacherWorkspacePage } from './teacher-shared'

const EMPTY_FORM = { student_id: 'new', identification: '', name: '', email: '', phone: '' }

export function TeacherStudentsPage() {
  return <TeacherWorkspacePage title="Estudiantes" description="Inscribe estudiantes en tus tutorías y mantén actualizados sus datos de contacto.">{(tutoring) => <StudentsTable tutoring={tutoring} />}</TeacherWorkspacePage>
}

function StudentsTable({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('')
  const list = usePaginatedCatalog((page, search) => teacherApi.students(tutoring.id, { page, search, status: status || undefined }), `${tutoring.id}:${status}`)
  const operation = useOperation()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Enrollment | null>(null)
  const [deactivating, setDeactivating] = useState<Enrollment | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [initial, setInitial] = useState(EMPTY_FORM)
  const search = useDegreeSearch()
  const available = useDegreeResource(() => open && !editing ? teacherApi.availableStudents(tutoring.id, search.search) : Promise.resolve([]), `${open}:${editing?.id ?? ''}:${tutoring.id}:${search.search}`)

  function openForm(student: Enrollment | null = null) {
    const next = student ? { student_id: String(student.student_id), identification: student.identification, name: student.name, email: student.email, phone: student.phone ?? '' } : EMPTY_FORM
    setEditing(student); setForm(next); setInitial(next); search.setInput(''); operation.clearError(); setOpen(true)
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void operation.run(() => editing
      ? teacherApi.updateStudent(tutoring.id, editing.id, { name: form.name.trim(), phone: form.phone || null })
      : teacherApi.enrollStudent(tutoring.id, form.student_id === 'new' ? { identification: form.identification, name: form.name.trim(), email: form.email.trim(), phone: form.phone || null } : { student_id: Number(form.student_id) }),
    editing ? 'Datos del estudiante actualizados.' : 'Estudiante inscrito.', async () => { setOpen(false); await list.reload() })
  }

  return <div className="flex flex-col gap-5">
    <Card><CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3"><CardTitle>Estudiantes de la tutoría</CardTitle><Button disabled={!tutoring.can_manage || operation.pending} onClick={() => openForm()}><PlusIcon data-icon="inline-start" />Registrar estudiante</Button></CardHeader><CardContent><TeacherFilters id="teacher-students" search={list.searchInput} onSearch={list.setSearchInput} status={status} onStatus={setStatus} /></CardContent></Card>
    <ErrorNotice message={list.error} retry={list.reload} />{!open && <ErrorNotice message={operation.error} />}
    <RecordTable rows={list.data} loading={list.isFetching || list.isInitialLoading} empty={<TeacherEmpty title="No hay estudiantes para mostrar" description="Registra un estudiante o revisa los filtros de búsqueda." />} columns={[
      { label: 'Estudiante', render: (student) => <div className="flex flex-col gap-1"><span className="font-medium">{student.name}</span><span className="text-xs text-muted-foreground">{student.identification}</span></div> },
      { label: 'Contacto', render: (student) => <div className="flex flex-col gap-1"><span className="break-all">{student.email}</span><span className="text-xs text-muted-foreground">{student.phone || 'Sin teléfono'}</span></div> },
      { label: 'Inscripción', render: (student) => <StatusBadge active={student.is_active} activeLabel="Inscrito" inactiveLabel="Deshabilitado" /> },
      { label: 'Acciones', render: (student) => <div className="flex items-center gap-1">
        {student.can_edit_profile && <Button variant="ghost" size="icon-sm" title="Editar datos" aria-label={`Editar datos de ${student.name}`} disabled={!tutoring.can_manage || operation.pending} onClick={() => openForm(student)}><PencilIcon /></Button>}
        {student.is_active ? <Button variant="ghost" size="icon-sm" title="Deshabilitar inscripción" aria-label={`Deshabilitar a ${student.name}`} disabled={!tutoring.can_manage || operation.pending} onClick={() => { operation.clearError(); setDeactivating(student) }}><PowerOffIcon /></Button> : <Button variant="outline" size="sm" disabled={!tutoring.can_manage || !student.student_is_active || operation.pending} onClick={() => void operation.run(() => teacherApi.enrollStudent(tutoring.id, { student_id: student.student_id }), 'Estudiante inscrito nuevamente.', list.reload)}><RotateCcwIcon data-icon="inline-start" />Reinscribir</Button>}
      </div> },
    ]} />
    <CatalogPagination label="estudiantes" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
    <MutationDialog open={open} title={editing ? 'Editar estudiante' : 'Registrar estudiante'} description={tutoring.subject_name} pending={operation.pending} error={operation.error} dirty={JSON.stringify(form) !== JSON.stringify(initial)} onClose={() => setOpen(false)} onSubmit={submit} submitLabel={editing ? 'Guardar cambios' : 'Inscribir estudiante'} submitDisabled={!form.student_id}>
      {!editing && <>
        <Field><FieldLabel htmlFor="teacher-student-search">Buscar estudiante del paralelo</FieldLabel><Input id="teacher-student-search" type="search" placeholder="Nombre, cédula o correo" value={search.input} onChange={(event) => search.setInput(event.target.value)} /><FieldDescription>Se muestran hasta 100 coincidencias del paralelo {tutoring.section_name ?? ''}.</FieldDescription></Field>
        <ErrorNotice message={available.error} retry={available.reload} />
        <Field><FieldLabel htmlFor="teacher-student-existing">Estudiante</FieldLabel><NativeSelect id="teacher-student-existing" value={form.student_id} onChange={(event) => setForm({ ...form, student_id: event.target.value })}><option value="new">Registrar un estudiante nuevo</option>{available.data?.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.identification}</option>)}</NativeSelect></Field>
      </>}
      {(editing || form.student_id === 'new') && <>
        <Field><FieldLabel htmlFor="teacher-student-identification">Cédula</FieldLabel><Input id="teacher-student-identification" value={form.identification} onChange={(event) => setForm({ ...form, identification: sanitizeDigits(event.target.value, 10) })} inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required disabled={Boolean(editing)} placeholder="10 dígitos" /></Field>
        <Field><FieldLabel htmlFor="teacher-student-name">Nombre completo</FieldLabel><Input id="teacher-student-name" value={form.name} onChange={(event) => setForm({ ...form, name: sanitizeLetters(event.target.value, 150) })} maxLength={150} required placeholder="Nombres y apellidos" /></Field>
        <Field><FieldLabel htmlFor="teacher-student-email">Correo institucional</FieldLabel><Input id="teacher-student-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} maxLength={150} required disabled={Boolean(editing)} placeholder="estudiante@ueb.edu.ec" /></Field>
        <Field><FieldLabel htmlFor="teacher-student-phone">Teléfono</FieldLabel><Input id="teacher-student-phone" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: sanitizeDigits(event.target.value, 10) })} maxLength={10} pattern="[0-9]{10}" placeholder="Opcional, 10 dígitos" /></Field>
      </>}
    </MutationDialog>
    <ConfirmModal open={Boolean(deactivating)} title="¿Deshabilitar inscripción?" description={`${deactivating?.name ?? 'El estudiante'} dejará de participar en esta tutoría. Se conservarán sus notas y asistencias.`} confirmLabel="Deshabilitar inscripción" pending={operation.pending} onClose={() => { if (!operation.pending) setDeactivating(null) }} onConfirm={() => { if (deactivating) void operation.run(() => teacherApi.deactivateStudent(tutoring.id, deactivating.id), 'Inscripción deshabilitada.', async () => { setDeactivating(null); await list.reload() }) }} />
  </div>
}
