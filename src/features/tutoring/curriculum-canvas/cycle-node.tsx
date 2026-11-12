import type { NodeProps, Node } from '@xyflow/react'

import { toRoman, type CycleNodeData } from './layout'

/** Carril de un ciclo: a la izquierda el ciclo y a la derecha cuántas asignaturas tiene. */
export function CurriculumCycleNode({ data }: NodeProps<Node<CycleNodeData>>) {
  const { lane, subjectCount } = data
  return (
    <section className="size-full cursor-default overflow-hidden rounded-md bg-(--curriculum-lane) ring-1 ring-surface-ring" aria-label={lane.label}>
      <div className="flex h-full">
        <header className="flex w-20 shrink-0 flex-col items-center justify-center gap-1 border-r bg-(--curriculum-cycle-chrome) p-3 text-center">
          <span className="text-xs text-muted-foreground uppercase">{lane.cycle === null ? 'Sin' : 'Ciclo'}</span>
          <strong className="text-lg">{lane.cycle === null ? 'ciclo' : toRoman(lane.cycle)}</strong>
          {lane.degree && <span className="text-curriculum-code text-muted-foreground uppercase">Titulación</span>}
        </header>
        <div className="flex-1" />
        <div className="flex w-20 shrink-0 flex-col items-center justify-center gap-1 border-l bg-(--curriculum-cycle-chrome) p-3 text-center">
          <span className="text-xs text-muted-foreground">Asignaturas</span>
          <strong className="text-sm">{subjectCount}</strong>
        </div>
      </div>
    </section>
  )
}
