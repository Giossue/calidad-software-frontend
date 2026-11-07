import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { RecordTable } from './tutoring-shared'

afterEach(cleanup)

const rows = [{ id: 1, name: 'Ana' }, { id: 2, name: 'Luis' }]
const columns = [{ label: 'Estudiante', render: (row: { name: string }) => row.name }]

describe('RecordTable', () => {
  it('numera las filas desde `numberFrom` para continuar entre páginas', () => {
    render(<RecordTable rows={rows} columns={columns} loading={false} empty="Vacío" numberFrom={16} />)

    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['#', 'Estudiante'])
    const [first, second] = screen.getAllByRole('row').slice(1)
    expect(within(first).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['16', 'Ana'])
    expect(within(second).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['17', 'Luis'])
    // En móvil la celda del número se oculta y el contador CSS lo muestra en la tarjeta.
    expect(within(first).getAllByRole('cell')[0]).toHaveAttribute('data-row-number')
    const body = screen.getAllByRole('rowgroup')[1]
    expect(body).toHaveAttribute('data-numbered')
    expect(body.style.counterReset).toBe('row-number 15')
  })

  it('sin `numberFrom` no agrega la columna', () => {
    render(<RecordTable rows={rows} columns={columns} loading={false} empty="Vacío" />)
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Estudiante'])
  })

  it('con un `from` nulo (página vacía) empieza en 1', () => {
    render(<RecordTable rows={rows} columns={columns} loading={false} empty="Vacío" numberFrom={null} />)
    expect(within(screen.getAllByRole('row')[1]).getAllByRole('cell')[0]).toHaveTextContent('1')
  })
})
