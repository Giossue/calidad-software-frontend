import { useState } from 'react'

import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { StatusBadge } from '@/components/ui/status-badge'
import type { Career } from '@/lib/api'
import { FilterBar } from './filter-bar'
import { ModuleHeader, RecordTable, ScopeNotice } from './tutoring-shared'
import type { useTutoringCatalogs } from './tutoring-hooks'

const CAREERS_PER_PAGE = 10

type Catalogs = ReturnType<typeof useTutoringCatalogs>

/**
 * Selección de carrera previa a los módulos del coordinador. Con una sola
 * carrera no hay nada que elegir: se entra directo a ella.
 */
export function useSelectedCareer(careers: readonly Career[]) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const single = careers.length === 1
  const explicit = careers.find((career) => career.id === selectedId)
  const career = explicit ?? (single ? careers[0] : undefined)
  return { career, canChange: !single, select: (id: number) => setSelectedId(id), clear: () => setSelectedId(null) }
}

export function CareerPicker({ catalogs, title, description, rowTitle, onSelect }: Readonly<{
  catalogs: Catalogs
  title: string
  description: string
  rowTitle: (career: Career) => string
  onSelect: (career: Career) => void
}>) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const filtered = catalogs.careers.filter((career) => career.name.toLowerCase().includes(search.trim().toLowerCase()))
  const lastPage = Math.max(1, Math.ceil(filtered.length / CAREERS_PER_PAGE))
  const offset = (Math.min(page, lastPage) - 1) * CAREERS_PER_PAGE
  const rows = filtered.slice(offset, offset + CAREERS_PER_PAGE)

  return <section className="flex flex-col gap-6">
    <ModuleHeader title={title} description={description} />
    <ScopeNotice catalogs={catalogs} />
    <FilterBar id="career-picker" search={search} onSearch={(value) => { setSearch(value); setPage(1) }} searchLabel="Buscar carrera" searchPlaceholder="Busca por nombre de carrera…" filters={[]} onClear={() => { setSearch(''); setPage(1) }} />
    {catalogs.careers.length > 0 && <RecordTable
      rows={rows}
      loading={catalogs.loading}
      onRowClick={onSelect}
      rowTitle={rowTitle}
      empty="No se encontraron carreras para esta búsqueda."
      columns={[
        { label: 'Carrera', render: (career) => <div className="flex flex-col gap-0.5"><span className="font-medium text-foreground">{career.name}</span>{career.modality_name && <span className="text-xs text-muted-foreground">{career.modality_name}</span>}</div> },
        { label: 'Facultad', render: (career) => career.faculty_name ?? '—' },
        { label: 'Ciclos', render: (career) => career.cycle_levels > 0 ? `${career.cycle_levels} ciclos` : '—' },
        { label: 'Estado', render: (career) => <StatusBadge active={career.status} activeLabel="Activa" inactiveLabel="Inactiva" /> },
      ]}
    />}
    {catalogs.careers.length > 0 && !catalogs.loading && <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Mostrando {rows.length} de {filtered.length} {filtered.length === 1 ? 'carrera' : 'carreras'}
      </p>
      <CatalogPagination label="carreras" page={Math.min(page, lastPage)} lastPage={lastPage} disabled={false} onChange={setPage} />
    </div>}
  </section>
}

export function CareerBreadcrumb({ root, career, onBack }: Readonly<{ root: string; career: string; onBack?: () => void }>) {
  if (!onBack) return null
  return <nav aria-label="Ruta" className="-mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
    <button type="button" onClick={onBack} className="cursor-pointer rounded-sm hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">{root}</button>
    <span aria-hidden="true">/</span>
    <span className="text-foreground" aria-current="page">{career}</span>
  </nav>
}
