import { useRef, useState, type DragEvent } from 'react'
import { FileSpreadsheetIcon, UploadCloudIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Zona para arrastrar un archivo o elegirlo con clic; sin archivo muestra la ayuda, con archivo su nombre y tamaño. */
export function FileDropzone({
  id,
  label,
  accept,
  extensions,
  file,
  onFileChange,
  onReject,
  disabled = false,
  hint,
}: Readonly<{
  id: string
  /** Texto accesible del campo. */
  label: string
  /** Valor del atributo `accept` del input. */
  accept: string
  /** Extensiones permitidas al soltar un archivo, p. ej. ['.csv']. */
  extensions: readonly string[]
  file: File | null
  onFileChange: (file: File | null) => void
  onReject?: (message: string) => void
  disabled?: boolean
  hint?: string
}>) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function choose(next: File | undefined) {
    if (!next) return
    if (!extensions.some((extension) => next.name.toLowerCase().endsWith(extension))) {
      onReject?.(`El archivo debe ser ${extensions.join(' o ')}.`)
      return
    }
    onFileChange(next)
  }

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    if (!disabled) choose(event.dataTransfer.files[0])
  }

  function clear() {
    onFileChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input bg-muted/30 px-6 py-8 text-center transition-colors',
          'hover:bg-muted/60 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
          dragging && 'border-primary bg-primary/5',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          aria-label={label}
          className="sr-only"
          disabled={disabled}
          onChange={(event) => choose(event.target.files?.[0])}
        />
        <UploadCloudIcon className="size-8 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-semibold">Arrastra tu archivo aquí o haz clic para seleccionarlo</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </label>

      {file && (
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <FileSpreadsheetIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{file.name}</span>
            <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
          </div>
          <Button type="button" variant="tertiary" size="icon" onClick={clear} disabled={disabled} aria-label="Quitar archivo">
            <XIcon />
          </Button>
        </div>
      )}
    </div>
  )
}
