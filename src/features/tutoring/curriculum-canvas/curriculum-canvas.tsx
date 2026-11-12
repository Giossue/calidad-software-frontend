import { useEffect, useMemo, useRef, useState } from 'react'
import { ConnectionMode, ReactFlow, ReactFlowProvider, type Connection, type Edge, type EdgeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { ConfirmModal } from '@/components/ui/confirm-modal'
import { toast } from '@/lib/toast'
import { formatSubjectName } from '@/lib/sanitize'
import { tutoringApi, type Subject } from '@/lib/tutoring-api'
import { cn } from '@/lib/utils'
import type { useOperation } from '../tutoring-hooks'
import { CurriculumAddSubjectNode } from './add-subject-node'
import { CurriculumCycleNode } from './cycle-node'
import {
  buildCurriculumNodes,
  buildRequirementEdges,
  CANVAS_ZOOM,
  contentHeightFor,
  laneWidthFor,
  navigationPadding,
  sortLaneSubjects,
  ZOOM_LEVELS,
  type CanvasLane,
  type CanvasRequirement,
  type CanvasSubject,
  type RelationMode,
  type ZoomChoice,
} from './layout'
import { CurriculumLegendButton, CurriculumNavigationControls } from './navigation-controls'
import { CurriculumRelationPicker } from './relation-picker'
import { CurriculumRequirementEdge } from './requirement-edge'
import { prerequisiteError, requirementsOf, type CycleOf } from './rules'
import { CurriculumSubjectNode } from './subject-node'

const nodeTypes = { cycle: CurriculumCycleNode, subject: CurriculumSubjectNode, addSubject: CurriculumAddSubjectNode }
const edgeTypes = { requirement: CurriculumRequirementEdge }

const ZOOM_STORAGE_KEY = 'curriculum-zoom'
function storedZoom(): ZoomChoice {
  const saved = localStorage.getItem(ZOOM_STORAGE_KEY)
  return ZOOM_LEVELS.find((value) => String(value) === saved) ?? 'fit'
}

type Operation = ReturnType<typeof useOperation>

/**
 * Malla visual de la carrera (React Flow), copiada de la malla del coordinador en sílabos:
 * un carril por ciclo, las asignaturas con su código y nombre, las previas como flechas, la
 * leyenda y los controles de zoom. Al editar, cada carril tiene «Agregar asignatura», las
 * tarjetas se conectan arrastrando desde sus manijas y una flecha se quita al pulsarla.
 */
export function CurriculumCanvas(props: Readonly<CurriculumCanvasProps>) {
  return (
    <ReactFlowProvider>
      <CurriculumCanvasBoard {...props} />
    </ReactFlowProvider>
  )
}

type CurriculumCanvasProps = {
  /** Asignaturas que se dibujan (ya filtradas). */
  subjects: readonly Subject[]
  /** Todas las asignaturas de la carrera: para validar la secuencia completa. */
  careerSubjects: readonly Subject[]
  lanes: readonly CanvasLane[]
  cycleOf: CycleOf
  editing: boolean
  fullScreen?: boolean
  operation: Operation
  /** El ciclo admite asignaturas nuevas (tiene un ciclo activo en el catálogo). */
  canAdd: (cycle: number) => boolean
  onOpen: (subject: Subject) => void
  onEdit: (subject: Subject) => void
  onAdd: (cycle: number) => void
  onDeactivate: (subject: Subject) => void
  /** Cambió la secuencia: `updated` es la asignatura guardada. */
  onChanged: (updated: Subject | null) => Promise<void> | void
}

function CurriculumCanvasBoard({ subjects, careerSubjects, lanes, cycleOf, editing, fullScreen = false, operation, canAdd, onOpen, onEdit, onAdd, onDeactivate, onChanged }: Readonly<CurriculumCanvasProps>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canvasWidth, setCanvasWidth] = useState(0)
  const [zoomChoice, setZoomChoice] = useState<ZoomChoice>(storedZoom)
  const [picker, setPicker] = useState<{ subjectId: string; mode: RelationMode } | null>(null)
  const [removing, setRemoving] = useState<CanvasRequirement | null>(null)
  const disabled = operation.pending

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (typeof width === 'number') setCanvasWidth(width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const byId = useMemo(() => new Map(careerSubjects.map((subject) => [String(subject.id), subject])), [careerSubjects])
  const drawn = useMemo<CanvasSubject[]>(() => subjects.map((subject) => ({ id: String(subject.id), code: subject.code, name: subject.name, cycle: cycleOf(subject) })), [subjects, cycleOf])
  const byLane = useMemo(() => {
    const map = new Map<string, CanvasSubject[]>()
    lanes.forEach((lane) => map.set(lane.key, sortLaneSubjects(drawn.filter((subject) => subject.cycle === lane.cycle))))
    return map
  }, [lanes, drawn])
  const subjectsForLane = (lane: CanvasLane) => byLane.get(lane.key) ?? []
  const requirements = useMemo(() => requirementsOf(subjects), [subjects])
  const nameOf = (id: string) => formatSubjectName(byId.get(id)?.name ?? 'asignatura')

  const laneWidth = laneWidthFor(lanes, subjectsForLane, editing)
  const boardWidth = laneWidth + navigationPadding * 2
  const boardHeight = contentHeightFor(lanes.length) + navigationPadding * 2
  // «Ajustar» llena el ancho: la malla se lee bajando, como un documento.
  const zoom = zoomChoice !== 'fit' ? zoomChoice : canvasWidth === 0 ? 1 : Math.min(CANVAS_ZOOM.max, Math.max(CANVAS_ZOOM.min, canvasWidth / boardWidth))

  function chooseZoom(choice: ZoomChoice) {
    setZoomChoice(choice)
    localStorage.setItem(ZOOM_STORAGE_KEY, String(choice))
  }

  const subjectOf = (id: string) => byId.get(id)
  const nodes = buildCurriculumNodes({
    lanes,
    subjectsForLane,
    laneWidth,
    editable: editing,
    disabled,
    canAdd,
    onOpen: (id) => { const subject = subjectOf(id); if (subject) onOpen(subject) },
    onEdit: (id) => { const subject = subjectOf(id); if (subject) onEdit(subject) },
    onRelate: (id, mode) => { operation.clearError(); setPicker({ subjectId: id, mode }) },
    onDeactivate: (id) => { const subject = subjectOf(id); if (subject) onDeactivate(subject) },
    onAdd,
  })
  const edges: Edge[] = buildRequirementEdges(requirements, lanes, subjectsForLane, nameOf)

  /** Guarda la previa con la misma petición que el formulario de la secuencia. */
  function connect(sourceId: string, targetId: string, afterSave?: () => void) {
    const source = byId.get(sourceId)
    const target = byId.get(targetId)
    if (!source || !target) return
    const reason = prerequisiteError(source, target, careerSubjects, cycleOf)
    if (reason) {
      toast.error('No se puede conectar', { description: reason })
      return
    }
    let updated: Subject | null = null
    void operation.run(
      async () => {
        updated = await tutoringApi.updateSubject(source.id, {
          code: source.code,
          name: source.name,
          next_subject_ids: [...(source.next_subjects ?? []).map((next) => next.id), target.id],
        })
      },
      'Previa agregada',
      async () => {
        afterSave?.()
        await onChanged(updated)
      },
    )
  }

  const onConnect = (connection: Connection) => {
    if (!editing || disabled) return
    connect(connection.source, connection.target)
  }

  const onEdgeClick: EdgeMouseHandler = (_, edge) => {
    if (!editing || disabled) return
    operation.clearError()
    setRemoving(requirements.find((requirement) => requirement.id === edge.id) ?? null)
  }

  const pickerSubject = picker ? drawn.find((subject) => subject.id === picker.subjectId) ?? null : null
  const legendRows = [
    { id: 'subjects', label: 'N° asignaturas', value: String(drawn.length) },
    { id: 'requirements', label: 'N° previas', value: String(edges.length) },
  ]

  return (
    <div
      className={cn('curriculum-canvas relative min-h-96 overflow-hidden rounded-md bg-background ring-1 ring-surface-ring', fullScreen ? 'min-h-0 flex-1' : 'h-(--curriculum-canvas-height)')}
      role="region"
      aria-label={editing ? 'Editor interactivo de la malla' : 'Vista de la malla'}
      aria-busy={disabled}
      data-tour="curriculum-canvas"
    >
      <CurriculumNavigationControls choice={zoomChoice} zoom={zoom} onChoose={chooseZoom}>
        <CurriculumLegendButton rows={legendRows} />
      </CurriculumNavigationControls>
      {/* La malla empieza bajo los controles de zoom, que así no la tapan. */}
      <div ref={scrollRef} data-curriculum-scroll className="absolute inset-x-0 top-14 bottom-0 overflow-auto overscroll-contain">
        <div data-curriculum-board className="relative mx-auto" style={{ width: `${boardWidth * zoom}px`, height: `${boardHeight * zoom}px` }}>
          {/* Sin teclado de React Flow: lo anuncia en inglés y aquí no se mueve nada con flechas. */}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            viewport={{ x: navigationPadding * zoom, y: navigationPadding * zoom, zoom }}
            onViewportChange={() => undefined}
            minZoom={CANVAS_ZOOM.min}
            maxZoom={CANVAS_ZOOM.max}
            panOnDrag={false}
            panOnScroll={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            preventScrolling={false}
            autoPanOnConnect={false}
            connectionMode={ConnectionMode.Loose}
            nodesDraggable={false}
            nodesConnectable={editing && !disabled}
            elementsSelectable={false}
            edgesFocusable={editing}
            disableKeyboardA11y
            proOptions={{ hideAttribution: true }}
            onConnect={onConnect}
            onEdgeClick={onEdgeClick}
          />
        </div>
      </div>

      {picker && pickerSubject && (
        <CurriculumRelationPicker
          subject={pickerSubject}
          mode={picker.mode}
          subjects={drawn}
          operation={operation}
          onClose={() => { if (!operation.pending) setPicker(null) }}
          onPick={({ source, target }) => connect(source, target, () => setPicker(null))}
        />
      )}
      <ConfirmModal
        open={removing !== null}
        title="¿Quitar previa?"
        description={removing ? `«${nameOf(removing.source)}» dejará de ser previa de «${nameOf(removing.target)}». Las asignaturas no se modifican.` : ''}
        confirmLabel="Quitar previa"
        pending={operation.pending}
        onClose={() => { if (!operation.pending) setRemoving(null) }}
        onConfirm={() => {
          const requirement = removing
          const source = requirement ? byId.get(requirement.source) : undefined
          if (!requirement || !source) return
          let updated: Subject | null = null
          void operation.run(
            async () => {
              updated = await tutoringApi.updateSubject(source.id, {
                code: source.code,
                name: source.name,
                next_subject_ids: (source.next_subjects ?? []).map((next) => next.id).filter((id) => String(id) !== requirement.target),
              })
            },
            'Previa quitada',
            async () => {
              setRemoving(null)
              await onChanged(updated)
            },
          )
        }}
      />
    </div>
  )
}
