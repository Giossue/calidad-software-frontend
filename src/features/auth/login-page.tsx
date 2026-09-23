import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ApiError } from '@/lib/api'
import { AuthFeedback } from './auth-feedback'
import { AuthShell } from './auth-shell'
import { useAuth } from './auth-context'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
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
    <AuthShell
      title="Bienvenido"
      description="Ingresa con tus credenciales institucionales para acceder a la gestión académica."
    >
      <AuthFeedback error={error} />
      <form onSubmit={submit} noValidate className="space-y-6 mt-4">
        <FieldGroup className="gap-5">
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="email" className="font-semibold text-slate-800 dark:text-slate-200">
              Correo electrónico
            </FieldLabel>
            <div className="relative flex items-center">
              <MailIcon className="absolute left-3.5 size-4 text-slate-400" />
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="nombre@ueb.edu.ec"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(error)}
                className="pl-10 h-11 border-slate-200 focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
                required
              />
            </div>
          </Field>

          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="password" className="font-semibold text-slate-800 dark:text-slate-200">
              Contraseña
            </FieldLabel>
            <div className="relative flex items-center">
              <LockIcon className="absolute left-3.5 size-4 text-slate-400" />
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(error)}
                className="pl-10 pr-10 h-11 border-slate-200 focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
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
            className="h-12 w-full bg-brand-blue hover:bg-brand-blue/90 text-white font-semibold text-base shadow-md transition-all duration-150"
          >
            {pending && <Spinner data-icon="inline-start" />}
            {pending ? 'Iniciando sesión…' : 'Ingresar'}
          </Button>
        </FieldGroup>
      </form>

      <div className="mt-8 flex items-center justify-between gap-4 border-t border-slate-100 pt-5 dark:border-slate-800">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          ¿No recuerdas tu contraseña?
        </span>
        <Button variant="link" size="sm" asChild className="text-brand-red hover:text-brand-red/80 font-semibold p-0">
          <Link to="/forgot-password">Recupérala aquí</Link>
        </Button>
      </div>
    </AuthShell>
  )
}
