import { useState, type FormEvent } from 'react'
import { LogInIcon } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Field, FieldGroup } from '@/components/ui/field'
import { FormField } from '@/components/ui/form-field'
import { PasswordInput } from '@/components/ui/password-input'
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
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <span className="flex items-center gap-2 font-medium">
            <img src="/ueb-logo.png" alt="" className="size-8 object-contain" width="32" height="32" />
            Universidad Estatal de Bolívar
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <form onSubmit={submit} noValidate className="flex flex-col gap-6">
              <FieldGroup>
                <div className="flex flex-col items-center gap-1 text-center">
                  <h1 className="text-2xl font-bold">Ingresa a tu cuenta</h1>
                  <p className="text-sm text-balance text-muted-foreground">
                    Usa tus credenciales institucionales para acceder al sistema de tutorías y titulación.
                  </p>
                </div>
                <FormField id="email" label="Correo electrónico">
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
                    required
                  />
                </FormField>
                <FormField id="password" label="Contraseña" error={error}>
                  <PasswordInput
                    id="password"
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value)
                      setError(null)
                    }}
                    aria-invalid={Boolean(error)}
                    required
                  />
                  <Link to="/forgot-password" className="self-end text-sm underline-offset-4 hover:underline">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </FormField>
                <Field>
                  <Button type="submit" disabled={pending}>
                    {pending ? <Spinner data-icon="inline-start" /> : <LogInIcon data-icon="inline-start" />}
                    {pending ? 'Iniciando sesión…' : 'Ingresar'}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-blue to-slate-950 lg:block" aria-hidden="true">
        <img
          src="/ueb-logo.png"
          alt=""
          className="absolute top-1/2 left-1/2 size-64 -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-2xl"
        />
      </div>
    </div>
  )
}
