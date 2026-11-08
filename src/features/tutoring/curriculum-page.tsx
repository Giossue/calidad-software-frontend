import { useState } from 'react'
import { ArrowDownIcon, ArrowUpIcon, FlagIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ErrorNotice } from '@/components/ui/error-notice'
import { Skeleton } from '@/components/ui/skeleton'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { isDegreeCycleNumber, maxCycleNumber } from '@/lib/academic-stage'
import { formatSubjectName } from '@/lib/sanitize'
import { tutoringApi, type Subject } from '@/lib/tutoring-api'
import { cn } from '@/lib/utils'
import { CareerBreadcrumb, CareerPicker, useSelectedCareer } from './career-picker'
import { ModuleHeader } from './tutoring-shared'
import { useTutoringCatalogs } from './tutoring-hooks'

type Catalogs = ReturnType<typeof useTutoringCatalogs>

/** Malla curricular de la carrera: asignaturas por ciclo y su secuencia (solo consulta). */
export function TutoringCurriculumPage() {
  const catalogs = useTutoringCatalogs()
  const selection = useSelectedCareer(catalogs.careers)

  if (selection.career) {
    return <CurriculumView catalogs={catalogs} careerId={selection.career.id} careerName={selection.career.name} onBack={selection.canChange ? selection.clear : undefined} />
  }

  return <CareerPicker catalogs={catalogs} title="Malla curricular" rowTitle={(career) => `Ver malla de ${career.name}`} onSelect={(career) => selection.select(career.id)} />
}

/** Todas las asignaturas activas de la carrera (la malla completa cabe en pocas páginas). */
async function loadCareerSubjects(careerId: number): Promise<Subject[]> {
  const subjects: Subject[] = []
  let page = 1
  let lastPage = 1
  do {
    const response = await tutoringApi.subjects({ career_id: careerId, status: 'active', page, per_page: 100 })
    subjects.push(...response.data)
    lastPage = response.meta?.last_page ?? 1
    page += 1
  } while (page <= lastPage)
  return subjects
}

function CurriculumView({ catalogs, careerId, careerName, onBack }: Readonly<{ catalogs: Catalogs; careerId: number; careerName: string; onBack?: () => void }>) {
  const resource = useDegreeResource(() => loadCareerSubjects(careerId), `curriculum-${careerId}`)
  const [selectedId, setSelectedId] = useState<number | null>(null)

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

  return (
    <section className="flex flex-col gap-6" data-tour-view="curriculum">
      <CareerBreadcrumb root="Malla curricular" career={careerName} onBack={onBack} />
      <ModuleHeader
        title={careerName}
        description="Asignaturas por ciclo y su secuencia. Elige una para ver de cuál viene y en cuál continúa. La secuencia se edita en Asignaturas."
      />
      <ErrorNotice message={resource.error} retry={resource.reload} />

      {resource.loading ? (
        <div role="status" aria-label="Cargando malla curricular" className="flex flex-col gap-3">
          {[1, 2, 3].map((index) => <Skeleton key={index} className="h-28 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Esta carrera aún no tiene asignaturas activas. Regístralas en Asignaturas.</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:flex-row sm:items-center sm:justify-between" aria-live="polite" data-tour="curriculum-detail">
            {selected ? (
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-medium">{formatSubjectName(selected.name)}</span>
                <span className="text-muted-foreground">
                  <span className="font-medium text-amber-700 dark:text-amber-300">Viene de:</span> {(selected.previous_subjects ?? []).map((item) => formatSubjectName(item.name)).join(', ') || 'ninguna (inicia una secuencia)'}
                </span>
                <span className="text-muted-foreground">
                  <span className="font-medium text-emerald-700 dark:text-emerald-300">Continúa en:</span> {(selected.next_subjects ?? []).map((item) => formatSubjectName(item.name)).join(', ') || 'ninguna (aquí termina la secuencia)'}
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
                            'flex h-full w-full flex-col gap-1.5 rounded-lg border bg-card p-3 text-left transition-[opacity,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                            isSelected && 'border-primary ring-2 ring-primary/30',
                            isPrevious && 'border-amber-500 bg-amber-500/10',
                            isNext && 'border-emerald-500 bg-emerald-500/10',
                            dimmed && 'opacity-40',
                          )}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[11px] text-muted-foreground">{subject.code ?? 'Sin código'}</span>
                            {isPrevious && <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300"><ArrowUpIcon className="size-3" aria-hidden="true" />Previa</span>}
                            {isNext && <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"><ArrowDownIcon className="size-3" aria-hidden="true" />Continúa</span>}
                          </span>
                          <span className="text-sm font-medium leading-snug">{formatSubjectName(subject.name)}</span>
                          <span className="mt-auto flex items-center gap-1 text-xs text-muted-foreground">
                            {nextCount > 0
                              ? <><ArrowDownIcon className="size-3" aria-hidden="true" />{(subject.next_subjects ?? []).map((item) => formatSubjectName(item.name)).join(', ')}</>
                              : <><FlagIcon className="size-3" aria-hidden="true" />Fin de secuencia</>}
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
