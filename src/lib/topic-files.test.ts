import { describe, expect, it } from 'vitest'

import { formatFileSize, topicFileError, topicFileKind, TOPIC_FILE_MAX_BYTES } from './topic-files'

const file = (name: string, size = 10) => new File([new Uint8Array(size)], name)

describe('recursos de los temas', () => {
  it('acepta documentos de oficina, PDF y texto hasta 20 MB', () => {
    for (const name of ['guia.pdf', 'Clase.PPTX', 'lectura.docx', 'notas.xlsx', 'resumen.odt', 'leeme.txt']) {
      expect(topicFileError(file(name)), name).toBeNull()
    }
  })

  it('rechaza otros tipos, archivos vacíos y los que superan 20 MB', () => {
    expect(topicFileError(file('foto.png'))).toMatch(/no es un PDF/)
    expect(topicFileError(file('sin-extension'))).toMatch(/no es un PDF/)
    expect(topicFileError(file('vacio.pdf', 0))).toMatch(/está vacío/)
    const big = file('grande.pdf', 1)
    Object.defineProperty(big, 'size', { value: TOPIC_FILE_MAX_BYTES + 1 })
    expect(topicFileError(big)).toMatch(/supera los 20 MB/)
  })

  it('clasifica y formatea los recursos', () => {
    expect(topicFileKind('a.ppt')).toBe('presentation')
    expect(topicFileKind('a.ods')).toBe('spreadsheet')
    expect(topicFileKind('a.doc')).toBe('word')
    expect(formatFileSize(500)).toBe('1 KB')
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
