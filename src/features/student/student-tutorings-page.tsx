import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { ErrorNotice, RecordTable } from '@/features/tutoring/tutoring-shared'
import { studentApi, type StudentTutoring } from '@/lib/student-api'
import { formatSubjectName } from '@/lib/sanitize'
import { StudentEmpty } from './student-shared'
import { usePagedList } from './student-hooks'
import { StudentTutoringWorkspace } from './student-tutoring-workspace'
import { ListFooter } from './student-ui'

export function StudentTutoringsPage() {
  const [params, setParams] = useSearchParams()
  const selectedId = Number(params.get('tutoring'))

  if (Number.isInteger(selectedId) && selectedId > 0) {
    return <StudentTutoringWorkspace subjectId={selectedId} />
  }
  return <TutoringsList onOpen={(id) => setParams({ tutoring: String(id) })} />
}

const isActive = (enrollment: StudentTutoring) => enrollment.is_active && Boolean(enrollment.subject?.is_active)

function TutoringsList({ onOpen }: Readonly<{ onOpen: (id: number) => void }>) {
  const resource = useDegreeResource(studentApi.tutorings)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('')
  const term = search.trim().toLowerCase()
  const rows = (resource.data ?? [])
    .filter((item) => item.subject)
    .filter((item) => !status || (status === 'active') === isActive(item))
    .filter((item) => !term || [item.subject?.name, item.subject?.teacher?.name, item.subject?.cycle?.name].some((value) => value?.toLowerCase().includes(term)))
  const pager = usePagedList(rows, 10)
  const hasTutorings = (resource.data ?? []).some((item) => item.subject)

  return <section className="flex min-w-0 flex-col gap-6" aria-busy={resource.loading}>
    <AdminSectionHeader title="Mis tutorías" description="Elige una tutoría para ver su contenido, tu asistencia, tus calificaciones y sus horarios." />
    <ErrorNotice message={resource.error} retry={resource.reload} />
    {!resource.error && (!resource.loading && !hasTutorings
      ? <StudentEmpty title="Aún no estás inscrito en ninguna tutoría" description="Tu docente te inscribirá en la tutoría de tu paralelo y aparecerá aquí." />
      : <>
        <FilterBar
          id="student-tutorings"
          search={search}
          onSearch={(value) => { setSearch(value); pager.setPage(1) }}
          searchLabel="Buscar tutoría"
          searchPlaceholder="Busca por asignatura, ciclo o docente…"
          filters={[{ id: 'status', label: 'Estado', value: status, onChange: (value) => { setStatus(value as '' | 'active' | 'inactive'); pager.setPage(1) }, allLabel: 'Todas', options: [{ value: 'active', label: 'En curso' }, { value: 'inactive', label: 'Finalizadas' }] }]}
          onClear={() => { setSearch(''); setStatus(''); pager.setPage(1) }}
        />
        <RecordTable
          rows={pager.rows}
          loading={resource.loading}
          onRowClick={(item) => item.subject && onOpen(item.subject.id)}
          rowTitle={(item) => `Abrir ${item.subject?.name ?? ''}`}
          empty="No hay tutorías que coincidan con tu búsqueda."
          columns={[
            { label: 'Asignatura', render: (item) => <div className="flex flex-col gap-0.5"><span className="font-medium text-foreground">{formatSubjectName(item.subject?.name ?? '')}</span>{item.subject?.modality && <span className="text-xs text-muted-foreground">{item.subject.modality.name}</span>}</div> },
            { label: 'Ciclo', render: (item) => <span>{item.subject?.cycle?.name ?? 'Sin ciclo'}{item.subject?.section ? ` · ${item.subject.section.name}` : ''}</span> },
            { label: 'Docente', render: (item) => item.subject?.teacher?.name ?? <span className="text-muted-foreground">Sin docente</span> },
            { label: 'Estado', render: (item) => <StatusBadge active={isActive(item)} activeLabel="En curso" inactiveLabel="Finalizada" /> },
          ]}
        />
        <ListFooter noun={rows.length === 1 ? 'tutoría' : 'tutorías'} total={rows.length} start={pager.start} shown={pager.rows.length} page={pager.page} lastPage={pager.lastPage} onPage={pager.setPage} />
      </>)}
  </section>
}
