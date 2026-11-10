import { ThemeToggle } from '@/components/ui/theme-toggle'

interface AuthShellProps {
  readonly title: string
  readonly description: string
  readonly children: React.ReactNode
}

/**
 * Pantallas de acceso: sello, título, una línea de contexto y el formulario centrado.
 * Sin paneles decorativos; el mismo marco para ingresar, recuperar y verificar.
 */
export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-sm flex-col gap-8">
        <header className="flex flex-col items-center gap-4 text-center">
          <img src="/ueb-logo.png" alt="Universidad Estatal de Bolívar" className="size-14 object-contain" width="56" height="56" />
          <div className="flex flex-col gap-1.5">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-balance text-muted-foreground">{description}</p>
          </div>
        </header>
        {children}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Universidad Estatal de Bolívar · Sistema de Tutorías y Titulación
      </p>
    </main>
  )
}
