import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Calendar } from '@/components/ui/calendar'

afterEach(() => cleanup())

describe('Calendar', () => {
  it('muestra el mes en español con la semana desde el lunes y navega entre meses', async () => {
    const user = userEvent.setup()
    const onMonthChange = vi.fn()
    render(<Calendar label="Sesiones" defaultMonth="2026-09" minMonth="2026-08" maxMonth="2026-10" onSelect={() => {}} onMonthChange={onMonthChange} />)

    expect(screen.getByRole('heading', { name: 'Septiembre de 2026' })).toBeInTheDocument()
    const headers = within(screen.getByRole('table')).getAllByRole('columnheader').map((cell) => cell.getAttribute('abbr'))
    expect(headers).toEqual(['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'])
    // El 1 de septiembre de 2026 es martes: la primera semana empieza con una celda vacía.
    const firstWeek = within(screen.getByRole('table')).getAllByRole('row')[1]
    expect(within(firstWeek).getAllByRole('cell')[0]).toBeEmptyDOMElement()
    expect(within(firstWeek).getByRole('button', { name: 'martes 1 de septiembre de 2026' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    expect(screen.getByRole('heading', { name: 'Octubre de 2026' })).toBeInTheDocument()
    expect(onMonthChange).toHaveBeenLastCalledWith('2026-10')
    // No se navega más allá de los límites.
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }))
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }))
    expect(screen.getByRole('heading', { name: 'Agosto de 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeDisabled()
  })

  it('deshabilita los días no elegibles, marca los indicados y avisa el día elegido', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <Calendar
        label="Sesiones"
        defaultMonth="2026-09"
        today="2026-09-29"
        selected="2026-09-21"
        isDisabled={(date) => date !== '2026-09-21' && date !== '2026-09-28'}
        marked={new Set(['2026-09-21'])}
        markLabel="sesión registrada"
        onSelect={onSelect}
      />,
    )

    const marked = screen.getByRole('button', { name: 'lunes 21 de septiembre de 2026, sesión registrada' })
    expect(marked).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'martes 29 de septiembre de 2026' })).toHaveAttribute('aria-current', 'date')
    expect(screen.getByRole('button', { name: 'martes 29 de septiembre de 2026' })).toBeDisabled()

    // Los días habilitados se alcanzan con el teclado.
    const monday = screen.getByRole('button', { name: 'lunes 28 de septiembre de 2026' })
    expect(monday).toBeEnabled()
    expect(monday).toHaveAttribute('aria-pressed', 'false')
    monday.focus()
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('2026-09-28')
    await user.click(screen.getByRole('button', { name: 'martes 29 de septiembre de 2026' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})
