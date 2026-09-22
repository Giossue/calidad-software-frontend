import { PencilIcon, PlusIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

export function CatalogFormActions({ editing, pending, onCancel, createLabel = 'Registrar', editLabel = 'Guardar cambios', pendingLabel = 'Guardando…' }: Readonly<{ editing: boolean; pending: boolean; onCancel: () => void; createLabel?: string; editLabel?: string; pendingLabel?: string }>) {
  return <div className="flex flex-wrap justify-end gap-3">
    <Button type="submit" disabled={pending}>
      {pending ? <Spinner data-icon="inline-start" /> : editing ? <PencilIcon data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
      {pending ? pendingLabel : editing ? editLabel : createLabel}
    </Button>
    {editing && <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}><XIcon data-icon="inline-start" />Cancelar</Button>}
  </div>
}
