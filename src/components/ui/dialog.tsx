import { createContext, useContext, useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { Trash2Icon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DialogContextValue {
  requestClose: () => void
}

const DialogContext = createContext<DialogContextValue | null>(null)

export function useDialog() {
  return useContext(DialogContext)
}

export function DialogCancelButton({
  children = 'Cancelar',
  onClick,
  ...props
}: ComponentProps<typeof Button>) {
  const dialog = useDialog()

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={(e) => {
        if (dialog) {
          dialog.requestClose()
        } else if (onClick) {
          onClick(e)
        }
      }}
      {...props}
    >
      {children}
    </Button>
  )
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = 'max-w-2xl',
  confirmClose = false,
  confirmCloseTitle = '¿Descartar los cambios?',
  confirmCloseDescription = '¿Estás seguro de cerrar este formulario? Cualquier información o cambio realizado que no haya sido guardado se perderá por completo.',
  dismissible = true,
  headerActions,
}: Readonly<{
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  maxWidth?: string
  /** Pide confirmación al cerrar. Úsalo solo cuando hay cambios sin guardar. */
  confirmClose?: boolean
  confirmCloseTitle?: string
  confirmCloseDescription?: string
  /** En `false` el modal no puede cerrarse: sin botón de cerrar, clic fuera ni Escape. */
  dismissible?: boolean
  /** Acciones de la cabecera (solo icono), junto al botón de cerrar. */
  headerActions?: ReactNode
}>) {
  const [showConfirm, setShowConfirm] = useState(false)

  // Resetea el diálogo de confirmación cuando el modal se abre o cierra externamente
  useEffect(() => {
    if (!open) {
      setShowConfirm(false)
    }
  }, [open])

  function handleAttemptClose() {
    if (!dismissible) return
    if (confirmClose) {
      setShowConfirm(true)
    } else {
      onClose()
    }
  }

  function handleConfirmDiscard() {
    setShowConfirm(false)
    onClose()
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (showConfirm) {
          setShowConfirm(false)
        } else {
          handleAttemptClose()
        }
      }
    }
    if (open) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, showConfirm, confirmClose, dismissible])

  if (!open) return null

  return (
    <DialogContext.Provider value={{ requestClose: handleAttemptClose }}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        {/* Fondo oscuro, igual que en sílabos */}
        <div
          className="fixed inset-0 bg-black/80 transition-opacity animate-in fade-in"
          onClick={handleAttemptClose}
        />

        {/* Contenedor Modal */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            'relative z-10 flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-lg border bg-card text-card-foreground shadow-modal animate-in fade-in-0 zoom-in-95 duration-200',
            maxWidth,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header del Modal */}
          <div className="flex shrink-0 items-start justify-between border-b border-border px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-1 pr-6">
              <h2 className="text-lg font-semibold leading-tight text-foreground">
                {title}
              </h2>
              {description && (
                <p className="text-sm text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {headerActions}
              {dismissible && (
                <Button type="button" variant="tertiary" size="icon" onClick={handleAttemptClose} aria-label="Cerrar modal">
                  <XIcon />
                </Button>
              )}
            </div>
          </div>

          {/* Cuerpo del Modal */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-4 sm:p-6">{children}</div>

          {/* Modal de confirmación emergente para descartar cambios en curso */}
          {showConfirm && (
            <div
              className="absolute inset-0 z-30 flex items-center justify-center rounded-lg bg-black/80 p-6 animate-in fade-in duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex w-full max-w-md flex-col gap-5 rounded-lg border bg-card p-6 shadow-modal animate-in zoom-in-95 duration-150">
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-base font-semibold text-foreground">
                    {confirmCloseTitle}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {confirmCloseDescription}
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowConfirm(false)}
                    className="max-sm:w-full"
                  >
                    Seguir editando
                  </Button>
                  <Button
                    type="button"
                    tone="destructive"
                    onClick={handleConfirmDiscard}
                    className="max-sm:w-full"
                  >
                    <Trash2Icon data-icon="inline-start" />
                    Sí, descartar y salir
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DialogContext.Provider>
  )
}
