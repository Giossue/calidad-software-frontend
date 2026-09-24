import { useRef, useState, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { MoonIcon, SunIcon } from 'lucide-react'

import { getStoredAccessibility, saveAccessibilitySettings } from '@/lib/accessibility'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: Readonly<{ className?: string }>) {
  const [isDark, setIsDark] = useState(() => getStoredAccessibility().darkMode)
  const isTransitioning = useRef(false)

  function applyTheme() {
    const current = getStoredAccessibility()
    const next = { ...current, darkMode: !current.darkMode }
    saveAccessibilitySettings(next)
    setIsDark(next.darkMode)
  }

  function toggle(event: MouseEvent<HTMLButtonElement>) {
    if (isTransitioning.current) return

    const reduceMotion =
      getStoredAccessibility().reduceMotion ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduceMotion || !document.startViewTransition) {
      applyTheme()
      return
    }

    const { left, top, width, height } = event.currentTarget.getBoundingClientRect()
    const x = left + width / 2
    const y = top + height / 2
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    )

    const root = document.documentElement
    // El pseudo-elemento nuevo nace ya recortado desde CSS. De esta forma no
    // puede mostrarse a pantalla completa mientras transition.ready resuelve.
    root.style.setProperty('--vt-x', `${x}px`)
    root.style.setProperty('--vt-y', `${y}px`)
    isTransitioning.current = true

    const transition = document.startViewTransition(() => flushSync(() => applyTheme()))

    void transition.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] },
        {
          duration: 500,
          easing: 'ease-in-out',
          fill: 'forwards',
          pseudoElement: '::view-transition-new(root)',
        },
      )
    })

    void transition.finished.then(
      () => {
        isTransitioning.current = false
      },
      () => {
        isTransitioning.current = false
      },
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
      className={cn(
        'relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-card text-muted-foreground shadow-2xs transition-colors hover:bg-muted',
        className,
      )}
    >
      <SunIcon
        className={cn(
          'absolute size-4 transition-all duration-300 ease-out',
          isDark ? '-rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100',
        )}
      />
      <MoonIcon
        className={cn(
          'absolute size-4 transition-all duration-300 ease-out',
          isDark ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0',
        )}
      />
    </button>
  )
}
