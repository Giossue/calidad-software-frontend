import { useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Driver, DriveStep } from 'driver.js'

import { useAuth } from '@/features/auth/auth-context'
import { api } from '@/lib/api'
import { buildPageTourSteps, currentPageTourKey, isPageLoading } from './page-tour-runtime'
import { PAGE_TOURS } from './page-tours'
import { startSystemTour } from './system-tour'
import { buildTourSteps } from './tour-steps'

/** Espera a que la pantalla se asiente (datos cargados, vista elegida) antes de abrir una guía. */
const SETTLE_DELAY_MS = 900

export const GENERAL_TOUR = 'general'

/**
 * Tutorial del sistema: el recorrido general se presenta la primera vez que el
 * usuario entra y, después, cada pantalla presenta su guía la primera vez que se
 * visita. Terminar o cerrar una guía cuenta como vista.
 */
export function useSystemTours({ section, moduleIds, menuReady }: Readonly<{ section: string; moduleIds: readonly string[]; menuReady: boolean }>) {
  const { user, replaceUser } = useAuth()
  const [params] = useSearchParams()
  const tourRef = useRef<Driver | null>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const completedRef = useRef(new Set<string>())

  const completedTours = user?.completed_tours
  // Sin `completed_tours` (backend anterior) no se presenta nada automáticamente.
  const autoEnabled = Array.isArray(completedTours) && !user?.must_complete_profile && menuReady

  // El estado más reciente, para los callbacks que corren fuera del render.
  const latest = useRef({ section, params, moduleIds, name: user?.name, autoEnabled })
  useEffect(() => {
    latest.current = { section, params, moduleIds, name: user?.name, autoEnabled }
    completedTours?.forEach((tour) => completedRef.current.add(tour))
  })

  const markDone = useCallback((tour: string) => {
    if (completedRef.current.has(tour)) return
    // Se da por vista en esta sesión aunque falle el registro: si falla, se volverá a presentar en el próximo ingreso.
    completedRef.current.add(tour)
    api.completeTour(tour).then(replaceUser).catch(() => undefined)
  }, [replaceUser])

  const run = useCallback((steps: DriveStep[], tour: string, onFinish?: () => void): boolean => {
    if (tourRef.current?.isActive() || steps.length === 0) return false
    tourRef.current = startSystemTour(steps, () => {
      tourRef.current = null
      markDone(tour)
      onFinish?.()
    })
    return true
  }, [markDone])

  const scheduleCheck = useCallback(function schedule() {
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      const { section: current, params: currentParams, moduleIds: modules, name, autoEnabled: enabled } = latest.current
      if (!enabled || tourRef.current?.isActive()) return
      if (!completedRef.current.has(GENERAL_TOUR)) {
        run(buildTourSteps(modules, name), GENERAL_TOUR, schedule)
        return
      }
      if (isPageLoading()) {
        schedule()
        return
      }
      const key = currentPageTourKey(current, currentParams)
      if (PAGE_TOURS[key] && !completedRef.current.has(key)) run(buildPageTourSteps(key), key)
    }, SETTLE_DELAY_MS)
  }, [run])

  const openGeneralTour = useCallback(() => {
    run(buildTourSteps(latest.current.moduleIds, latest.current.name), GENERAL_TOUR)
  }, [run])

  /** Guía de la pantalla actual; si la pantalla no tiene una, el recorrido general. */
  const openPageTour = useCallback(() => {
    const key = currentPageTourKey(latest.current.section, latest.current.params)
    if (!run(buildPageTourSteps(key), key)) openGeneralTour()
  }, [run, openGeneralTour])

  // Revisa al cambiar de pantalla o de pestaña, y cuando cambia la vista dentro de la pantalla.
  const paramsKey = params.toString()
  useEffect(() => {
    if (autoEnabled) scheduleCheck()
  }, [autoEnabled, section, paramsKey, scheduleCheck])

  useEffect(() => {
    if (!autoEnabled) return
    const content = document.querySelector('main[data-slot="sidebar-inset"]')
    if (!content) return
    const observer = new MutationObserver(scheduleCheck)
    observer.observe(content, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [autoEnabled, scheduleCheck])

  useEffect(() => () => {
    window.clearTimeout(timerRef.current)
    tourRef.current?.destroy()
  }, [])

  return { openPageTour, openGeneralTour }
}
