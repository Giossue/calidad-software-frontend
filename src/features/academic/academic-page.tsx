import { useEffect, useState, type FormEvent } from 'react'
import { BookOpenIcon, RefreshCwIcon, ShieldAlertIcon } from 'lucide-react'

import { AdminCrudLayout } from '@/components/admin/admin-crud-layout'
import { AdminFormCard } from '@/components/admin/admin-form-card'
import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogFormActions } from '@/components/admin/catalog-form-actions'
import { CatalogList } from '@/components/admin/catalog-list'
import { CatalogRow } from '@/components/admin/catalog-row'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { ApiError, api, type Career, type Cycle, type Faculty } from '@/lib/api'

type PendingAction = 'loading' | 'career' | 'cycle' | 'deactivate-career' | 'deactivate-cycle' | null


function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.firstValidationMessage ?? error.message
  return 'No fue posible conectar con el servidor.'
}

export type AcademicSection = 'all' | 'careers' | 'cycles'

export function AcademicPage({ section = 'all' }: Readonly<{ section?: AcademicSection }>) {
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
  const showCareers = section === 'all' || section === 'careers'
  const showCycles = section === 'all' || section === 'cycles'
  const title = section === 'careers' ? 'Carreras' : section === 'cycles' ? 'Ciclos' : 'Carreras y ciclos'
  const description = section === 'careers'
    ? 'Organiza las carreras dentro de las facultades activas.'
    : section === 'cycles'
      ? 'Define los ciclos académicos dentro de las carreras activas.'
      : 'Gestiona el catálogo académico que utilizará el sistema de calidad.'

  return (
    <section className="flex flex-col gap-8">
      <AdminSectionHeader title={title} description={description} actions={<Button variant="outline" onClick={() => void loadCatalogs()} disabled={pending !== null}>
        {pending === 'loading' ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
        Actualizar
      </Button>} />

      {pageError && <Alert variant="destructive"><ShieldAlertIcon /><AlertTitle>No se pudo cargar el catálogo</AlertTitle><AlertDescription>{pageError}</AlertDescription></Alert>}

      <AdminCrudLayout>
        {showCareers && <AdminFormCard title={editingCareer ? 'Editar carrera' : 'Registrar carrera'} description="Asigna una carrera a una facultad activa." onSubmit={submitCareer} labelledBy="career-form-title">
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="career-faculty">Facultad</FieldLabel>
              <NativeSelect id="career-faculty" value={careerFacultyId} onChange={(event) => setCareerFacultyId(event.target.value)} disabled={formPending} required>
                <option value="">Selecciona una facultad</option>
                {faculties.filter((faculty) => faculty.status).map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="career-name">Nombre de la carrera</FieldLabel>
              <Input id="career-name" value={careerName} onChange={(event) => setCareerName(event.target.value)} placeholder="Ingeniería de Software" disabled={formPending} maxLength={150} required />
              <FieldDescription>Hasta 150 caracteres.</FieldDescription>
            </Field>
            <FieldError>{formError}</FieldError>
            <CatalogFormActions editing={Boolean(editingCareer)} pending={pending === 'career'} onCancel={resetCareerForm} />
          </FieldGroup>
        </AdminFormCard>}

        {showCycles && <AdminFormCard title={editingCycle ? 'Editar ciclo' : 'Registrar ciclo'} description="Define el ciclo académico dentro de una carrera activa." onSubmit={submitCycle} labelledBy="cycle-form-title">
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="cycle-career">Carrera</FieldLabel>
              <NativeSelect id="cycle-career" value={cycleCareerId} onChange={(event) => setCycleCareerId(event.target.value)} disabled={formPending} required>
                <option value="">Selecciona una carrera</option>
                {activeCareers.map((career) => <option key={career.id} value={career.id}>{career.name}</option>)}
              </NativeSelect>
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
            <CatalogFormActions editing={Boolean(editingCycle)} pending={pending === 'cycle'} onCancel={resetCycleForm} />
          </FieldGroup>
        </AdminFormCard>}
      </AdminCrudLayout>

      <AdminCrudLayout>
        {showCareers && <CatalogList title="Carreras registradas" icon={<BookOpenIcon />} loading={pending === 'loading'} loadingMessage="Cargando carreras…" emptyMessage="Todavía no hay carreras registradas.">
          {careers.map((career) => <CatalogRow key={career.id} title={career.name} detail={career.faculty_name ?? `Facultad #${career.faculty_id}`} active={career.status} onEdit={() => startCareerEdit(career)} onDeactivate={() => void deactivateCareer(career)} disabled={pending !== null} />)}
        </CatalogList>}
        {showCycles && <CatalogList title="Ciclos registrados" icon={<BookOpenIcon />} loading={pending === 'loading'} loadingMessage="Cargando ciclos…" emptyMessage="Todavía no hay ciclos registrados.">
          {cycles.map((cycle) => <CatalogRow key={cycle.id} title={`${cycle.number}. ${cycle.name}`} detail={cycle.career_name ?? `Carrera #${cycle.career_id}`} active={cycle.status} onEdit={() => startCycleEdit(cycle)} onDeactivate={() => void deactivateCycle(cycle)} disabled={pending !== null} />)}
        </CatalogList>}
      </AdminCrudLayout>
    </section>
  )
}
