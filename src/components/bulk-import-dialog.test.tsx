import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BulkImportButton } from '@/components/bulk-import-dialog'
import { ApiError, importsApi, type BulkImport } from '@/lib/api'

vi.mock('@/lib/bulk-import', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/bulk-import')>()),
  BULK_IMPORT_POLL_MS: 10,
}))

const base: BulkImport = { id: 7, type: 'users', status: 'pending', total_rows: 3, created_count: 0, failed_count: 0, errors: [] }

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('BulkImportButton', () => {
  it('sube el CSV, consulta el progreso y muestra los errores por fila', async () => {
    const user = userEvent.setup()
    const onFinished = vi.fn()
    vi.spyOn(importsApi, 'upload').mockResolvedValue(base)
    vi.spyOn(importsApi, 'status').mockResolvedValue({
      ...base,
      status: 'done',
      created_count: 2,
      failed_count: 1,
      errors: [{ row: 3, messages: ['El correo ana@ueb.edu.ec ya está registrado.'] }],
    })

    render(<BulkImportButton type="users" title="Carga masiva de usuarios" onFinished={onFinished} />)
    await user.click(screen.getByRole('button', { name: 'Cargar datos masivos' }))
    expect(screen.getByText('correo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importar' })).toBeDisabled()

    const file = new File(['correo,rol,carrera\n'], 'usuarios.csv', { type: 'text/csv' })
    await user.upload(screen.getByLabelText('Archivo CSV'), file)
    await user.click(screen.getByRole('button', { name: 'Importar' }))

    expect(importsApi.upload).toHaveBeenCalledWith('users', file)
    expect(await screen.findByText(/2 registros creados y 1 con errores/)).toBeInTheDocument()
    expect(screen.getByText('El correo ana@ueb.edu.ec ya está registrado.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onFinished).toHaveBeenCalledTimes(1)
  })

  it('muestra el error del archivo sin cerrar el diálogo', async () => {
    const user = userEvent.setup()
    vi.spyOn(importsApi, 'upload').mockRejectedValue(new ApiError(422, { message: 'x', errors: { file: ['Faltan columnas obligatorias en el CSV: correo.'] } }))

    render(<BulkImportButton type="faculties" title="Carga masiva de facultades" />)
    await user.click(screen.getByRole('button', { name: 'Cargar datos masivos' }))
    await user.upload(screen.getByLabelText('Archivo CSV'), new File(['x'], 'f.csv', { type: 'text/csv' }))
    await user.click(screen.getByRole('button', { name: 'Importar' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Faltan columnas obligatorias en el CSV: correo.'))
    expect(screen.getByRole('button', { name: 'Importar' })).toBeEnabled()
  })
})
