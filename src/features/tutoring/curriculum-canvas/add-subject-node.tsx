import type { Node, NodeProps } from '@xyflow/react'

import { Button } from '@/components/ui/button'
import type { AddSubjectNodeData } from './layout'

/** Botón al final de cada carril (solo al editar) para agregar una asignatura a ese ciclo. */
export function CurriculumAddSubjectNode({ data }: NodeProps<Node<AddSubjectNodeData>>) {
  return (
    <Button
      type="button"
      variant="secondary"
      data-tour="curriculum-add"
      aria-label={`Agregar asignatura al ${data.label}`}
      className="nodrag nopan w-64 border-dashed"
      disabled={data.disabled}
      onClick={() => data.onAdd(data.cycle)}
    >
      Agregar asignatura
    </Button>
  )
}
