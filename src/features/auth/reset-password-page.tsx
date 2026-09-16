import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { api, ApiError } from '@/lib/api'
import { AuthFeedback } from './auth-feedback'
import { AuthShell } from './auth-shell'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const email = params.get('email') ?? ''
  const token = params.get('token') ?? ''

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      const response = await api.resetPassword({ email, token, password, password_confirmation: confirmation })
      setSuccess(response.message)
    } catch (caught: unknown) {
      setError(caught instanceof ApiError ? (caught.firstValidationMessage ?? caught.message) : 'No fue posible conectar con el servidor.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell title="Define una nueva contraseña" description={`Restablecimiento para ${email || 'tu cuenta'}.`}>
      <AuthFeedback error={error || (!email || !token ? 'El enlace está incompleto.' : null)} success={success} />
      <form onSubmit={submit} noValidate>
        <FieldGroup>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="password">Nueva contraseña</FieldLabel>
            <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(error)} required />
          </Field>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="confirmation">Confirma la contraseña</FieldLabel>
            <Input id="confirmation" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} aria-invalid={Boolean(error)} required />
            <FieldError>{error}</FieldError>
          </Field>
          <Button type="submit" disabled={pending || !email || !token} className="w-full">
            {pending && <Spinner data-icon="inline-start" />}
            Restablecer contraseña
          </Button>
          <Button variant="link" asChild><Link to="/login">Volver al inicio de sesión</Link></Button>
        </FieldGroup>
      </form>
    </AuthShell>
  )
}
