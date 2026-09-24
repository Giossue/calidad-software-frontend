import { useState, type MouseEvent } from 'react'
import { MoonIcon, SunIcon } from 'lucide-react'

import { getStoredAccessibility, saveAccessibilitySettings } from '@/lib/accessibility'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: Readonly<{ className?: string }>) {
  const [isDark, setIsDark] = useState(() => getStoredAccessibility().darkMode)

  function applyTheme() {
    const current = getStoredAccessibility()
    const next = { ...current, darkMode: !current.darkMode }
    saveAccessibilitySettings(next)
    setIsDark(next.darkMode)
  }

  function toggle(event: MouseEvent<HTMLButtonElement>) {
    const reduceMotion = getStoredAccessibility().reduceMotion
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

    const transition = document.startViewTransition(() => applyTheme())

    void transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] },
        { duration: 500, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' },
      )
    })
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
