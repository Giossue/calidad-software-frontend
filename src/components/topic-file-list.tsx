import { useState } from 'react'
import { DownloadIcon, FileIcon, FileSpreadsheetIcon, FileTextIcon, PresentationIcon, Trash2Icon } from 'lucide-react'
import { toast } from '@/lib/toast'

import { getFriendlyError } from '@/components/ui/error-modal'
import { IconAction } from '@/components/ui/icon-action'
import { formatFileSize, topicFileKind } from '@/lib/topic-files'
import { cn } from '@/lib/utils'

const KIND = {
  pdf: { icon: FileTextIcon, label: 'PDF', className: 'text-red-600 dark:text-red-400' },
  word: { icon: FileTextIcon, label: 'Documento', className: 'text-blue-600 dark:text-blue-400' },
  presentation: { icon: PresentationIcon, label: 'Presentación', className: 'text-orange-600 dark:text-orange-400' },
  spreadsheet: { icon: FileSpreadsheetIcon, label: 'Hoja de cálculo', className: 'text-green-600 dark:text-green-400' },
  text: { icon: FileIcon, label: 'Texto', className: 'text-muted-foreground' },
} as const

export type TopicFileItem = Readonly<{ key: string | number; name: string; size: number }>

/**
 * Lista de recursos de un tema. Con `onDownload` cada recurso se puede descargar;
 * con `onRemove`, quitar. `pendingLabel` marca los que aún no se han subido.
 */
export function TopicFileList<T extends TopicFileItem>({ files, onDownload, onRemove, removeDisabled = false, pendingLabel }: Readonly<{
  files: readonly T[]
  onDownload?: (file: T) => Promise<void>
  onRemove?: (file: T) => void
  removeDisabled?: boolean
  /** Etiqueta para los archivos aún no subidos (p. ej. «Se subirá al guardar»). */
  pendingLabel?: (file: T) => string | null
}>) {
  const [downloading, setDownloading] = useState<T['key'] | null>(null)

  async function download(file: T) {
    if (!onDownload || downloading !== null) return
    setDownloading(file.key)
    try {
      await onDownload(file)
    } catch (error) {
      const friendly = getFriendlyError(error)
      toast.error('No se pudo descargar el archivo', { description: friendly.description })
    } finally {
      setDownloading(null)
    }
  }

  if (files.length === 0) return null

  return (
    <ul className="flex flex-col gap-2" aria-label="Recursos del tema">
      {files.map((file) => {
        const kind = KIND[topicFileKind(file.name)]
        const Icon = kind.icon
        const pending = pendingLabel?.(file)
        return (
          <li key={file.key} className="flex min-w-0 items-center gap-3 rounded-lg border bg-card px-3 py-2">
            <Icon aria-hidden="true" className={cn('size-5 shrink-0', kind.className)} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-foreground" title={file.name}>{file.name}</span>
              <span className="text-xs text-muted-foreground">{kind.label} · {formatFileSize(file.size)}{pending ? ` · ${pending}` : ''}</span>
            </span>
            {onDownload && <IconAction label={`Descargar ${file.name}`} icon={DownloadIcon} loading={downloading === file.key} disabled={downloading !== null && downloading !== file.key} onClick={() => void download(file)} />}
            {onRemove && <IconAction label={`Quitar ${file.name}`} icon={Trash2Icon} tone="destructive" disabled={removeDisabled} onClick={() => onRemove(file)} />}
          </li>
        )
      })}
    </ul>
  )
}
