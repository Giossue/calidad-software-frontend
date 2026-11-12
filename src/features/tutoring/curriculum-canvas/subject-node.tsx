import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { Link2Icon, PencilIcon, PlusIcon, PowerOffIcon, UnlinkIcon } from 'lucide-react'

import { RowActionsMenu } from '@/components/ui/row-actions-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatSubjectName } from '@/lib/sanitize'
import { cn } from '@/lib/utils'
import type { SubjectNodeData } from './layout'

/**
 * Tarjeta de una asignatura: el código en la franja lateral y el nombre al centro, como en
 * sílabos. En la vista abre la asignatura; al editar, abre su formulario y muestra las
 * manijas para conectar previas (arriba llega la previa; abajo sale hacia la siguiente).
 */
export function CurriculumSubjectNode({ data }: NodeProps<Node<SubjectNodeData>>) {
  const { subject, editable, disabled } = data
  const name = formatSubjectName(subject.name)
  const connectable = editable && !disabled
  return (
    <>
      <ConnectHandle type="target" position={Position.Top} editable={editable} connectable={connectable} label="Conectar la previa de esta asignatura" />
      <article className="relative w-full overflow-hidden rounded-md bg-card text-card-foreground shadow-surface ring-1 ring-surface-ring" aria-label={`${subject.code ?? 'Sin código'}: ${name}`}>
        {editable && (
          <div className="nodrag nopan absolute top-1 right-1 z-10" onMouseDown={(event) => event.stopPropagation()}>
            <RowActionsMenu
              name={name}
              disabled={disabled}
              actions={[
                { label: 'Editar', icon: PencilIcon, onSelect: data.onEdit },
                { label: 'Agregar su previa…', icon: Link2Icon, onSelect: () => data.onRelate('requires') },
                { label: 'Es previa de otra asignatura…', icon: UnlinkIcon, onSelect: () => data.onRelate('required-by') },
                { label: 'Desactivar', icon: PowerOffIcon, onSelect: data.onDeactivate, tone: 'destructive' },
              ]}
            />
          </div>
        )}
        <button
          type="button"
          aria-label={editable ? `Editar ${name}` : `Abrir ${name}`}
          disabled={editable && disabled}
          onClick={editable ? data.onEdit : data.onOpen}
          className="nodrag flex h-24 w-full cursor-pointer text-left outline-hidden transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:cursor-not-allowed"
        >
          <span className="flex w-9 shrink-0 items-center justify-center border-r bg-primary px-1 py-2 text-primary-foreground">
            <span className="-rotate-90 whitespace-nowrap text-curriculum-code font-semibold">{subject.code ?? 'Sin código'}</span>
          </span>
          <span className={cn('flex min-w-0 flex-1 flex-col items-center justify-center gap-1.5 p-2 text-center', editable && 'pr-9')}>
            <span className="line-clamp-3 text-xs leading-snug font-semibold uppercase">{name}</span>
          </span>
        </button>
      </article>
      <ConnectHandle type="source" position={Position.Bottom} editable={editable} connectable={connectable} label="Conectar a la asignatura que tiene esta como previa" />
    </>
  )
}

function ConnectHandle({ type, position, editable, connectable, label }: Readonly<{ type: 'source' | 'target'; position: Position; editable: boolean; connectable: boolean; label: string }>) {
  if (!editable) return <Handle type={type} position={position} isConnectable={false} />
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Handle type={type} position={position} isConnectable={connectable} className="curriculum-handle" aria-label={label}>
          <PlusIcon className="pointer-events-none size-3 text-success-foreground" strokeWidth={3.5} aria-hidden="true" />
        </Handle>
      </TooltipTrigger>
      <TooltipContent>Conectar asignaturas</TooltipContent>
    </Tooltip>
  )
}
