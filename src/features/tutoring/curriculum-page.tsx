import { useCallback, useEffect, useState } from 'react'
import { ArrowLeftIcon, PencilIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'

import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorNotice } from '@/components/ui/error-notice'
import { DetailPageSkeleton } from '@/components/ui/loading-skeletons'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { useDetailParam } from '@/hooks/use-detail-param'
import { isDegreeCycleNumber, maxCycleNumber } from '@/lib/academic-stage'
import { tutoringApi, type Subject } from '@/lib/tutoring-api'
import { CareerBreadcrumb, CareerPicker, useSelectedCareer } from './career-picker'
import { CurriculumImportButton } from './curriculum-upload-dialog'
import { FilterBar } from './filter-bar'
import { SubjectDetail } from './subject-detail'
import { CurriculumCanvas } from './curriculum-canvas/curriculum-canvas'
import type { CanvasLane } from './curriculum-canvas/layout'
import { careerCycleNumbers, SubjectFormDialog, type SubjectFormMode } from './subjects-page'
import { ModuleHeader } from './tutoring-shared'
import { useOperation, useTutoringCatalogs } from './tutoring-hooks'
import { CurriculumScreenSkeleton } from './tutoring-skeletons'

type Catalogs = ReturnType<typeof useTutoringCatalogs>

