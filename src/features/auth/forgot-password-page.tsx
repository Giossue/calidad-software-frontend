import { useState, type FormEvent } from 'react'
import { ArrowLeftIcon, SendIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { api, ApiError } from '@/lib/api'
import { AuthFeedback } from './auth-feedback'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      const response = await api.forgotPassword(email)
      setSuccess(response.message)
    } catch (caught: unknown) {
      setError(caught instanceof ApiError ? (caught.firstValidationMessage ?? caught.message) : 'No fue posible conectar con el servidor.')
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
                  <h1 className="text-2xl font-bold">Recupera tu contraseña</h1>
                  <p className="text-sm text-balance text-muted-foreground">
                    Te enviaremos un enlace si el correo está registrado.
                  </p>
                </div>
                <AuthFeedback error={error} success={success} />
                <Field data-invalid={Boolean(error)}>
                  <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
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
                </Field>
                <Field>
                  <Button type="submit" disabled={pending}>
                    {pending ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
                    {pending ? 'Enviando…' : 'Enviar enlace'}
                  </Button>
                </Field>
                <Field>
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center gap-1.5 text-sm underline-offset-4 hover:underline"
                  >
                    <ArrowLeftIcon className="size-4" aria-hidden="true" />
                    Volver al inicio de sesión
                  </Link>
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
