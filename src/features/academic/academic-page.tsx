import { useEffect, useState, type FormEvent } from 'react'
import {
  BookOpenIcon,
  CheckCircle2Icon,
  Edit2Icon,
  Layers3Icon,
  PlusIcon,
  PowerIcon,
  PowerOffIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldAlertIcon,
  XCircleIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { ApiError, api, type Career, type Cycle, type Faculty } from '@/lib/api'
import { cn } from '@/lib/utils'

type PendingAction = 'loading' | 'career' | 'cycle' | 'toggle-career' | 'toggle-cycle' | null
type CareerToggleTarget = { career: Career; action: 'activate' | 'deactivate' }
type CycleToggleTarget = { cycle: Cycle; action: 'activate' | 'deactivate' }

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

  // Form states
  const [editingCareer, setEditingCareer] = useState<Career | null>(null)
  const [editingCycle, setEditingCycle] = useState<Cycle | null>(null)
  const [careerFacultyId, setCareerFacultyId] = useState('')
  const [careerName, setCareerName] = useState('')
  const [initialCareerFacultyId, setInitialCareerFacultyId] = useState('')
  const [initialCareerName, setInitialCareerName] = useState('')
  const [cycleCareerId, setCycleCareerId] = useState('')
  const [cycleName, setCycleName] = useState('')
  const [cycleNumber, setCycleNumber] = useState('')
  const [initialCycleCareerId, setInitialCycleCareerId] = useState('')
  const [initialCycleName, setInitialCycleName] = useState('')
  const [initialCycleNumber, setInitialCycleNumber] = useState('')

  // Modales
  const [isCareerModalOpen, setIsCareerModalOpen] = useState(false)
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false)
  const [careerToToggle, setCareerToToggle] = useState<CareerToggleTarget | null>(null)
  const [cycleToToggle, setCycleToToggle] = useState<CycleToggleTarget | null>(null)

  // Búsqueda
  const [searchQuery, setSearchQuery] = useState('')

  async function loadCatalogs(options?: { notify?: boolean }) {
    setPageError(null)
    setPending('loading')
    try {
      const [facultyData, careerData, cycleData] = await Promise.all([
        api.listFaculties(),
        api.listCareers(),
        api.listCycles(),
      ])
      setFaculties(facultyData)
      setCareers(careerData)
      setCycles(cycleData)
      if (options?.notify) {
        toast.success('Catálogo actualizado', { description: 'El listado se actualizó correctamente.' })
      }
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

  function openCreateCareerModal() {
    setEditingCareer(null)
    setCareerFacultyId('')
    setCareerName('')
    setInitialCareerFacultyId('')
    setInitialCareerName('')
    setFormError(null)
    setIsCareerModalOpen(true)
  }

  function startCareerEdit(career: Career) {
    setEditingCareer(career)
    setCareerFacultyId(String(career.faculty_id))
    setCareerName(career.name)
    setInitialCareerFacultyId(String(career.faculty_id))
    setInitialCareerName(career.name)
    setFormError(null)
    setIsCareerModalOpen(true)
  }

  function closeCareerModal() {
    setIsCareerModalOpen(false)
    setEditingCareer(null)
    setCareerFacultyId('')
    setCareerName('')
    setFormError(null)
  }

  function openCreateCycleModal() {
    setEditingCycle(null)
    setCycleCareerId('')
    setCycleName('')
    setCycleNumber('')
    setInitialCycleCareerId('')
    setInitialCycleName('')
    setInitialCycleNumber('')
    setFormError(null)
    setIsCycleModalOpen(true)
  }

  function startCycleEdit(cycle: Cycle) {
    setEditingCycle(cycle)
    setCycleCareerId(String(cycle.career_id))
    setCycleName(cycle.name)
    setCycleNumber(String(cycle.number))
    setInitialCycleCareerId(String(cycle.career_id))
    setInitialCycleName(cycle.name)
    setInitialCycleNumber(String(cycle.number))
    setFormError(null)
    setIsCycleModalOpen(true)
  }

  function closeCycleModal() {
    setIsCycleModalOpen(false)
    setEditingCycle(null)
    setCycleCareerId('')
    setCycleName('')
    setCycleNumber('')
    setFormError(null)
  }

  async function submitCareer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setPending('career')
    try {
      const input = { faculty_id: Number(careerFacultyId), name: careerName.trim() }
      if (editingCareer) {
        await api.updateCareer(editingCareer.id, input)
        toast.success('Carrera actualizada', { description: `La carrera "${input.name}" fue modificada.` })
      } else {
        await api.createCareer(input)
        toast.success('Carrera creada', { description: `La carrera "${input.name}" ha sido agregada.` })
      }
      closeCareerModal()
      await loadCatalogs()
    } catch (error: unknown) {
      setFormError(getErrorMessage(error))
    } finally {
      setPending(null)
    }
  }

  async function submitCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setPending('cycle')
    try {
      const input = { career_id: Number(cycleCareerId), name: cycleName.trim(), number: Number(cycleNumber) }
      if (editingCycle) {
        await api.updateCycle(editingCycle.id, input)
        toast.success('Ciclo actualizado', { description: `El ciclo "${input.name}" fue modificado.` })
      } else {
        await api.createCycle(input)
        toast.success('Ciclo creado', { description: `El ciclo "${input.name}" fue registrado.` })
      }
      closeCycleModal()
      await loadCatalogs()
    } catch (error: unknown) {
      setFormError(getErrorMessage(error))
    } finally {
      setPending(null)
    }
  }

  async function handleConfirmToggleCareer() {
    if (!careerToToggle) return
    const { career, action } = careerToToggle
    setPending('toggle-career')
    setPageError(null)
    try {
      if (action === 'activate') {
        await api.activateCareer(career.id)
        toast.success('Carrera habilitada', { description: `La carrera "${career.name}" fue habilitada.` })
      } else {
        await api.deactivateCareer(career.id)
        toast.info('Carrera deshabilitada', { description: `Se desactivó la carrera "${career.name}".` })
      }
      setCareerToToggle(null)
      await loadCatalogs()
    } catch (error: unknown) {
      setPageError(getErrorMessage(error))
    } finally {
      setPending(null)
    }
  }

  async function handleConfirmToggleCycle() {
    if (!cycleToToggle) return
    const { cycle, action } = cycleToToggle
    setPending('toggle-cycle')
    setPageError(null)
    try {
      if (action === 'activate') {
        await api.activateCycle(cycle.id)
        toast.success('Ciclo habilitado', { description: `El ciclo "${cycle.name}" fue habilitado.` })
      } else {
        await api.deactivateCycle(cycle.id)
        toast.info('Ciclo deshabilitado', { description: `Se desactivó el ciclo "${cycle.name}".` })
      }
      setCycleToToggle(null)
      await loadCatalogs()
    } catch (error: unknown) {
      setPageError(getErrorMessage(error))
    } finally {
      setPending(null)
    }
  }

  const activeCareers = careers.filter((career) => career.status)
  const isCareersSection = section === 'careers'
  const isCyclesSection = section === 'cycles'
  const formPending = pending === 'career' || pending === 'cycle'
  const isCareerFormDirty = careerFacultyId !== initialCareerFacultyId || careerName !== initialCareerName
  const isCycleFormDirty =
    cycleCareerId !== initialCycleCareerId || cycleName !== initialCycleName || cycleNumber !== initialCycleNumber

  const title = isCareersSection ? 'Oferta de Carreras' : isCyclesSection ? 'Niveles y Ciclos' : 'Carreras y Ciclos'
  const description = isCareersSection
    ? 'Gestiona las carreras profesionales ofertadas por cada facultad.'
    : isCyclesSection
      ? 'Define la estructura de ciclos y semestres dentro de cada carrera.'
      : 'Gestiona la oferta académica y los niveles de formación.'

  // Filtros de búsqueda
  const filteredCareers = careers.filter((career) => {
    const query = searchQuery.toLowerCase().trim()
    return (
      !query ||
      career.name.toLowerCase().includes(query) ||
      (career.faculty_name && career.faculty_name.toLowerCase().includes(query))
    )
  })

  const filteredCycles = cycles.filter((cycle) => {
    const query = searchQuery.toLowerCase().trim()
    return (
      !query ||
      cycle.name.toLowerCase().includes(query) ||
      (cycle.career_name && cycle.career_name.toLowerCase().includes(query))
    )
  })

  return (
    <section className="flex flex-col gap-8">
      <AdminSectionHeader
        title={title}
        description={description}
        eyebrow="Estructura Académica"
        actions={
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => void loadCatalogs({ notify: true })} disabled={pending !== null}>
              {pending === 'loading' ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
              Actualizar
            </Button>
            {isCareersSection && (
              <Button onClick={openCreateCareerModal} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
                <PlusIcon data-icon="inline-start" />
                Nueva carrera
              </Button>
            )}
            {isCyclesSection && (
              <Button onClick={openCreateCycleModal} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
                <PlusIcon data-icon="inline-start" />
                Nuevo ciclo
              </Button>
            )}
          </div>
        }
      />

      {pageError && (
        <Alert variant="destructive">
          <ShieldAlertIcon />
          <AlertTitle>No se pudo cargar el catálogo</AlertTitle>
          <AlertDescription>{pageError}</AlertDescription>
        </Alert>
      )}

      {/* Tarjetas KPI de Estadísticas */}
      {isCareersSection && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="flex items-center gap-4 p-5 border-slate-200/80 dark:border-slate-800">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <BookOpenIcon className="size-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Carreras
              </span>
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {careers.length}
              </span>
            </div>
          </Card>

          <Card className="flex items-center gap-4 p-5 border-slate-200/80 dark:border-slate-800">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2Icon className="size-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Carreras Activas
              </span>
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {careers.filter((c) => c.status).length}
              </span>
            </div>
          </Card>

          <Card className="flex items-center gap-4 p-5 border-slate-200/80 dark:border-slate-800">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <XCircleIcon className="size-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Inactivas
              </span>
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {careers.filter((c) => !c.status).length}
              </span>
            </div>
          </Card>
        </div>
      )}

      {isCyclesSection && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="flex items-center gap-4 p-5 border-slate-200/80 dark:border-slate-800">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Layers3Icon className="size-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Ciclos
              </span>
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {cycles.length}
              </span>
            </div>
          </Card>

          <Card className="flex items-center gap-4 p-5 border-slate-200/80 dark:border-slate-800">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2Icon className="size-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Ciclos Activos
              </span>
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {cycles.filter((c) => c.status).length}
              </span>
            </div>
          </Card>

          <Card className="flex items-center gap-4 p-5 border-slate-200/80 dark:border-slate-800">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <XCircleIcon className="size-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Inactivos
              </span>
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {cycles.filter((c) => !c.status).length}
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* Vista de Carreras */}
      {isCareersSection && (
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="relative flex flex-1 items-center max-w-md">
              <SearchIcon className="absolute left-3.5 size-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar carrera por nombre o facultad…"
                className="pl-10"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3.5">Carrera Universitaria</th>
                  <th className="px-5 py-3.5">Facultad Perteneciente</th>
                  <th className="px-5 py-3.5">Estado</th>
                  <th className="px-5 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pending === 'loading' ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-5 w-48 rounded-md bg-slate-200 dark:bg-slate-800" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-36 rounded-md bg-slate-200 dark:bg-slate-800" /></td>
                      <td className="px-5 py-4"><div className="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-800" /></td>
                      <td className="px-5 py-4 text-right"><div className="ml-auto h-8 w-16 rounded-md bg-slate-200 dark:bg-slate-800" /></td>
                    </tr>
                  ))
                ) : filteredCareers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-500 dark:text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <BookOpenIcon className="size-8 text-slate-300 dark:text-slate-600" />
                        <span className="font-medium">
                          {searchQuery ? 'No se encontraron carreras con el término buscado.' : 'Todavía no hay carreras registradas.'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCareers.map((career) => (
                    <tr key={career.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#0F1E2E] text-white shadow-2xs">
                            <BookOpenIcon className="size-4" />
                          </div>
                          <span>{career.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs font-medium text-slate-600 dark:text-slate-300">
                        {career.faculty_name ?? `Facultad #${career.faculty_id}`}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                            career.status
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
                          )}
                        >
                          <span className={cn('size-1.5 rounded-full', career.status ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400')} />
                          {career.status ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => startCareerEdit(career)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                            title="Editar carrera"
                          >
                            <Edit2Icon className="size-4" />
                          </button>
                          {career.status ? (
                            <button
                              type="button"
                              onClick={() => setCareerToToggle({ career, action: 'deactivate' })}
                              className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                              title="Desactivar carrera"
                            >
                              <PowerOffIcon className="size-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setCareerToToggle({ career, action: 'activate' })}
                              className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"
                              title="Habilitar carrera"
                            >
                              <PowerIcon className="size-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vista de Ciclos */}
      {isCyclesSection && (
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="relative flex flex-1 items-center max-w-md">
              <SearchIcon className="absolute left-3.5 size-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar ciclo por nombre o carrera…"
                className="pl-10"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3.5">Ciclo Académico</th>
                  <th className="px-5 py-3.5">Carrera Asignada</th>
                  <th className="px-5 py-3.5">Orden / Nivel</th>
                  <th className="px-5 py-3.5">Estado</th>
                  <th className="px-5 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pending === 'loading' ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-5 w-40 rounded-md bg-slate-200 dark:bg-slate-800" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-36 rounded-md bg-slate-200 dark:bg-slate-800" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-16 rounded-md bg-slate-200 dark:bg-slate-800" /></td>
                      <td className="px-5 py-4"><div className="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-800" /></td>
                      <td className="px-5 py-4 text-right"><div className="ml-auto h-8 w-16 rounded-md bg-slate-200 dark:bg-slate-800" /></td>
                    </tr>
                  ))
                ) : filteredCycles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500 dark:text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <Layers3Icon className="size-8 text-slate-300 dark:text-slate-600" />
                        <span className="font-medium">
                          {searchQuery ? 'No se encontraron ciclos con el término buscado.' : 'Todavía no hay ciclos registrados.'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCycles.map((cycle) => (
                    <tr key={cycle.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#0F1E2E] text-white shadow-2xs">
                            <Layers3Icon className="size-4" />
                          </div>
                          <span>{cycle.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs font-medium text-slate-600 dark:text-slate-300">
                        {cycle.career_name ?? `Carrera #${cycle.career_id}`}
                      </td>
                      <td className="px-5 py-4 text-xs font-bold text-slate-700 dark:text-slate-200">
                        Nivel {cycle.number}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                            cycle.status
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
                          )}
                        >
                          <span className={cn('size-1.5 rounded-full', cycle.status ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400')} />
                          {cycle.status ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => startCycleEdit(cycle)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                            title="Editar ciclo"
                          >
                            <Edit2Icon className="size-4" />
                          </button>
                          {cycle.status ? (
                            <button
                              type="button"
                              onClick={() => setCycleToToggle({ cycle, action: 'deactivate' })}
                              className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                              title="Desactivar ciclo"
                            >
                              <PowerOffIcon className="size-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setCycleToToggle({ cycle, action: 'activate' })}
                              className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"
                              title="Habilitar ciclo"
                            >
                              <PowerIcon className="size-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Dialog para Registrar / Editar Carrera */}
      <Dialog
        open={isCareerModalOpen}
        onClose={closeCareerModal}
        title={editingCareer ? 'Editar Carrera' : 'Registrar Carrera'}
        description={editingCareer ? 'Modifica los datos de la carrera seleccionada.' : 'Asigna la nueva carrera a una facultad activa.'}
        maxWidth="max-w-md"
        confirmClose={isCareerFormDirty}
      >
        <form onSubmit={submitCareer}>
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="career-faculty">Facultad Perteneciente</FieldLabel>
              <NativeSelect
                id="career-faculty"
                value={careerFacultyId}
                onChange={(e) => setCareerFacultyId(e.target.value)}
                disabled={formPending}
                required
              >
                <option value="">Selecciona una facultad</option>
                {faculties.filter((f) => f.status).map((faculty) => (
                  <option key={faculty.id} value={faculty.id}>
                    {faculty.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field>
              <FieldLabel htmlFor="career-name">Nombre de la carrera</FieldLabel>
              <Input
                id="career-name"
                value={careerName}
                onChange={(e) => setCareerName(e.target.value)}
                placeholder="Ej. Ingeniería en Software"
                disabled={formPending}
                maxLength={150}
                required
              />
              <FieldDescription>Hasta 150 caracteres.</FieldDescription>
            </Field>

            <FieldError>{formError}</FieldError>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <DialogCancelButton onClick={closeCareerModal} disabled={formPending}>
                Cancelar
              </DialogCancelButton>
              <Button type="submit" disabled={formPending} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
                {pending === 'career' && <Spinner data-icon="inline-start" />}
                {editingCareer ? 'Guardar Cambios' : 'Registrar Carrera'}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Dialog>

      {/* Modal Dialog para Registrar / Editar Ciclo */}
      <Dialog
        open={isCycleModalOpen}
        onClose={closeCycleModal}
        title={editingCycle ? 'Editar Ciclo Académico' : 'Registrar Ciclo Académico'}
        description={editingCycle ? 'Actualiza los datos del ciclo académico.' : 'Asigna el nuevo ciclo a una carrera profesional activa.'}
        maxWidth="max-w-md"
        confirmClose={isCycleFormDirty}
      >
        <form onSubmit={submitCycle}>
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="cycle-career">Carrera Profesional</FieldLabel>
              <NativeSelect
                id="cycle-career"
                value={cycleCareerId}
                onChange={(e) => setCycleCareerId(e.target.value)}
                disabled={formPending}
                required
              >
                <option value="">Selecciona una carrera</option>
                {activeCareers.map((career) => (
                  <option key={career.id} value={career.id}>
                    {career.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <div className="grid gap-5 sm:grid-cols-[1fr_7rem]">
              <Field>
                <FieldLabel htmlFor="cycle-name">Nombre del ciclo</FieldLabel>
                <Input
                  id="cycle-name"
                  value={cycleName}
                  onChange={(e) => setCycleName(e.target.value)}
                  placeholder="Ej. Primer Ciclo"
                  disabled={formPending}
                  maxLength={100}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="cycle-number">Número</FieldLabel>
                <Input
                  id="cycle-number"
                  type="number"
                  min="1"
                  step="1"
                  value={cycleNumber}
                  onChange={(e) => setCycleNumber(e.target.value)}
                  disabled={formPending}
                  required
                />
              </Field>
            </div>

            <FieldError>{formError}</FieldError>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <DialogCancelButton onClick={closeCycleModal} disabled={formPending}>
                Cancelar
              </DialogCancelButton>
              <Button type="submit" disabled={formPending} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
                {pending === 'cycle' && <Spinner data-icon="inline-start" />}
                {editingCycle ? 'Guardar Cambios' : 'Registrar Ciclo'}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Dialog>

      {/* ConfirmModals para Habilitar / Desactivar Carrera / Ciclo */}
      <ConfirmModal
        open={Boolean(careerToToggle)}
        onClose={() => setCareerToToggle(null)}
        onConfirm={() => void handleConfirmToggleCareer()}
        title={careerToToggle?.action === 'activate' ? '¿Habilitar carrera?' : '¿Desactivar carrera?'}
        description={
          careerToToggle?.action === 'activate'
            ? `¿Deseas habilitar la carrera "${careerToToggle?.career.name}"? Volverá a estar disponible en el sistema.`
            : `¿Estás seguro de desactivar la carrera "${careerToToggle?.career.name}"?`
        }
        confirmLabel={careerToToggle?.action === 'activate' ? 'Habilitar carrera' : 'Desactivar carrera'}
        cancelLabel="Cancelar"
        variant={careerToToggle?.action === 'activate' ? 'default' : 'destructive'}
        pending={pending === 'toggle-career'}
      />

      <ConfirmModal
        open={Boolean(cycleToToggle)}
        onClose={() => setCycleToToggle(null)}
        onConfirm={() => void handleConfirmToggleCycle()}
        title={cycleToToggle?.action === 'activate' ? '¿Habilitar ciclo?' : '¿Desactivar ciclo?'}
        description={
          cycleToToggle?.action === 'activate'
            ? `¿Deseas habilitar el ciclo "${cycleToToggle?.cycle.name}"? Volverá a estar disponible en el sistema.`
            : `¿Estás seguro de desactivar el ciclo "${cycleToToggle?.cycle.name}"?`
        }
        confirmLabel={cycleToToggle?.action === 'activate' ? 'Habilitar ciclo' : 'Desactivar ciclo'}
        cancelLabel="Cancelar"
        variant={cycleToToggle?.action === 'activate' ? 'default' : 'destructive'}
        pending={pending === 'toggle-cycle'}
      />
    </section>
  )
}
