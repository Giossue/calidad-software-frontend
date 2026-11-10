import { CheckIcon, Trash2Icon, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'destructive',
  pending = false,
  confirmIcon,
}: Readonly<{
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'destructive' | 'default'
  pending?: boolean
  /** Ícono del botón de confirmar; por defecto, papelera (destructivo) o visto. */
  confirmIcon?: LucideIcon
}>) {
  const ConfirmIcon = confirmIcon ?? (variant === 'destructive' ? Trash2Icon : CheckIcon)
  return (
    <Dialog open={open} onClose={onClose} confirmClose={false} title={title} maxWidth="max-w-md">
      <div className="flex flex-col gap-4">
        <p className="text-center text-sm text-muted-foreground">{description}</p>

        <div className="-mx-6 -mb-6 flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={pending} className="max-sm:w-full">
            {cancelLabel}
          </Button>
          <Button
            tone={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={pending}
            className="max-sm:w-full"
          >
            {pending ? <Spinner data-icon="inline-start" /> : <ConfirmIcon data-icon="inline-start" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
