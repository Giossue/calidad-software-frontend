import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'

afterEach(cleanup)

function renderSteps(nameReason: string | null, onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault())) {
  render(
    <FormDialog
      open
      title="Registrar asignatura"
      pending={false}
      error={null}
      dirty
      onClose={vi.fn()}
      onSubmit={onSubmit}
      submitLabel="Registrar asignatura"
      steps={[
        { title: 'Datos', description: 'Nombre y código', blockReason: nameReason, content: <FormField id="name" label="Nombre" required><Input id="name" /></FormField> },
        { title: 'Ubicación', content: <FormField id="cycle" label="Ciclo" optional><Input id="cycle" /></FormField> },
      ]}
    />,
  )
  return onSubmit
}

describe('FormDialog con pasos', () => {
  it('avanza con Siguiente, vuelve con Atrás y solo envía en el último paso', async () => {
    const user = userEvent.setup()
    const onSubmit = renderSteps(null)
    const form = screen.getByRole('form', { name: 'Registrar asignatura' })

    // Sin barra de pasos: cada paso muestra solo su título.
    expect(screen.queryByRole('navigation', { name: /Pasos de/ })).not.toBeInTheDocument()
    expect(within(form).getByRole('group', { name: 'Datos' })).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(within(form).queryByRole('button', { name: 'Registrar asignatura' })).not.toBeInTheDocument()

    await user.click(within(form).getByRole('button', { name: 'Siguiente' }))
    // «Siguiente» solo avanza: no envía el formulario aunque en su lugar aparezca el botón de enviar.
    expect(onSubmit).not.toHaveBeenCalled()
    expect(within(form).getByLabelText(/^Ciclo/)).toBeInTheDocument()
    expect(within(form).queryByLabelText(/^Nombre/)).not.toBeInTheDocument()

    await user.click(within(form).getByRole('button', { name: 'Atrás' }))
    expect(within(form).getByLabelText(/^Nombre/)).toBeInTheDocument()

    // Enter en un paso intermedio avanza, no envía.
    await user.type(within(form).getByLabelText(/^Nombre/), 'Cálculo{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
    await user.click(within(form).getByRole('button', { name: 'Registrar asignatura' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('bloquea Siguiente y explica qué falta en su tooltip, sin repetirlo en el modal', async () => {
    const user = userEvent.setup()
    renderSteps('Escribe el nombre de la asignatura.')
    const form = screen.getByRole('form', { name: 'Registrar asignatura' })
    const next = within(form).getByRole('button', { name: 'Siguiente' })
    expect(next).toBeDisabled()
    expect(within(form).queryByText('Escribe el nombre de la asignatura.')).not.toBeInTheDocument()
    await user.hover(next.parentElement as HTMLElement)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Escribe el nombre de la asignatura.')
  })

  it('marca los campos obligatorios con asterisco', () => {
    renderSteps(null)
    const label = screen.getByText('Nombre').closest('label') as HTMLElement
    expect(within(label).getByText('*')).toBeInTheDocument()
    expect(within(label).getByText('(obligatorio)')).toHaveClass('sr-only')
  })
})
