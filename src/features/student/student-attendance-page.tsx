import { CheckCircle2Icon, XCircleIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/format'
import { studentApi, type StudentAttendance } from '@/lib/student-api'
import { StudentEmpty, StudentReadPage } from './student-shared'
import { tutoringContext } from './student-format'

function AttendanceCard({ item }: Readonly<{ item: StudentAttendance }>) {
  const { summary } = item
  return <Card>
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CardTitle className="min-w-0 break-words">{item.tutoring?.name ?? 'Tutoría no disponible'}</CardTitle>
        <Badge variant={summary.total_sessions > 0 && summary.attendance_percentage < 70 ? 'destructive' : 'secondary'}>{summary.attendance_percentage}% de asistencia</Badge>
      </div>
      <CardDescription>{tutoringContext(item.tutoring)}</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div role="progressbar" aria-label="Porcentaje de asistencia" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.attendance_percentage} className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, summary.attendance_percentage)}%` }} /></div>
        <p className="text-sm text-muted-foreground">{summary.present_count} presentes · {summary.absent_count} ausentes · {summary.total_sessions} sesiones registradas</p>
      </div>
      {item.records.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay sesiones registradas.</p> : <ul className="flex flex-col divide-y rounded-lg border">
        {item.records.map((record) => <li key={record.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1 text-sm"><span className="font-medium">{record.date ? formatDate(record.date) : 'Sin fecha'}</span><span className="text-muted-foreground">{record.topics.length ? record.topics.map((topic) => topic.name).join(', ') : record.topics_covered === false ? 'Sin temas vistos' : 'Sin temas registrados'}</span></div>
          <Badge variant={record.present ? 'success' : 'inactive'} className="w-fit gap-1.5">{record.present ? <CheckCircle2Icon aria-hidden="true" /> : <XCircleIcon aria-hidden="true" />}{record.present ? 'Presente' : 'Ausente'}</Badge>
        </li>)}
      </ul>}
    </CardContent>
  </Card>
}

export function StudentAttendancePage() {
  return <StudentReadPage title="Mi asistencia" description="Consulta tu récord de asistencia, el porcentaje acumulado y los temas vistos en cada sesión." label="asistencia" loader={studentApi.attendance}
    empty={<StudentEmpty title="Aún no tienes asistencia registrada" description="Tu récord aparecerá cuando tu docente registre la primera sesión." />}>
    {(rows) => rows.map((item) => <AttendanceCard key={item.enrollment_id} item={item} />)}
  </StudentReadPage>
}
