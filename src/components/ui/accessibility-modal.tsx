import { useEffect, useState } from 'react'
import {
  EyeIcon,
  MoonIcon,
  SunIcon,
  TypeIcon,
  ZapIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import {
  applyAccessibilitySettings,
  getStoredAccessibility,
  saveAccessibilitySettings,
  type AccessibilitySettings,
} from '@/lib/accessibility'

export function AccessibilityModal({
  open,
  onClose,
}: Readonly<{
  open: boolean
  onClose: () => void
}>) {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => getStoredAccessibility())

  // Sincronizar estado cuando el modal se abre
  useEffect(() => {
    if (open) {
      const current = getStoredAccessibility()
      setSettings(current)
      applyAccessibilitySettings(current)
    }
  }, [open])

  // Aplicar inmediatamente en el DOM para previsualización directa
  function updateSetting<K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K],
  ) {
    const nextSettings = { ...settings, [key]: value }
    setSettings(nextSettings)
    applyAccessibilitySettings(nextSettings)
  }

  function handleSave() {
    saveAccessibilitySettings(settings)
    toast.success('Preferencias guardadas', {
      description: 'Se actualizaron y guardaron los ajustes de accesibilidad del sistema.',
    })
    onClose()
  }

  function handleCancel() {
    // Revertir a la configuración guardada previamente
    const saved = getStoredAccessibility()
    applyAccessibilitySettings(saved)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      title="Configuración de Accesibilidad"
      description="Personaliza la apariencia, tamaño de texto y contraste del sistema en tiempo real."
      maxWidth="max-w-lg"
    >
      <div className="flex flex-col gap-5">
        {/* Tema Visual (Oscuro / Claro) */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              {settings.darkMode ? <MoonIcon className="size-5" /> : <SunIcon className="size-5" />}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">Tema Visual</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {settings.darkMode ? 'Modo Oscuro activo' : 'Modo Claro activo'}
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateSetting('darkMode', !settings.darkMode)}
          >
            {settings.darkMode ? <SunIcon data-icon="inline-start" /> : <MoonIcon data-icon="inline-start" />}
            {settings.darkMode ? 'Cambiar a Claro' : 'Cambiar a Oscuro'}
          </Button>
        </div>

        {/* Tamaño de Texto */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <TypeIcon className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">Tamaño de Texto</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Escala de lectura global (+18%)</span>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-2xs dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => updateSetting('fontSize', 'normal')}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                settings.fontSize === 'normal'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => updateSetting('fontSize', 'large')}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                settings.fontSize === 'large'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              Grande
            </button>
          </div>
        </div>

        {/* Alto Contraste */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <EyeIcon className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">Alto Contraste</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Realce de bordes, enfoque y diferenciación visual</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateSetting('highContrast', !settings.highContrast)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.highContrast ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
            aria-label="Conmutar Alto Contraste"
          >
            <span
              className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
                settings.highContrast ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Reducción de Animaciones */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <ZapIcon className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">Reducir Movimiento</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Desactiva transiciones y animaciones</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateSetting('reduceMotion', !settings.reduceMotion)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.reduceMotion ? 'bg-amber-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
            aria-label="Conmutar Reducción de Movimiento"
          >
            <span
              className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
                settings.reduceMotion ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <DialogCancelButton onClick={handleCancel}>
            Cancelar
          </DialogCancelButton>
          <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
            Guardar Ajustes
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
