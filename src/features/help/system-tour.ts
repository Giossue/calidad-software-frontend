import { driver, type DriveStep, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'

/**
 * Inicia el tutorial. `onFinish` se llama una sola vez cuando el recorrido termina,
 * ya sea completado o cerrado (botón, Escape o clic fuera).
 */
export function startSystemTour(steps: DriveStep[], onFinish?: () => void): Driver {
  const tour = driver({
    steps,
    showProgress: true,
    progressText: '{{current}} de {{total}}',
    nextBtnText: 'Siguiente',
    prevBtnText: 'Anterior',
    doneBtnText: 'Entendido',
    closeBtnLabel: 'Cerrar tutorial',
    popoverClass: 'system-tour',
    stagePadding: 6,
    stageRadius: 8,
    allowKeyboardControl: true,
    smoothScroll: true,
    onDestroyed: () => onFinish?.(),
  })
  tour.drive()
  return tour
}
