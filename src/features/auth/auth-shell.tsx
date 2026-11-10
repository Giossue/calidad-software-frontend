import campusPhoto from '@/assets/ueb-campus-login.webp'
import { ThemeToggle } from '@/components/ui/theme-toggle'

interface AuthShellProps {
  readonly title: string
  readonly description: string
  readonly children: React.ReactNode
}

/**
 * Pantallas de acceso, como en sílabos: formulario a la izquierda y, en pantallas
 * grandes, el panel institucional con la foto del campus a la derecha.
 */
export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <main className="grid min-h-svh bg-background lg:grid-cols-2">
      <div className="relative flex flex-col p-6 md:p-10">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-sm flex-col gap-6">
            <header className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </header>
            {children}
          </div>
        </div>
      </div>
      <aside className="relative hidden overflow-hidden bg-brand-blue text-white lg:block" aria-hidden="true">
        <img src={campusPhoto} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-brand-blue/70" />
        <div className="relative flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
          <p className="text-4xl font-semibold tracking-tight">Tutorías y Titulación UEB</p>
          <p className="text-lg text-white/90">Seguimiento de tutorías y titulación de la Universidad Estatal de Bolívar</p>
        </div>
      </aside>
    </main>
  )
}
