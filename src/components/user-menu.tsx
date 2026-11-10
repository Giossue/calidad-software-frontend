import { useState } from 'react'
import { ChevronDownIcon, LogOutIcon } from 'lucide-react'

import { ConfirmModal } from '@/components/ui/confirm-modal'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'

interface UserMenuProps {
  readonly name: string
  readonly email: string
  readonly roleLabel: string
  readonly initials: string
  readonly onSignOut: () => void
  readonly signingOut: boolean
}

/** Cuenta en sesión, en la cabecera: iniciales y nombre; el menú muestra correo, rol y cerrar sesión. */
export function UserMenu({ name, email, roleLabel, initials, onSignOut, signingOut }: UserMenuProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Menú de ${name}`}
            data-tour="user-menu"
            className="inline-flex h-11 items-center gap-2 rounded-md px-2 text-left outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-medium text-muted-foreground">
              {initials}
            </span>
            <span className="hidden max-w-48 truncate text-sm font-medium sm:block">{name}</span>
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4} className="w-72">
          <UserMenuContent {...{ name, email, roleLabel, signingOut }} onSignOut={() => setConfirmOpen(true)} />
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          onSignOut()
        }}
        title="¿Cerrar sesión?"
        description="Tendrás que ingresar de nuevo con tu correo y contraseña."
        confirmLabel="Cerrar sesión"
        confirmIcon={LogOutIcon}
        pending={signingOut}
      />
    </>
  )
}

function UserMenuContent({ name, email, roleLabel, onSignOut, signingOut }: Omit<UserMenuProps, 'initials'>) {
  return (
    <>
      <DropdownMenuLabel className="flex flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">{name}</span>
        <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
        <span className="text-xs font-normal text-muted-foreground">{roleLabel}</span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onSignOut} disabled={signingOut} variant="destructive">
        {signingOut ? <Spinner aria-hidden="true" /> : <LogOutIcon aria-hidden="true" />}
        {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </DropdownMenuItem>
    </>
  )
}
