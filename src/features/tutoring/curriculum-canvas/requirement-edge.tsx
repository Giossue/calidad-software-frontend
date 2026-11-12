import { useState, type MouseEvent } from 'react'
import { BaseEdge, EdgeLabelRenderer, useReactFlow, type Edge, type EdgeProps } from '@xyflow/react'

import { laneHeight, subjectHeight, type RequirementEdgeData } from './layout'

const LEVEL_GAP = laneHeight - subjectHeight
const CHANNEL_MARGIN = 12

/**
 * Flecha de una previa: baja de la asignatura, corre por su canal entre los dos ciclos y
 * entra desde arriba a la siguiente (la misma forma que en sílabos). Al pasar el cursor
 * dice qué relación es.
 */
export function CurriculumRequirementEdge({ id, sourceX, sourceY, targetX, targetY, style, markerEnd, data }: EdgeProps<Edge<RequirementEdgeData>>) {
  const { screenToFlowPosition } = useReactFlow()
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null)
  const geometry = data ?? { label: 'Previa', sourceOffset: 0, targetOffset: 0, channelIndex: 0, channelCount: 1 }
  const fromX = sourceX + geometry.sourceOffset
  const toX = targetX + geometry.targetOffset

  let path: string
  let middle: { x: number; y: number }
  if (Math.abs(fromX - toX) < 0.5) {
    path = `M ${fromX} ${sourceY} V ${targetY}`
    middle = { x: fromX, y: (sourceY + targetY) / 2 }
  } else {
    const usable = LEVEL_GAP - CHANNEL_MARGIN * 2
    const step = usable / (geometry.channelCount + 1)
    const channelY = targetY - LEVEL_GAP + CHANNEL_MARGIN + step * (geometry.channelIndex + 1)
    path = `M ${fromX} ${sourceY} V ${channelY} H ${toX} V ${targetY}`
    middle = { x: (fromX + toX) / 2, y: channelY }
  }

  const onHoverMove = (event: MouseEvent) => setHoverPoint(screenToFlowPosition({ x: event.clientX, y: event.clientY }))

  return (
    <>
      <g
        className="cursor-pointer focus:outline-hidden"
        onMouseEnter={onHoverMove}
        onMouseMove={onHoverMove}
        onMouseLeave={() => setHoverPoint(null)}
        onFocus={() => setHoverPoint(middle)}
        onBlur={() => setHoverPoint(null)}
      >
        <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} interactionWidth={24} />
      </g>
      <EdgeLabelRenderer>
        {hoverPoint && (
          <div
            className="pointer-events-none absolute z-10 rounded-md bg-card px-2 py-1 text-curriculum-edge text-card-foreground shadow-menu ring-1 ring-surface-ring"
            style={{ transform: `translate(-50%, -150%) translate(${hoverPoint.x}px, ${hoverPoint.y}px)` }}
          >
            {geometry.label}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}
