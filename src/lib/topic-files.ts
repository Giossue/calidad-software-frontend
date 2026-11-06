/** Recurso adjunto a un tema de tutoría. Deben coincidir con las reglas del backend. */
export interface TopicFile {
  readonly id: number
  readonly name: string
  readonly mime_type: string
  readonly size: number
  readonly uploaded_at: string | null
}

export const TOPIC_FILE_EXTENSIONS = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'odt', 'odp', 'ods', 'txt'] as const
export const TOPIC_FILE_ACCEPT = TOPIC_FILE_EXTENSIONS.map((extension) => `.${extension}`).join(',')
export const TOPIC_FILE_MAX_BYTES = 20 * 1024 * 1024
export const TOPIC_FILES_PER_TOPIC = 10

export function topicFileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

/** Motivo por el que el archivo no se puede adjuntar, o null si es válido. */
export function topicFileError(file: File): string | null {
  if (!(TOPIC_FILE_EXTENSIONS as readonly string[]).includes(topicFileExtension(file.name))) {
    return `«${file.name}» no es un PDF, Word, PowerPoint, Excel ni archivo de texto.`
  }
  if (file.size > TOPIC_FILE_MAX_BYTES) return `«${file.name}» supera los 20 MB.`
  if (file.size === 0) return `«${file.name}» está vacío.`
  return null
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Tipo legible del recurso, para el icono y la etiqueta. */
export function topicFileKind(name: string): 'pdf' | 'word' | 'presentation' | 'spreadsheet' | 'text' {
  const extension = topicFileExtension(name)
  if (extension === 'pdf') return 'pdf'
  if (['doc', 'docx', 'odt'].includes(extension)) return 'word'
  if (['ppt', 'pptx', 'odp'].includes(extension)) return 'presentation'
  if (['xls', 'xlsx', 'ods'].includes(extension)) return 'spreadsheet'
  return 'text'
}
