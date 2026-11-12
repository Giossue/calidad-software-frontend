import { ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, GitBranchIcon, PencilIcon, PowerOffIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatSubjectName } from '@/lib/sanitize'
import type { Subject } from '@/lib/tutoring-api'
import type { useOperation } from './tutoring-hooks'

type Operation = ReturnType<typeof useOperation>

/**
 * Pantalla de una asignatura: se abre al pulsar su fila. Arriba lo esencial y sus
 * acciones (editar, desactivar); debajo, su secuencia en la malla y sus datos. La
 * asignatura no lleva paralelos: se eligen al crear cada tutoría del período.
 */
export function SubjectDetail({
  subject,
  operation,
  onBack,
  onEdit,
  onEditSequence,
  onDeactivate,
}: Readonly<{
  subject: Subject
  operation: Operation
  onBack: () => void
  onEdit: () => void
  onEditSequence: () => void
  onDeactivate: () => void
}>) {
  const cycleText = subject.cycle_number ? `${subject.cycle_number}° ciclo` : 'Sin ciclo'
  const description = [subject.code, cycleText].filter(Boolean).join(' · ')
  const previous = subject.previous_subjects ?? []
  const next = subject.next_subjects ?? []

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
        description={description}
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

      <Tabs defaultValue="curriculum">
        <TabsList aria-label="Secciones de la asignatura">
          <TabsTrigger value="curriculum">Malla</TabsTrigger>
          <TabsTrigger value="data">Datos</TabsTrigger>
        </TabsList>
        <TabsContent value="curriculum">
          <Card>
            <CardContent className="flex flex-col gap-5 pt-6">
              {/* La secuencia se lee de izquierda a derecha: de dónde viene, esta asignatura y en cuál continúa. */}
              <ol aria-label="Secuencia en la malla" className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <SequenceStep label="Viene de" names={previous.map((item) => formatSubjectName(item.name))} empty="Ninguna: inicia una secuencia." />
                <SequenceArrow />
                <SequenceStep label="Esta asignatura" names={[formatSubjectName(subject.name)]} current />
                <SequenceArrow />
                <SequenceStep label="Continúa en" names={next.map((item) => formatSubjectName(item.name))} empty="Ninguna: aquí termina la secuencia." />
              </ol>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {next.length > 0
                    ? `Al aprobarla, el estudiante pasa a la tutoría de ${next.map((item) => formatSubjectName(item.name)).join(' y ')} en el siguiente período.`
                    : 'Al aprobarla, el estudiante no pasa a otra tutoría de esta secuencia.'}
                </p>
                {subject.is_active && (
                  <Button type="button" variant="secondary" disabled={operation.pending} onClick={onEditSequence}>
                    <GitBranchIcon data-icon="inline-start" />
                    Editar secuencia
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="data">
          <dl className="grid max-w-3xl gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <Datum label="Código" value={subject.code || 'Sin código'} />
            <Datum label="Ciclo" value={cycleText} />
            <Datum label="Modalidad" value={subject.modality_name || 'Sin modalidad'} />
          </dl>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Datum({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="[overflow-wrap:anywhere]">{value}</dd>
    </div>
  )
}

/** Un tramo de la secuencia: su rótulo y las asignaturas (o qué significa que no haya). */
function SequenceStep({ label, names, empty, current = false }: Readonly<{ label: string; names: readonly string[]; empty?: string; current?: boolean }>) {
  return (
    <li className={`flex min-w-0 flex-1 flex-col gap-1 rounded-md border p-3 ${current ? 'border-primary bg-accent' : 'border-border'}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {names.length > 0 ? (
        names.map((name) => <span key={name} className="text-sm">{name}</span>)
      ) : (
        <span className="text-sm text-muted-foreground">{empty}</span>
      )}
    </li>
  )
}

function SequenceArrow() {
  return (
    <li aria-hidden="true" className="flex shrink-0 justify-center text-muted-foreground">
      <ArrowRightIcon className="hidden size-4 sm:block" />
      <ArrowDownIcon className="size-4 sm:hidden" />
    </li>
  )
}
