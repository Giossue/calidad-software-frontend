import { Checkbox } from '@/components/ui/checkbox'
import type { ClassGroup } from './joint-groups'

/** Aviso de clase conjunta con la opción de trabajar solo con el grupo propio. */
export function JointNotice({ groups, include, onIncludeChange, action }: Readonly<{
  groups: readonly ClassGroup[]
  include: boolean
  onIncludeChange: (include: boolean) => void
  /** Qué se hace con ambos grupos: «tomar asistencia», «calificar». */
  action: string
}>) {
  if (groups.length === 0) return null
  return (
    <div className="flex flex-col gap-2 rounded-md border border-notice-border bg-notice px-3 py-2 text-sm text-notice-foreground sm:flex-row sm:items-center sm:justify-between">
      <p>
        Clase conjunta con {groups.map((group) => group.label).join(', ')}: la misma asignatura a la misma hora. Puedes {action} a ambos grupos a la vez; cada grupo se guarda en su tutoría.
      </p>
      <label className="flex shrink-0 items-center gap-2 font-medium">
        <Checkbox checked={include} onCheckedChange={(checked) => onIncludeChange(checked === true)} aria-label="Incluir el grupo conjunto" />
        Incluir {groups.length === 1 ? 'el otro grupo' : 'los otros grupos'}
      </label>
    </div>
  )
}
