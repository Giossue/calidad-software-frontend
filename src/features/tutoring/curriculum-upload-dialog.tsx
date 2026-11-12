import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { CheckIcon, DownloadIcon, PlusIcon, Trash2Icon, UploadIcon } from 'lucide-react'
import { toast } from '@/lib/toast'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { FileDropzone } from '@/components/ui/file-dropzone'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ApiError } from '@/lib/api'
import { tutoringApi, type CurriculumSubjectRow } from '@/lib/tutoring-api'
import { cn } from '@/lib/utils'

const MAX_CYCLE = 12
const TEMPLATE = 'codigo;nombre;ciclo;previas\nSW-B1-001;ALGORITMOS Y LOGICA DE PROGRAMACION;1;\nSW-B2-006;PROGRAMACION ORIENTADA A OBJETOS;2;SW-B1-001\nSW-B3-011;ESTRUCTURA DE DATOS;3;SW-B2-006\n'

type Row = { key: number; code: string; name: string; cycle: string; previous: string }
/** Asignatura que la carrera ya tiene (con el número de su ciclo, si lo tiene). */
export type ExistingSubject = { readonly code: string | null; readonly name: string; readonly cycle: number | null }

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.firstValidationMessage ?? error.message
  return 'No fue posible conectar con el servidor.'
}

