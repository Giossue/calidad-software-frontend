import { useState } from 'react'
import { GraduationCapIcon, UserMinusIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { ErrorNotice } from '@/components/ui/error-notice'
import { StatusBadge } from '@/components/ui/status-badge'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import {
  degreeCoordinationApi,
  type DegreeEnrollmentStudent,
  type DegreePaginationMeta,
} from '@/lib/degree-coordination-api'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { RecordTable } from '@/features/tutoring/tutoring-shared'

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
      `${enrollTarget.name} matriculado en titulación`,
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
      `${unenrollTarget.name} dado de baja de titulación`,
      async () => {
        setUnenrollTarget(null)
        await degreeList.reload()
      },
    )
  }

  const currentPeriodName = degreeList.meta?.current_period?.name

  const noPeriod = !currentPeriodName && !degreeList.isInitialLoading && !degreeList.error
  const hasFilters = Boolean(degreeList.searchInput || degreeFilter)

  return (
    <section className="flex flex-col gap-6">
      <AdminSectionHeader
        title="Matrícula en titulación"
        description={currentPeriodName ? `Matricula a los estudiantes en titulación del período ${currentPeriodName}.` : 'Matricula a los estudiantes en titulación del período vigente.'}
      />

      {noPeriod && <Alert><AlertDescription>No hay un período académico activo. Administración debe activarlo para matricular estudiantes en titulación.</AlertDescription></Alert>}

      <FilterBar
        id="coordination-degree-students-filter"
        search={degreeList.searchInput}
        onSearch={degreeList.setSearchInput}
        searchLabel="Buscar estudiante"
        searchPlaceholder="Nombre, cédula o correo"
        filters={[
          {
            id: 'enrollment-status',
            label: 'Estado de matrícula',
            value: degreeFilter,
            onChange: (val) => setDegreeFilter(val as '' | 'enrolled' | 'not_enrolled'),
            allLabel: 'Todos los estudiantes',
            options: [
              { label: 'Matriculados', value: 'enrolled' },
              { label: 'Sin matrícula', value: 'not_enrolled' },
            ],
          },
        ]}
        onClear={() => {
          degreeList.setSearchInput('')
          setDegreeFilter('')
        }}
      />

      <ErrorNotice message={degreeList.error} retry={degreeList.reload} />

      <RecordTable<DegreeEnrollmentStudent>
        numberFrom={degreeList.meta?.from}
        rows={degreeList.data}
        loading={degreeList.isFetching || degreeList.isInitialLoading}
        empty={hasFilters ? 'No hay estudiantes con estos filtros.' : 'Aún no hay estudiantes para el período vigente.'}
        columns={[
          {
            label: 'Estudiante',
            render: (student) => (
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">{student.name}</span>
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
            label: 'Ciclo',
            render: (student) => (
              <span className="text-sm text-muted-foreground">
                {student.cycle_number ? `${student.cycle_number}° ciclo${student.section_name ? ` · ${student.section_name}` : ''}` : '—'}
              </span>
            ),
          },
          {
            label: 'Estado',
            render: (student) => <StatusBadge active={student.is_degree_enrolled} activeLabel="Matriculado" inactiveLabel="No matriculado" />,
          },
          {
            label: 'Fecha de matrícula',
            render: (student) => (
              <span className="text-sm text-muted-foreground">{student.enrolled_at || '—'}</span>
            ),
          },
          {
            // Una sola acción por fila, escrita: matricular o dar de baja según su estado.
            label: 'Matrícula',
            render: (student) => student.is_degree_enrolled ? (
              <Button type="button" size="sm" variant="tertiary" tone="destructive" aria-label={`Dar de baja a ${student.name}`} onClick={() => setUnenrollTarget(student)} disabled={operation.pending}>
                <UserMinusIcon data-icon="inline-start" />Dar de baja
              </Button>
            ) : (
              <Button type="button" size="sm" variant="secondary" aria-label={`Matricular a ${student.name}`} onClick={() => setEnrollTarget(student)} disabled={operation.pending}>
                <GraduationCapIcon data-icon="inline-start" />Matricular
              </Button>
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

      <ConfirmModal
        open={Boolean(enrollTarget)}
        variant="default"
        confirmIcon={GraduationCapIcon}
        title={`¿Matricular a ${enrollTarget?.name} en titulación?`}
        description={`Se le habilitará el módulo de titulación del período ${currentPeriodName ?? 'vigente'} para presentar su propuesta.`}
        confirmLabel="Confirmar matrícula"
        pending={operation.pending}
        onClose={() => setEnrollTarget(null)}
        onConfirm={handleEnrollConfirm}
      />

      <ConfirmModal
        open={Boolean(unenrollTarget)}
        confirmIcon={UserMinusIcon}
        title={`¿Dar de baja a ${unenrollTarget?.name} de titulación?`}
        description={`Perderá el acceso al módulo de titulación del período ${currentPeriodName ?? 'vigente'}.`}
        confirmLabel="Dar de baja"
        pending={operation.pending}
        onClose={() => setUnenrollTarget(null)}
        onConfirm={handleUnenrollConfirm}
      />
    </section>
  )
}
