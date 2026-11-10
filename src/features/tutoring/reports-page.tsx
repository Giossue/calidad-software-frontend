import { useState } from 'react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ErrorNotice } from '@/components/ui/error-notice'
import { PrintStructuredReport, StructuredReport } from '@/features/reports/structured-report'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { isStructuredReport } from '@/lib/structured-report'
import { tutoringApi, type TutoringReport, type TutoringReportMeta } from '@/lib/tutoring-api'
import { CareerBreadcrumb, CareerPicker, useSelectedCareer } from './career-picker'
import { FilterBar } from './filter-bar'
import { ModuleHeader, RecordTable } from './tutoring-shared'
import { useTutoringCatalogs } from './tutoring-hooks'
import { ListScreenSkeleton } from './tutoring-skeletons'

function formatDate(value: string, time = false): string {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'medium',
    ...(time ? { timeStyle: 'short' as const } : {}),
  }).format(date)
}

export function TutoringReportsPage() {
  const catalogs = useTutoringCatalogs()
  const selection = useSelectedCareer(catalogs.careers)

  if (selection.career) {
    return <ReportsWorkspace catalogs={catalogs} careerId={selection.career.id} onBack={selection.canChange ? selection.clear : undefined} />
  }

  return <CareerPicker catalogs={catalogs} title="Informes" skeleton={<ReportsSkeleton />} rowTitle={(career) => `Ver informes de ${career.name}`} onSelect={(career) => selection.select(career.id)} />
}

/** Esqueleto de Informes: el mismo mientras cargan las carreras y la primera página. */
function ReportsSkeleton() {
  return <ListScreenSkeleton label="Cargando informes" actions={0} filters={1} headers={['Asignatura / Tutoría', 'Tipo de informe', 'Docente', 'Fecha']} />
}

function ReportsWorkspace({ catalogs, careerId, onBack }: Readonly<{ catalogs: ReturnType<typeof useTutoringCatalogs>; careerId: number; onBack?: () => void }>) {
  const [cycleFilter, setCycleFilter] = useState('')
  const [readingReport, setReadingReport] = useState<TutoringReport | null>(null)
  const readingStructured = Boolean(readingReport && isStructuredReport(readingReport.summary))

  const list = usePaginatedCatalog<TutoringReport, TutoringReportMeta>(
    (page, search) =>
      tutoringApi.allReports({
        page,
        search,
        career_id: careerId,
        cycle_number: Number(cycleFilter) || undefined,
      }),
    `${careerId}|${cycleFilter}`,
  )

  const careerName = catalogs.careers.find((career) => career.id === careerId)?.name ?? 'Informes'
  const cycleLevels = Array.from(
    new Map(catalogs.cycles.filter((cycle) => cycle.status && cycle.career_id === careerId).map((cycle) => [cycle.number, cycle])).values(),
  ).sort((a, b) => a.number - b.number)

  const clearFilters = () => {
    list.setSearchInput('')
    setCycleFilter('')
  }

  if (list.isInitialLoading) return <ReportsSkeleton />

  return (
    <section className="flex flex-col gap-6">
      <CareerBreadcrumb root="Informes" career={careerName} onBack={onBack} />
      <ModuleHeader
        title="Informes"
        description={`Lee los informes que envían los docentes de las tutorías de ${careerName}. Haz clic en uno para abrirlo.`}
      />

      <FilterBar
        id="tutoring-reports"
        search={list.searchInput}
        onSearch={list.setSearchInput}
        searchPlaceholder="Busca por tipo, contenido, autor o asignatura…"
        onClear={clearFilters}
        filters={[
          {
            id: 'cycle',
            label: 'Ciclo',
            value: cycleFilter,
            onChange: setCycleFilter,
            allLabel: 'Todos los ciclos',
            options: cycleLevels.map((level) => ({ value: String(level.number), label: `${level.number}° ciclo` })),
          },
        ]}
      />

      <ErrorNotice message={list.error} retry={list.reload} />

      <RecordTable
        rows={list.data}
        loading={list.isFetching || list.isInitialLoading}
        empty={list.searchInput || cycleFilter
          ? 'No hay informes con estos filtros.'
          : 'Aún no hay informes. Aparecerán aquí cuando los docentes los envíen.'}
        onRowClick={(report) => { if (report.content) setReadingReport(report) }}
        rowTitle={(report) => report.content ? `Leer informe ${report.type}` : ''}
        isRowSelected={(report) => readingReport?.id === report.id}
        columns={[
          {
            label: 'Asignatura / Tutoría',
            render: (report: TutoringReport) => (
              <div className="flex flex-col gap-1 items-start">
                <span className="text-foreground">
                  {report.subject_name || `Tutoría #${report.tutoring_id ?? report.id}`}
                </span>
                <span className="text-xs text-muted-foreground">
                  {[report.career_name, report.cycle_name, report.section_name ? `Paralelo ${report.section_name}` : null].filter(Boolean).join(' · ')}
                </span>
              </div>
            ),
          },
          {
            label: 'Tipo de informe',
            render: (report: TutoringReport) => (
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground">{report.type}</span>
                {!report.content && <span className="text-xs text-muted-foreground">Sin contenido adjunto</span>}
              </div>
            ),
          },
          {
            label: 'Docente',
            render: (report: TutoringReport) => (
              <span className="text-sm">{report.author_name || 'Docente'}</span>
            ),
          },
          {
            label: 'Fecha',
            render: (report: TutoringReport) => (
              <span className="text-sm text-muted-foreground">
                {formatDate(report.generated_at, true)}
              </span>
            ),
          },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {list.isFetching || list.isInitialLoading ? <span /> : <p className="text-sm text-muted-foreground">
          Mostrando {list.data.length} de {list.meta?.total ?? list.data.length} {(list.meta?.total ?? list.data.length) === 1 ? 'informe' : 'informes'}
        </p>}
        <CatalogPagination
          label="informes"
          page={list.page}
          lastPage={list.meta?.last_page ?? 1}
          disabled={list.isFetching}
          onChange={list.setPage}
        />
      </div>

      <Dialog
        open={Boolean(readingReport)}
        title={`Informe: ${readingReport?.type ?? ''}`}
        description={readingReport?.subject_name || 'Informe de tutoría'}
        confirmClose={false}
        onClose={() => setReadingReport(null)}
        maxWidth={readingStructured ? 'max-w-5xl' : 'max-w-2xl'}
      >
        {readingReport && (
          <div className="flex min-w-0 flex-col gap-5">
            <article aria-label="Contenido del informe" className="flex max-h-[60vh] min-w-0 flex-col gap-5 overflow-y-auto">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Autor</dt>
                  <dd className="text-foreground">{readingReport.author_name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Fecha de generación</dt>
                  <dd className="text-foreground">{formatDate(readingReport.generated_at, true)}</dd>
                </div>
              </dl>
              {readingStructured ? (
                <StructuredReport summary={readingReport.summary} />
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere] text-foreground">
                  {readingReport.content}
                </p>
              )}
            </article>
            <div className="flex flex-wrap justify-end gap-3">
              {readingStructured && <PrintStructuredReport summary={readingReport.summary} />}
              <Button type="button" variant="secondary" onClick={() => setReadingReport(null)}>
                Cerrar informe
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  )
}
