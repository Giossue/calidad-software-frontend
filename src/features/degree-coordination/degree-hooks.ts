export { useDetailParam } from '@/hooks/use-detail-param'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError } from '@/lib/api'
import { degreeCoordinationApi } from '@/lib/degree-coordination-api'
import { describeError } from '@/features/tutoring/tutoring-hooks'

export function useDegreeResource<T>(loader: () => Promise<T>, key = 'default') {
  const [revision, setRevision] = useState(0)
  const requestKey = `${key}:${revision}`
  const [result, setResult] = useState<{ key: string; data: T | null; error: string | null; status: number | null }>({ key: '', data: null, error: null, status: null })
  // Último dato recibido (de cualquier clave): al recargar, buscar o cambiar de página la
  // pantalla lo sigue mostrando y solo las filas se ven cargando.
  const [last, setLast] = useState<T | null>(null)
  const loaderRef = useRef(loader)
  useEffect(() => { loaderRef.current = loader })
  useEffect(() => {
    let cancelled = false
    void Promise.resolve().then(() => loaderRef.current()).then((data) => {
      if (cancelled) return
      setResult({ key: requestKey, data, error: null, status: null })
      setLast(data)
    }).catch((caught: unknown) => {
      if (!cancelled) setResult({ key: requestKey, data: null, error: describeError(caught), status: caught instanceof ApiError ? caught.status : null })
    })
    return () => { cancelled = true }
  }, [requestKey])
  const current = result.key === requestKey
  return {
    data: current ? result.data : null,
    error: current ? result.error : null,
    status: current ? result.status : null,
    loading: !current,
    /** Ya terminó al menos una consulta (con datos o con error): lo que carga después es una recarga. */
    settled: result.key !== '',
    /** El último dato recibido, aunque ahora se esté recargando con otra clave (página, búsqueda). */
    previous: last,
    reload: useCallback(() => setRevision((value) => value + 1), []),
  }
}

export function useDegreePeriod() {
  return useDegreeResource(async () => {
    const [period, sections] = await Promise.all([degreeCoordinationApi.currentPeriod(), degreeCoordinationApi.sections()])
    return { period, sections }
  })
}

export function useDegreeSearch() {
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(input.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [input])
  return { input, setInput, search }
}

