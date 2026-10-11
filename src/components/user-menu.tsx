import { ChevronDownIcon, LogOutIcon, MoonIcon, Settings2Icon, SunIcon } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import { useThemeToggle } from '@/components/ui/theme-toggle'

interface UserMenuProps {
  readonly name: string
  readonly email: string
  readonly roleLabel: string
  readonly initials: string
  readonly onOpenAccessibility: () => void
  readonly onSignOut: () => void
  readonly signingOut: boolean
}

/** Datos del usuario en sesión; al pulsarlos se abren accesibilidad, tema y cierre de sesión. */
export function UserMenu({ name, email, roleLabel, initials, onOpenAccessibility, onSignOut, signingOut }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Menú de ${name}`}
          className="flex items-center gap-2 rounded-full border border-border bg-card p-1 text-left shadow-2xs transition-colors hover:bg-muted max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:shadow-none sm:gap-3 sm:p-1.5 sm:pr-3"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-blue text-xs font-bold text-white sm:size-9">
            {initials}
          </span>
          <span className="hidden flex-col sm:flex">
            <span className="max-w-[120px] truncate text-xs font-bold leading-tight text-foreground lg:max-w-none">{name}</span>
            <span className="max-w-[120px] truncate text-[11px] font-medium text-muted-foreground lg:max-w-none">{email}</span>
          </span>
          <ChevronDownIcon className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      {/* El contenido se monta al abrir, así el tema mostrado siempre es el vigente. */}
      <DropdownMenuContent align="end" className="w-64">
        <UserMenuContent {...{ name, email, roleLabel, onOpenAccessibility, onSignOut, signingOut }} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserMenuContent({ name, email, roleLabel, onOpenAccessibility, onSignOut, signingOut }: Omit<UserMenuProps, 'initials'>) {
  const { isDark, toggle } = useThemeToggle()

  return (
    <>
      <DropdownMenuLabel className="flex flex-col gap-0.5">
        <span className="truncate text-sm font-semibold text-foreground">{name}</span>
        <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
        <span className="text-xs font-normal text-muted-foreground">{roleLabel}</span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onOpenAccessibility}>
        <Settings2Icon aria-hidden="true" />
        Accesibilidad
      </DropdownMenuItem>
      <DropdownMenuItem
        // El menú sigue abierto para ver el cambio de tema.
        onSelect={(event) => {
          event.preventDefault()
          toggle(event.currentTarget as Element)
        }}
      >
        {isDark ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}
        {isDark ? 'Modo claro' : 'Modo oscuro'}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onSignOut} disabled={signingOut} variant="destructive">
        {signingOut ? <Spinner aria-hidden="true" /> : <LogOutIcon aria-hidden="true" />}
        {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </DropdownMenuItem>
    </>
  )
}
