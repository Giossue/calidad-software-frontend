import { useCallback, useEffect, useState } from 'react'
import { ArrowLeftIcon, PencilIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'

import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorNotice } from '@/components/ui/error-notice'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { isDegreeCycleNumber } from '@/lib/academic-stage'
import { tutoringApi, type Malla, type Subject, type TutoringCareer } from '@/lib/tutoring-api'
import { CareerBreadcrumb, CareerPicker, useSelectedCareer } from './career-picker'
import { CurriculumImportButton } from './curriculum-upload-dialog'
import { MallaManagement } from './malla-management'
import { MallaPicker } from './malla-picker'
import { SubjectDetail } from './subject-detail'
import { CurriculumCanvas } from './curriculum-canvas/curriculum-canvas'
import type { CanvasLane } from './curriculum-canvas/layout'
import { careerCycleNumbers, SubjectFormDialog, type SubjectFormMode } from './subjects-page'
import { ModuleHeader } from './tutoring-shared'
import { useOperation, useSelectedMalla, useTutoringCatalogs } from './tutoring-hooks'
import { CurriculumScreenSkeleton } from './tutoring-skeletons'

type Catalogs = ReturnType<typeof useTutoringCatalogs>

/**
 * Malla curricular de la carrera: la carrera puede tener varias mallas y se trabaja con una
 * a la vez (la vigente por defecto). Aquí se gestionan las mallas, se importa la malla y se ve
 * como un lienzo (un carril por ciclo y las previas como flechas, como en sílabos); en
 * «Editar malla» se agregan asignaturas en cada ciclo, se editan y se conectan sus previas.
 */
export function TutoringCurriculumPage() {
  const catalogs = useTutoringCatalogs()
  const selection = useSelectedCareer(catalogs.careers)

  if (selection.career) {
    return <CurriculumWorkspace catalogs={catalogs} career={selection.career} onBack={selection.canChange ? selection.clear : undefined} />
  }

  return <CareerPicker catalogs={catalogs} title="Malla curricular" skeleton={<CurriculumScreenSkeleton />} rowTitle={(career) => `Ver malla de ${career.name}`} onSelect={(career) => selection.select(career.id)} />
}

/** Todas las asignaturas de la malla elegida (la malla completa cabe en pocas páginas). */
async function loadMallaSubjects(careerId: number, mallaId: number | undefined): Promise<Subject[]> {
  const subjects: Subject[] = []
  let page = 1
  let lastPage = 1
  do {
    const response = await tutoringApi.subjects({ career_id: careerId, ...(mallaId === undefined ? {} : { malla_id: mallaId }), page, per_page: 100 })
    subjects.push(...response.data)
    lastPage = response.meta?.last_page ?? 1
    page += 1
  } while (page <= lastPage)
  return subjects
}

/**
 * Mallas de la carrera con lo que tiene cada una (para saber si se puede eliminar). Mientras
 * no llegan, el selector usa las mallas que vienen con la carrera.
 */
function useCareerMallas(careerId: number) {
  const [list, setList] = useState<{ careerId: number; data: readonly Malla[] } | null>(null)
  // Sin la lista se sigue trabajando con las mallas de la carrera; solo no se ofrece eliminar.
  const fetchList = useCallback(
    () => Promise.resolve(tutoringApi.mallas(careerId)).then((data) => (Array.isArray(data) ? data : null)).catch(() => null),
    [careerId],
  )
  useEffect(() => {
    let cancelled = false
    void fetchList().then((data) => { if (!cancelled && data) setList({ careerId, data }) })
    return () => { cancelled = true }
  }, [careerId, fetchList])
  // Al crear, renombrar o eliminar se espera la lista nueva (p. ej. para elegir la malla creada).
  const reload = useCallback(async () => {
    const data = await fetchList()
    if (data) setList({ careerId, data })
  }, [careerId, fetchList])
  return { data: list?.careerId === careerId ? list.data : null, reload }
}

