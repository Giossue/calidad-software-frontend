import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PencilIcon, PowerOffIcon } from 'lucide-react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RowActionsMenu } from '@/components/ui/row-actions-menu'

afterEach(cleanup)

describe('RowActionsMenu', () => {
  it('abre el menú de la fila y ejecuta la acción elegida sin activar la fila', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const onRow = vi.fn()
    render(
      <div onClick={onRow}>
        <RowActionsMenu
          name="Software"
          actions={[
            { label: 'Editar', icon: PencilIcon, onSelect: onEdit },
            { label: 'Desactivar', icon: PowerOffIcon, onSelect: vi.fn(), tone: 'destructive' },
            { label: 'Oculta', icon: PencilIcon, onSelect: vi.fn(), visible: false },
          ]}
        />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: 'Acciones para Software' }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Editar', 'Desactivar'])
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }))

    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onRow).not.toHaveBeenCalled()
  })

  it('no se muestra cuando no hay acciones visibles', () => {
    render(<RowActionsMenu name="Software" actions={[{ label: 'Editar', icon: PencilIcon, onSelect: vi.fn(), visible: false }]} />)
    expect(screen.queryByRole('button', { name: 'Acciones para Software' })).not.toBeInTheDocument()
  })
})
