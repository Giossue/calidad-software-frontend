import { createContext, useContext, useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { AlertTriangleIcon, XIcon } from 'lucide-react'

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
      variant="outline"
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
  confirmClose = true,
  confirmCloseTitle = '¿Descartar los cambios?',
  confirmCloseDescription = '¿Estás seguro de cerrar este formulario? Cualquier información o cambio realizado que no haya sido guardado se perderá por completo.',
}: Readonly<{
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  maxWidth?: string
  confirmClose?: boolean
  confirmCloseTitle?: string
  confirmCloseDescription?: string
}>) {
  const [showConfirm, setShowConfirm] = useState(false)

  // Resetea el diálogo de confirmación cuando el modal se abre o cierra externamente
  useEffect(() => {
    if (!open) {
      setShowConfirm(false)
    }
  }, [open])

  function handleAttemptClose() {
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
  }, [open, showConfirm, confirmClose])

  if (!open) return null

  return (
    <DialogContext.Provider value={{ requestClose: handleAttemptClose }}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop con desfoque suave */}
        <div
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={handleAttemptClose}
        />

        {/* Contenedor Modal */}
        <div
          className={cn(
            'relative z-10 flex w-full flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 dark:bg-slate-900 dark:ring-slate-800 animate-in zoom-in-95 duration-150',
            maxWidth,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header del Modal */}
          <div className="flex items-start justify-between border-b border-slate-100 p-6 dark:border-slate-800">
            <div className="flex flex-col gap-1 pr-6">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {title}
              </h2>
              {description && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleAttemptClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Cerrar modal"
            >
              <XIcon className="size-5" />
            </button>
          </div>

          {/* Cuerpo del Modal */}
          <div className="p-6">{children}</div>

          {/* Modal de confirmación emergente para descartar cambios en curso */}
          {showConfirm && (
            <div
              className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-slate-950/60 p-6 backdrop-blur-xs animate-in fade-in duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in zoom-in-95 duration-150">
                <div className="flex items-start gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                    <AlertTriangleIcon className="size-6" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {confirmCloseTitle}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {confirmCloseDescription}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowConfirm(false)}
                    className="font-medium"
                  >
                    Seguir editando
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleConfirmDiscard}
                    className="font-semibold"
                  >
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
