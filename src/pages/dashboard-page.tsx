import { useState } from 'react'
import { CheckCircle2Icon, LogOutIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { AcademicPage } from '@/features/academic/academic-page'
import { useAuth } from '@/features/auth/auth-context'

export function DashboardPage() {
  const { user, logout } = useAuth()
  const [pending, setPending] = useState(false)

  async function signOut() {
    setPending(true)
    await logout()
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-7xl flex-col gap-10 px-6 py-8 sm:px-8 lg:px-10">
      <header className="flex items-center justify-between gap-4 border-b pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Panel principal</h1>
          <p className="text-sm text-muted-foreground">Bienvenido, {user?.name}.</p>
        </div>
        <Button variant="outline" onClick={() => void signOut()} disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : <LogOutIcon data-icon="inline-start" />}
          {pending ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </Button>
      </header>
      <section className="grid gap-4 sm:grid-cols-2" aria-label="Estado de la sesión">
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">Sesión activa</p>
          <div className="mt-4 flex items-center gap-2 text-sm font-medium"><CheckCircle2Icon className="size-4 text-primary" /> Acceso verificado</div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">Cuenta</p>
          <p className="mt-4 text-sm font-medium">{user?.email}</p>
        </div>
      </section>
      {user?.role === 'administrador' ? <AcademicPage /> : <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm"><p className="text-sm text-muted-foreground">Tu cuenta no tiene permisos para administrar el catálogo académico.</p></section>}
    </main>
  )
}
