import { useState } from 'react'
import { ArrowDownIcon, FlagIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorNotice } from '@/components/ui/error-notice'
import { DetailPageSkeleton } from '@/components/ui/loading-skeletons'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { useDetailParam } from '@/hooks/use-detail-param'
import { isDegreeCycleNumber, maxCycleNumber } from '@/lib/academic-stage'
import { formatSubjectName } from '@/lib/sanitize'
import { tutoringApi, type Subject } from '@/lib/tutoring-api'
import { CareerBreadcrumb, CareerPicker, useSelectedCareer } from './career-picker'
import { CurriculumImportButton } from './curriculum-upload-dialog'
import { FilterBar } from './filter-bar'
import { SubjectDetail } from './subject-detail'
import { activeParallels, SubjectFormDialog, type SubjectFormMode } from './subjects-page'
import { ModuleHeader } from './tutoring-shared'
import { useOperation, useTutoringCatalogs } from './tutoring-hooks'
import { CurriculumCardsSkeleton, CurriculumScreenSkeleton } from './tutoring-skeletons'

type Catalogs = ReturnType<typeof useTutoringCatalogs>

/**
 * Malla curricular de la carrera: la malla es la carrera. Aquí se importa la malla y se
 * administran sus asignaturas (registrar, editar, desactivar, paralelos y secuencia).
 */
export function TutoringCurriculumPage() {
  const catalogs = useTutoringCatalogs()
  const selection = useSelectedCareer(catalogs.careers)

  if (selection.career) {
    return <CurriculumWorkspace catalogs={catalogs} careerId={selection.career.id} careerName={selection.career.name} onBack={selection.canChange ? selection.clear : undefined} />
  }

  return <CareerPicker catalogs={catalogs} title="Malla curricular" skeleton={<CurriculumScreenSkeleton />} rowTitle={(career) => `Ver malla de ${career.name}`} onSelect={(career) => selection.select(career.id)} />
}

/** Todas las asignaturas de la carrera (la malla completa cabe en pocas páginas). */
async function loadCareerSubjects(careerId: number): Promise<Subject[]> {
  const subjects: Subject[] = []
  let page = 1
  let lastPage = 1
  do {
    const response = await tutoringApi.subjects({ career_id: careerId, page, per_page: 100 })
    subjects.push(...response.data)
    lastPage = response.meta?.last_page ?? 1
    page += 1
  } while (page <= lastPage)
  return subjects
}

const normalize = (value: string) => value.normalize('NFD').replace(/\p{Mn}/gu, '').trim().toLocaleLowerCase('es')

