import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ApiError } from '@/lib/api'
import { useAuth } from './auth-context'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Tras restablecer la contraseña se llega aquí con el correo de la cuenta.
  const [email, setEmail] = useState(() => {
    const state: unknown = location.state
    return typeof state === 'object' && state !== null && 'email' in state && typeof state.email === 'string' ? state.email : ''
  })
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)

    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (caught: unknown) {
      if (caught instanceof ApiError && caught.payload.code === 'two_factor_required') {
        navigate('/two-factor', { replace: true })
        return
      }
      setError(
        caught instanceof ApiError
          ? (caught.firstValidationMessage ?? caught.message)
          : 'No fue posible conectar con el servidor.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <LoginLayout>
      <form onSubmit={submit} noValidate className="mt-4 space-y-6">
        <FieldGroup className="gap-5">
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="email" className="font-semibold text-slate-800 dark:text-slate-200">
              Correo electrónico
            </FieldLabel>
            <div className="relative flex items-center">
              <MailIcon className="absolute left-3.5 size-4 text-slate-400" aria-hidden="true" />
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="nombre@ueb.edu.ec"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setError(null)
                }}
                aria-invalid={Boolean(error)}
                className="h-11 border-slate-200 pl-10 focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
                required
              />
            </div>
          </Field>

          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="password" className="font-semibold text-slate-800 dark:text-slate-200">
              Contraseña
            </FieldLabel>
            <div className="relative flex items-center">
              <LockIcon className="absolute left-3.5 size-4 text-slate-400" aria-hidden="true" />
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setError(null)
                }}
                aria-invalid={Boolean(error)}
                className="h-11 border-slate-200 pr-10 pl-10 focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                className="absolute right-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
              </button>
            </div>
            <FieldError>{error}</FieldError>
          </Field>

          <FieldDescription className="-mt-1 text-xs text-slate-500">
            Usa las credenciales asignadas para tu cuenta institucional.
          </FieldDescription>

          <Button
            type="submit"
            disabled={pending}
            size="lg"
            className="h-12 w-full bg-brand-blue text-base font-semibold text-white shadow-md transition-all duration-150 hover:bg-brand-blue/90"
          >
            {pending && <Spinner data-icon="inline-start" />}
            {pending ? 'Iniciando sesión…' : 'Ingresar'}
          </Button>
        </FieldGroup>
      </form>

      <div className="mt-8 flex items-center justify-between gap-4 border-t border-slate-100 pt-5 dark:border-slate-800">
        <span className="text-xs text-slate-500 dark:text-slate-400">¿No recuerdas tu contraseña?</span>
        <Link to="/forgot-password" className="text-sm font-semibold text-brand-red hover:text-brand-red/80 hover:underline">
          Recupérala aquí
        </Link>
      </div>
    </LoginLayout>
  )
}

/** Tarjeta de dos paneles del inicio de sesión: bienvenida institucional a la izquierda y formulario a la derecha. */
function LoginLayout({ children }: { readonly children: ReactNode }) {
  return (
    <main className="relative flex min-h-svh items-center justify-center bg-slate-100 p-4 sm:p-6 lg:p-10 dark:bg-slate-950">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl lg:grid-cols-[1.1fr_0.9fr] dark:border-slate-800 dark:bg-slate-900">
        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-blue via-brand-blue to-slate-950 p-8 text-white lg:flex lg:flex-col lg:items-start lg:justify-between xl:p-14">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(165,28,28,0.18),transparent_50%)]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgb(255_255_255_/_0.1)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255_/_0.1)_1px,transparent_1px)] [background-size:40px_40px] opacity-15"
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute -top-32 -right-32 size-[32rem] rounded-full border border-white/5" aria-hidden="true" />

          <div className="relative z-10 flex items-center gap-4">
            <div className="relative">
              <div className="pointer-events-none absolute inset-0 rounded-full bg-brand-red/20 blur-xl" />
              <img
                src="/ueb-logo.png"
                alt="Escudo de la Universidad Estatal de Bolívar"
                className="relative z-10 size-24 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] sm:size-28"
                width="112"
                height="112"
                loading="eager"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-widest text-slate-300 uppercase">Universidad Estatal de Bolívar</span>
              <span className="text-[11px] font-medium text-slate-400">Calidad del Software &bull; Grupo 2</span>
            </div>
          </div>

          <div className="relative z-10 my-auto flex max-w-lg flex-col gap-4 border-l-4 border-brand-red pl-7 xl:pl-9">
            <span className="text-xs font-bold tracking-[0.2em] text-brand-red-contrast uppercase">Plataforma Institucional</span>
            <h1 className="font-display text-5xl leading-[1.05] font-extrabold tracking-tight text-white xl:text-6xl">Bienvenido</h1>
            <p className="text-base leading-relaxed text-slate-300">
              Ingresa con tus credenciales institucionales para acceder a la gestión académica.
            </p>
          </div>

          <div className="relative z-10 text-xs font-medium text-slate-400">
            &copy; {new Date().getFullYear()} Universidad Estatal de Bolívar. Todos los derechos reservados.
          </div>
        </aside>

        <section className="flex items-center justify-center px-6 py-8 sm:px-10 lg:px-12 xl:px-16" aria-label="Formulario de autenticación">
          <div className="w-full max-w-md">
            <header className="mb-8 flex flex-col gap-2">
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-red/10 px-3 py-1 text-xs font-semibold text-brand-red dark:bg-brand-red/20 dark:text-brand-red-contrast">
                <span className="size-1.5 animate-pulse rounded-full bg-brand-red" />
                <span>Acceso Institucional</span>
              </div>
              <h2 className="text-2xl leading-tight font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                Sistema para el seguimiento de Tutorías y Titulación
              </h2>
              <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">Universidad Estatal de Bolívar</p>
            </header>

            {children}
          </div>
        </section>
      </div>
    </main>
  )
}