function CurriculumWorkspace({ catalogs, career, onBack }: Readonly<{ catalogs: Catalogs; career: TutoringCareer; onBack?: () => void }>) {
  const careerId = career.id
  const careerName = career.name
  const careerMallas = useCareerMallas(careerId)
  const malla = useSelectedMalla(careerId, careerMallas.data ?? career.mallas)
  const mallaId = malla.mallaId
  const resource = useDegreeResource(() => loadMallaSubjects(careerId, mallaId), `curriculum-${careerId}-${mallaId ?? ''}`)
  const [editing, setEditing] = useState(false)
  const operation = useOperation()
  // La asignatura abierta en el modal; la URL no cambia.
  const [openedSubject, setOpenedSubject] = useState<Subject | null>(null)
  const [form, setForm] = useState<{ key: number; mode: SubjectFormMode | null; subject: Subject | null; cycleNumber: number | null }>({ key: 0, mode: null, subject: null, cycleNumber: null })
  const [deactivating, setDeactivating] = useState<Subject | null>(null)

  const subjects = resource.data ?? resource.previous ?? []
  const careerCycles = catalogs.cycles.filter((cycle) => cycle.career_id === careerId)
  // La asignatura se dibuja en el carril de su número de ciclo (la malla no tiene paralelos).
  const levelOf = useCallback((subject: Subject) => subject.cycle_number ?? null, [])
  // Ciclos en los que se puede agregar una asignatura desde un carril.
  const cycleNumbers = new Set(careerCycleNumbers(catalogs, careerId))

  // La malla muestra las asignaturas activas, en la vista y al editar.
  const visible = subjects.filter((subject) => subject.is_active)
  const levels = Array.from(new Set([
    ...careerCycles.map((cycle) => cycle.number),
    ...visible.map(levelOf).filter((number): number is number => number !== null),
  ])).sort((a, b) => a - b)
  const lanes: CanvasLane[] = [
    ...levels.map((level) => ({ key: String(level), cycle: level, label: `${level}° ciclo`, degree: isDegreeCycleNumber(level) })),
    ...(visible.some((subject) => levelOf(subject) === null) ? [{ key: 'none', cycle: null, label: 'Sin ciclo', degree: false }] : []),
  ]

  // En la edición la malla ocupa toda la pantalla: la página de atrás no se desplaza.
  useEffect(() => {
    if (!editing) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [editing])

  const detailSubject = openedSubject
  const closeDetail = () => setOpenedSubject(null)

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

  // Recarga las mallas (con lo que tiene cada una) y la carrera, que también trae sus mallas.
  async function refreshMallas() {
    await careerMallas.reload()
    catalogs.reload()
  }

  // Lo que la malla ya tiene: la vista previa lo marca y lo acepta como previa.
  const existing = subjects.map((subject) => ({ code: subject.code, name: subject.name, cycle: subject.cycle_number ?? null }))

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
      onOpen={setOpenedSubject}
      onEdit={(subject) => openForm('edit', subject)}
      onAdd={(cycle) => openForm('create', null, cycle)}
      onDeactivate={askDeactivate}
      onChanged={(updated) => refresh(updated)}
    />
  )

  let content
  if (!resource.settled) {
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
          description={`Asignaturas de ${careerName} por ciclo y sus previas. Haz clic en una para ver su detalle.`}
          disabled={operation.pending || catalogs.loading}
          extraActions={
            <>
              <CurriculumImportButton careerId={careerId} careerName={careerName} mallaId={mallaId} mallaName={malla.malla?.name} existing={existing} onImported={() => refresh()} />
              <Button type="button" variant="secondary" className="w-full sm:w-auto" data-tour="curriculum-edit" disabled={operation.pending || catalogs.loading || levels.length === 0} onClick={() => setEditing(true)}>
                <PencilIcon data-icon="inline-start" />
                Editar malla
              </Button>
            </>
          }
        />
        <MallaPicker selection={malla} label="Nombre de la malla" disabled={operation.pending}>
          <MallaManagement careerId={careerId} selection={malla} mallas={careerMallas.data} disabled={operation.pending} onChanged={refreshMallas} />
        </MallaPicker>
        <ErrorNotice message={resource.error} retry={resource.reload} />

        {visible.length === 0 ? (
          <EmptyState className="rounded-md ring-1 ring-surface-ring">
            {subjects.length === 0
              ? 'Esta malla aún no tiene asignaturas. Usa «Importar malla» para crearlas desde el archivo de la malla o «Editar malla» para agregarlas una a una.'
              : 'Esta malla no tiene asignaturas activas.'}
          </EmptyState>
        ) : canvas}
      </>
    )
  }

  return (
    <section className="flex flex-col gap-6">
      {content}
      {/* La asignatura se abre en un modal sobre la malla; mientras se edita o se desactiva, cede su lugar. */}
      {detailSubject && !form.mode && !deactivating && (
        <SubjectDetail
          subject={detailSubject}
          operation={operation}
          onClose={closeDetail}
          onEdit={() => openForm('edit', detailSubject)}
          onDeactivate={() => askDeactivate(detailSubject)}
        />
      )}
      <SubjectFormDialog
        key={form.key}
        catalogs={catalogs}
        careerId={careerId}
        mallaId={mallaId}
        mode={form.mode}
        subject={form.subject}
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
