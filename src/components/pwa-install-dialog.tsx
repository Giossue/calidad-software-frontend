import { useState } from 'react'
import {
  CheckCircle2Icon,
  DownloadIcon,
  MonitorDownIcon,
  SparklesIcon,
  LaptopIcon,
  SmartphoneIcon,
  ShareIcon,
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

  const isIos =
    typeof window !== 'undefined' &&
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !(window as any).MSStream

  const isMobile =
    typeof window !== 'undefined' &&
    /android|iphone|ipad|ipod/i.test(navigator.userAgent)

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
      title={isMobile ? 'Instalar en el Teléfono' : 'Acceso directo en el Escritorio'}
      description={
        isMobile
          ? 'Añade el Sistema a la pantalla principal de tu celular para abrirlo como una aplicación con su icono oficial.'
          : 'Añade el Sistema de Tutorías y Titulación a tu escritorio para ingresar rápidamente con un solo clic.'
      }
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
              <CheckCircle2Icon className="size-3" /> Icono oficial para escritorio y móvil
            </span>
          </div>
        </div>

        {/* Ventajas */}
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-start gap-2.5">
            {isMobile ? (
              <SmartphoneIcon className="size-4 shrink-0 text-brand-blue mt-0.5" />
            ) : (
              <MonitorDownIcon className="size-4 shrink-0 text-brand-blue mt-0.5" />
            )}
            <span>
              <strong className="text-foreground">
                {isMobile ? 'Acceso rápido en tu celular:' : 'Acceso directo en el Escritorio:'}
              </strong>{' '}
              {isMobile
                ? 'Se crea el icono en la pantalla de inicio de tu teléfono, junto a tus demás aplicaciones.'
                : 'Inicia el sistema directamente sin tener que escribir la dirección web.'}
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <SparklesIcon className="size-4 shrink-0 text-brand-blue mt-0.5" />
            <span>
              <strong className="text-foreground">Pantalla completa:</strong> Se abre en su propia ventana sin barras molestas del navegador.
            </span>
          </div>
        </div>

        {/* Acciones principales */}
        <div className="flex flex-col gap-3 pt-2">
          {isInstalled ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2Icon className="size-4 shrink-0" />
              <span>
                {isMobile
                  ? 'La aplicación ya está instalada en tu teléfono. Puedes abrirla desde tu pantalla de inicio.'
                  : 'La aplicación ya se encuentra instalada en tu equipo. Puedes abrirla desde tu Escritorio o Menú Inicio.'}
              </span>
            </div>
          ) : canPrompt ? (
            <Button
              type="button"
              variant="default"
              className="w-full h-11 text-sm font-semibold gap-2 shadow-sm"
              onClick={handleInstallClick}
              disabled={installing}
            >
              {isMobile ? <SmartphoneIcon className="size-4" /> : <MonitorDownIcon className="size-4" />}
              {installing
                ? 'Instalando...'
                : isMobile
                  ? 'Agregar a la pantalla principal'
                  : 'Instalar en el Escritorio ahora'}
            </Button>
          ) : isIos ? (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <ShareIcon className="size-4 text-brand-blue" />
                <span>Cómo instalar en iPhone / iPad:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-700 dark:text-slate-300">
                <li>Toca el botón <strong>Compartir</strong> en la barra de Safari.</li>
                <li>Desplázate hacia abajo y selecciona <strong>"Agregar a pantalla de inicio"</strong>.</li>
                <li>Toca <strong>Agregar</strong> en la esquina superior derecha.</li>
              </ol>
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                {isMobile ? (
                  <SmartphoneIcon className="size-4 text-brand-blue" />
                ) : (
                  <LaptopIcon className="size-4 text-brand-blue" />
                )}
                <span>Instalación desde tu navegador:</span>
              </div>
              {isMobile ? (
                <p>
                  En <strong>Google Chrome</strong> en tu celular, toca el menú de los tres puntos <strong>(⋮)</strong> en la esquina superior y selecciona <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.
                </p>
              ) : (
                <p>
                  En <strong>Google Chrome</strong> o <strong>Microsoft Edge</strong>, haz clic en el icono de instalación (💻 o ⊕) ubicado en el extremo derecho de la barra de direcciones de tu navegador, o ve al menú <strong>(⋮) &gt; Instalar aplicación</strong>.
                </p>
              )}
            </div>
          )}

          {/* Opción de descarga directa de archivo .url con icono (principalmente para computadoras) */}
          {!isMobile && (
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
          )}
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
