import { useCallback, useEffect, useState } from 'react'
import { BellIcon, CheckCheckIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import { notificationsApi, type AppNotification } from '@/lib/api'
import { cn } from '@/lib/utils'

/** Cada cuánto se consulta si hay avisos nuevos. */
export const NOTIFICATIONS_POLL_MS = 45_000

const relativeTime = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

function timeAgo(value: string | null): string {
  if (!value) return ''
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [['day', 86_400], ['hour', 3_600], ['minute', 60]]
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relativeTime.format(Math.round(seconds / size), unit)
  }
  return 'hace un momento'
}

/** Campana con los avisos de acciones que afectan al usuario. */
export function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<readonly AppNotification[] | null>(null)
  const [error, setError] = useState(false)

  const refreshCount = useCallback(() => {
    notificationsApi.unreadCount().then(setUnread).catch(() => undefined)
  }, [])

  useEffect(() => {
    refreshCount()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshCount()
    }, NOTIFICATIONS_POLL_MS)
    window.addEventListener('focus', refreshCount)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshCount)
    }
  }, [refreshCount])

  useEffect(() => {
    if (!open) return
    setError(false)
    notificationsApi.list()
      .then(({ data, unreadCount }) => {
        setItems(data)
        setUnread(unreadCount)
      })
      .catch(() => setError(true))
  }, [open])

  async function openNotification(notification: AppNotification) {
    if (!notification.read_at) {
      setItems((current) => current?.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item) ?? null)
      setUnread((count) => Math.max(0, count - 1))
      notificationsApi.markAsRead(notification.id).catch(() => undefined)
    }
    if (notification.url) navigate(notification.url)
  }

  async function markAll() {
    setItems((current) => current?.map((item) => item.read_at ? item : { ...item, read_at: new Date().toISOString() }) ?? null)
    setUnread(0)
    await notificationsApi.markAllAsRead().catch(() => refreshCount())
  }

  const label = unread > 0 ? `Notificaciones (${unread} sin leer)` : 'Notificaciones'

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="tertiary" size="icon" aria-label={label} title={label} className="relative">
          <BellIcon />
          {unread > 0 && (
            <span aria-hidden="true" className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-bold leading-none text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <span className="text-sm font-semibold">Notificaciones</span>
          {unread > 0 && (
            <Button type="button" variant="tertiary" size="sm" onClick={() => void markAll()}>
              <CheckCheckIcon data-icon="inline-start" aria-hidden="true" />
              Marcar todas como leídas
            </Button>
          )}
        </div>
        <div className="max-h-[min(26rem,70vh)] overflow-y-auto py-1">
          {error ? (
            <p role="alert" className="px-3 py-6 text-center text-sm text-destructive">No se pudieron cargar las notificaciones.</p>
          ) : items === null ? (
            <p role="status" className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground"><Spinner aria-hidden="true" />Cargando…</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No tienes notificaciones.</p>
          ) : (
            items.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                onSelect={() => void openNotification(notification)}
                className={cn('mx-1 flex cursor-pointer flex-col items-start gap-0.5 rounded-md px-2.5 py-2', !notification.read_at && 'bg-brand-blue/5 dark:bg-primary/10')}
              >
                <span className="flex w-full items-start gap-2">
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', notification.read_at ? 'bg-transparent' : 'bg-brand-red')} aria-hidden="true" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={cn('text-sm leading-snug', notification.read_at ? 'font-medium text-foreground/80' : 'font-semibold text-foreground')}>
                      {notification.title}
                      {!notification.read_at && <span className="sr-only"> (sin leer)</span>}
                    </span>
                    <span className="text-xs leading-snug text-muted-foreground [overflow-wrap:anywhere]">{notification.body}</span>
                    <span className="text-[11px] text-muted-foreground/80">{timeAgo(notification.created_at)}</span>
                  </span>
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
