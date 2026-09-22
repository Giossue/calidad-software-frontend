interface AuthShellProps {
  readonly title: string
  readonly description: string
  readonly children: React.ReactNode
}

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <main className="min-h-svh bg-background p-3 sm:p-5 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100svh-2rem)] max-w-7xl overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-[0_24px_80px_-32px_oklch(0.2_0.06_170_/_0.45)] lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="relative hidden overflow-hidden bg-brand-blue p-8 text-white lg:flex lg:min-h-[720px] lg:items-center xl:p-12">
          <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgb(255_255_255_/_0.08)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255_/_0.08)_1px,transparent_1px)] [background-size:48px_48px]" aria-hidden="true" />
          <div className="absolute -right-40 -top-40 size-[34rem] rounded-full border border-white/10" aria-hidden="true" />
          <div className="absolute -bottom-56 -left-36 size-[32rem] rounded-full border border-brand-red/25" aria-hidden="true" />

          <div className="relative z-10 max-w-xl border-l-4 border-brand-red pl-7 xl:pl-9">
            <h2 className="max-w-lg font-display text-5xl leading-[0.98] tracking-[-0.045em] xl:text-7xl">
              Cada avance cuenta.
            </h2>
            <p className="mt-6 max-w-md text-base leading-7 text-white/70">
              Accede al espacio donde tutorías, actividades y resultados mantienen su trazabilidad.
            </p>
          </div>
        </aside>

        <section className="flex items-center px-6 py-10 sm:px-12 lg:px-14 xl:px-20" aria-labelledby="auth-title">
          <div className="mx-auto w-full max-w-md">
            <header className="mb-8 flex flex-col gap-2">
              <p className="text-xs font-semibold tracking-[0.18em] text-brand-red uppercase">Acceso seguro</p>
              <h1 id="auth-title" className="font-display text-4xl leading-tight tracking-[-0.035em] sm:text-5xl">{title}</h1>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
            </header>
            {children}
          </div>
        </section>
      </div>
    </main>
  )
}
