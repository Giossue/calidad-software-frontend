import { ChevronDownIcon, LogOutIcon } from 'lucide-react'

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

/** Datos del usuario en sesión; al pulsarlos se muestra el cierre de sesión. */
export function UserMenu({ name, email, roleLabel, initials, onSignOut, signingOut }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Menú de ${name}`}
          className="flex items-center gap-2 rounded-lg p-1 text-left transition-colors hover:bg-muted max-md:p-0 sm:gap-3 sm:p-1.5 sm:pr-3"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-blue text-xs font-medium text-white sm:size-9">
            {initials}
          </span>
          <span className="hidden flex-col sm:flex">
            <span className="max-w-[120px] truncate text-xs font-medium leading-tight text-foreground lg:max-w-none">{name}</span>
            <span className="max-w-[120px] truncate text-[11px] text-muted-foreground lg:max-w-none">{email}</span>
          </span>
          <ChevronDownIcon className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <UserMenuContent {...{ name, email, roleLabel, onSignOut, signingOut }} />
      </DropdownMenuContent>
    </DropdownMenu>
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
