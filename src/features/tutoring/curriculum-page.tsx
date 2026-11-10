import { useState } from 'react'
import { ArrowDownIcon, ArrowUpIcon, FlagIcon, Trash2Icon, XIcon } from 'lucide-react'
import { toast } from '@/lib/toast'

import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorNotice } from '@/components/ui/error-notice'
import { SelectField } from '@/components/ui/select-field'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { isDegreeCycleNumber, maxCycleNumber } from '@/lib/academic-stage'
import { ApiError } from '@/lib/api'
import { formatSubjectName } from '@/lib/sanitize'
import { tutoringApi, type Curriculum, type Subject } from '@/lib/tutoring-api'
import { cn } from '@/lib/utils'
import { CareerBreadcrumb, CareerPicker, useSelectedCareer } from './career-picker'
import { CurriculumUploadButton } from './curriculum-upload-dialog'
import { ModuleHeader } from './tutoring-shared'
import { useTutoringCatalogs } from './tutoring-hooks'
import { CurriculumCardsSkeleton, CurriculumScreenSkeleton } from './tutoring-skeletons'

type Catalogs = ReturnType<typeof useTutoringCatalogs>

/** Malla curricular de la carrera: asignaturas por ciclo y su secuencia (solo consulta). */
export function TutoringCurriculumPage() {
  const catalogs = useTutoringCatalogs()
  const selection = useSelectedCareer(catalogs.careers)

  if (selection.career) {
    return <CurriculumView catalogs={catalogs} careerId={selection.career.id} careerName={selection.career.name} onBack={selection.canChange ? selection.clear : undefined} />
  }

  return <CareerPicker catalogs={catalogs} title="Malla curricular" skeleton={<CurriculumScreenSkeleton />} rowTitle={(career) => `Ver malla de ${career.name}`} onSelect={(career) => selection.select(career.id)} />
}

/** Todas las asignaturas activas de una malla de la carrera (la malla completa cabe en pocas páginas). */
async function loadCareerSubjects(careerId: number, curriculumId: number): Promise<Subject[]> {
  const subjects: Subject[] = []
  let page = 1
  let lastPage = 1
  do {
    const response = await tutoringApi.subjects({ career_id: careerId, curriculum_id: curriculumId, status: 'active', page, per_page: 100 })
    subjects.push(...response.data)
    lastPage = response.meta?.last_page ?? 1
    page += 1
  } while (page <= lastPage)
  return subjects
}

/** A quién se aplica la malla. */
function curriculumScope(curriculum: Curriculum): string {
  if (curriculum.is_initial) return 'Malla con la que se registró la carrera.'
  return `Rige desde ${curriculum.from_period_name ?? 'su PAO'} para quienes estaban de 1.º a ${curriculum.up_to_cycle ?? '?'}.º ciclo al subirla y para quienes ingresen después. Los de ciclos superiores siguen con ${curriculum.previous_name ?? 'la malla anterior'}.`
}

