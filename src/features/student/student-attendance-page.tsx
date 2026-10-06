import { useState } from 'react'
import { CheckCircle2Icon, ListIcon, XCircleIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { ErrorNotice, RecordTable } from '@/features/tutoring/tutoring-shared'
import { formatDate } from '@/lib/format'
import { studentApi, type StudentAttendance } from '@/lib/student-api'
import { StudentEmpty } from './student-shared'
import { FilterChips, ListFooter, RedProgress } from './student-ui'
import { usePagedList } from './student-hooks'

type RecordFilter = 'all' | 'present' | 'absent'

function AttendanceView({ item }: Readonly<{ item: StudentAttendance }>) {
  const { summary } = item
  const [filter, setFilter] = useState<RecordFilter>('all')
  const visible = item.records.filter((record) => filter === 'all' || (filter === 'present') === record.present)
  const pager = usePagedList(visible)
  return <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-4xl font-semibold tabular-nums">{Math.round(summary.attendance_percentage)}% <span className="text-base font-normal text-muted-foreground">de asistencia</span></p>
        <RedProgress value={summary.attendance_percentage} label="Porcentaje de asistencia" />
        <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground"><span>{summary.present_count} presentes · {summary.absent_count} ausentes</span><span>{summary.total_sessions} sesiones registradas</span></div>
      </div>
      {item.records.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay sesiones registradas.</p> : <>
        <FilterChips label="Filtrar sesiones" value={filter} onChange={(next) => { setFilter(next); pager.setPage(1) }} options={[{ value: 'all', label: 'Todas', count: item.records.length, icon: ListIcon }, { value: 'present', label: 'Presentes', count: summary.present_count, icon: CheckCircle2Icon }, { value: 'absent', label: 'Ausentes', count: summary.absent_count, icon: XCircleIcon }]} />
        <RecordTable
          rows={pager.rows}
          loading={false}
          empty="No hay sesiones para este filtro."
          columns={[
            { label: 'Fecha', render: (record) => <span className="font-medium text-foreground">{record.date ? formatDate(record.date) : 'Sin fecha'}</span> },
            { label: 'Temas tratados', render: (record) => <span className="text-muted-foreground">{record.topics.length ? record.topics.map((topic) => topic.name).join(', ') : record.topics_covered === false ? 'Sin temas vistos' : 'Sin temas registrados'}</span> },
            { label: 'Asistencia', render: (record) => <Badge variant={record.present ? 'success' : 'danger'}>{record.present ? 'Presente' : 'Ausente'}</Badge> },
          ]}
        />
        <ListFooter noun="sesiones" total={visible.length} start={pager.start} shown={pager.rows.length} page={pager.page} lastPage={pager.lastPage} onPage={pager.setPage} />
      </>}
  </div>
}

// Récord de asistencia de una tutoría.
export function AttendancePanel({ tutoringId }: Readonly<{ tutoringId: number }>) {
  const resource = useDegreeResource(studentApi.attendance)
  const item = resource.data?.find((attendance) => attendance.tutoring?.id === tutoringId)

  return <div className="flex flex-col gap-5">
    <ErrorNotice message={resource.error} retry={resource.reload} />
    {resource.loading ? <Skeleton role="status" aria-label="Cargando asistencia" className="h-48 w-full" /> : !resource.error && (!item ? <StudentEmpty title="Aún no tienes asistencia registrada" description="Tu récord aparecerá cuando tu docente registre la primera sesión." /> : <AttendanceView item={item} />)}
  </div>
}
