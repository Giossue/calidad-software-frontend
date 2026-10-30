import { describe, expect, it } from 'vitest'

import { BULK_IMPORT_COLUMNS, bulkImportInstructions } from '@/lib/bulk-import'

describe('bulkImportInstructions', () => {
  it('genera solo líneas de comentario, cada una en una celda entre comillas', () => {
    const lines = bulkImportInstructions('users').trimEnd().split('\r\n')

    expect(lines.length).toBeGreaterThan(BULK_IMPORT_COLUMNS.users.length)
    for (const line of lines) expect(line).toMatch(/^"# .*"$/)
  })

  it('lista cada columna indicando si es obligatoria', () => {
    const text = bulkImportInstructions('users')

    expect(text).toContain('- correo (obligatoria)')
    expect(text).toContain('- cedula (opcional)')
  })
})
