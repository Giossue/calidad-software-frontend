import { ArrowUpRightIcon, CheckIcon, GraduationCapIcon, ScanLineIcon } from 'lucide-react'

interface AuthShellProps {
  readonly title: string
  readonly description: string
  readonly children: React.ReactNode
}

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <main className="min-h-svh bg-background p-3 sm:p-5 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100svh-2rem)] max-w-7xl overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-[0_24px_80px_-32px_oklch(0.2_0.06_170_/_0.45)] lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="relative hidden overflow-hidden bg-primary p-8 text-primary-foreground lg:flex lg:min-h-[720px] lg:flex-col lg:justify-between xl:p-12">
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(oklch(1_0_0_/_0.08)_1px,transparent_1px),linear-gradient(90deg,oklch(1_0_0_/_0.08)_1px,transparent_1px)] [background-size:48px_48px]" aria-hidden="true" />
          <div className="absolute -right-40 -top-40 size-[34rem] rounded-full border border-primary-foreground/10" aria-hidden="true" />
          <div className="absolute -bottom-56 -left-36 size-[32rem] rounded-full border border-primary-foreground/10" aria-hidden="true" />

          <div className="relative z-10 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-lg shadow-black/10">
              <GraduationCapIcon aria-hidden="true" className="size-6" />
            </span>
            <span className="text-sm font-semibold tracking-[0.18em] uppercase">Calidad Software</span>
          </div>

          <div className="relative z-10 max-w-xl">
            <div className="mb-6 flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-primary-foreground/65 uppercase">
              <ScanLineIcon aria-hidden="true" className="size-4" />
              Seguimiento que deja evidencia
            </div>
            <h2 className="max-w-lg font-display text-5xl leading-[0.98] tracking-[-0.045em] xl:text-7xl">
              Cada avance cuenta.
            </h2>
            <p className="mt-6 max-w-md text-base leading-7 text-primary-foreground/70">
              Accede al espacio donde tutorías, actividades y resultados mantienen su trazabilidad.
            </p>

            <div className="mt-10 flex max-w-md items-end gap-3" aria-label="Indicador visual de trazabilidad">
              <div className="relative h-28 flex-1 overflow-hidden rounded-2xl border border-primary-foreground/15 bg-primary-foreground/[0.06] p-4">
                <div className="absolute inset-x-4 top-1/2 border-t border-dashed border-primary-foreground/20" aria-hidden="true" />
                <svg viewBox="0 0 240 80" className="absolute inset-0 h-full w-full" fill="none" aria-hidden="true">
                  <path d="M4 58C28 58 29 26 55 26C79 26 78 50 103 50C127 50 128 17 153 17C179 17 177 38 204 38C221 38 225 23 236 23" stroke="oklch(0.93 0.18 108)" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="55" cy="26" r="4" fill="oklch(0.93 0.18 108)" />
                  <circle cx="153" cy="17" r="4" fill="oklch(0.93 0.18 108)" />
                  <circle cx="236" cy="23" r="4" fill="oklch(0.93 0.18 108)" />
                </svg>
                <span className="absolute bottom-3 left-4 text-[10px] font-medium tracking-[0.14em] text-primary-foreground/50 uppercase">Proceso visible</span>
              </div>
              <div className="flex size-28 flex-col justify-between rounded-2xl bg-accent p-4 text-accent-foreground">
                <ArrowUpRightIcon aria-hidden="true" className="size-5 self-end" />
                <span className="text-xs font-semibold leading-4">Listo para avanzar</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between gap-4 border-t border-primary-foreground/15 pt-5 text-xs text-primary-foreground/55">
            <span>Control académico con contexto</span>
            <span className="flex items-center gap-1.5"><CheckIcon aria-hidden="true" className="size-3.5" /> Acceso protegido</span>
          </div>
        </aside>

        <section className="flex items-center px-6 py-10 sm:px-12 lg:px-14 xl:px-20" aria-labelledby="auth-title">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-10 flex items-center gap-2 lg:hidden">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <GraduationCapIcon aria-hidden="true" className="size-5" />
              </span>
              <span className="text-sm font-semibold tracking-[0.12em] uppercase">Calidad Software</span>
            </div>
            <header className="mb-8 flex flex-col gap-2">
              <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Acceso seguro</p>
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
