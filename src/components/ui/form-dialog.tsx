import { type FormEvent, type ReactNode } from 'react'
import { CheckIcon, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { type FriendlyErrorInfo } from '@/components/ui/error-modal'
import { ErrorNotice } from '@/components/ui/error-notice'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'

/**
 * Formulario estándar en un modal centrado, con pie fijo (Cancelar + acción).
 * Pide confirmar al cerrar solo si hay cambios (`dirty`) y deja "Guardar" bloqueado cuando:
 *  - no hay cambios (`requireChanges`, activo por defecto), o
 *  - el formulario no es válido (`blockReason`: se muestra junto al botón, no escondido).
 * Un error del servidor se muestra una sola vez, en línea, dentro del modal.
 * `headerActions` son acciones de solo icono junto a la X (p. ej. habilitar/desactivar).
 */
export function FormDialog({
  open,
  title,
  description,
  pending,
  error,
  errorModal,
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
  submitIcon: SubmitIcon = CheckIcon,
  maxWidth = 'max-w-xl',
}: Readonly<{
  open: boolean
  title: string
  description?: string
  pending: boolean
  error: string | null
  /** Título amigable del error (de `useOperation`); se muestra sobre el detalle. */
  errorModal?: FriendlyErrorInfo | null
  /** Ya no se usa: el error vive en línea y se limpia al volver a enviar. */
  onCloseErrorModal?: () => void
  dirty: boolean
  /** Si es false, "Guardar" no exige cambios (acciones que se confirman sin editar nada). */
  requireChanges?: boolean
  /** Motivo por el que el formulario no es válido; bloquea "Guardar" y se muestra junto al botón. */
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
  const reason = blockReason ?? (requireChanges && !dirty ? noChangesReason : null)
  const blocked = pending || submitDisabled || reason !== null

  return (
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
      <form onSubmit={onSubmit} aria-label={title} className="flex flex-1 flex-col">
        <fieldset disabled={pending} className="flex flex-1 flex-col">
          <FieldGroup className="flex-1 pb-4">
            {children}
            <ErrorNotice title={errorModal?.title} message={error} />
          </FieldGroup>
          <div className="sticky -bottom-6 z-10 -mx-6 -mb-6 flex flex-col-reverse gap-2 border-t bg-card p-4 sm:flex-row sm:items-center sm:justify-end">
            {blockReason && !pending && (
              <p className="text-sm text-muted-foreground sm:mr-auto">{blockReason}</p>
            )}
            <DialogCancelButton disabled={pending}>Cancelar</DialogCancelButton>
            <Button type="submit" disabled={blocked}>
              {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <SubmitIcon data-icon="inline-start" />}
              {pending ? 'Guardando…' : submitLabel}
            </Button>
          </div>
        </fieldset>
      </form>
    </Dialog>
  )
}