function CurriculumView({ catalogs, careerId, careerName, onBack }: Readonly<{ catalogs: Catalogs; careerId: number; careerName: string; onBack?: () => void }>) {
  const curricula = useDegreeResource(() => tutoringApi.curricula(careerId), `curricula-${careerId}`)
  const [chosenCurriculumId, setChosenCurriculumId] = useState<number | null>(null)
  const versions = curricula.data?.data ?? []
  const curriculum = versions.find((item) => item.id === chosenCurriculumId) ?? versions.find((item) => item.in_force) ?? versions[0] ?? null
  const curriculumId = curriculum?.id ?? null
  const resource = useDegreeResource(() => (curriculumId ? loadCareerSubjects(careerId, curriculumId) : Promise.resolve(null)), `curriculum-${careerId}-${curriculumId ?? 'none'}`)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deletePending, setDeletePending] = useState(false)

  async function deleteCurriculum() {
    if (!curriculum) return
    setDeletePending(true)
    try {
      await tutoringApi.deleteCurriculum(curriculum.id)
      toast.success(`Malla «${curriculum.name}» eliminada`)
      setDeleting(false)
      setChosenCurriculumId(null)
      curricula.reload()
    } catch (caught: unknown) {
      toast.error(caught instanceof ApiError ? caught.firstValidationMessage ?? caught.message : 'No fue posible eliminar la malla.')
    } finally {
      setDeletePending(false)
    }
  }

  const careerCycles = catalogs.cycles.filter((cycle) => cycle.career_id === careerId)
  const maxCycle = maxCycleNumber(careerCycles)
  const levelOf = (subject: Subject) => {
    const numbers = subject.cycle_ids.map((id) => careerCycles.find((cycle) => cycle.id === id)?.number).filter((number): number is number => typeof number === 'number')
    return numbers.length > 0 ? Math.min(...numbers) : null
  }

  const subjects = resource.data ?? []
  const levels = Array.from(new Set(careerCycles.map((cycle) => cycle.number))).sort((a, b) => a - b)
  const rows = [
    ...levels.map((level) => ({ key: String(level), label: `${level}° ciclo`, degree: isDegreeCycleNumber(level, maxCycle), subjects: subjects.filter((subject) => levelOf(subject) === level) })),
    { key: 'none', label: 'Sin ciclo', degree: false, subjects: subjects.filter((subject) => levelOf(subject) === null) },
  ].filter((row) => row.subjects.length > 0)

  const selected = subjects.find((subject) => subject.id === selectedId) ?? null
  const previousIds = new Set((selected?.previous_subjects ?? []).map((item) => item.id))
  const nextIds = new Set((selected?.next_subjects ?? []).map((item) => item.id))
  const withSequence = subjects.filter((subject) => (subject.next_subjects ?? []).length > 0).length

  // Primera carga (versiones y asignaturas de la malla): el mismo esqueleto que mientras
  // cargaban las carreras (encabezado y tarjetas). Al recargar después se mantiene la pantalla
  // y solo las tarjetas muestran su esqueleto.
  const [loadedOnce, setLoadedOnce] = useState(false)
  const loading = curricula.loading || resource.loading
  if (!loadedOnce && !loading) setLoadedOnce(true)
  if (!loadedOnce && loading) return <CurriculumScreenSkeleton />

  return (
    <section className="flex flex-col gap-6" data-tour-view="curriculum">
      <CareerBreadcrumb root="Malla curricular" career={careerName} onBack={onBack} />
      <ModuleHeader
        title="Malla curricular"
        description={`Asignaturas por ciclo de la malla de ${careerName} y su secuencia. Elige una para ver de cuál viene y en cuál continúa; la secuencia se edita en Asignaturas.`}
        extraActions={(
          <CurriculumUploadButton
            careerId={careerId}
            careerName={careerName}
            info={curricula.data}
            maxCycle={maxCycle ?? 1}
            onCreated={(id) => {
              setChosenCurriculumId(id)
              setSelectedId(null)
              curricula.reload()
            }}
          />
        )}
      />
      <ErrorNotice message={curricula.error ?? resource.error} retry={curricula.error ? curricula.reload : resource.reload} />

      {curriculum && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between" data-tour="curriculum-version">
          {versions.length > 1 ? (
            <SelectField
              id="curriculum-version"
              label="Malla"
              className="sm:max-w-sm"
              value={String(curriculum.id)}
              onValueChange={(value) => {
                setChosenCurriculumId(Number(value))
                setSelectedId(null)
              }}
              options={versions.map((item) => ({ value: String(item.id), label: `${item.name}${item.in_force ? ' · vigente' : item.is_initial ? '' : ` · desde ${item.from_period_name ?? ''}`}` }))}
            />
          ) : <span className="text-sm font-medium">{curriculum.name}</span>}
          {!curriculum.is_initial && (
            <Button type="button" variant="tertiary" tone="destructive" size="sm" className="self-start sm:self-end" onClick={() => setDeleting(true)}>
              <Trash2Icon data-icon="inline-start" />Eliminar esta malla
            </Button>
          )}
        </div>
      )}
      {curriculum && versions.length > 1 && <p className="-mt-3 text-sm text-muted-foreground">{curriculumScope(curriculum)}</p>}
      <ConfirmModal
        open={deleting}
        onClose={() => !deletePending && setDeleting(false)}
        onConfirm={() => void deleteCurriculum()}
        title="¿Eliminar esta malla?"
        description={`Se eliminan «${curriculum?.name ?? ''}», sus asignaturas y secuencias. Solo es posible mientras ninguna tutoría use sus asignaturas.`}
        confirmLabel="Eliminar malla"
        pending={deletePending}
      />

      {loading ? (
        <div role="status" aria-label="Cargando malla curricular">
          <CurriculumCardsSkeleton />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState className="rounded-md ring-1 ring-surface-ring">Esta carrera aún no tiene asignaturas activas. Regístralas en Asignaturas.</EmptyState>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-md bg-muted px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between" aria-live="polite" data-tour="curriculum-detail">
            {selected ? (
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-medium">{formatSubjectName(selected.name)}</span>
                <span className="text-muted-foreground">
                  <span className="font-medium text-warning">Viene de:</span> {(selected.previous_subjects ?? []).map((item) => formatSubjectName(item.name)).join(', ') || 'ninguna (inicia una secuencia)'}
                </span>
                <span className="text-muted-foreground">
                  <span className="font-medium text-success">Continúa en:</span> {(selected.next_subjects ?? []).map((item) => formatSubjectName(item.name)).join(', ') || 'ninguna (aquí termina la secuencia)'}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">{subjects.length} asignaturas · {withSequence} continúan en otra. Elige una para ver su secuencia.</span>
            )}
            {selected && (
              <Button type="button" variant="tertiary" size="sm" className="shrink-0 self-start sm:self-center" onClick={() => setSelectedId(null)}>
                <XIcon data-icon="inline-start" />Quitar selección
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-5">
            {rows.map((row) => (
              <section key={row.key} aria-label={row.label} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-muted-foreground">{row.label}{row.degree ? ' · Titulación' : ''}</h3>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {row.subjects.map((subject) => {
                    const isSelected = subject.id === selectedId
                    const isPrevious = previousIds.has(subject.id)
                    const isNext = nextIds.has(subject.id)
                    const dimmed = selected !== null && !isSelected && !isPrevious && !isNext
                    const nextCount = (subject.next_subjects ?? []).length
                    return (
                      <li key={subject.id}>
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setSelectedId(isSelected ? null : subject.id)}
                          className={cn(
                            'flex h-full w-full flex-col gap-1.5 rounded-md bg-card p-3 text-left shadow-surface ring-1 ring-surface-ring transition-[opacity,box-shadow] hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                            isSelected && 'ring-2 ring-primary',
                            isPrevious && 'bg-warning/10 ring-2 ring-warning',
                            isNext && 'bg-success/10 ring-2 ring-success',
                            dimmed && 'opacity-40',
                          )}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">{subject.code ?? 'Sin código'}</span>
                            {isPrevious && <span className="flex items-center gap-1 text-xs font-medium text-warning"><ArrowUpIcon className="size-4" aria-hidden="true" />Previa</span>}
                            {isNext && <span className="flex items-center gap-1 text-xs font-medium text-success"><ArrowDownIcon className="size-4" aria-hidden="true" />Continúa</span>}
                          </span>
                          <span className="text-sm font-medium leading-snug">{formatSubjectName(subject.name)}</span>
                          <span className="mt-auto flex items-center gap-1 text-xs text-muted-foreground">
                            {nextCount > 0
                              ? <><ArrowDownIcon className="size-4 shrink-0" aria-hidden="true" />{(subject.next_subjects ?? []).map((item) => formatSubjectName(item.name)).join(', ')}</>
                              : <><FlagIcon className="size-4 shrink-0" aria-hidden="true" />Fin de secuencia</>}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
