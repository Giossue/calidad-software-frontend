import { MailIcon, PhoneIcon } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/format'
import { degreeCoordinationApi } from '@/lib/degree-coordination-api'
import { studentApi, type StudentDegreeAssignments } from '@/lib/student-api'
import { StudentEmpty, StudentReadPage } from './student-shared'

type Row = { readonly id: number; readonly assignments: StudentDegreeAssignments }

function Person({ role, person }: Readonly<{ role: string; person: NonNullable<StudentDegreeAssignments['tutor']> }>) {
  return <li className="flex flex-col gap-1 rounded-lg border p-4 text-sm">
    <Badge variant="secondary" className="w-fit">{role}</Badge>
    <span className="font-medium">{person.name}</span>
    <span className="flex items-center gap-2 break-all text-muted-foreground"><MailIcon className="size-4 shrink-0" aria-hidden="true" />{person.email}</span>
    {person.phone && <span className="flex items-center gap-2 text-muted-foreground"><PhoneIcon className="size-4 shrink-0" aria-hidden="true" />{person.phone}</span>}
    {person.assigned_at && <span className="text-xs text-muted-foreground">Asignado el {formatDate(person.assigned_at)}</span>}
  </li>
}

async function loadAssignments(): Promise<readonly Row[]> {
  const topics = await degreeCoordinationApi.studentTopics()
  const approved = topics.filter((topic) => topic.status === 'aprobado')
  return Promise.all(approved.map(async (topic) => ({ id: topic.id, assignments: await studentApi.degreeAssignments(topic.id) })))
}

export function StudentDegreeAssignmentsPage() {
  return <StudentReadPage title="Tutor y pares académicos" description="Consulta el docente tutor y los pares académicos asignados a tu tema de titulación aprobado." label="asignaciones" loader={loadAssignments}
    empty={<StudentEmpty title="Aún no tienes un tema aprobado" description="El tutor y los pares académicos se asignan cuando la Coordinación de Titulación aprueba tu propuesta." />}>
    {(rows) => rows.map(({ id, assignments }) => <Card key={id}>
      <CardHeader><CardTitle className="break-words">{assignments.topic.title}</CardTitle><CardDescription>{assignments.topic.academic_period?.name ?? 'Período sin registrar'}{assignments.topic.section ? ` · Paralelo ${assignments.topic.section.name}` : ''}{assignments.topic.approved_at ? ` · Aprobado el ${formatDate(assignments.topic.approved_at)}` : ''}</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!assignments.tutor && assignments.peers.length === 0 && <Alert><AlertDescription>Coordinación aún no asigna un tutor ni pares académicos a este tema.</AlertDescription></Alert>}
        <ul className="grid gap-3 md:grid-cols-2">
          {assignments.tutor ? <Person role="Tutor" person={assignments.tutor} /> : <li className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Sin tutor asignado.</li>}
          {assignments.peers.map((peer) => <Person key={peer.assignment_id} role="Par académico" person={peer} />)}
        </ul>
      </CardContent>
    </Card>)}
  </StudentReadPage>
}
