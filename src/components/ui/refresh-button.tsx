import { RefreshCwIcon } from 'lucide-react'

import { IconAction } from '@/components/ui/icon-action'

/** Botón terciario de solo icono para volver a cargar datos; el texto va en el tooltip. */
export function RefreshButton({
  onClick,
  loading = false,
  disabled = false,
  label = 'Actualizar',
}: Readonly<{ onClick: () => void; loading?: boolean; disabled?: boolean; label?: string }>) {
  return <IconAction label={label} icon={RefreshCwIcon} onClick={onClick} loading={loading} disabled={disabled} />
}
