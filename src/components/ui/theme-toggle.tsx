import { useState } from 'react'
import { MoonIcon, SunIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getStoredAccessibility, saveAccessibilitySettings } from '@/lib/accessibility'
import { cn } from '@/lib/utils'

/** Alterna entre modo claro y oscuro; el cambio es inmediato, sin animación. */
export function useThemeToggle() {
  const [isDark, setIsDark] = useState(() => getStoredAccessibility().darkMode)

  function toggle() {
    const current = getStoredAccessibility()
    const next = { ...current, darkMode: !current.darkMode }
    saveAccessibilitySettings(next)
    setIsDark(next.darkMode)
  }

  return { isDark, toggle }
}

export function ThemeToggle({ className }: Readonly<{ className?: string }>) {
  const { isDark, toggle } = useThemeToggle()

  return (
    <Button
      type="button"
      variant="tertiary"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
      className={cn('relative overflow-hidden', className)}
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
    </Button>
  )
}
