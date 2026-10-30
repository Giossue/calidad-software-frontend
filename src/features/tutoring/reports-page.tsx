import { useState } from 'react'
import { FileTextIcon } from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ErrorNotice } from '@/components/ui/error-notice'
import { IconAction } from '@/components/ui/icon-action'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PrintStructuredReport, StructuredReport } from '@/features/reports/structured-report'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { isStructuredReport } from '@/lib/structured-report'
import { tutoringApi, type TutoringReport, type TutoringReportMeta } from '@/lib/tutoring-api'
import { CareerBreadcrumb, CareerPicker, useSelectedCareer } from './career-picker'
import { FilterBar } from './filter-bar'
import { ModuleHeader, RecordTable } from './tutoring-shared'
import { useTutoringCatalogs } from './tutoring-hooks'

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

  return <CareerPicker catalogs={catalogs} title="Informes" rowTitle={(career) => `Ver informes de ${career.name}`} onSelect={(career) => selection.select(career.id)} />
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

  return (
    <section className="flex flex-col gap-6">
      <CareerBreadcrumb root="Informes" career={careerName} onBack={onBack} />
      <ModuleHeader
        title={careerName}
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
            allLabel: 'Todos',
            options: cycleLevels.map((level) => ({ value: String(level.number), label: `${level.number}° ${level.name}` })),
          },
        ]}
      />

      <ErrorNotice message={list.error} retry={list.reload} />

      <RecordTable
        rows={list.data}
        loading={list.isFetching || list.isInitialLoading}
        empty={
          <Empty className="border-none p-6">
            <EmptyMedia variant="icon"><FileTextIcon /></EmptyMedia>
            <EmptyTitle>No hay informes registrados</EmptyTitle>
            <EmptyDescription>
              Los informes académicos registrados por los docentes en las tutorías aparecerán aquí.
            </EmptyDescription>
          </Empty>
        }
        onRowClick={(report) => { if (report.content) setReadingReport(report) }}
        rowTitle={(report) => report.content ? `Leer informe ${report.type}` : ''}
        isRowSelected={(report) => readingReport?.id === report.id}
        columns={[
          {
            label: 'Asignatura / Tutoría',
            render: (report: TutoringReport) => (
              <div className="flex flex-col gap-1 items-start">
                <span className="font-medium text-foreground">
                  {report.subject_name || `Tutoría #${report.tutoring_id ?? report.id}`}
                </span>
                <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                  {report.career_name && <span>{report.career_name}</span>}
                  {report.cycle_name && <span>· {report.cycle_name}</span>}
                  {report.section_name && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      Paralelo {report.section_name}
                    </Badge>
                  )}
                </div>
              </div>
            ),
          },
          {
            label: 'Tipo de informe',
            render: (report: TutoringReport) => (
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground">{report.type}</span>
                <span className="text-xs text-muted-foreground">Informe #{report.id}</span>
              </div>
            ),
          },
          {
            label: 'Docente (Autor)',
            render: (report: TutoringReport) => (
              <span className="text-sm">{report.author_name || 'Docente'}</span>
            ),
          },
          {
            label: 'Fecha de generación',
            render: (report: TutoringReport) => (
              <span className="text-sm text-muted-foreground">
                {formatDate(report.generated_at, true)}
              </span>
            ),
          },
          {
            label: 'Acciones',
            render: (report: TutoringReport) =>
              report.content ? (
                <IconAction label="Leer informe" icon={FileTextIcon} onClick={() => setReadingReport(report)} />
              ) : (
                <span className="text-xs text-muted-foreground">Sin contenido adjunto</span>
              ),
          },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Mostrando {list.data.length} de {list.meta?.total ?? list.data.length} {(list.meta?.total ?? list.data.length) === 1 ? 'informe' : 'informes'}
        </p>
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
                <div className="rounded-lg border bg-muted/20 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere] text-foreground">
                    {readingReport.content}
                  </p>
                </div>
              )}
            </article>
            <div className="flex flex-wrap justify-end gap-3 pt-2 border-t">
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
