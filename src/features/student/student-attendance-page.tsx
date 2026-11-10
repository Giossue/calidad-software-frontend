import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { SelectInput } from '@/components/ui/select-field'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { ErrorNotice } from '@/components/ui/error-notice'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { formatDate } from '@/lib/format'
import { studentApi, type StudentAttendance } from '@/lib/student-api'
import { AbsenceNotices } from './student-absence-notices'
import { StudentEmpty } from './student-shared'
import { ListFooter, RedProgress } from './student-ui'
import { usePagedList } from './student-hooks'
import { AttendanceSkeleton } from './student-skeletons'

type RecordFilter = 'all' | 'present' | 'absent'

function AttendanceView({ item }: Readonly<{ item: StudentAttendance }>) {
  const { summary } = item
  const [filter, setFilter] = useState<RecordFilter>('all')
  const visible = item.records.filter((record) => filter === 'all' || (filter === 'present') === record.present)
  const pager = usePagedList(visible)
  const choose = (next: string) => { setFilter(next as RecordFilter); pager.setPage(1) }
  return <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <RedProgress value={summary.attendance_percentage} label="Porcentaje de asistencia" />
      <p className="shrink-0 text-sm text-muted-foreground"><span className="font-semibold text-foreground tabular-nums">{Math.round(summary.attendance_percentage)} %</span> de asistencia · {summary.present_count} de {summary.total_sessions} sesiones</p>
    </div>
    {item.records.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay sesiones registradas.</p> : <div className="flex flex-col gap-3">
      <SelectInput
        id="student-attendance-status"
        ariaLabel="Filtrar sesiones"
        className="w-full sm:w-52 sm:self-end"
        value={filter}
        onValueChange={choose}
        options={[
          { value: 'all', label: `Todas (${item.records.length})` },
          { value: 'present', label: `Presentes (${summary.present_count})` },
          { value: 'absent', label: `Ausentes (${summary.absent_count})` },
        ]}
      />
      <RecordTable
        rows={pager.rows}
        loading={false}
        empty="No hay sesiones para este filtro."
        columns={[
          { label: 'Sesión', render: (record) => <span className="text-foreground">{record.session_number ? `Sesión ${record.session_number}` : 'Sesión'}</span> },
          { label: 'Fecha', render: (record) => <span className="text-foreground">{record.date ? formatDate(record.date) : 'Sin fecha'}</span> },
          { label: 'Asistencia', render: (record) => <Badge variant={record.present ? 'success' : 'danger'}>{record.present ? 'Presente' : 'Ausente'}</Badge> },
        ]}
      />
      <ListFooter noun="sesiones" total={visible.length} start={pager.start} shown={pager.rows.length} page={pager.page} lastPage={pager.lastPage} onPage={pager.setPage} />
    </div>}
  </div>
}

// Récord de asistencia de una tutoría.
export function AttendancePanel({ tutoringId, canNotify = false }: Readonly<{ tutoringId: number; canNotify?: boolean }>) {
  const resource = useDegreeResource(studentApi.attendance)
  const item = resource.data?.find((attendance) => attendance.tutoring?.id === tutoringId)

  // Primero el récord del estudiante; los avisos (acción secundaria) quedan al final.
  return <div className="flex flex-col gap-6">
    <ErrorNotice message={resource.error} retry={resource.reload} />
    {resource.loading ? <AttendanceSkeleton /> : !resource.error && (!item ? <StudentEmpty title="Aún no tienes asistencia registrada" description="Tu récord aparecerá cuando tu docente registre la primera sesión." /> : <AttendanceView item={item} />)}
    <AbsenceNotices tutoringId={tutoringId} canNotify={canNotify} />
  </div>
}
