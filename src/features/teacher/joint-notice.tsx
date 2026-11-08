import { UsersIcon } from 'lucide-react'

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
    <div className="flex flex-col gap-2 rounded-lg border border-sky-300/60 bg-sky-500/10 px-3 py-2 text-sm text-sky-900 sm:flex-row sm:items-center sm:justify-between dark:border-sky-800 dark:text-sky-100">
      <p className="flex items-start gap-2">
        <UsersIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          Clase conjunta con {groups.map((group) => group.label).join(', ')}: la misma asignatura a la misma hora. Puedes {action} a ambos grupos a la vez; cada grupo se guarda en su tutoría.
        </span>
      </p>
      <label className="flex shrink-0 items-center gap-2 font-medium">
        <Checkbox checked={include} onCheckedChange={(checked) => onIncludeChange(checked === true)} aria-label="Incluir el grupo conjunto" />
        Incluir {groups.length === 1 ? 'el otro grupo' : 'los otros grupos'}
      </label>
    </div>
  )
}
