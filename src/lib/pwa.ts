import { useEffect, useState } from 'react'

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    listeners.forEach((listener) => listener())
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    listeners.forEach((listener) => listener())
  })
}

export function registerServiceWorker() {
  if (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Ignorar en entornos de prueba o sin soporte
      })
    })
  }
}

export function usePwaInstall() {
  const [, setTick] = useState(0)

  useEffect(() => {
    const onChange = () => setTick((t) => t + 1)
    listeners.add(onChange)
    return () => {
      listeners.delete(onChange)
    }
  }, [])

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true)

  const canPrompt = !!deferredPrompt

  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) return false
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        deferredPrompt = null
        listeners.forEach((listener) => listener())
        return true
      }
      return false
    } catch {
      return false
    }
  }

  return {
    isInstalled: isStandalone,
    canPrompt,
    promptInstall,
  }
}

export function downloadDesktopShortcut() {
  if (typeof window === 'undefined') return
  const origin = window.location.origin
  const iconUrl = `${origin}/favicon.ico`
  const fileContent = `[InternetShortcut]\r\nURL=${origin}\r\nIconFile=${iconUrl}\r\nIconIndex=0\r\nHotKey=0\r\n`
  const blob = new Blob([fileContent], { type: 'application/x-mswinurl' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'Sistema_Tutorias_UEB.url'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
