interface AuthShellProps {
  readonly title: string
  readonly description: string
  readonly children: React.ReactNode
}

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-slate-100 p-4 sm:p-6 lg:p-10 dark:bg-slate-950">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[1.1fr_0.9fr]">

        {/* Panel Azul Oscuro (Izquierda) */}
        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-blue via-brand-blue to-slate-950 p-8 text-white lg:flex lg:flex-col lg:items-start lg:justify-between xl:p-14">
          {/* Luz ambiental radial de fondo */}
          <div
            className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(165,28,28,0.18),transparent_50%)] pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 opacity-15 [background-image:linear-gradient(rgb(255_255_255_/_0.1)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255_/_0.1)_1px,transparent_1px)] [background-size:40px_40px] pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute -right-32 -top-32 size-[32rem] rounded-full border border-white/5 pointer-events-none"
            aria-hidden="true"
          />

          {/* Escudo Flotante sin cajas blancas ni fondos cuadrados */}
          <div className="relative z-10 flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-brand-red/20 blur-xl pointer-events-none" />
              <img
                src="/ueb-logo.png"
                alt="Escudo de la Universidad Estatal de Bolívar"
                className="relative z-10 size-24 object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] sm:size-28"
                width="112"
                height="112"
                loading="eager"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-widest text-slate-300 uppercase">
                UNIVERSIDAD ESTATAL DE BOLÍVAR
              </span>
              <span className="text-[11px] font-medium text-slate-400">
                Calidad del Software &bull; Grupo 2
              </span>
            </div>
          </div>

          {/* Mensaje Principal de Bienvenida */}
          <div className="relative z-10 my-auto flex flex-col gap-4 max-w-lg border-l-4 border-brand-red pl-7 xl:pl-9">
            <span className="text-xs font-bold tracking-[0.2em] text-brand-red-contrast uppercase">
              Plataforma Institucional
            </span>
            <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-white xl:text-6xl">
              {title}
            </h1>
            <p className="text-base leading-relaxed text-slate-300">
              {description}
            </p>
          </div>

          {/* Footer del Panel */}
          <div className="relative z-10 text-xs text-slate-400 font-medium">
            &copy; {new Date().getFullYear()} Universidad Estatal de Bolívar. Todos los derechos reservados.
          </div>
        </aside>

        {/* Sección del Formulario (Derecha) */}
        <section className="flex items-center justify-center px-6 py-8 sm:px-10 lg:px-12 xl:px-16" aria-label="Formulario de autenticación">
          <div className="w-full max-w-md">

            {/* Encabezado del Formulario */}
            <header className="mb-8 flex flex-col gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-brand-red/10 px-3 py-1 text-xs font-semibold text-brand-red dark:bg-brand-red/20 dark:text-brand-red-contrast w-fit">
                <span className="size-1.5 rounded-full bg-brand-red animate-pulse" />
                <span>Acceso Institucional</span>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl leading-tight">
                Sistema para el seguimiento de Tutorías y Titulación
              </h2>
              <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                UNIVERSIDAD ESTATAL DE BOLÍVAR
              </p>
            </header>

            {children}
          </div>
        </section>
      </div>
    </main>
  )
}
