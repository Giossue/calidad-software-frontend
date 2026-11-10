import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { CheckIcon, DownloadIcon, PlusIcon, Trash2Icon, UploadIcon } from 'lucide-react'
import { toast } from '@/lib/toast'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { FileDropzone } from '@/components/ui/file-dropzone'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ApiError } from '@/lib/api'
import { tutoringApi, type CurriculumList, type CurriculumSubjectRow } from '@/lib/tutoring-api'
import { cn } from '@/lib/utils'

const MAX_CYCLE = 12
const TEMPLATE = 'codigo;nombre;ciclo;previas\nSW-B1-001;ALGORITMOS Y LOGICA DE PROGRAMACION;1;\nSW-B2-006;PROGRAMACION ORIENTADA A OBJETOS;2;SW-B1-001\nSW-B3-011;ESTRUCTURA DE DATOS;3;SW-B2-006\n'

type Row = { key: number; code: string; name: string; cycle: string; previous: string }

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.firstValidationMessage ?? error.message
  return 'No fue posible conectar con el servidor.'
}

const normalize = (value: string) => value.normalize('NFD').replace(/\p{Mn}/gu, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
const splitPrevious = (value: string) => value.split(/[|;]+/).map((item) => item.trim()).filter(Boolean)

/** Mismas reglas que el servidor: nombre, ciclo, repetidos y previas de un ciclo anterior. */
function rowErrors(rows: readonly Row[]): Map<number, string[]> {
  const codes = new Map<string, number>()
  const names = new Map<string, number>()
  for (const row of rows) {
    if (row.code.trim()) codes.set(row.code.trim().toUpperCase(), (codes.get(row.code.trim().toUpperCase()) ?? 0) + 1)
    if (row.name.trim()) names.set(normalize(row.name), (names.get(normalize(row.name)) ?? 0) + 1)
  }
  const find = (reference: string) => rows.find((row) => row.code.trim().toUpperCase() === reference.toUpperCase() || (row.name.trim() !== '' && normalize(row.name) === normalize(reference)))
  const errors = new Map<number, string[]>()
  for (const row of rows) {
    const list: string[] = []
    const cycle = Number(row.cycle)
    if (!row.name.trim()) list.push('Falta el nombre de la asignatura.')
    else if ((names.get(normalize(row.name)) ?? 0) > 1) list.push('El nombre está repetido en la malla.')
    if (row.code.trim() && (codes.get(row.code.trim().toUpperCase()) ?? 0) > 1) list.push('El código está repetido en la malla.')
    if (!Number.isInteger(cycle) || cycle < 1 || cycle > MAX_CYCLE) list.push(`Indica el ciclo (1 a ${MAX_CYCLE}).`)
    for (const reference of splitPrevious(row.previous)) {
      const previous = find(reference)
      if (!previous) list.push(`La previa «${reference}» no está en la malla.`)
      else if (Number(previous.cycle) >= cycle) list.push(`La previa «${reference}» debe ser de un ciclo anterior.`)
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
 * «Subir nueva malla curricular»: el coordinador sube la malla (Excel, CSV o PDF),
 * elige desde qué PAO rige y hasta qué ciclo se aplica, revisa las asignaturas y
 * la crea. Los estudiantes de ciclos superiores siguen con la malla anterior.
 */
export function CurriculumUploadButton({ careerId, careerName, info, maxCycle, onCreated }: Readonly<{ careerId: number; careerName: string; info: CurriculumList | null; maxCycle: number; onCreated: (id: number) => unknown }>) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [periodId, setPeriodId] = useState('')
  const [upToCycle, setUpToCycle] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const periods = info?.periods ?? []
  const current = info?.data.find((curriculum) => curriculum.in_force)
  const period = periods.find((item) => String(item.id) === periodId)
  const cycleOptions = Array.from({ length: Math.max(maxCycle, 1) }, (_, index) => index + 1)
  const errors = useMemo(() => rowErrors(rows ?? []), [rows])
  const dirty = Boolean(file || rows)

  function close() {
    if (pending) return
    setOpen(false)
    setFile(null)
    setName('')
    setPeriodId('')
    setUpToCycle('')
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

  async function create() {
    if (!rows || !period) return
    setPending(true)
    setError(null)
    try {
      const created = await tutoringApi.createCurriculum({
        career_id: careerId,
        name: name.trim(),
        period_id: period.id,
        up_to_cycle: Number(upToCycle),
        subjects: rows.map((row) => ({ code: row.code.trim() || null, name: row.name.trim(), cycle: Number(row.cycle), previous: splitPrevious(row.previous) })),
      })
      toast.success(`Malla «${created.name}» creada con ${created.subjects_count} asignaturas.`)
      setPending(false)
      close()
      void onCreated(created.id)
    } catch (caught: unknown) {
      setError(errorMessage(caught))
      setPending(false)
    }
  }

  const update = (key: number, patch: Partial<Row>) => setRows((list) => list?.map((row) => (row.key === key ? { ...row, ...patch } : row)) ?? null)
  const settingsReady = Boolean(file && name.trim() && period && upToCycle)
  // Qué falta para revisar la malla, en el orden de los campos (se lee en el tooltip del botón).
  const reviewBlockReason = !name.trim()
    ? 'Escribe el nombre de la malla.'
    : !period ? 'Elige desde qué PAO rige.'
      : !upToCycle ? 'Elige a qué ciclos se aplica.'
        : !file ? 'Sube el archivo de la malla.'
          : null
  const cycle = Number(upToCycle)

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} disabled={!info} className="whitespace-nowrap max-sm:w-full" data-tour="curriculum-upload">
        <UploadIcon data-icon="inline-start" />
        Subir nueva malla curricular
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title="Subir nueva malla curricular"
        description={careerName}
        confirmClose={dirty}
        maxWidth="max-w-4xl"
      >
        {rows === null ? (
          <form onSubmit={review} aria-label="Subir nueva malla curricular" className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="curriculum-name" label="Nombre de la malla" required counter={{ current: name.length, max: 150 }}>
                <Input id="curriculum-name" value={name} maxLength={150} onChange={(event) => setName(event.target.value)} placeholder="Ej. Malla 2027" required />
              </FormField>
              <SelectField
                id="curriculum-period"
                label="¿Desde qué PAO rige?"
                required
                value={periodId}
                onValueChange={(value) => {
                  setPeriodId(value)
                  const chosen = periods.find((item) => String(item.id) === value)
                  if (chosen && !name.trim()) setName(`Malla ${chosen.name}`)
                }}
                placeholder={periods.length > 0 ? 'Selecciona el PAO' : 'Registra primero el PAO'}
                options={periods.map((item) => ({ value: String(item.id), label: item.name }))}
                disabled={periods.length === 0}
              />
            </div>
            <SelectField
              id="curriculum-cycle"
              label="¿A qué ciclos se aplica esta nueva malla?"
              required
              tip="Se aplica a quienes hoy están en ese ciclo o en uno anterior, y a quienes ingresen después. Los siguen con ella al avanzar."
              value={upToCycle}
              onValueChange={setUpToCycle}
              placeholder="Selecciona el ciclo"
              options={cycleOptions.map((number) => ({ value: String(number), label: number === 1 ? 'Solo 1.º ciclo' : `De 1.º a ${number}.º ciclo` }))}
            />
            {period && cycle > 0 && (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                Desde <strong>{period.name}</strong>, los estudiantes que hoy están de 1.º a {cycle}.º ciclo seguirán la nueva malla. Los de {cycle + 1}.º ciclo en adelante seguirán con <strong>{current?.name ?? 'la malla anterior'}</strong> hasta terminar.
              </p>
            )}
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
              hint="Excel o CSV con las columnas codigo, nombre, ciclo y previas, o el PDF de la malla. Antes de crearla podrás revisar y corregir cada asignatura."
            />
            <Button type="button" variant="tertiary" size="sm" className="self-start" onClick={downloadTemplate}>
              <DownloadIcon data-icon="inline-start" />Descargar plantilla
            </Button>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={close} disabled={pending}>Cancelar</Button>
              <BlockedReason reason={pending ? null : reviewBlockReason}>
                <Button type="submit" disabled={pending || !settingsReady}>
                  {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <UploadIcon data-icon="inline-start" />}
                  {pending ? 'Leyendo…' : 'Revisar malla'}
                </Button>
              </BlockedReason>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {rows.length} asignaturas · rige desde {period?.name} para 1.º a {cycle}.º ciclo.
              {errors.size > 0 ? ` Corrige ${errors.size === 1 ? 'la asignatura marcada' : `las ${errors.size} asignaturas marcadas`} para continuar.` : ' Revisa las previas: separa varias con «|».'}
            </p>
            <div className="max-h-[50vh] overflow-auto rounded-md ring-1 ring-surface-ring">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Asignaturas de la nueva malla</caption>
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
                <Button type="button" onClick={() => void create()} disabled={pending || rows.length === 0 || errors.size > 0}>
                  {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <CheckIcon data-icon="inline-start" />}
                  {pending ? 'Creando…' : `Crear malla con ${rows.length} asignaturas`}
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
