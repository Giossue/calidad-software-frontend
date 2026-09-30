import { CalendarDaysIcon, MailIcon, UserRoundIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDate } from '@/lib/format'
import { studentApi, type StudentTutoring } from '@/lib/student-api'
import { DAY_LABELS } from '@/lib/tutoring-api'
import { StudentEmpty, StudentReadPage } from './student-shared'

function TutoringCard({ enrollment }: Readonly<{ enrollment: StudentTutoring }>) {
  const subject = enrollment.subject
  const schedules = (subject?.schedules ?? []).filter((item) => item.is_active)
  const teacher = subject?.teacher
  return <Card>
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CardTitle className="min-w-0 break-words">{subject?.name ?? 'Tutoría no disponible'}</CardTitle>
        <StatusBadge active={enrollment.is_active && Boolean(subject?.is_active)} activeLabel="En curso" inactiveLabel="Finalizada" />
      </div>
      <CardDescription>{[subject?.academic_period?.name, subject?.cycle?.name, subject?.section ? `Paralelo ${subject.section.name}` : null, subject?.modality?.name].filter(Boolean).join(' · ')}</CardDescription>
    </CardHeader>
    <CardContent className="grid gap-5 md:grid-cols-2">
      <div className="flex flex-col gap-2 text-sm">
        <h3 className="flex items-center gap-2 font-semibold"><UserRoundIcon className="size-4 text-muted-foreground" aria-hidden="true" />Docente</h3>
        {teacher ? <><p className="font-medium">{teacher.name}</p><p className="flex items-center gap-2 break-all text-muted-foreground"><MailIcon className="size-4 shrink-0" aria-hidden="true" />{teacher.email}</p>{teacher.phone && <p className="text-muted-foreground">{teacher.phone}</p>}</> : <p className="text-muted-foreground">Sin docente asignado.</p>}
        {enrollment.enrolled_at && <p className="text-xs text-muted-foreground">Inscrito el {formatDate(enrollment.enrolled_at)}</p>}
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <h3 className="flex items-center gap-2 font-semibold"><CalendarDaysIcon className="size-4 text-muted-foreground" aria-hidden="true" />Horarios</h3>
        {schedules.length === 0 ? <p className="text-muted-foreground">Aún no hay horarios registrados.</p> : <ul className="flex flex-wrap gap-2">
          {schedules.map((item) => <li key={item.id}><Badge variant="secondary">{DAY_LABELS[item.day_of_week] ?? item.day_of_week} · {item.start_time.slice(0, 5)} – {item.end_time.slice(0, 5)}</Badge></li>)}
        </ul>}
      </div>
    </CardContent>
  </Card>
}

export function StudentTutoringsPage() {
  return <StudentReadPage title="Mis tutorías" description="Consulta las asignaturas en las que estás inscrito, su docente y sus horarios." label="tutorías" loader={studentApi.tutorings}
    empty={<StudentEmpty title="Aún no estás inscrito en ninguna tutoría" description="Tu docente te inscribirá en la tutoría de tu paralelo y aparecerá aquí." />}>
    {(rows) => rows.map((enrollment) => <TutoringCard key={enrollment.id} enrollment={enrollment} />)}
  </StudentReadPage>
}
