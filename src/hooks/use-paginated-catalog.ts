import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError, type PaginatedResourceCollection, type PaginationMeta } from '@/lib/api'

function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.firstValidationMessage ?? error.message
  return 'No fue posible conectar con el servidor.'
}

const SEARCH_DEBOUNCE_MS = 400

export function usePaginatedCatalog<T, M extends PaginationMeta = PaginationMeta>(
  fetcher: (page: number, search: string) => Promise<PaginatedResourceCollection<T, M>>,
  // Representación en texto de cualquier filtro adicional (ej. un rol). Al cambiar,
  // vuelve a la página 1 y dispara una nueva consulta, igual que la búsqueda.
  filterKey = '',
) {
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [data, setData] = useState<readonly T[]>([])
  const [meta, setMeta] = useState<M | null>(null)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  })
  const requestIdRef = useRef(0)

  const load = useCallback(async (targetPage: number, targetSearch: string): Promise<boolean> => {
    const requestId = ++requestIdRef.current
    setIsFetching(true)
    setError(null)
    try {
      const response = await fetcherRef.current(targetPage, targetSearch)
      if (requestId !== requestIdRef.current) return false
      setData(response.data)
      setMeta(response.meta ?? null)
      return true
    } catch (caught: unknown) {
      if (requestId !== requestIdRef.current) return false
      setError(describeError(caught))
      return false
    } finally {
      if (requestId === requestIdRef.current) {
        setIsFetching(false)
        setIsInitialLoading(false)
      }
    }
  }, [])

  // Espera a que el usuario deje de escribir antes de disparar la búsqueda en el backend.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const previousFilterKeyRef = useRef(filterKey)
  useEffect(() => {
    if (previousFilterKeyRef.current !== filterKey) {
      previousFilterKeyRef.current = filterKey
      setPage(1)
    }
  }, [filterKey])

  useEffect(() => {
    void load(page, search)
  }, [page, search, filterKey, load])

  return {
    data,
    meta,
    page,
    setPage,
    searchInput,
    setSearchInput,
    isInitialLoading,
    isFetching,
    error,
    reload: () => load(page, search),
  }
}