/**
 * Malla curricular de la carrera: la malla es la carrera. Aquí se importa la malla y se ve
 * como un lienzo (un carril por ciclo y las previas como flechas, como en sílabos); en
 * «Editar malla» se agregan asignaturas en cada ciclo, se editan y se conectan sus previas.
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
  const [editing, setEditing] = useState(false)
  const operation = useOperation()
  // La asignatura abierta vive en la URL (?asignatura=<id>) para que "Atrás" vuelva a la malla.
  const detail = useDetailParam('asignatura')
  const [openedSubject, setOpenedSubject] = useState<Subject | null>(null)
  const [form, setForm] = useState<{ key: number; mode: SubjectFormMode | null; subject: Subject | null; cycleNumber: number | null }>({ key: 0, mode: null, subject: null, cycleNumber: null })
  const [deactivating, setDeactivating] = useState<Subject | null>(null)

  const subjects = resource.data ?? resource.previous ?? []
  const careerCycles = catalogs.cycles.filter((cycle) => cycle.career_id === careerId)
  const maxCycle = maxCycleNumber(careerCycles)
  // La asignatura se dibuja en el carril de su número de ciclo (la malla no tiene paralelos).
  const levelOf = useCallback((subject: Subject) => subject.cycle_number ?? null, [])
  // Ciclos en los que se puede agregar una asignatura desde un carril.
  const cycleNumbers = new Set(careerCycleNumbers(catalogs, careerId))

  const needle = normalize(search)
  // Al editar se ve la malla vigente completa; los filtros son de la vista.
  const visible = editing
    ? subjects.filter((subject) => subject.is_active)
    : subjects
      .filter((subject) => (statusFilter === 'inactive' ? !subject.is_active : subject.is_active))
      .filter((subject) => !needle || normalize(subject.name).includes(needle) || normalize(subject.code ?? '').includes(needle))
  const levels = Array.from(new Set([
    ...careerCycles.map((cycle) => cycle.number),
    ...visible.map(levelOf).filter((number): number is number => number !== null),
  ])).sort((a, b) => a - b)
  const lanes: CanvasLane[] = [
    ...levels.map((level) => ({ key: String(level), cycle: level, label: `${level}° ciclo`, degree: isDegreeCycleNumber(level, maxCycle) })),
    ...(visible.some((subject) => levelOf(subject) === null) ? [{ key: 'none', cycle: null, label: 'Sin ciclo', degree: false }] : []),
  ]

  // En la edición la malla ocupa toda la pantalla: la página de atrás no se desplaza.
  useEffect(() => {
    if (!editing) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [editing])

  const detailSubject = detail.id === null
    ? null
    : (openedSubject?.id === detail.id ? openedSubject : null) ?? subjects.find((item) => item.id === detail.id) ?? null

  function openSubject(subject: Subject) {
    setOpenedSubject(subject)
    detail.open(subject.id)
  }

  function openForm(mode: SubjectFormMode, subject: Subject | null, cycleNumber: number | null = null) {
    operation.clearError()
    setForm((current) => ({ key: current.key + 1, mode, subject, cycleNumber }))
  }

  function askDeactivate(subject: Subject) {
    operation.clearError()
    setDeactivating(subject)
  }

  async function refresh(updated: Subject | null = null) {
    if (updated) setOpenedSubject(updated)
    resource.reload()
    await catalogs.reload()
  }

  // Lo que la carrera ya tiene: la vista previa lo marca y lo acepta como previa.
  const existing = subjects.map((subject) => ({ code: subject.code, name: subject.name, cycle: subject.cycle_number ?? null }))
  const filtered = needle !== '' || statusFilter !== ''

  const canvas = (
    <CurriculumCanvas
      subjects={visible}
      careerSubjects={subjects}
      lanes={lanes}
      cycleOf={levelOf}
      editing={editing}
      fullScreen={editing}
      operation={operation}
      canAdd={(cycle) => cycleNumbers.has(cycle)}
      onOpen={openSubject}
      onEdit={(subject) => openForm('edit', subject)}
      onAdd={(cycle) => openForm('create', null, cycle)}
      onDeactivate={askDeactivate}
      onChanged={(updated) => refresh(updated)}
    />
  )

  let content
  if (detailSubject) {
    content = (
      <SubjectDetail
        subject={detailSubject}
        operation={operation}
        onBack={detail.close}
        onEdit={() => openForm('edit', detailSubject)}
        onEditSequence={() => openForm('sequence', detailSubject)}
        onDeactivate={() => askDeactivate(detailSubject)}
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
    // después se mantiene el lienzo con lo último cargado.
    content = <CurriculumScreenSkeleton />
  } else if (editing) {
    // Edición a pantalla completa, como en sílabos: sin menú lateral y con «Volver a la vista».
    content = (
      <section aria-label="Editar malla" data-tour-view="editor" className="fixed inset-0 z-40 flex flex-col gap-4 bg-background p-4 sm:p-6">
        <div>
          <Button type="button" variant="tertiary" data-tour="curriculum-back" onClick={() => setEditing(false)}>
            <ArrowLeftIcon data-icon="inline-start" />
            Volver a la vista
          </Button>
        </div>
        <AdminSectionHeader
          title={`Malla de ${careerName}`}
          description="Agrega asignaturas en cada ciclo y arrastra desde una tarjeta hasta otra para conectar su previa. Pulsa una flecha para quitarla."
        />
        <ErrorNotice message={resource.error} retry={resource.reload} />
        {canvas}
      </section>
    )
  } else {
    content = (
      <>
        <CareerBreadcrumb root="Malla curricular" career={careerName} onBack={onBack} />
        <ModuleHeader
          title="Malla curricular"
          description={`Asignaturas de ${careerName} por ciclo y sus previas. Haz clic en una para abrirla.`}
          disabled={operation.pending || catalogs.loading}
          extraActions={
            <>
              <CurriculumImportButton careerId={careerId} careerName={careerName} existing={existing} onImported={() => refresh()} />
              <Button type="button" variant="secondary" className="w-full sm:w-auto" data-tour="curriculum-edit" disabled={operation.pending || catalogs.loading || levels.length === 0} onClick={() => { setSearch(''); setStatusFilter(''); setEditing(true) }}>
                <PencilIcon data-icon="inline-start" />
                Editar malla
              </Button>
            </>
          }
        />
        {subjects.length > 0 && (
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
        )}
        <ErrorNotice message={resource.error} retry={resource.reload} />

        {visible.length === 0 ? (
          <EmptyState className="rounded-md ring-1 ring-surface-ring">
            {filtered
              ? 'No hay asignaturas con estos filtros.'
              : subjects.length === 0
                ? 'Esta carrera aún no tiene asignaturas. Usa «Importar malla» para crearlas desde el archivo de la malla o «Editar malla» para agregarlas una a una.'
                : 'Esta carrera no tiene asignaturas activas.'}
          </EmptyState>
        ) : canvas}
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
        initialCycleNumber={form.cycleNumber}
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
