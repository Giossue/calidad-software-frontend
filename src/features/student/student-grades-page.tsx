import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { InfoTip } from '@/components/ui/info-tip'
import { Skeleton } from '@/components/ui/skeleton'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { ErrorNotice } from '@/components/ui/error-notice'
import { formatDate } from '@/lib/format'
import { studentApi, type StudentGradeEntry } from '@/lib/student-api'
import { StudentEmpty } from './student-shared'

function GradeTile({ label, entry, maximum, children }: Readonly<{ label: string; entry: StudentGradeEntry | null; maximum: number; children?: ReactNode }>) {
  return <Card role="region" aria-label={label} className="flex flex-col gap-2 bg-muted/30 p-5">
    <div className="flex items-center gap-1.5">
      <h4 className="text-sm text-muted-foreground">{label}</h4>
      {entry?.registered_at && <InfoTip label={`Fecha de ${label}`}>Registrada el {formatDate(entry.registered_at)}</InfoTip>}
    </div>
    <p className="text-4xl font-semibold tabular-nums">{entry ? entry.formatted_value : '—'}<span className="ml-1 text-sm font-normal text-muted-foreground">/ {maximum}</span></p>
    {!entry && <p className="text-xs text-muted-foreground">Aún sin registrar</p>}
    {children}
  </Card>
}

// Notas de una tutoría: diagnóstico (con su grupo de conocimiento), parcial 1 y parcial 2.
export function GradesPanel({ tutoringId }: Readonly<{ tutoringId: number }>) {
  const resource = useDegreeResource(studentApi.grades)
  const item = resource.data?.find((grades) => grades.tutoring?.id === tutoringId)
  const metric = item?.knowledge_metric

  return <div className="flex flex-col gap-5">
    <ErrorNotice message={resource.error} retry={resource.reload} />
    {resource.loading ? <Skeleton role="status" aria-label="Cargando calificaciones" className="h-48 w-full" /> : !resource.error && (!item ? <StudentEmpty title="Aún no tienes calificaciones" description="Cuando tu docente registre notas de esta tutoría, las verás aquí." /> : (
      <div className="grid gap-4 sm:grid-cols-3">
        <GradeTile label="Diagnóstico" entry={item.grades.diagnostic} maximum={item.scale_settings.maximum}>
          {metric && <div className="flex items-center gap-1.5">
            <Badge variant="secondary">Grupo {metric.group}</Badge>
            <InfoTip label="Qué es el grupo de conocimiento">Tu nota diagnóstica te ubica en el grupo {metric.group} ({metric.min_score} – {metric.max_score} sobre {item.scale_settings.maximum}).</InfoTip>
          </div>}
        </GradeTile>
        <GradeTile label="Parcial 1" entry={item.grades.partial} maximum={item.scale_settings.maximum} />
        <GradeTile label="Parcial 2" entry={item.grades.second_partial} maximum={item.scale_settings.maximum} />
      </div>
    ))}
  </div>
}
