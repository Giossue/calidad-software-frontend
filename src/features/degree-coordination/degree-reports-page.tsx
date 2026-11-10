import { useState } from 'react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { ErrorNotice } from '@/components/ui/error-notice'
import { RecordTable } from '@/features/tutoring/tutoring-shared'
import { degreeCoordinationApi, type DegreeReport } from '@/lib/degree-coordination-api'
import { formatDegreeDate } from './degree-format'
import { useDegreeResource, useDegreeSearch } from './degree-hooks'

export function DegreeReportsPage() {
  const search = useDegreeSearch()
  const [page, setPage] = useState(1)
  const [selectedReport, setSelectedReport] = useState<DegreeReport | null>(null)

  const resource = useDegreeResource(
    () => degreeCoordinationApi.reports({ page, search: search.search }),
    `degree-reports-${page}-${search.search}`,
  )

  const reports = resource.data?.data ?? []
  const meta = resource.data?.meta

  return (
    <section className="flex flex-col gap-6">
      <AdminSectionHeader
        title="Reportes de titulación"
        description="Consulta los informes de seguimiento emitidos para cada tema."
      />

      <FilterBar
        id="degree-reports"
        search={search.input}
        onSearch={(val) => {
          search.setInput(val)
          setPage(1)
        }}
        searchLabel="Buscar reporte"
        searchPlaceholder="Título de tema, estudiante o palabras clave"
        onClear={() => {
          search.setInput('')
          setPage(1)
        }}
        filters={[]}
      />

      <ErrorNotice message={resource.error} retry={resource.reload} />

      <RecordTable
        rows={reports}
        loading={resource.loading}
        empty={search.search ? 'No hay informes con esta búsqueda.' : 'Aún no se han emitido informes de titulación.'}
        onRowClick={setSelectedReport}
        rowTitle={(report) => `Ver informe de ${report.student_name}`}
        columns={[
          {
            label: 'Tema',
            render: (report) => (
              <div className="flex flex-col gap-1 max-w-sm">
                <span className="font-medium text-foreground">{report.topic_title}</span>
                <span className="text-xs text-muted-foreground">{report.period_name || 'Período vigente'}</span>
              </div>
            ),
          },
          {
            label: 'Estudiante',
            render: (report) => (
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground">{report.student_name}</span>
                <span className="text-xs text-muted-foreground">{report.student_identification}</span>
              </div>
            ),
          },
          {
            label: 'Fecha de emisión',
            render: (report) => (
              <span className="text-xs text-muted-foreground">
                {report.generated_at ? formatDegreeDate(report.generated_at) : 'Reciente'}
              </span>
            ),
          },
          {
            label: 'Avance registrado',
            render: (report) => (
              <Badge variant="outline">
                {report.progress_percentage}%
              </Badge>
            ),
          },
          {
            label: 'Coordinador',
            render: (report) => (
              <span className="text-xs text-muted-foreground">{report.coordinator_name || 'Coordinación'}</span>
            ),
          },
        ]}
      />

      <CatalogPagination
        label="reportes"
        page={page}
        lastPage={meta?.last_page ?? 1}
        disabled={resource.loading}
        onChange={setPage}
      />

      {selectedReport && (
        <Dialog
          open={selectedReport !== null}
          onClose={() => setSelectedReport(null)}
          title="Informe de titulación"
          description={selectedReport.topic_title}
        >
          <div className="flex flex-col gap-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <ReportItem label="Estudiante" value={`${selectedReport.student_name} (${selectedReport.student_identification})`} />
              <ReportItem label="Avance registrado" value={`${selectedReport.progress_percentage}%`} />
              <ReportItem label="Emitido" value={formatDegreeDate(selectedReport.generated_at)} />
              <ReportItem label="Generado por" value={selectedReport.coordinator_name || 'Coordinación'} />
            </dl>
            <div className="flex flex-col gap-1.5 border-t pt-4">
              <h3 className="text-sm text-muted-foreground">Observaciones y dictamen final</h3>
              <p className="whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{selectedReport.final_observations}</p>
            </div>
            <div className="flex justify-end">
              <DialogCancelButton>Cerrar</DialogCancelButton>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  )
}

function ReportItem({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div className="flex min-w-0 flex-col gap-0.5"><dt className="text-muted-foreground">{label}</dt><dd className="[overflow-wrap:anywhere]">{value}</dd></div>
}
