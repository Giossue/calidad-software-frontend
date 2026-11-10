import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, type AcademicPeriod } from '@/lib/api'
import { AcademicPeriodsPage } from './academic-periods-page'

const period: AcademicPeriod = { id: 1, name: 'PAO I 2026', start_date: '2026-04-01', end_date: '2026-08-31', is_active: true }
const meta = { current_page: 1, last_page: 1, per_page: 15, total: 1, from: 1, to: 1, active_count: 1, inactive_count: 0 }

beforeEach(() => {
  vi.spyOn(api, 'listAcademicPeriods').mockResolvedValue({ data: [period], meta })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Períodos académicos', () => {
  it('marca como obligatorios el nombre y las fechas del período', async () => {
    const user = userEvent.setup()
    render(<AcademicPeriodsPage />)
    await user.click(await screen.findByRole('button', { name: 'Nuevo período' }))
    const dialog = await screen.findByRole('dialog', { name: 'Registrar período académico' })

    expect(within(dialog).getByRole('combobox', { name: 'Nombre del período académico(obligatorio)' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/^Fecha de inicio/)).toHaveAccessibleName('Fecha de inicio(obligatorio)')
    expect(within(dialog).getByLabelText(/^Fecha de finalización/)).toHaveAccessibleName('Fecha de finalización(obligatorio)')
    expect(within(dialog).getByRole('button', { name: 'Registrar período' })).toBeDisabled()
  })

  it('abre la edición del período al pulsar su fila', async () => {
    const user = userEvent.setup()
    render(<AcademicPeriodsPage />)
    await user.click(await screen.findByRole('row', { name: /PAO I 2026/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar período académico' })
    expect(within(dialog).getByLabelText('Año del período')).toHaveValue('2026')
  })

  it('registra sin descripción redundante, con el ícono de visto, y muestra el error de la fecha bajo el campo', async () => {
    const user = userEvent.setup()
    render(<AcademicPeriodsPage />)
    await user.click(await screen.findByRole('button', { name: 'Nuevo período' }))
    const dialog = await screen.findByRole('dialog', { name: 'Registrar período académico' })

    expect(within(dialog).queryByText('Elige el número de PAO, el año y las fechas del período.')).not.toBeInTheDocument()
    const submit = within(dialog).getByRole('button', { name: 'Registrar período' })
    expect(submit.querySelector('.lucide-plus')).toBeNull()
    expect(submit.querySelector('.lucide-check')).not.toBeNull()

    const now = new Date()
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15)
    const earlier = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}-15`
    fireEvent.change(within(dialog).getByLabelText(/^Fecha de inicio/), { target: { value: earlier } })
    expect(await within(dialog).findByText('La fecha de inicio no puede pertenecer a un mes anterior.')).toBeInTheDocument()
  })

  it('muestra el error del año bajo el nombre al salir del campo', async () => {
    const user = userEvent.setup()
    render(<AcademicPeriodsPage />)
    await user.click(await screen.findByRole('button', { name: 'Nuevo período' }))
    const dialog = await screen.findByRole('dialog', { name: 'Registrar período académico' })
    await user.type(within(dialog).getByLabelText('Año del período'), '20')
    expect(within(dialog).queryByText('Ingresa un año válido de 4 dígitos.')).not.toBeInTheDocument()
    await user.tab()
    expect(await within(dialog).findByText('Ingresa un año válido de 4 dígitos.')).toBeInTheDocument()
  })
})
