import { useState } from 'react'
import { FileTextIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useDegreeResource } from '@/features/degree-coordination/degree-hooks'
import { ErrorNotice } from '@/features/tutoring/tutoring-shared'
import { teacherApi, type TeacherTutoring } from '@/lib/teacher-api'
import { ReportsPanel } from './teacher-reports-page'
import { TeacherEmpty } from './teacher-shared'

export function TeacherReportsStandalonePage() {
  const resource = useDegreeResource(() => teacherApi.allTutorings())
  const [selected, setSelected] = useState<TeacherTutoring | null>(null)

  const tutorings = resource.data ?? []

  if (selected) {
    return (
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="w-fit text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setSelected(null)}
          >
            ← Elegir otra tutoría
          </button>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
            {selected.subject_name}
          </h2>
          <p className="text-sm text-muted-foreground">{selected.career_name} · {selected.cycle_name}{selected.section_name ? ` · ${selected.section_name}` : ''}</p>
        </div>
        <ReportsPanel tutoring={selected} />
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-6">
      <AdminSectionHeader
        title="Informes"
        description="Selecciona una tutoría para ver o enviar informes al Coordinador de Carrera."
      />
      <ErrorNotice message={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Cargando tutorías">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : tutorings.length === 0 ? (
        <TeacherEmpty
          title="No hay tutorías asignadas"
          description="Cuando el Coordinador de Carrera te asigne una tutoría, aparecerá aquí."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {tutorings.map((tutoring) => (
            <li key={tutoring.id}>
              <button
                type="button"
                className="group w-full rounded-xl border border-border bg-card p-4 text-left shadow-xs transition-all hover:border-primary/40 hover:bg-accent hover:shadow-sm"
                onClick={() => setSelected(tutoring)}
                aria-label={`Ver informes de ${tutoring.subject_name}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="font-semibold truncate">{tutoring.subject_name}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {tutoring.career_name} · {tutoring.cycle_name}{tutoring.section_name ? ` · ${tutoring.section_name}` : ''}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={tutoring.can_manage ? 'default' : 'secondary'}>
                      {tutoring.can_manage ? 'En curso' : 'Solo consulta'}
                    </Badge>
                    <FileTextIcon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden="true" />
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
