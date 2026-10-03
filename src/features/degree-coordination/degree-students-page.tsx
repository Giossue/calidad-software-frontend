import { useState } from 'react'
import {
  CalendarDaysIcon,
  CheckCircle2Icon,
  GraduationCapIcon,
  UserCheckIcon,
  UserMinusIcon,
  XCircleIcon,
} from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import {
  degreeCoordinationApi,
  type DegreeEnrollmentStudent,
  type DegreePaginationMeta,
} from '@/lib/degree-coordination-api'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { ErrorNotice, RecordTable } from '@/features/tutoring/tutoring-shared'

export function DegreeStudentsPage() {
  const [degreeFilter, setDegreeFilter] = useState<'' | 'enrolled' | 'not_enrolled'>('')
  const degreeList = usePaginatedCatalog<DegreeEnrollmentStudent, DegreePaginationMeta>(
    (page, search) =>
      degreeCoordinationApi.degreeStudents({
        page,
        search,
        enrolled: degreeFilter === '' ? undefined : degreeFilter === 'enrolled',
      }),
    degreeFilter,
  )
  const operation = useOperation()
  const [enrollTarget, setEnrollTarget] = useState<DegreeEnrollmentStudent | null>(null)
  const [unenrollTarget, setUnenrollTarget] = useState<DegreeEnrollmentStudent | null>(null)

  function handleEnrollConfirm() {
    if (!enrollTarget) return
    void operation.run(
      () => degreeCoordinationApi.enrollDegreeStudent(enrollTarget.student_id),
      `Estudiante ${enrollTarget.name} matriculado en titulación exitosamente.`,
      async () => {
        setEnrollTarget(null)
        await degreeList.reload()
      },
    )
  }

  function handleUnenrollConfirm() {
    if (!unenrollTarget) return
    void operation.run(
      () => degreeCoordinationApi.unenrollDegreeStudent(unenrollTarget.student_id),
      `Se dio de baja a ${unenrollTarget.name} de titulación.`,
      async () => {
        setUnenrollTarget(null)
        await degreeList.reload()
      },
    )
  }

  const currentPeriodName = degreeList.meta?.current_period?.name

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
            <UserCheckIcon className="size-6 text-primary" />
            Matrícula de Estudiantes en Titulación
          </h2>
          <p className="text-sm text-muted-foreground">
            Matricula a los estudiantes de la carrera en el período académico actual para habilitarles el acceso a la postulación de temas de titulación.
          </p>
        </div>
        {currentPeriodName ? (
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground shadow-2xs">
            <CalendarDaysIcon className="size-4 text-primary shrink-0" />
            <span>Período actual:</span>
            <span className="font-semibold text-primary">{currentPeriodName}</span>
          </div>
        ) : !degreeList.isInitialLoading ? (
          <div className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
            <span>Sin período académico activo</span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <FilterBar
          id="coordination-degree-students-filter"
          search={degreeList.searchInput}
          onSearch={degreeList.setSearchInput}
          searchLabel="Buscar estudiante"
          searchPlaceholder="Busca por nombre, cédula o correo…"
          filters={[
            {
              id: 'enrollment-status',
              label: 'Estado de matrícula',
              value: degreeFilter,
              onChange: (val) => setDegreeFilter(val as '' | 'enrolled' | 'not_enrolled'),
              allLabel: 'Todos los estudiantes',
              options: [
                { label: 'Matriculados en Titulación', value: 'enrolled' },
                { label: 'Sin matrícula en Titulación', value: 'not_enrolled' },
              ],
            },
          ]}
          onClear={() => {
            degreeList.setSearchInput('')
            setDegreeFilter('')
          }}
        />
      </div>

      <ErrorNotice message={degreeList.error} retry={degreeList.reload} />

      <RecordTable<DegreeEnrollmentStudent>
        rows={degreeList.data}
        loading={degreeList.isFetching || degreeList.isInitialLoading}
        empty={
          <Empty className="border-none py-12">
            <EmptyMedia>
              <GraduationCapIcon className="size-10 text-muted-foreground/60" />
            </EmptyMedia>
            <EmptyTitle>No se encontraron estudiantes</EmptyTitle>
            <EmptyDescription>
              {degreeList.searchInput || degreeFilter !== ''
                ? 'No hay estudiantes que coincidan con los filtros aplicados. Intenta con otros términos.'
                : 'Aún no hay estudiantes registrados para el período académico actual.'}
            </EmptyDescription>
          </Empty>
        }
        columns={[
          {
            label: 'Estudiante',
            render: (student) => (
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-foreground">{student.name}</span>
                <span className="text-xs text-muted-foreground">{student.email}</span>
              </div>
            ),
          },
          {
            label: 'Cédula',
            render: (student) => <span className="font-mono text-sm">{student.identification}</span>,
          },
          {
            label: 'Teléfono',
            render: (student) => (
              <span className="text-sm text-muted-foreground">{student.phone || '—'}</span>
            ),
          },
          {
            label: 'Estado en Titulación',
            render: (student) =>
              student.is_degree_enrolled ? (
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 gap-1.5 font-medium text-xs py-1 px-2.5"
                >
                  <CheckCircle2Icon className="size-3.5 text-emerald-600" />
                  Matriculado
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-border text-muted-foreground gap-1.5 text-xs py-1 px-2.5"
                >
                  <XCircleIcon className="size-3.5 text-muted-foreground" />
                  No matriculado
                </Badge>
              ),
          },
          {
            label: 'Fecha Matrícula',
            render: (student) => (
              <span className="text-sm text-muted-foreground">{student.enrolled_at || '—'}</span>
            ),
          },
          {
            label: 'Acciones',
            render: (student) => (
              <div className="flex items-center gap-2">
                {student.is_degree_enrolled ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setUnenrollTarget(student)}
                    disabled={operation.pending}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 text-xs font-medium"
                  >
                    <UserMinusIcon className="size-3.5" />
                    Dar de baja
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setEnrollTarget(student)}
                    disabled={operation.pending}
                    className="gap-1.5 text-xs font-medium bg-brand-blue hover:bg-brand-blue/90 text-white"
                  >
                    <GraduationCapIcon className="size-3.5" />
                    Matricular en Titulación
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />

      <CatalogPagination
        label="estudiantes de titulación"
        page={degreeList.page}
        lastPage={degreeList.meta?.last_page ?? 1}
        disabled={degreeList.isFetching}
        onChange={degreeList.setPage}
      />

      {/* Modal Confirmación Matrícula Titulación */}
      <ConfirmModal
        open={Boolean(enrollTarget)}
        title={`¿Matricular a ${enrollTarget?.name} en Titulación?`}
        description={`El estudiante quedará matriculado en titulación para el período ${currentPeriodName ?? 'actual'}. Se le habilitará inmediatamente la pestaña de titulación para presentar sus propuestas de grado.`}
        confirmLabel="Confirmar matrícula"
        pending={operation.pending}
        onClose={() => setEnrollTarget(null)}
        onConfirm={handleEnrollConfirm}
      />

      {/* Modal Confirmación Dar de Baja Titulación */}
      <ConfirmModal
        open={Boolean(unenrollTarget)}
        title={`¿Dar de baja a ${unenrollTarget?.name} de Titulación?`}
        description={`¿Estás seguro de que deseas retirar la matrícula de titulación a ${unenrollTarget?.name}? Se le deshabilitará el acceso a la pestaña de titulación para el período actual.`}
        confirmLabel="Sí, dar de baja"
        pending={operation.pending}
        onClose={() => setUnenrollTarget(null)}
        onConfirm={handleUnenrollConfirm}
      />
    </div>
  )
}
