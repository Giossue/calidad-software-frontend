import { useEffect, useState } from 'react'
import {
  CheckIcon,
  EyeIcon,
  SaveIcon,
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

  const saved = getStoredAccessibility()
  const dirty = (Object.keys(settings) as (keyof AccessibilitySettings)[]).some((key) => settings[key] !== saved[key])

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
      confirmClose={dirty}
      title="Configuración de Accesibilidad"
      description="Personaliza la apariencia, tamaño de texto y contraste del sistema en tiempo real."
      maxWidth="max-w-lg"
    >
      <div className="flex flex-col gap-5">
        {/* Tamaño de Texto */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <TypeIcon className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">Tamaño de Texto</span>
              <span className="text-xs text-muted-foreground">Escala de lectura global (+18%)</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={settings.fontSize === 'normal' ? 'primary' : 'secondary'}
              aria-pressed={settings.fontSize === 'normal'}
              onClick={() => updateSetting('fontSize', 'normal')}
            >
              {settings.fontSize === 'normal' && <CheckIcon data-icon="inline-start" />}
              Normal
            </Button>
            <Button
              type="button"
              size="sm"
              variant={settings.fontSize === 'large' ? 'primary' : 'secondary'}
              aria-pressed={settings.fontSize === 'large'}
              onClick={() => updateSetting('fontSize', 'large')}
            >
              {settings.fontSize === 'large' && <CheckIcon data-icon="inline-start" />}
              Grande
            </Button>
          </div>
        </div>

        {/* Alto Contraste */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <EyeIcon className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">Alto Contraste</span>
              <span className="text-xs text-muted-foreground">Realce de bordes, enfoque y diferenciación visual</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateSetting('highContrast', !settings.highContrast)}
            role="switch"
            aria-checked={settings.highContrast}
            className={`relative inline-flex h-6 w-11 items-center rounded-full outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
              settings.highContrast ? 'bg-primary' : 'bg-input'
            }`}
            aria-label="Conmutar Alto Contraste"
          >
            <span
              className={`inline-block size-4 transform rounded-full bg-background transition-transform ${
                settings.highContrast ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Reducción de Animaciones */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ZapIcon className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">Reducir Movimiento</span>
              <span className="text-xs text-muted-foreground">Desactiva transiciones y animaciones</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateSetting('reduceMotion', !settings.reduceMotion)}
            role="switch"
            aria-checked={settings.reduceMotion}
            className={`relative inline-flex h-6 w-11 items-center rounded-full outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
              settings.reduceMotion ? 'bg-primary' : 'bg-input'
            }`}
            aria-label="Conmutar Reducción de Movimiento"
          >
            <span
              className={`inline-block size-4 transform rounded-full bg-background transition-transform ${
                settings.reduceMotion ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
          <DialogCancelButton onClick={handleCancel}>
            Cancelar
          </DialogCancelButton>
          <Button onClick={handleSave}>
            <SaveIcon data-icon="inline-start" />
            Guardar Ajustes
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
