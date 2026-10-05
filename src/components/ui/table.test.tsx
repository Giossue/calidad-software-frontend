import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

describe('Table stacked', () => {
  afterEach(cleanup)

  it('etiqueta cada celda con el encabezado de su columna y omite las filas combinadas', () => {
    render(
      <Table stacked>
        <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
        <TableBody>
          <TableRow><TableCell>Ana</TableCell><TableCell>Activo</TableCell></TableRow>
          <TableRow><TableCell colSpan={2}>Sin resultados</TableCell></TableRow>
        </TableBody>
      </Table>,
    )

    expect(screen.getByText('Ana')).toHaveAttribute('data-label', 'Nombre')
    expect(screen.getByText('Activo')).toHaveAttribute('data-label', 'Estado')
    expect(screen.getByText('Sin resultados')).not.toHaveAttribute('data-label')
  })

  it('no etiqueta las tablas que no son stacked', () => {
    render(
      <Table>
        <TableHeader><TableRow><TableHead>Nombre</TableHead></TableRow></TableHeader>
        <TableBody><TableRow><TableCell>Ana</TableCell></TableRow></TableBody>
      </Table>,
    )

    expect(screen.getByText('Ana')).not.toHaveAttribute('data-label')
  })
})
