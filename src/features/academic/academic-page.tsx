import { Children, useEffect, useState, type FormEvent } from 'react'
import { BookOpenIcon, PencilIcon, PlusIcon, RefreshCwIcon, ShieldAlertIcon, XIcon } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ApiError, api, type Career, type Cycle, type Faculty } from '@/lib/api'

type PendingAction = 'loading' | 'career' | 'cycle' | 'deactivate-career' | 'deactivate-cycle' | null

const selectClassName = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.firstValidationMessage ?? error.message
  return 'No fue posible conectar con el servidor.'
}

export function AcademicPage() {
  const [faculties, setFaculties] = useState<readonly Faculty[]>([])
  const [careers, setCareers] = useState<readonly Career[]>([])
  const [cycles, setCycles] = useState<readonly Cycle[]>([])
  const [pageError, setPageError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction>(null)
  const [editingCareer, setEditingCareer] = useState<Career | null>(null)
  const [editingCycle, setEditingCycle] = useState<Cycle | null>(null)
  const [careerFacultyId, setCareerFacultyId] = useState('')
  const [careerName, setCareerName] = useState('')
  const [cycleCareerId, setCycleCareerId] = useState('')
  const [cycleName, setCycleName] = useState('')
  const [cycleNumber, setCycleNumber] = useState('')

  async function loadCatalogs() {
    setPageError(null)
    setPending('loading')
    try {
      const [facultyData, careerData, cycleData] = await Promise.all([
        api.listFaculties(), api.listCareers(), api.listCycles(),
      ])
      setFaculties(facultyData)
      setCareers(careerData)
      setCycles(cycleData)
    } catch (error: unknown) {
      setPageError(getErrorMessage(error))
    } finally {
      setPending(null)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadCatalogs() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  function startCareerEdit(career: Career) {
    setEditingCareer(career)
    setCareerFacultyId(String(career.faculty_id))
    setCareerName(career.name)
    setFormError(null)
  }

  function startCycleEdit(cycle: Cycle) {
    setEditingCycle(cycle)
    setCycleCareerId(String(cycle.career_id))
    setCycleName(cycle.name)
    setCycleNumber(String(cycle.number))
    setFormError(null)
  }

  function resetCareerForm() {
    setEditingCareer(null)
    setCareerFacultyId('')
    setCareerName('')
  }

  function resetCycleForm() {
    setEditingCycle(null)
    setCycleCareerId('')
    setCycleName('')
    setCycleNumber('')
  }

  async function submitCareer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setPending('career')
    try {
      const input = { faculty_id: Number(careerFacultyId), name: careerName.trim() }
      if (editingCareer) await api.updateCareer(editingCareer.id, input)
      else await api.createCareer(input)
      resetCareerForm()
      await loadCatalogs()
    } catch (error: unknown) {
      setFormError(getErrorMessage(error))
      setPending(null)
    }
  }

  async function submitCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setPending('cycle')
    try {
      const input = { career_id: Number(cycleCareerId), name: cycleName.trim(), number: Number(cycleNumber) }
      if (editingCycle) await api.updateCycle(editingCycle.id, input)
      else await api.createCycle(input)
      resetCycleForm()
      await loadCatalogs()
    } catch (error: unknown) {
      setFormError(getErrorMessage(error))
      setPending(null)
    }
  }

  async function deactivateCareer(career: Career) {
    if (!window.confirm(`¿Desactivar la carrera “${career.name}”?`)) return
    setPending('deactivate-career')
    setPageError(null)
    try { await api.deactivateCareer(career.id); await loadCatalogs() }
    catch (error: unknown) { setPageError(getErrorMessage(error)); setPending(null) }
  }

  async function deactivateCycle(cycle: Cycle) {
    if (!window.confirm(`¿Desactivar el ciclo “${cycle.name}”?`)) return
    setPending('deactivate-cycle')
    setPageError(null)
    try { await api.deactivateCycle(cycle.id); await loadCatalogs() }
    catch (error: unknown) { setPageError(getErrorMessage(error)); setPending(null) }
  }

  const activeCareers = careers.filter((career) => career.status)
  const formPending = pending === 'career' || pending === 'cycle'

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-[0.16em] text-brand-red uppercase">Administración académica</p>
          <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Carreras y ciclos</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Gestiona el catálogo académico que utilizará el sistema de calidad.</p>
        </div>
        <Button variant="outline" onClick={() => void loadCatalogs()} disabled={pending !== null}>
          {pending === 'loading' ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
          Actualizar
        </Button>
      </div>

      {pageError && <Alert variant="destructive"><ShieldAlertIcon /><AlertTitle>No se pudo cargar el catálogo</AlertTitle><AlertDescription>{pageError}</AlertDescription></Alert>}

      <div className="grid gap-6 xl:grid-cols-2">
        <CatalogForm title={editingCareer ? 'Editar carrera' : 'Registrar carrera'} description="Asigna una carrera a una facultad activa." onSubmit={submitCareer}>
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="career-faculty">Facultad</FieldLabel>
              <select id="career-faculty" className={selectClassName} value={careerFacultyId} onChange={(event) => setCareerFacultyId(event.target.value)} disabled={formPending} required>
                <option value="">Selecciona una facultad</option>
                {faculties.filter((faculty) => faculty.status).map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="career-name">Nombre de la carrera</FieldLabel>
              <Input id="career-name" value={careerName} onChange={(event) => setCareerName(event.target.value)} placeholder="Ingeniería de Software" disabled={formPending} maxLength={150} required />
              <FieldDescription>Hasta 150 caracteres.</FieldDescription>
            </Field>
            <FieldError>{formError}</FieldError>
            <FormActions editing={Boolean(editingCareer)} pending={pending === 'career'} onCancel={resetCareerForm} />
          </FieldGroup>
        </CatalogForm>

        <CatalogForm title={editingCycle ? 'Editar ciclo' : 'Registrar ciclo'} description="Define el ciclo académico dentro de una carrera activa." onSubmit={submitCycle}>
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="cycle-career">Carrera</FieldLabel>
              <select id="cycle-career" className={selectClassName} value={cycleCareerId} onChange={(event) => setCycleCareerId(event.target.value)} disabled={formPending} required>
                <option value="">Selecciona una carrera</option>
                {activeCareers.map((career) => <option key={career.id} value={career.id}>{career.name}</option>)}
              </select>
            </Field>
            <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
              <Field>
                <FieldLabel htmlFor="cycle-name">Nombre del ciclo</FieldLabel>
                <Input id="cycle-name" value={cycleName} onChange={(event) => setCycleName(event.target.value)} placeholder="Primer ciclo" disabled={formPending} maxLength={100} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="cycle-number">Número</FieldLabel>
                <Input id="cycle-number" type="number" min="1" step="1" value={cycleNumber} onChange={(event) => setCycleNumber(event.target.value)} disabled={formPending} required />
              </Field>
            </div>
            <FieldError>{formError}</FieldError>
            <FormActions editing={Boolean(editingCycle)} pending={pending === 'cycle'} onCancel={resetCycleForm} />
          </FieldGroup>
        </CatalogForm>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CatalogList title="Carreras registradas" icon={<BookOpenIcon />} emptyMessage="Todavía no hay carreras registradas.">
          {careers.map((career) => <CatalogRow key={career.id} title={career.name} detail={career.faculty_name ?? `Facultad #${career.faculty_id}`} active={career.status} onEdit={() => startCareerEdit(career)} onDeactivate={() => void deactivateCareer(career)} disabled={pending !== null} />)}
        </CatalogList>
        <CatalogList title="Ciclos registrados" icon={<BookOpenIcon />} emptyMessage="Todavía no hay ciclos registrados.">
          {cycles.map((cycle) => <CatalogRow key={cycle.id} title={`${cycle.number}. ${cycle.name}`} detail={cycle.career_name ?? `Carrera #${cycle.career_id}`} active={cycle.status} onEdit={() => startCycleEdit(cycle)} onDeactivate={() => void deactivateCycle(cycle)} disabled={pending !== null} />)}
        </CatalogList>
      </div>
    </section>
  )
}

function CatalogForm({ title, description, onSubmit, children }: Readonly<{ title: string; description: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; children: React.ReactNode }>) {
  return <form onSubmit={onSubmit} className="flex flex-col gap-6 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-1"><h3 className="text-lg font-semibold">{title}</h3><p className="text-sm text-muted-foreground">{description}</p></div>{children}</form>
}

function FormActions({ editing, pending, onCancel }: Readonly<{ editing: boolean; pending: boolean; onCancel: () => void }>) {
  return <div className="flex flex-wrap justify-end gap-3"><Button type="submit" disabled={pending}>{pending ? <Spinner data-icon="inline-start" /> : editing ? <PencilIcon data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}{pending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar'}</Button>{editing && <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}><XIcon data-icon="inline-start" />Cancelar</Button>}</div>
}

function CatalogList({ title, icon, emptyMessage, children }: Readonly<{ title: string; icon: React.ReactNode; emptyMessage: string; children: React.ReactNode }>) {
  return <div className="rounded-2xl border border-border/70 bg-card shadow-sm"><div className="flex items-center gap-3 border-b border-border/70 px-5 py-4"><span className="text-brand-red">{icon}</span><h3 className="font-semibold">{title}</h3></div><div className="flex flex-col">{Children.count(children) > 0 ? children : <p className="px-5 py-8 text-sm text-muted-foreground">{emptyMessage}</p>}</div></div>
}

function CatalogRow({ title, detail, active, onEdit, onDeactivate, disabled }: Readonly<{ title: string; detail: string; active: boolean; onEdit: () => void; onDeactivate: () => void; disabled: boolean }>) {
  return <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-4 last:border-b-0"><div className="min-w-0"><p className="truncate text-sm font-medium">{title}</p><p className="truncate text-xs text-muted-foreground">{detail}</p></div><div className="flex shrink-0 items-center gap-2"><span className={`rounded-full px-2 py-1 text-[0.68rem] font-semibold ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'}`}>{active ? 'Activo' : 'Inactivo'}</span>{active && <><Button variant="ghost" size="icon-sm" aria-label={`Editar ${title}`} onClick={onEdit} disabled={disabled}><PencilIcon /></Button><Button variant="ghost" size="icon-sm" aria-label={`Desactivar ${title}`} onClick={onDeactivate} disabled={disabled}><XIcon /></Button></>}</div></div>
}
