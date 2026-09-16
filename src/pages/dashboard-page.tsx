import { LogOutIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'

export function DashboardPage() {
  const { user, logout } = useAuth()

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between gap-4 border-b pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Panel principal</h1>
          <p className="text-sm text-muted-foreground">Bienvenido, {user?.name}.</p>
        </div>
        <Button variant="outline" onClick={() => void logout()}>
          <LogOutIcon data-icon="inline-start" />
          Cerrar sesión
        </Button>
      </header>
    </main>
  )
}
