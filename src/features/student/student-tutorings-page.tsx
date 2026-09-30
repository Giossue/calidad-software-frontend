import { useSearchParams } from 'react-router-dom'
import { ChevronRightIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { ErrorNotice } from '@/features/tutoring/tutoring-shared'
import { studentApi, type StudentTutoring } from '@/lib/student-api'
import { StudentEmpty } from './student-shared'
import { StudentTutoringWorkspace } from './student-tutoring-workspace'
import { ContextPills, IconTile } from './student-ui'

export function StudentTutoringsPage() {
  const [params, setParams] = useSearchParams()
  const selectedId = Number(params.get('tutoring'))

  if (Number.isInteger(selectedId) && selectedId > 0) {
    return <StudentTutoringWorkspace subjectId={selectedId} onBack={() => setParams({})} />
  }
  return <TutoringsList onOpen={(id) => setParams({ tutoring: String(id) })} />
}

function TutoringRow({ enrollment, onOpen }: Readonly<{ enrollment: StudentTutoring; onOpen: (id: number) => void }>) {
  const subject = enrollment.subject
  if (!subject) return null
  return <li>
    <button type="button" onClick={() => onOpen(subject.id)} aria-label={`Abrir ${subject.name}`} className="flex w-full cursor-pointer items-center gap-4 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
      <IconTile />
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="break-words text-lg font-semibold tracking-tight">{subject.name}</span>
        <ContextPills source={subject} />
      </span>
      <StatusBadge active={enrollment.is_active && subject.is_active} activeLabel="En curso" inactiveLabel="Finalizada" />
      <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  </li>
}

function TutoringsList({ onOpen }: Readonly<{ onOpen: (id: number) => void }>) {
  const resource = useDegreeResource(studentApi.tutorings)
  const rows = (resource.data ?? []).filter((item) => item.subject)

  return <section className="flex min-w-0 flex-col gap-6" aria-busy={resource.loading}>
    <AdminSectionHeader title="Mis tutorías" description="Elige una tutoría para ver su contenido, tu asistencia, tus calificaciones y sus horarios." />
    <ErrorNotice message={resource.error} retry={resource.reload} />
    {resource.loading ? <div role="status" aria-label="Cargando tutorías" className="flex flex-col gap-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>
      : !resource.error && (rows.length === 0 ? <StudentEmpty title="Aún no estás inscrito en ninguna tutoría" description="Tu docente te inscribirá en la tutoría de tu paralelo y aparecerá aquí." />
        : <ul className="flex flex-col gap-3">{rows.map((enrollment) => <TutoringRow key={enrollment.id} enrollment={enrollment} onOpen={onOpen} />)}</ul>)}
  </section>
}
