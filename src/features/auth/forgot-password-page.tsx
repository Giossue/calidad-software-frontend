import { useState, type FormEvent } from 'react'
import { ArrowLeftIcon, SendIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Field, FieldGroup } from '@/components/ui/field'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { api, ApiError } from '@/lib/api'
import { AuthFeedback } from './auth-feedback'
import { AuthShell } from './auth-shell'

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
    <AuthShell title="Recupera tu contraseña" description="Te enviaremos un enlace si el correo está registrado.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        <FieldGroup>
          <AuthFeedback error={error} success={success} />
          <FormField id="email" label="Correo institucional">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Ej. nombre@ueb.edu.ec"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                setError(null)
              }}
              aria-invalid={Boolean(error)}
              required
            />
          </FormField>
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
    </AuthShell>
  )
}
