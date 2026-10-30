import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CheckCircle2Icon, DownloadIcon, FileUpIcon, InfoIcon, TriangleAlertIcon, UploadIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ApiError, importsApi, type BulkImport, type BulkImportRowMessage, type BulkImportType } from '@/lib/api'
import { BULK_IMPORT_COLUMNS, BULK_IMPORT_POLL_MS } from '@/lib/bulk-import'

import { cn } from '@/lib/utils'

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.firstValidationMessage ?? error.message
  return 'No fue posible conectar con el servidor.'
}

/** Botón "Cargar datos masivos" con el diálogo para subir un CSV y ver el resultado por fila. */
export function BulkImportButton({
  type,
  title,
  description,
  onFinished,
  className,
}: Readonly<{
  type: BulkImportType
  title: string
  description?: string
  onFinished?: () => unknown
  className?: string
}>) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BulkImport | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const processing = result !== null && (result.status === 'pending' || result.status === 'processing')

  useEffect(() => {
    if (!result || !processing) return
    timer.current = window.setTimeout(() => {
      importsApi.status(result.id)
        .then(setResult)
        .catch((caught: unknown) => setError(errorMessage(caught)))
    }, BULK_IMPORT_POLL_MS)
    return () => window.clearTimeout(timer.current)
  }, [result, processing])

  function close() {
    if (pending) return
    window.clearTimeout(timer.current)
    if (result && result.created_count > 0) void onFinished?.()
    setOpen(false)
    setFile(null)
    setError(null)
    setResult(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) return
    setPending(true)
    setError(null)
    try {
      setResult(await importsApi.upload(type, file))
    } catch (caught: unknown) {
      setError(errorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  async function downloadTemplate() {
    try {
      await importsApi.downloadTemplate(type)
    } catch (caught: unknown) {
      setError(errorMessage(caught))
    }
  }

  const columns = BULK_IMPORT_COLUMNS[type]

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} className={cn('whitespace-nowrap', className)}>
        <FileUpIcon data-icon="inline-start" />
        Cargar datos masivos
      </Button>
      <Dialog open={open} onClose={close} title={title} description={description} confirmClose={false} maxWidth="max-w-2xl">
        {result === null ? (
          <form onSubmit={submit} aria-label={title} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-muted-foreground">
                Sube un archivo CSV (separado por comas o punto y coma, como lo guarda Excel) con estas columnas en la primera fila:
              </p>
              <ul className="flex flex-col gap-1">
                {columns.map((column) => (
                  <li key={column.name}>
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{column.name}</code>
                    {column.required ? <span className="ml-2 text-xs font-medium text-destructive">obligatoria</span> : <span className="ml-2 text-xs text-muted-foreground">opcional</span>}
                    {column.hint && <span className="ml-2 text-xs text-muted-foreground">{column.hint}</span>}
                  </li>
                ))}
              </ul>
              <div>
                <Button type="button" variant="tertiary" size="sm" className="-ml-3" onClick={() => void downloadTemplate()}>
                  <DownloadIcon data-icon="inline-start" />
                  Descargar plantilla
                </Button>
              </div>
            </div>
            <Field>
              <FieldLabel htmlFor={`bulk-import-${type}`}>Archivo CSV</FieldLabel>
              <Input
                id={`bulk-import-${type}`}
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                disabled={pending}
              />
              <FieldDescription>Máximo 2 MB y 1000 filas. Las filas con errores se informan y no detienen la carga.</FieldDescription>
            </Field>
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={close} disabled={pending}>Cancelar</Button>
              <Button type="submit" disabled={pending || !file}>
                {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <UploadIcon data-icon="inline-start" />}
                {pending ? 'Subiendo…' : 'Importar'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-5" aria-live="polite">
            {processing ? (
              <p className="flex items-center gap-2 text-sm">
                <Spinner aria-hidden="true" />
                Procesando {result.total_rows} {result.total_rows === 1 ? 'fila' : 'filas'}…
              </p>
            ) : result.status === 'failed' ? (
              <p role="alert" className="text-sm font-medium text-destructive">La importación se interrumpió por un error del servidor. Inténtalo de nuevo.</p>
            ) : (
              <p className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2Icon className="size-5 text-emerald-600" aria-hidden="true" />
                Importación terminada: {[
                  `${result.created_count} ${result.created_count === 1 ? 'registro creado' : 'registros creados'}`,
                  ...((result.skipped_count ?? 0) > 0 ? [`${result.skipped_count} ya ${result.skipped_count === 1 ? 'estaba registrado' : 'estaban registrados'}`] : []),
                  `${result.failed_count} con errores`,
                ].join(', ').replace(/, ([^,]*)$/, ' y $1')}.
              </p>
            )}
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            {(result.warnings?.length ?? 0) > 0 && (
              <ImportRowsTable
                tone="warning"
                title="Ya registrados en el sistema"
                description="Estas filas se omitieron porque sus datos ya existen; no es necesario volver a cargarlas."
                rows={result.warnings ?? []}
              />
            )}
            {result.errors.length > 0 && (
              <ImportRowsTable tone="error" title="Filas con errores" rows={result.errors} />
            )}
            {!processing && result.errors.length > 0 && (
              <p className="text-xs text-muted-foreground">Corrige solo esas filas en un archivo nuevo y vuelve a cargarlo; las demás ya quedaron registradas.</p>
            )}
            <div className="flex justify-end">
              <Button type="button" onClick={close}>
                <XIcon data-icon="inline-start" />
                {processing ? 'Cerrar y seguir en segundo plano' : 'Cerrar'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  )
}

function ImportRowsTable({ tone, title, description, rows }: Readonly<{ tone: 'warning' | 'error'; title: string; description?: string; rows: readonly BulkImportRowMessage[] }>) {
  const Icon = tone === 'warning' ? InfoIcon : TriangleAlertIcon

  return (
    <section className="flex flex-col gap-2">
      <h3 className={cn('flex items-center gap-2 text-sm font-semibold', tone === 'warning' ? 'text-amber-700 dark:text-amber-300' : 'text-destructive')}>
        <Icon className="size-4" aria-hidden="true" />
        {title} ({rows.length})
      </h3>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className={cn('max-h-56 overflow-auto rounded-lg border', tone === 'warning' && 'border-amber-200 dark:border-amber-900')}>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{title}</caption>
          <thead className={cn('sticky top-0', tone === 'warning' ? 'bg-amber-50 dark:bg-amber-950/60' : 'bg-muted')}>
            <tr><th scope="col" className="w-20 px-3 py-2">Fila</th><th scope="col" className="px-3 py-2">{tone === 'warning' ? 'Aviso' : 'Error'}</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.row} className="border-t align-top">
                <td className="px-3 py-2 font-mono">{row.row}</td>
                <td className="px-3 py-2">{row.messages.join(' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
