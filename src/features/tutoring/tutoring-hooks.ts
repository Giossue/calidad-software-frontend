import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { ApiError, type AcademicPeriod, type Career, type Cycle, type Modality, type Section } from '@/lib/api'
import { tutoringApi } from '@/lib/tutoring-api'

export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.firstValidationMessage ?? error.message
  return 'No fue posible conectar con el servidor. Intenta nuevamente.'
}

export function useOperation() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)
  async function run(action: () => Promise<unknown>, success: string, onSuccess?: () => void | Promise<unknown>) {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setError(null)
    try {
      await action()
      toast.success(success)
      await onSuccess?.()
    } catch (caught) {
      const message = describeError(caught)
      setError(message)
      toast.error(message)
    } finally {
      busy.current = false
      setPending(false)
    }
  }
  return { pending, error, clearError: () => setError(null), run }
}

export function useTutoringCatalogs() {
  const [careers, setCareers] = useState<readonly Career[]>([])
  const [cycles, setCycles] = useState<readonly Cycle[]>([])
  const [periods, setPeriods] = useState<readonly AcademicPeriod[]>([])
  const [modalities, setModalities] = useState<readonly Modality[]>([])
  const [sections, setSections] = useState<readonly Section[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let cancelled = false
    Promise.all([
      tutoringApi.careers(),
      tutoringApi.cycles(),
      tutoringApi.periods(),
      tutoringApi.modalities(),
      Promise.resolve(tutoringApi.sections?.() ?? []).catch(() => []),
    ])
      .then(([nextCareers, nextCycles, nextPeriods, nextModalities, nextSections]) => {
        if (cancelled) return
        setCareers(nextCareers)
        setCycles(nextCycles)
        setPeriods(nextPeriods)
        setModalities(nextModalities)
        setSections(nextSections ?? [])
      })
      .catch((caught: unknown) => { if (!cancelled) setError(describeError(caught)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [revision])
  return { careers, cycles, periods, modalities, sections, loading, error, reload: useCallback(() => { setLoading(true); setError(null); setRevision((value) => value + 1) }, []) }
}

export type TutoringCatalogs = ReturnType<typeof useTutoringCatalogs>