function CurriculumWorkspace({ catalogs, careerId, careerName, onBack }: Readonly<{ catalogs: Catalogs; careerId: number; careerName: string; onBack?: () => void }>) {
  const resource = useDegreeResource(() => loadCareerSubjects(careerId), `curriculum-${careerId}`)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'inactive'>('')
  const operation = useOperation()
  // La asignatura abierta vive en la URL (?asignatura=<id>) para que "Atrás" vuelva a la malla.
  const detail = useDetailParam('asignatura')
  const [openedSubject, setOpenedSubject] = useState<Subject | null>(null)
  const [form, setForm] = useState<{ key: number; mode: SubjectFormMode | null; subject: Subject | null }>({ key: 0, mode: null, subject: null })
  const [deactivating, setDeactivating] = useState<Subject | null>(null)

  const subjects = resource.data ?? resource.previous ?? []
  const careerCycles = catalogs.cycles.filter((cycle) => cycle.career_id === careerId)
  const maxCycle = maxCycleNumber(careerCycles)
  const levelOf = (subject: Subject) => {
    const numbers = subject.cycle_ids.map((id) => careerCycles.find((cycle) => cycle.id === id)?.number).filter((number): number is number => typeof number === 'number')
    return numbers.length > 0 ? Math.min(...numbers) : null
  }

  const needle = normalize(search)
  const visible = subjects
    .filter((subject) => (statusFilter === 'inactive' ? !subject.is_active : subject.is_active))
    .filter((subject) => !needle || normalize(subject.name).includes(needle) || normalize(subject.code ?? '').includes(needle))
  const levels = Array.from(new Set(careerCycles.map((cycle) => cycle.number))).sort((a, b) => a - b)
  const rows = [
    ...levels.map((level) => ({ key: String(level), label: `${level}° ciclo`, degree: isDegreeCycleNumber(level, maxCycle), subjects: visible.filter((subject) => levelOf(subject) === level) })),
    { key: 'none', label: 'Sin ciclo', degree: false, subjects: visible.filter((subject) => levelOf(subject) === null) },
  ].filter((row) => row.subjects.length > 0)

  const detailSubject = detail.id === null
    ? null
    : (openedSubject?.id === detail.id ? openedSubject : null) ?? subjects.find((item) => item.id === detail.id) ?? null

  function openSubject(subject: Subject) {
    setOpenedSubject(subject)
    detail.open(subject.id)
  }

  function openForm(mode: SubjectFormMode, subject: Subject | null) {
    operation.clearError()
    setForm((current) => ({ key: current.key + 1, mode, subject }))
  }

  async function refresh(updated: Subject | null = null) {
    if (updated) setOpenedSubject(updated)
    resource.reload()
    await catalogs.reload()
  }

  const parallels = activeParallels(catalogs)
  // Lo que la carrera ya tiene: la vista previa lo marca y lo acepta como previa.
  const existing = subjects.map((subject) => {
    const numbers = subject.cycle_ids.map((id) => careerCycles.find((cycle) => cycle.id === id)?.number).filter((number): number is number => typeof number === 'number')
    return { code: subject.code, name: subject.name, cycle: numbers.length > 0 ? Math.max(...numbers) : null }
  })
  const filtered = needle !== '' || statusFilter !== ''

  let content
  if (detailSubject) {
    content = (
      <SubjectDetail
        subject={detailSubject}
        cycles={catalogs.cycles}
        parallels={parallels}
        operation={operation}
        onBack={detail.close}
        onEdit={() => openForm('edit', detailSubject)}
        onEditSequence={() => openForm('sequence', detailSubject)}
        onDeactivate={() => { operation.clearError(); setDeactivating(detailSubject) }}
        onChanged={(updated) => refresh(updated)}
      />
    )
  } else if (detail.id !== null && resource.settled) {
    content = (
      <div className="flex flex-col items-start gap-4">
        <p className="text-sm text-muted-foreground">No encontramos esta asignatura en la carrera.</p>
        <Button type="button" variant="secondary" onClick={detail.close}>Volver a la malla</Button>
      </div>
    )
  } else if (detail.id !== null) {
    content = <DetailPageSkeleton label="Cargando asignatura" />
  } else if (!resource.settled) {
    // Primera carga: el mismo esqueleto que mientras cargaban las carreras. Al recargar
    // después se mantiene la pantalla y solo las tarjetas muestran su esqueleto.
    content = <CurriculumScreenSkeleton />
  } else {
    content = (
      <>
        <CareerBreadcrumb root="Malla curricular" career={careerName} onBack={onBack} />
        <ModuleHeader
          title="Malla curricular"
          description={`Asignaturas de ${careerName} por ciclo y su secuencia. Haz clic en una para abrirla.`}
          createLabel="Nueva asignatura"
          onCreate={() => openForm('create', null)}
          disabled={operation.pending || catalogs.loading}
          extraActions={<CurriculumImportButton careerId={careerId} careerName={careerName} existing={existing} onImported={() => refresh()} />}
        />
        <FilterBar
          id="curriculum"
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Busca por nombre o código…"
          onClear={() => { setSearch(''); setStatusFilter('') }}
          filters={[
            { id: 'status', label: 'Estado', value: statusFilter, onChange: (value) => setStatusFilter(value as '' | 'inactive'), allLabel: 'Activas', options: [{ value: 'inactive', label: 'Inactivas' }] },
          ]}
        />
        <ErrorNotice message={resource.error} retry={resource.reload} />

        {resource.loading ? (
          <div role="status" aria-label="Cargando malla curricular">
            <CurriculumCardsSkeleton />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState className="rounded-md ring-1 ring-surface-ring">
            {filtered
              ? 'No hay asignaturas con estos filtros.'
              : subjects.length === 0
                ? 'Esta carrera aún no tiene asignaturas. Usa «Importar malla» para crearlas desde el archivo de la malla.'
                : 'Esta carrera no tiene asignaturas activas.'}
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-5">
            {rows.map((row) => (
              <section key={row.key} aria-label={row.label} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-muted-foreground">{row.label}{row.degree ? ' · Titulación' : ''}</h3>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {row.subjects.map((subject) => {
                    const next = subject.next_subjects ?? []
                    return (
                      <li key={subject.id}>
                        <button
                          type="button"
                          title={`Abrir ${formatSubjectName(subject.name)}`}
                          onClick={() => openSubject(subject)}
                          className="flex h-full w-full cursor-pointer flex-col gap-1.5 rounded-md bg-card p-3 text-left shadow-surface ring-1 ring-surface-ring transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                          <span className="text-xs text-muted-foreground">{subject.code ?? 'Sin código'}</span>
                          <span className="text-sm leading-snug">{formatSubjectName(subject.name)}</span>
                          <span className="mt-auto flex items-center gap-1 text-xs text-muted-foreground">
                            {next.length > 0
                              ? <><ArrowDownIcon className="size-4 shrink-0" aria-hidden="true" />{next.map((item) => formatSubjectName(item.name)).join(', ')}</>
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
        )}
      </>
    )
  }

  return (
    <section className="flex flex-col gap-6">
      {content}
      <SubjectFormDialog
        key={form.key}
        catalogs={catalogs}
        careerId={careerId}
        mode={form.mode}
        subject={form.subject}
        careerSubjects={resource.settled ? subjects : null}
        operation={operation}
        onClose={() => setForm((current) => ({ ...current, mode: null }))}
        onSaved={async (updated) => {
          setForm((current) => ({ ...current, mode: null }))
          await refresh(updated)
        }}
      />
      <ConfirmModal
        open={Boolean(deactivating)}
        title="¿Desactivar asignatura?"
        description={`La asignatura «${deactivating?.name ?? ''}» dejará de estar disponible para nuevas tutorías. Sus tutorías existentes se conservarán.`}
        confirmLabel="Desactivar asignatura"
        pending={operation.pending}
        onClose={() => { if (!operation.pending) setDeactivating(null) }}
        onConfirm={() => {
          if (!deactivating) return
          let updated: Subject | null = null
          void operation.run(
            async () => { updated = await tutoringApi.deactivateSubject(deactivating.id) },
            'Asignatura desactivada',
            async () => {
              setDeactivating(null)
              await refresh(updated)
            },
          )
        }}
      />
    </section>
  )
}
