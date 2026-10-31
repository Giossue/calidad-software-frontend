import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { SaveIcon, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { ErrorModal, type FriendlyErrorInfo } from '@/components/ui/error-modal'
import { ErrorNotice } from '@/components/ui/error-notice'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * Modal de formulario estándar. Pide confirmar al cerrar solo si hay cambios (`dirty`)
 * y deja "Guardar" bloqueado, con un tooltip que explica el motivo, cuando:
 *  - no hay cambios (`requireChanges`, activo por defecto), o
 *  - el formulario no es válido (`blockReason`: primer error pendiente).
 * `headerActions` son acciones de solo icono junto a la X (p. ej. habilitar/desactivar).
 */
export function FormDialog({
  open,
  title,
  description,
  pending,
  error,
  errorModal,
  onCloseErrorModal,
  dirty,
  requireChanges = true,
  blockReason = null,
  noChangesReason = 'No hay cambios por guardar.',
  headerActions,
  onClose,
  onSubmit,
  children,
  submitLabel = 'Guardar cambios',
  submitDisabled = false,
  submitIcon: SubmitIcon = SaveIcon,
  maxWidth = 'max-w-xl',
}: Readonly<{
  open: boolean
  title: string
  description?: string
  pending: boolean
  error: string | null
  errorModal?: FriendlyErrorInfo | null
  onCloseErrorModal?: () => void
  dirty: boolean
  /** Si es false, "Guardar" no exige cambios (acciones que se confirman sin editar nada). */
  requireChanges?: boolean
  /** Motivo por el que el formulario no es válido; bloquea "Guardar" y se muestra en el tooltip. */
  blockReason?: string | null
  noChangesReason?: string
  headerActions?: ReactNode
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  children: ReactNode
  submitLabel?: string
  submitDisabled?: boolean
  submitIcon?: LucideIcon
  maxWidth?: string
}>) {
  const [modalDismissed, setModalDismissed] = useState(false)
  const lastErrorRef = useRef<FriendlyErrorInfo | null>(null)

  useEffect(() => {
    if (errorModal && errorModal !== lastErrorRef.current) {
      setModalDismissed(false)
      lastErrorRef.current = errorModal
    } else if (!errorModal) {
      lastErrorRef.current = null
      setModalDismissed(false)
    }
  }, [errorModal])

  const isErrorModalOpen = Boolean(open && errorModal && !modalDismissed)
  const reason = blockReason ?? (requireChanges && !dirty ? noChangesReason : null)
  const blocked = pending || submitDisabled || reason !== null

  function handleCloseErrorModal() {
    setModalDismissed(true)
    onCloseErrorModal?.()
  }

  return (
    <>
      <Dialog
        open={open}
        title={title}
        description={description}
        confirmClose={dirty}
        headerActions={headerActions}
        onClose={() => {
          if (!pending) onClose()
        }}
        maxWidth={maxWidth}
      >
        <form onSubmit={onSubmit} aria-label={title} className="max-h-[65vh] overflow-y-auto p-1">
          <fieldset disabled={pending}>
            <FieldGroup>
              {children}
              <ErrorNotice message={error} />
              <div className="sticky -bottom-1 z-10 flex flex-wrap justify-end gap-3 bg-card pt-3 pb-1">
                <DialogCancelButton disabled={pending}>Cancelar</DialogCancelButton>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={reason ? 0 : -1}>
                      <Button type="submit" disabled={blocked}>
                        {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <SubmitIcon data-icon="inline-start" />}
                        {pending ? 'Guardando…' : submitLabel}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {reason && !pending && <TooltipContent>{reason}</TooltipContent>}
                </Tooltip>
              </div>
            </FieldGroup>
          </fieldset>
        </form>
      </Dialog>
      {errorModal && (
        <ErrorModal open={isErrorModalOpen} onClose={handleCloseErrorModal} title={errorModal.title} description={errorModal.description} />
      )}
    </>
  )
}
