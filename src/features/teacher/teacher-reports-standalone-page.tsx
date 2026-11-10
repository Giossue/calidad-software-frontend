import { useSearchParams } from 'react-router-dom'
import { ArrowLeftIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Button } from '@/components/ui/button'
import { TableSkeleton } from '@/components/ui/loading-skeletons'
import { StatusBadge } from '@/components/ui/status-badge'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { ErrorNotice } from '@/components/ui/error-notice'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { teacherApi, type TeacherTutoring } from '@/lib/teacher-api'
import { ReportsPanel } from './teacher-reports-page'
import { TeacherEmpty } from './teacher-shared'

const groupLabel = (tutoring: TeacherTutoring) => `${tutoring.cycle_name}${tutoring.section_name ? ` · ${tutoring.section_name}` : ''}`

export function TeacherReportsStandalonePage() {
  const resource = useDegreeResource(() => teacherApi.allTutorings())
  // La tutoría abierta va en la URL: «atrás» del navegador vuelve a la lista de tutorías.
  const [params, setParams] = useSearchParams()
  const selectedId = Number(params.get('tutoring')) || null
  const selected = selectedId ? resource.data?.find((item) => item.id === selectedId) ?? null : null

  if (selectedId && resource.loading) return <TableSkeleton columns={3} />

  if (selected) {
    return (
      <section className="flex flex-col gap-6" data-tour-view="tutoring">
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="tertiary"
            size="sm"
            onClick={() => setParams({})}
            className="-ml-2 w-fit"
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Elegir otra tutoría
          </Button>
          <AdminSectionHeader title={selected.subject_name} description={`${selected.career_name} · ${groupLabel(selected)}`} />
        </div>
        <ReportsPanel tutoring={selected} />
      </section>
    )
  }

  // Misma lista que «Mis tutorías»: la fila abre los informes de la tutoría.
  return (
    <section className="flex flex-col gap-6">
      <AdminSectionHeader
        title="Informes"
        description="Elige una tutoría para ver o enviar sus informes al Coordinador de Carrera."
      />
      <ErrorNotice message={resource.error} retry={resource.reload} />
      <RecordTable
        rows={resource.data ?? []}
        loading={resource.loading}
        onRowClick={(tutoring) => setParams({ tutoring: String(tutoring.id) })}
        rowTitle={(tutoring) => `Ver informes de ${tutoring.subject_name}`}
        empty={
          <TeacherEmpty
            title="No hay tutorías asignadas"
            description="Cuando el Coordinador de Carrera te asigne una tutoría, aparecerá aquí."
          />
        }
        columns={[
          { label: 'Asignatura', render: (tutoring) => <div className="flex flex-col gap-1"><span>{tutoring.subject_name}</span><span className="text-xs text-muted-foreground">{tutoring.career_name}</span></div> },
          { label: 'Ciclo y paralelo', render: groupLabel },
          { label: 'Estado', render: (tutoring) => <StatusBadge active={tutoring.can_manage} activeLabel="En curso" inactiveLabel="Solo consulta" /> },
        ]}
      />
    </section>
  )
}
