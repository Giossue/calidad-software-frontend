import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
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
      <AuthFeedback error={error} success={success} />
      <form onSubmit={submit} noValidate>
        <FieldGroup>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
            <Input id="email" type="email" autoComplete="email" placeholder="nombre@ueb.edu.ec" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(error)} required />
          </Field>
          <Button type="submit" disabled={pending} className="w-full">
            {pending && <Spinner data-icon="inline-start" />}
            Enviar enlace
          </Button>
          <Button variant="link" asChild><Link to="/login">Volver al inicio de sesión</Link></Button>
        </FieldGroup>
      </form>
    </AuthShell>
  )
}
