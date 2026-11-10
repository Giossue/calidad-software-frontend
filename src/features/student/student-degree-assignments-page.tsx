import { MailIcon, PhoneIcon } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { degreeCoordinationApi } from '@/lib/degree-coordination-api'
import { formatDate } from '@/lib/format'
import { studentApi, type StudentDegreeAssignments } from '@/lib/student-api'
import { StudentEmpty, StudentReadPage } from './student-shared'
import { DegreeAssignmentsSkeleton } from './student-skeletons'
import { Initials } from './student-ui'

type Row = { readonly id: number; readonly assignments: StudentDegreeAssignments }

function Person({ role, person }: Readonly<{ role: string; person: NonNullable<StudentDegreeAssignments['tutor']> }>) {
  return <li className="flex items-start gap-3 py-4 text-sm first:pt-0 last:pb-0">
    <Initials name={person.name} />
    <div className="flex min-w-0 flex-col gap-1">
      <span className="font-medium">{person.name} <span className="font-normal text-muted-foreground">· {role}</span></span>
      <a href={`mailto:${person.email}`} className="flex w-fit items-center gap-2 break-all text-muted-foreground hover:text-foreground hover:underline"><MailIcon className="size-4 shrink-0" aria-hidden="true" />{person.email}</a>
      {person.phone && <a href={`tel:${person.phone}`} className="flex w-fit items-center gap-2 text-muted-foreground hover:text-foreground hover:underline"><PhoneIcon className="size-4 shrink-0" aria-hidden="true" />{person.phone}</a>}
      {person.assigned_at && <span className="text-xs text-muted-foreground">Asignado el {formatDate(person.assigned_at)}</span>}
    </div>
  </li>
}

async function loadAssignments(): Promise<readonly Row[]> {
  const topics = await degreeCoordinationApi.studentTopics()
  const approved = topics.filter((topic) => topic.status === 'aprobado')
  return Promise.all(approved.map(async (topic) => ({ id: topic.id, assignments: await studentApi.degreeAssignments(topic.id) })))
}

export function StudentDegreeAssignmentsPage() {
  return <StudentReadPage title="Tutor y pares académicos" description="Consulta el docente tutor y los pares académicos asignados a tu tema de titulación aprobado." label="asignaciones" loader={loadAssignments} skeleton={<DegreeAssignmentsSkeleton />}
    empty={<StudentEmpty title="Aún no tienes un tema aprobado" description="El tutor y los pares académicos se asignan cuando la Coordinación de Titulación aprueba tu propuesta." />}>
    {(rows) => rows.map(({ id, assignments }) => <Card key={id} role="region" aria-label={assignments.topic.title}>
      <CardContent className="flex flex-col gap-5 pt-6">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="break-words text-xl font-semibold tracking-tight">{assignments.topic.title}</h3>
          <p className="text-sm text-muted-foreground">{[assignments.topic.academic_period?.name ?? 'Período sin registrar', assignments.topic.section ? `Paralelo ${assignments.topic.section.name}` : null, assignments.topic.approved_at ? `Aprobado el ${formatDate(assignments.topic.approved_at)}` : null].filter(Boolean).join(' · ')}</p>
        </div>
        {!assignments.tutor && assignments.peers.length === 0
          ? <Alert><AlertDescription>Coordinación aún no asigna un tutor ni pares académicos a este tema.</AlertDescription></Alert>
          : <ul className="flex flex-col divide-y border-t pt-4">
            {assignments.tutor ? <Person role="Tutor" person={assignments.tutor} /> : <li className="py-4 text-sm text-muted-foreground first:pt-0">Sin tutor asignado.</li>}
            {assignments.peers.map((peer) => <Person key={peer.assignment_id} role="Par académico" person={peer} />)}
          </ul>}
      </CardContent>
    </Card>)}
  </StudentReadPage>
}
