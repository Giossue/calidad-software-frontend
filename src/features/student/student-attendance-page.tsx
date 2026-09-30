import { useState } from 'react'
import { CheckCircle2Icon, ListIcon, XCircleIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { studentApi, type StudentAttendance } from '@/lib/student-api'
import { StudentEmpty, StudentReadPage } from './student-shared'
import { ContextPills, FilterChips, IconTile, ListFooter, RedProgress } from './student-ui'
import { usePagedList } from './student-hooks'

const monthYear = (date: string) => new Intl.DateTimeFormat('es-EC', { month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`)).replace('.', '')

type RecordFilter = 'all' | 'present' | 'absent'

function AttendanceCard({ item }: Readonly<{ item: StudentAttendance }>) {
  const { summary } = item
  const [filter, setFilter] = useState<RecordFilter>('all')
  const visible = item.records.filter((record) => filter === 'all' || (filter === 'present') === record.present)
  const pager = usePagedList(visible)
  return <Card>
    <CardContent className="flex flex-col gap-6 pt-6">
      <div className="flex min-w-0 items-center gap-4"><IconTile /><div className="flex min-w-0 flex-col gap-2"><h3 className="break-words text-lg font-semibold tracking-tight">{item.tutoring?.name ?? 'Tutoría no disponible'}</h3><ContextPills source={item.tutoring} /></div></div>
      <div className="flex flex-col gap-2">
        <p className="text-4xl font-semibold tabular-nums">{Math.round(summary.attendance_percentage)}% <span className="text-base font-normal text-muted-foreground">de asistencia</span></p>
        <RedProgress value={summary.attendance_percentage} label="Porcentaje de asistencia" />
        <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground"><span>{summary.present_count} presentes · {summary.absent_count} ausentes</span><span>{summary.total_sessions} sesiones registradas</span></div>
      </div>
      {item.records.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay sesiones registradas.</p> : <>
        <FilterChips label="Filtrar sesiones" value={filter} onChange={(next) => { setFilter(next); pager.setPage(1) }} options={[{ value: 'all', label: 'Todas', count: item.records.length, icon: ListIcon }, { value: 'present', label: 'Presentes', count: summary.present_count, icon: CheckCircle2Icon }, { value: 'absent', label: 'Ausentes', count: summary.absent_count, icon: XCircleIcon }]} />
        <ul className="flex flex-col gap-3">
          {pager.rows.map((record) => <li key={record.id} className="flex items-center gap-4 rounded-xl border bg-card p-4">
            <span aria-hidden="true" className="flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-muted text-foreground"><span className="text-lg font-semibold leading-none">{record.date ? record.date.slice(8, 10) : '—'}</span><span className="mt-1 text-[11px] leading-none text-muted-foreground">{record.date ? monthYear(record.date) : ''}</span></span>
            <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm"><span className="font-semibold">{record.date ? formatDate(record.date) : 'Sin fecha'}</span><span className="text-muted-foreground">{record.topics.length ? record.topics.map((topic) => topic.name).join(', ') : record.topics_covered === false ? 'Sin temas vistos' : 'Sin temas registrados'}</span></div>
            <Badge variant={record.present ? 'success' : 'inactive'} className={cn('gap-1.5 px-3 py-1', !record.present && 'bg-destructive/10 text-destructive')}>{record.present ? <CheckCircle2Icon aria-hidden="true" /> : <XCircleIcon aria-hidden="true" />}{record.present ? 'Presente' : 'Ausente'}</Badge>
          </li>)}
        </ul>
        <ListFooter noun="sesiones" total={visible.length} start={pager.start} shown={pager.rows.length} page={pager.page} lastPage={pager.lastPage} onPage={pager.setPage} />
      </>}
    </CardContent>
  </Card>
}

export function StudentAttendancePage() {
  return <StudentReadPage title="Mi asistencia" description="Consulta tu récord de asistencia, el porcentaje acumulado y los temas vistos en cada sesión." label="asistencia" loader={studentApi.attendance}
    empty={<StudentEmpty title="Aún no tienes asistencia registrada" description="Tu récord aparecerá cuando tu docente registre la primera sesión." />}>
    {(rows) => rows.map((item) => <AttendanceCard key={item.enrollment_id} item={item} />)}
  </StudentReadPage>
}
