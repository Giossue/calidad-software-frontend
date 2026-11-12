import { MarkerType, Position, type Edge, type Node } from '@xyflow/react'

/**
 * Geometría de la malla visual. Es la misma de la malla del coordinador en sílabos
 * (`curriculumCanvasLayout.ts`): un carril por ciclo, las asignaturas en fila dentro
 * del carril y las previas como flechas que bajan de un ciclo al siguiente. Solo se
 * dibujan los datos que este sistema tiene: código, nombre, ciclo y previas.
 */

/** Asignatura tal como la dibuja el lienzo. */
export type CanvasSubject = {
  readonly id: string
  readonly code: string | null
  readonly name: string
  /** Número del ciclo; `null` si la asignatura no tiene ciclo. */
  readonly cycle: number | null
}

/** Previa: `source` hay que aprobarla antes de `target`. */
export type CanvasRequirement = {
  readonly id: string
  readonly source: string
  readonly target: string
}

/** Carril del lienzo: un ciclo de la carrera (o «Sin ciclo», al final). */
export type CanvasLane = {
  readonly key: string
  readonly cycle: number | null
  readonly label: string
  readonly degree: boolean
}


const ROMAN_NUMERALS = [
  ['X', 10],
  ['IX', 9],
  ['V', 5],
  ['IV', 4],
  ['I', 1],
] as const

export const toRoman = (value: number): string => {
  let remaining = value
  let roman = ''
  ROMAN_NUMERALS.forEach(([symbol, amount]) => {
    while (remaining >= amount) {
      roman += symbol
      remaining -= amount
    }
  })
  return roman || String(value)
}

// Las tarjetas de sílabos llevan horas y créditos (158 px); aquí solo código y nombre (h-24).
// El espacio entre carriles (80 px) es el mismo, porque ahí corren las flechas.
export const subjectHeight = 96
export const laneHeight = subjectHeight + 80
export const subjectWidth = 274
export const subjectGap = 34
export const CANVAS_ZOOM = { min: 0.2, max: 1 } as const
// La malla se ve en niveles fijos y se recorre con scroll normal: así nadie se pierde en el lienzo.
export const ZOOM_LEVELS = [0.5, 0.75, 1] as const
export type ZoomChoice = 'fit' | (typeof ZOOM_LEVELS)[number]
export const laneInset = 16
export const addSubjectHeight = 36
export const subjectOffset = Math.round((laneHeight - laneInset - subjectHeight) / 2)
export const addSubjectOffset = Math.round((laneHeight - laneInset - addSubjectHeight) / 2)
export const laneStart = 109
export const subjectStep = subjectWidth + subjectGap
export const navigationPadding = 48

// React Flow describe nodos y conexiones en inglés para lectores de pantalla; se reemplaza en español.
const spanishRole = (role: string) => ({ 'aria-roledescription': role, 'aria-describedby': undefined })

/** Asignaturas de un carril, en orden estable (código y nombre): este sistema no guarda posición. */
export function sortLaneSubjects(subjects: readonly CanvasSubject[]): CanvasSubject[] {
  return [...subjects].sort((left, right) => (left.code ?? '').localeCompare(right.code ?? '') || left.name.localeCompare(right.name))
}

export function laneWidthFor(lanes: readonly CanvasLane[], subjectsForLane: (lane: CanvasLane) => readonly CanvasSubject[], editable: boolean): number {
  const widest = lanes.reduce((width, lane) => Math.max(width, laneStart + subjectsForLane(lane).length * subjectStep + (editable ? subjectStep : 0)), 0)
  return Math.max(1120, widest + 200)
}

export const contentHeightFor = (laneCount: number) => Math.max(laneHeight - laneInset, laneCount * laneHeight - laneInset)

export type SubjectNodeData = {
  subject: CanvasSubject
  editable: boolean
  disabled: boolean
  onOpen: () => void
  onEdit: () => void
  onDeactivate: () => void
}

export type CycleNodeData = { lane: CanvasLane; subjectCount: number }
export type AddSubjectNodeData = { cycle: number; label: string; disabled: boolean; onAdd: (cycle: number) => void }

type NodeOptions = {
  lanes: readonly CanvasLane[]
  subjectsForLane: (lane: CanvasLane) => readonly CanvasSubject[]
  laneWidth: number
  editable: boolean
  disabled: boolean
  canAdd: (cycle: number) => boolean
  onOpen: (subjectId: string) => void
  onEdit: (subjectId: string) => void
  onDeactivate: (subjectId: string) => void
  onAdd: (cycle: number) => void
}

