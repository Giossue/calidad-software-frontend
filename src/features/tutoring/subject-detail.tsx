import { useId, type ReactNode } from 'react'
import { ArrowLeftIcon, PencilIcon, PowerOffIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatSubjectName } from '@/lib/sanitize'
import type { Subject } from '@/lib/tutoring-api'
import type { useOperation } from './tutoring-hooks'

type Operation = ReturnType<typeof useOperation>

/**
 * Pantalla de una asignatura: se abre al pulsar su fila. Arriba lo esencial y sus
 * acciones (editar, desactivar); debajo, sus datos. Las previas se ven y se editan en
 * el lienzo de la malla («Editar malla»). La asignatura no lleva paralelos: se eligen
 * al crear cada tutoría del período.
 */
export function SubjectDetail({
  subject,
  operation,
  onBack,
  onEdit,
  onDeactivate,
}: Readonly<{
  subject: Subject
  operation: Operation
  onBack: () => void
  onEdit: () => void
  onDeactivate: () => void
}>) {
  const cycleText = subject.cycle_number ? `${subject.cycle_number}° ciclo` : 'Sin ciclo'

  return (
    <div className="flex flex-col gap-6" data-tour-view="detail">
      <div>
        <Button type="button" variant="tertiary" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" />
          Volver a la malla
        </Button>
      </div>

      <AdminSectionHeader
        title={formatSubjectName(subject.name)}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge active={subject.is_active} activeLabel="Activa" inactiveLabel="Inactiva" />
            {subject.is_active && (
              <>
                <Button type="button" variant="tertiary" size="icon" aria-label="Editar asignatura" disabled={operation.pending} onClick={onEdit}>
                  <PencilIcon />
                </Button>
                <Button type="button" variant="tertiary" size="icon" tone="destructive" aria-label="Desactivar asignatura" disabled={operation.pending} onClick={onDeactivate}>
                  <PowerOffIcon />
                </Button>
              </>
            )}
          </div>
        }
      />

      <dl className="grid max-w-3xl gap-x-6 gap-y-4 text-sm sm:grid-cols-2" data-tour="subject-data">
        <Datum label="Código">{subject.code || 'Sin código'}</Datum>
        <Datum label="Ciclo">{cycleText}</Datum>
        <Datum label="Modalidad">{subject.modality_name || '—'}</Datum>
        <Datum label="Previas"><SubjectNames subjects={subject.previous_subjects} /></Datum>
        <Datum label="Continúa en"><SubjectNames subjects={subject.next_subjects} /></Datum>
      </dl>
    </div>
  )
}

function Datum({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt id={id} className="text-muted-foreground">{label}</dt>
      <dd aria-labelledby={id} className="[overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

/** Asignaturas relacionadas como texto simple, o «Ninguna». */
function SubjectNames({ subjects }: Readonly<{ subjects?: Subject['previous_subjects'] }>) {
  if (!subjects || subjects.length === 0) return 'Ninguna'
  return (
    <ul className="flex flex-col gap-0.5">
      {subjects.map((item) => <li key={item.id}>{formatSubjectName(item.name)}</li>)}
    </ul>
  )
}
