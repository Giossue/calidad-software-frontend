import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { SearchInput } from '@/components/ui/search-input'

afterEach(() => cleanup())

function Harness({ initial = '' }: Readonly<{ initial?: string }>) {
  const [value, setValue] = useState(initial)
  return <SearchInput aria-label="Buscar" value={value} onValueChange={setValue} />
}

describe('SearchInput', () => {
  it('muestra el botón de borrar solo con texto y lo limpia devolviendo el foco', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = screen.getByRole('searchbox', { name: 'Buscar' })
    expect(screen.queryByRole('button', { name: 'Borrar búsqueda' })).not.toBeInTheDocument()

    await user.type(input, 'ana')
    expect(input).toHaveValue('ana')

    await user.click(screen.getByRole('button', { name: 'Borrar búsqueda' }))
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Borrar búsqueda' })).not.toBeInTheDocument()
  })
})