export function buildCurriculumNodes(options: NodeOptions): Node[] {
  const nodes: Node[] = []
  options.lanes.forEach((lane, laneIndex) => {
    const laneSubjects = options.subjectsForLane(lane)
    const laneY = laneIndex * laneHeight
    nodes.push({
      id: `cycle-${lane.key}`,
      type: 'cycle',
      domAttributes: spanishRole('ciclo'),
      position: { x: 0, y: laneY },
      data: { lane, subjectCount: laneSubjects.length } satisfies CycleNodeData,
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
      width: options.laneWidth,
      height: laneHeight - laneInset,
      style: { width: `${options.laneWidth}px`, height: `${laneHeight - laneInset}px` },
      zIndex: -1,
    })

    let x = laneStart
    laneSubjects.forEach((subject) => {
      nodes.push({
        id: subject.id,
        type: 'subject',
        domAttributes: spanishRole('asignatura'),
        position: { x, y: laneY + subjectOffset },
        data: {
          subject,
          editable: options.editable,
          disabled: options.disabled,
          onOpen: () => options.onOpen(subject.id),
          onEdit: () => options.onEdit(subject.id),
          onDeactivate: () => options.onDeactivate(subject.id),
        } satisfies SubjectNodeData,
        // Con medidas y manijas declaradas, las flechas se dibujan antes de medir el DOM.
        width: subjectWidth,
        height: subjectHeight,
        handles: [
          { type: 'target', position: Position.Top, x: subjectWidth / 2, y: 0, width: 1, height: 1 },
          { type: 'source', position: Position.Bottom, x: subjectWidth / 2, y: subjectHeight, width: 1, height: 1 },
        ],
        draggable: false,
        connectable: options.editable && !options.disabled,
        selectable: false,
        focusable: false,
        // Sin selección ni arrastre React Flow apaga los clics del nodo; la tarjeta los necesita.
        style: { width: `${subjectWidth}px`, pointerEvents: 'all' },
      })
      x += subjectStep
    })

    if (!options.editable || lane.cycle === null || !options.canAdd(lane.cycle)) return
    nodes.push({
      id: `add-subject-${lane.key}`,
      type: 'addSubject',
      domAttributes: spanishRole('acción'),
      position: { x, y: laneY + addSubjectOffset },
      data: { cycle: lane.cycle, label: lane.label, disabled: options.disabled, onAdd: options.onAdd } satisfies AddSubjectNodeData,
      width: 256,
      height: addSubjectHeight,
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
      style: { pointerEvents: 'all' },
    })
  })
  return nodes
}

const EDGE_SPACING = 18

type EdgeGeometry = { source: number; target: number; channelIndex: number; channelCount: number }

/**
 * Separa las flechas que salen o llegan a la misma asignatura y elige, entre dos carriles,
 * el canal horizontal de cada una para que se crucen lo menos posible (igual que sílabos).
 */
