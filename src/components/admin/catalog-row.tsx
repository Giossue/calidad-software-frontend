import { PencilIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'

export function CatalogRow({ title, detail, active, activeLabel = 'Activo', inactiveLabel = 'Inactivo', disabled, deactivating, onEdit, onDeactivate }: Readonly<{ title: string; detail: string; active: boolean; activeLabel?: string; inactiveLabel?: string; disabled: boolean; deactivating?: boolean; onEdit: () => void; onDeactivate: () => void }>) {
  return <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-4 last:border-b-0">
    <div className="min-w-0">
      <p className="truncate text-sm font-medium">{title}</p>
      <p className="truncate text-xs text-muted-foreground">{detail}</p>
    </div>
    <div className="flex shrink-0 items-center gap-2">
      <StatusBadge active={active} activeLabel={activeLabel} inactiveLabel={inactiveLabel} />
      {active && <>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar ${title}`} onClick={onEdit} disabled={disabled}><PencilIcon /></Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Desactivar ${title}`} onClick={onDeactivate} disabled={disabled}>{deactivating ? <Spinner /> : <XIcon />}</Button>
      </>}
    </div>
  </div>
}
