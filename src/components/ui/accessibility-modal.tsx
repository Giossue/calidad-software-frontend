import { useEffect, useState } from 'react'
import { CheckIcon } from 'lucide-react'
import { toast } from '@/lib/toast'

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
    toast.success('Preferencias guardadas')
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
      title="Accesibilidad"
      description="Los cambios se ven al instante."
      maxWidth="max-w-lg"
    >
      <div className="flex flex-col">
        <div className="divide-y divide-border">
          <SettingRow label="Tamaño del texto" hint="Agranda todo el texto un 18 %.">
            <div className="flex items-center gap-2" role="group" aria-label="Tamaño del texto">
              <Button type="button" size="sm" variant={settings.fontSize === 'normal' ? 'primary' : 'secondary'} aria-pressed={settings.fontSize === 'normal'} onClick={() => updateSetting('fontSize', 'normal')}>
                Normal
              </Button>
              <Button type="button" size="sm" variant={settings.fontSize === 'large' ? 'primary' : 'secondary'} aria-pressed={settings.fontSize === 'large'} onClick={() => updateSetting('fontSize', 'large')}>
                Grande
              </Button>
            </div>
          </SettingRow>
          <SettingRow label="Alto contraste" hint="Realza bordes, enfoque y texto.">
            <Switch checked={settings.highContrast} label="Alto contraste" onChange={(value) => updateSetting('highContrast', value)} />
          </SettingRow>
          <SettingRow label="Reducir movimiento" hint="Quita transiciones y animaciones.">
            <Switch checked={settings.reduceMotion} label="Reducir movimiento" onChange={(value) => updateSetting('reduceMotion', value)} />
          </SettingRow>
        </div>

        <div className="sticky -bottom-6 -mx-6 -mb-6 mt-4 flex flex-col-reverse gap-2 border-t bg-card p-4 sm:flex-row sm:justify-end">
          <DialogCancelButton onClick={handleCancel}>Cancelar</DialogCancelButton>
          <Button onClick={handleSave}>
            <CheckIcon data-icon="inline-start" />
            Guardar preferencias
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

/** Una preferencia: nombre, una línea de qué hace y su control, sin recuadros. */
function SettingRow({ label, hint, children }: Readonly<{ label: string; hint: string; children: React.ReactNode }>) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">{hint}</span>
      </div>
      {children}
    </div>
  )
}

function Switch({ checked, label, onChange }: Readonly<{ checked: boolean; label: string; onChange: (value: boolean) => void }>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full outline-hidden transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 ${checked ? 'bg-primary' : 'bg-input'}`}
    >
      <span className={`inline-block size-4 rounded-full bg-background transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}
