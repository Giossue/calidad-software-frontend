import { useState, type FormEvent } from 'react'
import { HistoryIcon } from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice, MutationDialog, RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { formatDate } from '@/lib/format'
import { teacherApi, type Enrollment, type GradeType, type TeacherTutoring } from '@/lib/teacher-api'
import { TeacherEmpty, TeacherFilters, TeacherWorkspacePage } from './teacher-shared'

export function TeacherGradesPage() {
  return <TeacherWorkspacePage title="Calificaciones" description="Registra las notas diagnósticas y parciales de tus estudiantes y consulta su grupo de conocimiento.">{(tutoring) => <GradesTable tutoring={tutoring} />}</TeacherWorkspacePage>
}

function GradesTable({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  const list = usePaginatedCatalog((page, search) => teacherApi.students(tutoring.id, { page, search }), String(tutoring.id))
  const settings = useDegreeResource(() => teacherApi.gradeSettings())
  const operation = useOperation()
  const [editing, setEditing] = useState<{ student: Enrollment; type: GradeType } | null>(null)
  const [history, setHistory] = useState<Enrollment | null>(null)
  const [value, setValue] = useState('')
  const [initial, setInitial] = useState('')
  function openForm(student: Enrollment, type: GradeType) {
    const current = (type === 'diagnostic' ? student.diagnostic_grade : student.partial_grade) ?? ''
    setValue(current); setInitial(current); operation.clearError(); setEditing({ student, type })
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    void operation.run(() => teacherApi.registerGrade(tutoring.id, editing.student.id, editing.type, value), 'Calificación registrada.', async () => { setEditing(null); await list.reload() })
  }

  return <div className="flex flex-col gap-5">
    <Card><CardHeader><CardTitle>Notas por estudiante</CardTitle></CardHeader><CardContent><TeacherFilters id="teacher-grades" search={list.searchInput} onSearch={list.setSearchInput} /></CardContent></Card>
    <ErrorNotice message={list.error} retry={list.reload} /><ErrorNotice message={settings.error} retry={settings.reload} />
    <RecordTable rows={list.data} loading={list.isFetching || list.isInitialLoading} empty={<TeacherEmpty title="No hay estudiantes para evaluar" description="Inscribe estudiantes desde la sección Estudiantes." />} columns={[
      { label: 'Estudiante', render: (student) => <div className="flex flex-col gap-1"><span className="font-medium">{student.name}</span><span className="text-xs text-muted-foreground">{student.identification}{student.is_active ? '' : ' · Inscripción deshabilitada'}</span></div> },
      { label: 'Diagnóstico', render: (student) => student.diagnostic_grade ?? 'Sin registrar' },
      { label: 'Grupo de conocimiento', render: (student) => student.knowledge_group ? <Badge variant="secondary">{student.knowledge_group}</Badge> : <span className="text-muted-foreground">Sin diagnóstico</span> },
      { label: 'Parcial', render: (student) => student.partial_grade ?? 'Sin registrar' },
      { label: 'Acciones', render: (student) => <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" aria-label={`Registrar diagnóstico de ${student.name}`} disabled={!tutoring.can_manage || !student.is_active || !student.student_is_active || operation.pending || settings.loading || Boolean(settings.error)} onClick={() => openForm(student, 'diagnostic')}>Diagnóstico</Button>
        <Button variant="outline" size="sm" aria-label={`Registrar parcial de ${student.name}`} disabled={!tutoring.can_manage || !student.is_active || !student.student_is_active || operation.pending || settings.loading || Boolean(settings.error)} onClick={() => openForm(student, 'partial')}>Parcial</Button>
        <Button variant="ghost" size="icon-sm" title="Historial de notas" aria-label={`Ver historial de notas de ${student.name}`} onClick={() => setHistory(student)}><HistoryIcon /></Button>
      </div> },
    ]} />
    <CatalogPagination label="estudiantes" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
    <MutationDialog open={Boolean(editing)} title={editing?.type === 'diagnostic' ? 'Registrar nota diagnóstica' : 'Registrar nota parcial'} description={editing?.student.name} pending={operation.pending} error={operation.error} dirty={value !== initial} onClose={() => setEditing(null)} onSubmit={submit} submitLabel="Registrar nota" submitDisabled={!settings.data}>
      <Field><FieldLabel htmlFor="teacher-grade-value">Calificación</FieldLabel><Input id="teacher-grade-value" type="number" inputMode="decimal" step="0.01" min={settings.data?.minimum} max={settings.data?.maximum} value={value} onChange={(event) => setValue(event.target.value)} required /><FieldDescription>Escala de {settings.data?.minimum} a {settings.data?.maximum}.</FieldDescription></Field>
      {editing?.type === 'diagnostic' && <FieldDescription>{settings.data?.groups.map((group) => `${group.label}: ${group.min}–${group.max}`).join(' · ')}</FieldDescription>}
    </MutationDialog>
    <Dialog open={Boolean(history)} title="Historial de calificaciones" description={history?.name} onClose={() => setHistory(null)} confirmClose={false}><div className="flex flex-col gap-5">
      <RecordTable rows={history?.grade_history ?? []} loading={false} empty="Este estudiante aún no tiene calificaciones registradas." columns={[
        { label: 'Tipo', render: (grade) => grade.type === 'diagnostic' ? 'Diagnóstico' : grade.type === 'partial' ? 'Parcial' : grade.type }, { label: 'Nota', render: (grade) => grade.value }, { label: 'Registrada', render: (grade) => formatDate(grade.registered_at) },
      ]} /><div className="flex justify-end"><DialogCancelButton>Cerrar historial</DialogCancelButton></div>
    </div></Dialog>
  </div>
}
