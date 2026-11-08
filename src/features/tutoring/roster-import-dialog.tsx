import { useState, type FormEvent } from 'react'
import { CheckCircle2Icon, FileTextIcon, InfoIcon, TriangleAlertIcon, UploadIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { FileDropzone } from '@/components/ui/file-dropzone'
import { Spinner } from '@/components/ui/spinner'
import { ApiError } from '@/lib/api'
import { formatSubjectName } from '@/lib/sanitize'
import { tutoringApi, type RosterImport, type RosterStudentStatus } from '@/lib/tutoring-api'
import { cn } from '@/lib/utils'

const STATUS: Record<RosterStudentStatus, { readonly preview: string; readonly done: string; readonly className: string }> = {
  new: { preview: 'Se registra e inscribe', done: 'Registrado e inscrito', className: 'text-emerald-700 dark:text-emerald-300' },
  enroll: { preview: 'Se inscribe', done: 'Inscrito', className: 'text-emerald-700 dark:text-emerald-300' },
  enrolled: { preview: 'Ya inscrito', done: 'Ya inscrito', className: 'text-muted-foreground' },
  blocked: { preview: 'No se inscribe', done: 'No se inscribió', className: 'text-amber-700 dark:text-amber-300' },
  error: { preview: 'Error', done: 'Error', className: 'text-destructive' },
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.firstValidationMessage ?? error.message
  return 'No fue posible conectar con el servidor.'
}

function count(report: RosterImport, ...statuses: RosterStudentStatus[]) {
  return report.students.filter((student) => statuses.includes(student.status)).length
}

/**
 * «Cargar listado PDF»: sube el listado del sistema académico, muestra qué se va a
 * hacer y, al confirmar, crea la tutoría, las cuentas y las inscripciones.
 */
export function RosterImportButton({ careerId, onFinished }: Readonly<{ careerId: number; onFinished?: () => unknown }>) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<RosterImport | null>(null)

  function close() {
    if (pending) return
    if (report?.applied) void onFinished?.()
    setOpen(false)
    setFile(null)
    setError(null)
    setReport(null)
  }

  async function send(confirm: boolean) {
    if (!file) return
    setPending(true)
    setError(null)
    try {
      setReport(await tutoringApi.importRoster(careerId, file, confirm))
    } catch (caught: unknown) {
      setError(errorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void send(false)
  }

  const toApply = report ? count(report, 'new', 'enroll') : 0

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} className="whitespace-nowrap max-sm:w-full" data-tour="tutorings-roster-import">
        <FileTextIcon data-icon="inline-start" />
        Cargar listado PDF
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title="Cargar listado de la asignatura"
        description="Sube el listado (PDF) que descargas del sistema académico. Se crea la tutoría del período vigente si no existe, se le asigna el docente y se registran e inscriben sus estudiantes."
        confirmClose={false}
        maxWidth="max-w-3xl"
      >
        {report === null ? (
          <form onSubmit={preview} aria-label="Cargar listado de la asignatura" className="flex flex-col gap-5">
            <FileDropzone
              id="roster-import"
              label="Listado en PDF"
              accept=".pdf,application/pdf"
              extensions={['.pdf']}
              file={file}
              onFileChange={(next) => {
                setFile(next)
                setError(null)
              }}
              onReject={setError}
              disabled={pending}
              hint="PDF de hasta 5 MB. Antes de cargar verás qué se hará con cada estudiante."
            />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={close} disabled={pending}>Cancelar</Button>
              <Button type="submit" disabled={pending || !file}>
                {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <UploadIcon data-icon="inline-start" />}
                {pending ? 'Leyendo…' : 'Revisar listado'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4" aria-live="polite">
            {report.applied && (
              <p className="flex items-center gap-2 text-sm">
                <CheckCircle2Icon className="size-5 text-emerald-600" aria-hidden="true" />
                Listado cargado: {count(report, 'new')} registrados, {count(report, 'enroll')} inscritos, {count(report, 'enrolled')} ya estaban y {count(report, 'blocked', 'error')} sin inscribir.
              </p>
            )}

            <dl className="grid gap-x-6 gap-y-2 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-2">
              <Detail label="Asignatura" value={report.subject ? `${formatSubjectName(report.subject.name)}${report.cycle_number ? ` · ${report.cycle_number}° ciclo` : ''}` : formatSubjectName(report.subject_name)} />
              <Detail label="Paralelo" value={report.section_name} />
              <Detail label="Período" value={report.period_name ?? '—'} />
              <Detail
                label="Tutoría"
                value={report.applied ? 'Lista' : report.tutoring?.exists ? 'Ya existe; se completa' : 'Se crea al confirmar'}
              />
              <Detail
                label="Docente"
                value={report.teacher ? `${report.teacher.name}${report.teacher.assign && !report.applied ? ' (se asigna)' : ''}` : 'Sin asignar'}
              />
            </dl>

            {report.errors.length > 0 && (
              <Notice tone="error" title="No se puede cargar el listado" items={report.errors} />
            )}
            {report.notes.length > 0 && <Notice tone="info" title="Ten en cuenta" items={report.notes} />}

            <div className="max-h-72 overflow-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Estudiantes del listado</caption>
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th scope="col" className="w-10 px-3 py-2">#</th>
                    <th scope="col" className="px-3 py-2">Estudiante</th>
                    <th scope="col" className="px-3 py-2">{report.applied ? 'Resultado' : 'Qué se hará'}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.students.map((student) => (
                    <tr key={student.email} className="border-t align-top">
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{student.number}</td>
                      <td className="px-3 py-2">
                        <span className="block font-medium">{student.name}</span>
                        <span className="block text-xs text-muted-foreground">{student.email}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn('block font-medium', STATUS[student.status].className)}>
                          {report.applied ? STATUS[student.status].done : STATUS[student.status].preview}
                        </span>
                        {student.message && <span className="block text-xs text-muted-foreground">{student.message}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap justify-end gap-3">
              {report.applied ? (
                <Button type="button" onClick={close}><XIcon data-icon="inline-start" />Cerrar</Button>
              ) : (
                <>
                  <Button type="button" variant="secondary" onClick={() => setReport(null)} disabled={pending}>Elegir otro archivo</Button>
                  <Button type="button" onClick={() => void send(true)} disabled={pending || report.errors.length > 0 || (toApply === 0 && report.tutoring?.exists === true && !report.teacher?.assign)}>
                    {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <CheckCircle2Icon data-icon="inline-start" />}
                    {pending ? 'Cargando…' : `Cargar ${toApply} ${toApply === 1 ? 'estudiante' : 'estudiantes'}`}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </>
  )
}

function Detail({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium" title={value}>{value}</dd>
    </div>
  )
}

function Notice({ tone, title, items }: Readonly<{ tone: 'error' | 'info'; title: string; items: readonly string[] }>) {
  const Icon = tone === 'error' ? TriangleAlertIcon : InfoIcon
  return (
    <section role={tone === 'error' ? 'alert' : undefined} className={cn('flex flex-col gap-1 rounded-lg border p-3 text-sm', tone === 'error' ? 'border-destructive/40 text-destructive' : 'border-amber-200 text-amber-800 dark:border-amber-900 dark:text-amber-200')}>
      <h3 className="flex items-center gap-2 font-semibold"><Icon className="size-4" aria-hidden="true" />{title}</h3>
      <ul className="list-disc pl-6">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  )
}
