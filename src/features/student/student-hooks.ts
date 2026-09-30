import { useState } from 'react'

export function usePagedList<T>(items: readonly T[], size = 5) {
  const [requested, setPage] = useState(1)
  const lastPage = Math.max(1, Math.ceil(items.length / size))
  const page = Math.min(requested, lastPage)
  const start = (page - 1) * size
  return { page, lastPage, setPage, start, rows: items.slice(start, start + size) }
}
