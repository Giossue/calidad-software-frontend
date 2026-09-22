export type AccessibilitySettings = {
  darkMode: boolean
  fontSize: 'normal' | 'large'
  highContrast: boolean
  reduceMotion: boolean
}

const STORAGE_KEY = 'sistema_calidad_accessibility'

export function getStoredAccessibility(): AccessibilitySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AccessibilitySettings>
      return {
        darkMode: typeof parsed.darkMode === 'boolean' ? parsed.darkMode : document.documentElement.classList.contains('dark'),
        fontSize: parsed.fontSize === 'large' ? 'large' : 'normal',
        highContrast: Boolean(parsed.highContrast),
        reduceMotion: Boolean(parsed.reduceMotion),
      }
    }
  } catch {
    // Fallback if localStorage is inaccessible or corrupt
  }

  return {
    darkMode: document.documentElement.classList.contains('dark'),
    fontSize: 'normal',
    highContrast: false,
    reduceMotion: false,
  }
}

export function applyAccessibilitySettings(settings: AccessibilitySettings): void {
  const root = document.documentElement

  // 1. Dark Mode
  if (settings.darkMode) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  // 2. Font Size Scaling
  if (settings.fontSize === 'large') {
    root.classList.add('text-scale-large')
    root.style.fontSize = '118%'
  } else {
    root.classList.remove('text-scale-large')
    root.style.fontSize = '100%'
  }

  // 3. High Contrast
  if (settings.highContrast) {
    root.classList.add('high-contrast')
  } else {
    root.classList.remove('high-contrast')
  }

  // 4. Reduce Motion
  if (settings.reduceMotion) {
    root.classList.add('reduce-motion')
  } else {
    root.classList.remove('reduce-motion')
  }
}

export function saveAccessibilitySettings(settings: AccessibilitySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (err) {
    console.error('Failed to save accessibility settings:', err)
  }
  applyAccessibilitySettings(settings)
}
