import { useState } from 'react'
import { FileTextIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { ErrorNotice, RecordTable } from '@/features/tutoring/tutoring-shared'
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
        empty="No se han generado informes de titulación para los criterios seleccionados."
        columns={[
          {
            label: 'Tema',
            render: (report) => (
              <div className="flex flex-col gap-1 max-w-sm">
                <span className="font-semibold text-foreground">{report.topic_title}</span>
                <span className="text-xs text-muted-foreground">{report.period_name || 'Período vigente'}</span>
              </div>
            ),
          },
          {
            label: 'Estudiante',
            render: (report) => (
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">{report.student_name}</span>
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
              <Badge variant="outline" className="font-semibold">
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
          {
            label: 'Acciones',
            render: (report) => (
              <Button size="sm" variant="outline" onClick={() => setSelectedReport(report)}>
                <FileTextIcon className="size-4 mr-1" /> Ver informe
              </Button>
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

      {/* Modal Visualizar Informe */}
      {selectedReport && (
        <Dialog
          open={selectedReport !== null}
          onClose={() => setSelectedReport(null)}
          title="Informe de titulación"
          description="Emisión oficial de seguimiento para el trabajo de titulación."
        >
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-xs">
              <div><span className="font-semibold text-foreground">Tema: </span>{selectedReport.topic_title}</div>
              <div><span className="font-semibold text-foreground">Estudiante: </span>{selectedReport.student_name} ({selectedReport.student_identification})</div>
              <div><span className="font-semibold text-foreground">Fecha de generación: </span>{formatDegreeDate(selectedReport.generated_at)}</div>
              <div><span className="font-semibold text-foreground">Avance general: </span>{selectedReport.progress_percentage}%</div>
              <div><span className="font-semibold text-foreground">Generado por: </span>{selectedReport.coordinator_name}</div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-1">Observaciones y dictamen final:</h4>
              <div className="rounded-lg border bg-background p-3 text-sm text-foreground whitespace-pre-wrap">
                {selectedReport.final_observations}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <DialogCancelButton>Cerrar</DialogCancelButton>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  )
}
