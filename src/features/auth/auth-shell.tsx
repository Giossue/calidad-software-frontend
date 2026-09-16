import { GraduationCapIcon } from 'lucide-react'

interface AuthShellProps {
  readonly title: string
  readonly description: string
  readonly children: React.ReactNode
}

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-12">
      <section className="flex w-full max-w-sm flex-col gap-8" aria-labelledby="auth-title">
        <header className="flex flex-col items-center gap-3 text-center">
          <GraduationCapIcon aria-hidden="true" className="size-10" />
          <div className="flex flex-col gap-1">
            <h1 id="auth-title" className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </header>
        {children}
      </section>
    </main>
  )
}
