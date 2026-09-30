import { CalendarDaysIcon, MailIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDate } from '@/lib/format'
import { studentApi, type StudentTutoring } from '@/lib/student-api'
import { DAY_LABELS } from '@/lib/tutoring-api'
import { StudentEmpty, StudentReadPage } from './student-shared'
import { IconTile, TutoringInfoChips } from './student-ui'

function TutoringCard({ enrollment }: Readonly<{ enrollment: StudentTutoring }>) {
  const subject = enrollment.subject
  const schedules = (subject?.schedules ?? []).filter((item) => item.is_active)
  const teacher = subject?.teacher
  return <Card>
    <CardContent className="flex flex-col gap-5 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <IconTile className="size-14" />
          <div className="flex min-w-0 flex-col gap-1"><h3 className="break-words text-lg font-semibold tracking-tight">{subject?.name ?? 'Tutoría no disponible'}</h3><p className="text-sm text-muted-foreground">{[subject?.academic_period?.name, subject?.modality?.name].filter(Boolean).join(' · ') || 'Período sin registrar'}</p></div>
        </div>
        <StatusBadge active={enrollment.is_active && Boolean(subject?.is_active)} activeLabel="En curso" inactiveLabel="Finalizada" />
      </div>
      <TutoringInfoChips source={subject} />
      <div className="grid gap-5 border-t pt-5 text-sm md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h4 className="font-semibold">Contacto del docente</h4>
          {teacher ? <><p className="flex items-center gap-2 break-all text-muted-foreground"><MailIcon className="size-4 shrink-0" aria-hidden="true" />{teacher.email}</p>{teacher.phone && <p className="text-muted-foreground">{teacher.phone}</p>}</> : <p className="text-muted-foreground">Sin docente asignado.</p>}
          {enrollment.enrolled_at && <p className="text-xs text-muted-foreground">Inscrito el {formatDate(enrollment.enrolled_at)}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <h4 className="flex items-center gap-2 font-semibold"><CalendarDaysIcon className="size-4 text-muted-foreground" aria-hidden="true" />Horarios</h4>
          {schedules.length === 0 ? <p className="text-muted-foreground">Aún no hay horarios registrados.</p> : <ul className="flex flex-wrap gap-2">
            {schedules.map((item) => <li key={item.id}><Badge variant="secondary" className="px-3 py-1">{DAY_LABELS[item.day_of_week] ?? item.day_of_week} · {item.start_time.slice(0, 5)} – {item.end_time.slice(0, 5)}</Badge></li>)}
          </ul>}
        </div>
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
