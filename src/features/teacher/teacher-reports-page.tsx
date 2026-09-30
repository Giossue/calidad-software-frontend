import { useState, type FormEvent } from 'react'
import { FileTextIcon, SendIcon } from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice, MutationDialog, RecordTable } from '@/features/tutoring/tutoring-shared'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { formatDate } from '@/lib/format'
import { teacherApi, type TeacherReport, type TeacherTutoring } from '@/lib/teacher-api'
import { TeacherEmpty, TeacherWorkspacePage } from './teacher-shared'

const INITIAL = { title: 'Informe de tutorías', observations: '' }

export function TeacherReportsPage() {
  return <TeacherWorkspacePage title="Informes" description="Envía al Coordinador de Carrera un informe consolidado del trabajo de tus tutorías.">{(tutoring) => <ReportsTable tutoring={tutoring} />}</TeacherWorkspacePage>
}

function ReportsTable({ tutoring }: Readonly<{ tutoring: TeacherTutoring }>) {
  const list = usePaginatedCatalog((page) => teacherApi.reports(tutoring.id, { page }), String(tutoring.id))
  const operation = useOperation()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(INITIAL)
  const [reading, setReading] = useState<TeacherReport | null>(null)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void operation.run(() => teacherApi.sendReport(tutoring.id, { title: form.title.trim(), observations: form.observations.trim() }), 'Informe enviado al Coordinador de Carrera.', async () => { setOpen(false); await list.reload() })
  }

  return <div className="flex flex-col gap-5">
    <Card><CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3"><div className="flex flex-col gap-1"><CardTitle>Informes enviados</CardTitle><CardDescription>Conserva el consolidado de estudiantes, notas, asistencia y temas al momento del envío.</CardDescription></div><Button disabled={!tutoring.can_manage || operation.pending} onClick={() => { operation.clearError(); setForm(INITIAL); setOpen(true) }}><SendIcon data-icon="inline-start" />Enviar informe</Button></CardHeader></Card>
    <ErrorNotice message={list.error} retry={list.reload} />
    <RecordTable rows={list.data} loading={list.isInitialLoading || list.isFetching} empty={<TeacherEmpty title="Aún no hay informes enviados" description="Envía un informe para compartir el desarrollo de esta tutoría con el coordinador." />} columns={[
      { label: 'Informe', render: (report) => <span className="font-medium">{report.type}</span> }, { label: 'Autor', render: (report) => report.author_name }, { label: 'Enviado', render: (report) => formatDate(report.generated_at, true) },
      { label: 'Acciones', render: (report) => <Button variant="outline" size="sm" disabled={!report.content} onClick={() => setReading(report)}><FileTextIcon data-icon="inline-start" />Leer informe</Button> },
    ]} />
    <CatalogPagination label="informes" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
    <MutationDialog open={open} title="Enviar informe al coordinador" description={tutoring.subject_name} pending={operation.pending} error={operation.error} dirty={JSON.stringify(form) !== JSON.stringify(INITIAL)} onClose={() => setOpen(false)} onSubmit={submit} submitLabel="Enviar informe">
      <Field><FieldLabel htmlFor="teacher-report-title">Título del informe</FieldLabel><Input id="teacher-report-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={100} required /></Field>
      <Field><FieldLabel htmlFor="teacher-report-observations">Resultados y observaciones</FieldLabel><Textarea id="teacher-report-observations" value={form.observations} onChange={(event) => setForm({ ...form, observations: event.target.value })} maxLength={10000} rows={6} placeholder="Describe los avances, dificultades y resultados de las sesiones." /></Field>
    </MutationDialog>
    <Dialog open={Boolean(reading)} title={reading?.type ?? 'Informe'} description={reading ? `${reading.author_name} · ${formatDate(reading.generated_at, true)}` : undefined} confirmClose={false} onClose={() => setReading(null)}>
      <div className="flex flex-col gap-5"><article aria-label="Contenido del informe" className="max-h-[60vh] overflow-y-auto"><p className="whitespace-pre-wrap break-words text-sm leading-6">{reading?.content}</p></article><div className="flex justify-end"><DialogCancelButton>Cerrar informe</DialogCancelButton></div></div>
    </Dialog>
  </div>
}