const normalize = (value: string) => value.normalize('NFD').replace(/\p{Mn}/gu, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
const splitPrevious = (value: string) => value.split(/[|;]+/).map((item) => item.trim()).filter(Boolean)

/**
 * Mismas reglas que el servidor: nombre, ciclo, repetidos, lo que ya existe en la carrera
 * y previas (otra fila o una asignatura de la carrera) de un ciclo anterior.
 */
function rowErrors(rows: readonly Row[], existing: readonly ExistingSubject[]): Map<number, string[]> {
  const codes = new Map<string, number>()
  const names = new Map<string, number>()
  for (const row of rows) {
    if (row.code.trim()) codes.set(row.code.trim().toUpperCase(), (codes.get(row.code.trim().toUpperCase()) ?? 0) + 1)
    if (row.name.trim()) names.set(normalize(row.name), (names.get(normalize(row.name)) ?? 0) + 1)
  }
  const existingCodes = new Set(existing.flatMap((subject) => (subject.code ? [subject.code.trim().toUpperCase()] : [])))
  const existingNames = new Set(existing.map((subject) => normalize(subject.name)))
  const matches = (code: string | null, name: string, reference: string) =>
    (Boolean(code?.trim()) && code!.trim().toUpperCase() === reference.toUpperCase()) || (name.trim() !== '' && normalize(name) === normalize(reference))
  const find = (reference: string): { cycle: number | null } | null => {
    const row = rows.find((item) => matches(item.code, item.name, reference))
    if (row) return { cycle: row.cycle.trim() === '' ? null : Number(row.cycle) }
    return existing.find((subject) => matches(subject.code, subject.name, reference)) ?? null
  }
  const errors = new Map<number, string[]>()
  for (const row of rows) {
    const list: string[] = []
    const cycle = Number(row.cycle)
    if (!row.name.trim()) list.push('Falta el nombre de la asignatura.')
    else if ((names.get(normalize(row.name)) ?? 0) > 1) list.push('El nombre está repetido en la malla.')
    else if (existingNames.has(normalize(row.name))) list.push('La asignatura ya existe en la carrera.')
    if (row.code.trim() && (codes.get(row.code.trim().toUpperCase()) ?? 0) > 1) list.push('El código está repetido en la malla.')
    else if (row.code.trim() && existingCodes.has(row.code.trim().toUpperCase())) list.push('El código ya existe en la carrera.')
    if (!Number.isInteger(cycle) || cycle < 1 || cycle > MAX_CYCLE) list.push(`Indica el ciclo (1 a ${MAX_CYCLE}).`)
    for (const reference of splitPrevious(row.previous)) {
      const previous = find(reference)
      if (!previous) list.push(`La previa «${reference}» no está en la malla.`)
      else if (previous.cycle !== null && Number.isInteger(cycle) && previous.cycle >= cycle) list.push(`La previa «${reference}» debe ser de un ciclo anterior.`)
    }
    if (list.length > 0) errors.set(row.key, list)
  }
  return errors
}

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([`﻿${TEMPLATE}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'plantilla-malla-curricular.csv'
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * «Importar malla»: el coordinador sube la malla de la carrera (Excel, CSV o PDF), revisa
 * y corrige cada asignatura y la importa: se crean las asignaturas, sus ciclos y previas.
 */
export function CurriculumImportButton({ careerId, careerName, existing, onImported }: Readonly<{ careerId: number; careerName: string; existing: readonly ExistingSubject[]; onImported: () => unknown }>) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const errors = useMemo(() => rowErrors(rows ?? [], existing), [rows, existing])
  const dirty = Boolean(file || rows)

  function close() {
    if (pending) return
    setOpen(false)
    setFile(null)
    setRows(null)
    setError(null)
  }

  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) return
    setPending(true)
    setError(null)
    try {
      const subjects = await tutoringApi.previewCurriculum(careerId, file)
      setRows(subjects.map((subject: CurriculumSubjectRow, index) => ({ key: index, code: subject.code ?? '', name: subject.name, cycle: subject.cycle ? String(subject.cycle) : '', previous: subject.previous.join(' | ') })))
    } catch (caught: unknown) {
      setError(errorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  async function importRows() {
    if (!rows) return
    setPending(true)
    setError(null)
    try {
      const { created } = await tutoringApi.importCurriculum({
        career_id: careerId,
        subjects: rows.map((row) => ({ code: row.code.trim() || null, name: row.name.trim(), cycle: Number(row.cycle), previous: splitPrevious(row.previous) })),
      })
      toast.success(created === 1 ? '1 asignatura importada' : `${created} asignaturas importadas`)
      setPending(false)
      close()
      void onImported()
    } catch (caught: unknown) {
      setError(errorMessage(caught))
      setPending(false)
    }
  }

  const update = (key: number, patch: Partial<Row>) => setRows((list) => list?.map((row) => (row.key === key ? { ...row, ...patch } : row)) ?? null)

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="whitespace-nowrap max-sm:w-full" data-tour="curriculum-import">
        <UploadIcon data-icon="inline-start" />
        Importar malla
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title="Importar malla"
        description={careerName}
        confirmClose={dirty}
        maxWidth="max-w-4xl"
      >
        {rows === null ? (
          <form onSubmit={review} aria-label="Importar malla" className="flex flex-col gap-5">
            <FileDropzone
              id="curriculum-file"
              label="Archivo de la malla"
              accept=".xlsx,.csv,.pdf,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              extensions={['.xlsx', '.csv', '.pdf']}
              file={file}
              onFileChange={(next) => {
                setFile(next)
                setError(null)
              }}
              onReject={setError}
              disabled={pending}
              hint="Excel o CSV con las columnas codigo, nombre, ciclo y previas, o el PDF de la malla. Antes de importarla podrás revisar y corregir cada asignatura."
            />
            <Button type="button" variant="tertiary" size="sm" className="self-start" onClick={downloadTemplate}>
              <DownloadIcon data-icon="inline-start" />Descargar plantilla
            </Button>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={close} disabled={pending}>Cancelar</Button>
              <BlockedReason reason={pending || file ? null : 'Sube el archivo de la malla.'}>
                <Button type="submit" disabled={pending || !file}>
                  {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <UploadIcon data-icon="inline-start" />}
                  {pending ? 'Leyendo…' : 'Revisar malla'}
                </Button>
              </BlockedReason>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {rows.length} asignaturas.
              {errors.size > 0 ? ` Corrige ${errors.size === 1 ? 'la asignatura marcada' : `las ${errors.size} asignaturas marcadas`} para continuar.` : ' Revisa las previas: separa varias con «|».'}
            </p>
            <div className="max-h-[50vh] overflow-auto rounded-md ring-1 ring-surface-ring">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Asignaturas de la malla</caption>
                <thead className="sticky top-0 z-10 bg-field">
                  <tr>
                    <th scope="col" className="px-2 py-2">Código</th>
                    <th scope="col" className="px-2 py-2">Nombre</th>
                    <th scope="col" className="w-20 px-2 py-2">Ciclo</th>
                    <th scope="col" className="px-2 py-2">Previas</th>
                    <th scope="col" className="w-10 px-2 py-2"><span className="sr-only">Quitar</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const rowError = errors.get(row.key)
                    const label = row.name.trim() || row.code.trim() || `fila ${index + 1}`
                    return (
                      <tr key={row.key} className={cn('border-t align-top', rowError && 'bg-destructive/5')}>
                        <td className="px-2 py-1.5"><Input aria-label={`Código de ${label}`} value={row.code} maxLength={30} onChange={(event) => update(row.key, { code: event.target.value })} className="h-8 min-w-24" /></td>
                        <td className="px-2 py-1.5">
                          <Input aria-label={`Nombre de ${label}`} value={row.name} maxLength={150} aria-invalid={Boolean(rowError)} onChange={(event) => update(row.key, { name: event.target.value })} className="h-8 min-w-48" />
                          {rowError && <ul className="mt-1 text-xs text-destructive">{rowError.map((message) => <li key={message}>{message}</li>)}</ul>}
                        </td>
                        <td className="px-2 py-1.5"><Input aria-label={`Ciclo de ${label}`} type="number" min={1} max={MAX_CYCLE} value={row.cycle} onChange={(event) => update(row.key, { cycle: event.target.value })} className="h-8 w-16" /></td>
                        <td className="px-2 py-1.5"><Input aria-label={`Previas de ${label}`} value={row.previous} onChange={(event) => update(row.key, { previous: event.target.value })} placeholder="Ninguna" className="h-8 min-w-40" /></td>
                        <td className="px-2 py-1.5">
                          <Button type="button" variant="tertiary" size="icon" aria-label={`Quitar ${label}`} onClick={() => setRows(rows.filter((item) => item.key !== row.key))}>
                            <Trash2Icon />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Button type="button" variant="tertiary" size="sm" className="self-start" onClick={() => setRows([...rows, { key: Math.max(-1, ...rows.map((row) => row.key)) + 1, code: '', name: '', cycle: '', previous: '' }])}>
              <PlusIcon data-icon="inline-start" />Agregar asignatura
            </Button>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setRows(null)} disabled={pending}>Volver</Button>
              <BlockedReason reason={pending ? null : rows.length === 0 ? 'Agrega al menos una asignatura.' : errors.size > 0 ? 'Corrige las asignaturas marcadas.' : null}>
                <Button type="button" onClick={() => void importRows()} disabled={pending || rows.length === 0 || errors.size > 0}>
                  {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <CheckIcon data-icon="inline-start" />}
                  {pending ? 'Importando…' : 'Importar'}
                </Button>
              </BlockedReason>
            </div>
          </div>
        )}
      </Dialog>
    </>
  )
}

/** Motivo de un botón bloqueado en su tooltip (mismo patrón que `FormDialog`). */
function BlockedReason({ reason, children }: Readonly<{ reason: string | null; children: ReactNode }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={reason ? 0 : undefined} className="inline-flex rounded-md outline-hidden focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:[&>button]:w-full">
          {children}
        </span>
      </TooltipTrigger>
      {reason && <TooltipContent>{reason}</TooltipContent>}
    </Tooltip>
  )
}
