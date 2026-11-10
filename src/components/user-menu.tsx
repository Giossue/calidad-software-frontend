import { ChevronsUpDownIcon, LogOutIcon } from 'lucide-react'

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

/**
 * Cuenta en sesión, al pie del menú lateral: iniciales, nombre y rol. Al pulsarla se
 * muestran el correo y el cierre de sesión. Con el menú contraído quedan solo las iniciales.
 */
export function UserMenu({ name, email, roleLabel, initials, onSignOut, signingOut }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Menú de ${name}`}
          data-tour="user-menu"
          className="flex w-full min-w-0 items-center gap-2 rounded-md p-2 text-left text-sm text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground">
            {initials}
          </span>
          <span className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-medium">{name}</span>
            <span className="truncate text-xs text-muted-foreground">{roleLabel}</span>
          </span>
          <ChevronsUpDownIcon className="ml-auto size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
        <UserMenuContent {...{ name, email, onSignOut, signingOut }} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserMenuContent({ name, email, onSignOut, signingOut }: Omit<UserMenuProps, 'initials' | 'roleLabel'>) {
  return (
    <>
      <DropdownMenuLabel className="flex flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">{name}</span>
        <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onSignOut} disabled={signingOut} variant="destructive">
        {signingOut ? <Spinner aria-hidden="true" /> : <LogOutIcon aria-hidden="true" />}
        {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </DropdownMenuItem>
    </>
  )
}