function edgeGeometry(requirements: readonly CanvasRequirement[], laneOf: (id: string) => number, columnOf: (id: string) => number): Map<string, EdgeGeometry> {
  const centerX = (subjectId: string) => laneStart + columnOf(subjectId) * subjectStep + subjectWidth / 2
  const result = new Map<string, EdgeGeometry>()
  const entry = (id: string): EdgeGeometry => {
    const current = result.get(id) ?? { source: 0, target: 0, channelIndex: 0, channelCount: 1 }
    result.set(id, current)
    return current
  }

  type End = { requirement: CanvasRequirement; end: 'source' | 'target'; towards: number }
  const groups = new Map<string, End[]>()
  const push = (key: string, end: End) => groups.set(key, [...(groups.get(key) ?? []), end])
  requirements.forEach((requirement) => {
    push(`${laneOf(requirement.target) - 1}:${columnOf(requirement.target)}`, { requirement, end: 'target', towards: centerX(requirement.source) })
    push(`${laneOf(requirement.source)}:${columnOf(requirement.source)}`, { requirement, end: 'source', towards: centerX(requirement.target) })
  })
  groups.forEach((ends) => {
    const slots: End[][] = []
    const seen = new Map<string, End[]>()
    ends.forEach((end) => {
      const straight = columnOf(end.requirement.source) === columnOf(end.requirement.target) && laneOf(end.requirement.target) - laneOf(end.requirement.source) === 1
      const shared = straight ? seen.get(end.requirement.id) : undefined
      if (shared) {
        shared.push(end)
        return
      }
      const slot = [end]
      slots.push(slot)
      if (straight) seen.set(end.requirement.id, slot)
    })
    const own = (slot: End[]) => centerX(slot[0].end === 'source' ? slot[0].requirement.source : slot[0].requirement.target)
    const sorted = slots.sort((left, right) => {
      const l = left.length > 1 ? 0 : left[0].towards - own(left)
      const r = right.length > 1 ? 0 : right[0].towards - own(right)
      return l - r
    })
    sorted.forEach((slot, index) => {
      const offset = (index - (sorted.length - 1) / 2) * EDGE_SPACING
      slot.forEach((end) => {
        entry(end.requirement.id)[end.end] = offset
      })
    })
  })

  const byGap = new Map<number, CanvasRequirement[]>()
  requirements.forEach((requirement) => {
    const gap = laneOf(requirement.target) - 1
    byGap.set(gap, [...(byGap.get(gap) ?? []), requirement])
  })
  byGap.forEach((group) => {
    const xs = group.map((requirement) => {
      const geometry = entry(requirement.id)
      return { id: requirement.id, sx: centerX(requirement.source) + geometry.source, tx: centerX(requirement.target) + geometry.target }
    })
    const between = (x: number, a: number, b: number) => x > Math.min(a, b) && x < Math.max(a, b)
    const crossings = (order: number[]) => {
      let total = 0
      for (let upper = 0; upper < order.length; upper++) {
        for (let lower = upper + 1; lower < order.length; lower++) {
          const e = xs[order[upper]]
          const f = xs[order[lower]]
          if (between(f.sx, e.sx, e.tx)) total++
          if (between(e.tx, f.sx, f.tx)) total++
        }
      }
      return total
    }
    const indexes = xs.map((_, index) => index)
    let best = [...indexes].sort((left, right) => xs[left].tx - xs[right].tx || xs[left].sx - xs[right].sx)
    if (indexes.length <= 8) {
      let bestScore = crossings(best)
      const permute = (prefix: number[], rest: number[]) => {
        if (bestScore === 0) return
        if (rest.length === 0) {
          const score = crossings(prefix)
          if (score < bestScore) {
            bestScore = score
            best = prefix
          }
          return
        }
        rest.forEach((item, index) => permute([...prefix, item], [...rest.slice(0, index), ...rest.slice(index + 1)]))
      }
      permute([], indexes)
    }
    best.forEach((edgeIndex, channel) => {
      const geometry = entry(xs[edgeIndex].id)
      geometry.channelIndex = channel
      geometry.channelCount = best.length
    })
  })
  return result
}

export type RequirementEdgeData = { label: string; sourceOffset: number; targetOffset: number; channelIndex: number; channelCount: number }

export function buildRequirementEdges(requirements: readonly CanvasRequirement[], lanes: readonly CanvasLane[], subjectsForLane: (lane: CanvasLane) => readonly CanvasSubject[], nameOf: (id: string) => string): Edge[] {
  const laneIndex = new Map<string, number>()
  const columnIndex = new Map<string, number>()
  lanes.forEach((lane, index) => subjectsForLane(lane).forEach((subject, column) => {
    laneIndex.set(subject.id, index)
    columnIndex.set(subject.id, column)
  }))
  const drawn = requirements.filter((requirement) => laneIndex.has(requirement.source) && laneIndex.has(requirement.target))
  const geometry = edgeGeometry(drawn, (id) => laneIndex.get(id) ?? 0, (id) => columnIndex.get(id) ?? 0)
  const color = 'var(--curriculum-prerequisite)'
  return drawn.map((requirement) => {
    const offset = geometry.get(requirement.id)
    return {
      id: requirement.id,
      source: requirement.source,
      target: requirement.target,
      type: 'requirement',
      ariaLabel: `Previa: ${nameOf(requirement.source)} → ${nameOf(requirement.target)}`,
      domAttributes: spanishRole('conexión'),
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
      style: { stroke: color, strokeWidth: 2 },
      data: {
        label: 'Previa',
        sourceOffset: offset?.source ?? 0,
        targetOffset: offset?.target ?? 0,
        channelIndex: offset?.channelIndex ?? 0,
        channelCount: offset?.channelCount ?? 1,
      } satisfies RequirementEdgeData,
    }
  })
}
