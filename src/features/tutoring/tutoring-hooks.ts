import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '@/lib/toast'

import { getFriendlyError, type FriendlyErrorInfo } from '@/components/ui/error-modal'
import { isFormDialogOpen } from '@/components/ui/form-dialog'
import { ApiError, type AcademicPeriod, type Career, type Cycle, type Modality, type Section } from '@/lib/api'
import { tutoringApi } from '@/lib/tutoring-api'

export function describeError(error: unknown): string {
  const friendly = getFriendlyError(error)
  return friendly.description
}

/**
 * Campo que rechazó el servidor: el que reconoce el mensaje amigable o, si no, la primera
 * clave de los errores de validación (p. ej. `teacher_id`, `cycle_id`).
 */
export function errorFieldOf(caught: unknown, friendlyField?: string): string | undefined {
  if (friendlyField) return friendlyField
  return caught instanceof ApiError ? Object.keys(caught.payload.errors ?? {})[0] : undefined
}

export function useOperation() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorModal, setErrorModal] = useState<FriendlyErrorInfo | null>(null)
  const busy = useRef(false)

  async function run(action: () => Promise<unknown>, success: string, onSuccess?: () => void | Promise<unknown>) {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setError(null)
    setErrorModal(null)
    try {
      await action()
      toast.success(success)
      await onSuccess?.()
    } catch (caught) {
      const friendly = getFriendlyError(caught)
      const field = errorFieldOf(caught, friendly.field)
      setError(friendly.description)
      setErrorModal(field ? { ...friendly, field } : friendly)
      if (!isFormDialogOpen()) toast.error(friendly.title, { description: friendly.description })
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  return {
    pending,
    error,
    errorModal,
    clearError: () => {
      setError(null)
      setErrorModal(null)
    },
    clearErrorModal: () => setErrorModal(null),
    /** Error del servidor de uno de estos campos, para mostrarlo bajo el campo (o null). */
    fieldError: (...fields: readonly string[]) => (errorModal?.field && fields.includes(errorModal.field) ? error : null),
    run,
  }
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
