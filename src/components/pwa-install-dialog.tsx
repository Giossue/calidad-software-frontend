import { useState } from 'react'
import {
  CheckCircle2Icon,
  DownloadIcon,
  MonitorDownIcon,
  SparklesIcon,
  LaptopIcon,
  InfoIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { downloadDesktopShortcut, usePwaInstall } from '@/lib/pwa'

interface PwaInstallDialogProps {
  open: boolean
  onClose: () => void
}

export function PwaInstallDialog({ open, onClose }: PwaInstallDialogProps) {
  const { isInstalled, canPrompt, promptInstall } = usePwaInstall()
  const [downloaded, setDownloaded] = useState(false)
  const [installing, setInstalling] = useState(false)

  const handleInstallClick = async () => {
    setInstalling(true)
    try {
      const success = await promptInstall()
      if (success) {
        onClose()
      }
    } finally {
      setInstalling(false)
    }
  }

  const handleDownloadShortcut = () => {
    downloadDesktopShortcut()
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 3000)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Acceso directo en el Escritorio"
      description="Añade el Sistema de Tutorías y Titulación a tu escritorio para ingresar rápidamente con un solo clic."
      maxWidth="max-w-lg"
      confirmClose={false}
    >
      <div className="flex flex-col gap-5 py-2">
        {/* Banner de la aplicación */}
        <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/40 p-4">
          <img
            src="/ueb-logo.png"
            alt="Logo UEB"
            className="size-14 rounded-lg object-contain bg-white p-1 shadow-2xs"
          />
          <div className="flex flex-col">
            <h4 className="text-sm font-bold text-foreground">
              Sistema de Gestión Académica
            </h4>
            <span className="text-xs text-muted-foreground">
              Universidad Estatal de Bolívar
            </span>
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2Icon className="size-3" /> Con icono oficial (.ico)
            </span>
          </div>
        </div>

        {/* Ventajas */}
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-start gap-2.5">
            <MonitorDownIcon className="size-4 shrink-0 text-brand-blue mt-0.5" />
            <span>
              <strong className="text-foreground">Acceso directo en el Escritorio:</strong> Inicia el sistema directamente sin tener que escribir la dirección web.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <SparklesIcon className="size-4 shrink-0 text-brand-blue mt-0.5" />
            <span>
              <strong className="text-foreground">Ventana independiente:</strong> Se abre como una aplicación de escritorio nativa, más rápida y sin barras del navegador.
            </span>
          </div>
        </div>

        {/* Acciones principales */}
        <div className="flex flex-col gap-3 pt-2">
          {isInstalled ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2Icon className="size-4 shrink-0" />
              <span>La aplicación ya se encuentra instalada en tu equipo. Puedes abrirla desde tu Escritorio o Menú Inicio.</span>
            </div>
          ) : canPrompt ? (
            <Button
              type="button"
              variant="default"
              className="w-full h-11 text-sm font-semibold gap-2 shadow-sm"
              onClick={handleInstallClick}
              disabled={installing}
            >
              <MonitorDownIcon className="size-4" />
              {installing ? 'Instalando...' : 'Instalar en el Escritorio ahora'}
            </Button>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <LaptopIcon className="size-4 text-brand-blue" />
                <span>Instalación desde tu navegador:</span>
              </div>
              <p>
                En <strong>Google Chrome</strong> o <strong>Microsoft Edge</strong>, haz clic en el icono de instalación (💻 o ⊕) ubicado en el extremo derecho de la barra de direcciones de tu navegador, o ve al menú <strong>(⋮) &gt; Instalar aplicación</strong>.
              </p>
            </div>
          )}

          {/* Opción de descarga directa de archivo .url con icono */}
          <div className="border-t border-border/60 pt-3">
            <Button
              type="button"
              variant="outline"
              className="w-full text-xs font-medium gap-2 text-muted-foreground hover:text-foreground"
              onClick={handleDownloadShortcut}
            >
              <DownloadIcon className="size-3.5" />
              {downloaded
                ? '¡Acceso directo descargado! Arrástralo a tu Escritorio'
                : 'Descargar archivo de acceso directo (.url para Windows)'}
            </Button>
            <p className="mt-1.5 text-center text-[11px] text-muted-foreground/80 flex items-center justify-center gap-1">
              <InfoIcon className="size-3" /> Incluye el ícono oficial (.ico) del sistema.
            </p>
          </div>
        </div>

        {/* Botón Cerrar */}
        <div className="flex justify-end pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Entendido / Cerrar
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
