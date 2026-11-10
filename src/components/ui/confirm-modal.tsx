import { CheckIcon, Trash2Icon } from 'lucide-react'

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
}>) {
  return (
    <Dialog open={open} onClose={onClose} confirmClose={false} title={title} maxWidth="max-w-md">
      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">{description}</p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={pending} className="max-sm:w-full">
            {cancelLabel}
          </Button>
          <Button
            tone={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={pending}
            className="max-sm:w-full"
          >
            {pending ? <Spinner data-icon="inline-start" /> : variant === 'destructive' ? <Trash2Icon data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
