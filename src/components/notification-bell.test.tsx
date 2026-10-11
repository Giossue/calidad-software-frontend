import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NotificationBell } from '@/components/notification-bell'
import { notificationsApi, type AppNotification } from '@/lib/api'

const unread: AppNotification = {
  id: 'a1', kind: 'degree_topic_approved', title: 'Tu propuesta fue aprobada', body: 'La propuesta «IA» fue aprobada.',
  url: '/panel/student-degree-assignments', read_at: null, created_at: new Date().toISOString(),
}
const read: AppNotification = { ...unread, id: 'a2', title: 'Fuiste inscrito en una tutoría', body: 'Calidad', url: null, read_at: new Date().toISOString() }

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderBell() {
  return render(
    <MemoryRouter initialEntries={['/panel/student-tutorings']}>
      <Routes>
        <Route path="/panel/student-tutorings" element={<NotificationBell />} />
        <Route path="/panel/student-degree-assignments" element={<p>Pantalla de tutor y pares</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('NotificationBell', () => {
  it('muestra el contador, lista los avisos y al abrir uno lo marca como leído y navega', async () => {
    const user = userEvent.setup()
    vi.spyOn(notificationsApi, 'unreadCount').mockResolvedValue(1)
    vi.spyOn(notificationsApi, 'list').mockResolvedValue({ data: [unread, read], unreadCount: 1 })
    vi.spyOn(notificationsApi, 'markAsRead').mockResolvedValue({ ...unread, read_at: new Date().toISOString() })

    renderBell()
    const bell = await screen.findByRole('button', { name: 'Notificaciones (1 sin leer)' })
    expect(bell).toHaveTextContent('1')

    await user.click(bell)
    expect(await screen.findByText('Tu propuesta fue aprobada')).toBeInTheDocument()
    expect(screen.getByText('Fuiste inscrito en una tutoría')).toBeInTheDocument()

    await user.click(screen.getByText('Tu propuesta fue aprobada'))
    expect(notificationsApi.markAsRead).toHaveBeenCalledWith('a1')
    expect(await screen.findByText('Pantalla de tutor y pares')).toBeInTheDocument()
  })

  it('marca todas como leídas', async () => {
    const user = userEvent.setup()
    vi.spyOn(notificationsApi, 'unreadCount').mockResolvedValue(1)
    vi.spyOn(notificationsApi, 'list').mockResolvedValue({ data: [unread], unreadCount: 1 })
    vi.spyOn(notificationsApi, 'markAllAsRead').mockResolvedValue()

    renderBell()
    await user.click(await screen.findByRole('button', { name: 'Notificaciones (1 sin leer)' }))
    await user.click(await screen.findByRole('button', { name: /Marcar todas como leídas/ }))

    expect(notificationsApi.markAllAsRead).toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('button', { name: /Marcar todas como leídas/ })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Notificaciones', hidden: true })).not.toHaveTextContent('1')
  })
})
