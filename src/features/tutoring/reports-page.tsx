import { useState, type ComponentType } from 'react'
import {
  AlertTriangleIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  UsersIcon,
} from 'lucide-react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { tutoringApi, type TutoringReport, type TutoringReportMeta } from '@/lib/tutoring-api'
import { cn } from '@/lib/utils'
import { FilterBar } from './filter-bar'
import { ErrorNotice, ModuleHeader, RecordTable, ScopeNotice } from './tutoring-shared'
import { useTutoringCatalogs } from './tutoring-hooks'

function formatDate(value: string, time = false): string {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'medium',
    ...(time ? { timeStyle: 'short' as const } : {}),
  }).format(date)
}

function StatMiniCard({
  icon: Icon,
  tone,
  label,
  value,
}: Readonly<{
  icon: ComponentType<{ className?: string }>
  tone: 'blue' | 'green' | 'red'
  label: string
  value: number
}>) {
  const toneClass =
    tone === 'blue'
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
      : tone === 'green'
        ? 'bg-success/10 text-success-foreground'
        : 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'

  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', toneClass)}>
          <Icon className="size-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-2xl font-semibold">{value}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export function TutoringReportsPage() {
  const catalogs = useTutoringCatalogs()
  const [careerFilter, setCareerFilter] = useState('')
  const [cycleFilter, setCycleFilter] = useState('')
  const [readingReport, setReadingReport] = useState<TutoringReport | null>(null)

  const list = usePaginatedCatalog<TutoringReport, TutoringReportMeta>(
    (page, search) =>
      tutoringApi.allReports({
        page,
        search,
        career_id: Number(careerFilter) || undefined,
        cycle_id: Number(cycleFilter) || undefined,
      }),
    `${careerFilter}|${cycleFilter}`,
  )

  const onCareerFilterChange = (value: string) => {
    setCareerFilter(value)
    setCycleFilter('')
  }

  const clearFilters = () => {
    list.setSearchInput('')
    setCareerFilter('')
    setCycleFilter('')
  }

  const cycleFilterOptions = careerFilter
    ? catalogs.cycles.filter((cycle) => cycle.career_id === Number(careerFilter))
    : []

  return (
    <section className="flex flex-col gap-6">
      <ModuleHeader
        title="Informes"
        description="Consulta y supervisa los informes académicos generados por los docentes en las tutorías de tus carreras."
      />
      <ScopeNotice catalogs={catalogs} />

      <FilterBar
        id="tutoring-reports"
        search={list.searchInput}
        onSearch={list.setSearchInput}
        searchPlaceholder="Busca por tipo, contenido, autor o asignatura…"
        onClear={clearFilters}
        filters={[
          {
            id: 'career',
            label: 'Carrera',
            value: careerFilter,
            onChange: onCareerFilterChange,
            allLabel: 'Todas mis carreras',
            options: catalogs.careers.map((career) => ({
              value: String(career.id),
              label: career.name,
            })),
          },
          {
            id: 'cycle',
            label: 'Ciclo',
            value: cycleFilter,
            onChange: setCycleFilter,
            allLabel: careerFilter ? 'Todos los ciclos' : 'Primero selecciona una carrera',
            disabled: !careerFilter,
            disabledReason: 'Selecciona primero una carrera para filtrar por ciclo.',
            options: cycleFilterOptions.map((cycle) => ({
              value: String(cycle.id),
              label: `${cycle.name}${cycle.paralelo_name ? ` · ${cycle.paralelo_name}` : ''}`,
            })),
          },
        ]}
      />

      <ErrorNotice message={list.error} retry={list.reload} />

      {list.meta && !list.error && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatMiniCard
            icon={UsersIcon}
            tone="blue"
            label="Estudiantes atendidos"
            value={list.meta.enrollment_count ?? 0}
          />
          <StatMiniCard
            icon={ClipboardCheckIcon}
            tone="green"
            label="Asistencias registradas"
            value={list.meta.present_count ?? 0}
          />
          <StatMiniCard
            icon={AlertTriangleIcon}
            tone="red"
            label="Ausencias registradas"
            value={list.meta.absent_count ?? 0}
          />
        </div>
      )}

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
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
                    <span className="font-semibold text-foreground">{report.type}</span>
                    <span className="text-xs text-muted-foreground">Informe #{report.id}</span>
                  </div>
                ),
              },
              {
                label: 'Docente (Autor)',
                render: (report: TutoringReport) => (
                  <span className="text-sm font-medium">{report.author_name || 'Docente'}</span>
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
                label: 'Contenido',
                render: (report: TutoringReport) =>
                  report.content ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setReadingReport(report)}
                      className="text-xs gap-1.5 h-8 font-medium"
                    >
                      <FileTextIcon className="size-3.5" />
                      Leer informe
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin contenido adjunto</span>
                  ),
              },
            ]}
          />

          <CatalogPagination
            label="informes"
            page={list.page}
            lastPage={list.meta?.last_page ?? 1}
            disabled={list.isFetching}
            onChange={list.setPage}
          />
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(readingReport)}
        title={`Informe: ${readingReport?.type ?? ''}`}
        description={readingReport?.subject_name || 'Informe de tutoría'}
        confirmClose={false}
        onClose={() => setReadingReport(null)}
        maxWidth="max-w-2xl"
      >
        {readingReport && (
          <div className="flex min-w-0 flex-col gap-5">
            <article aria-label="Contenido del informe" className="flex max-h-[60vh] min-w-0 flex-col gap-5 overflow-y-auto">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Autor</dt>
                  <dd className="font-medium text-foreground">{readingReport.author_name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Fecha de generación</dt>
                  <dd className="font-medium text-foreground">{formatDate(readingReport.generated_at, true)}</dd>
                </div>
              </dl>
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere] text-foreground">
                  {readingReport.content}
                </p>
              </div>
            </article>
            <div className="flex justify-end pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setReadingReport(null)}>
                Cerrar informe
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  )
}
