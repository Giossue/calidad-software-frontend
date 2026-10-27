import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { PasswordInput } from '@/components/ui/password-input'
import { PasswordStrength } from '@/components/ui/password-strength'
import { Spinner } from '@/components/ui/spinner'
import { api, ApiError } from '@/lib/api'
import { isPasswordValid } from '@/lib/password-rules'
import { AuthFeedback } from './auth-feedback'
import { AuthShell } from './auth-shell'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const email = params.get('email') ?? ''
  const token = params.get('token') ?? ''

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setError(null)
    setPending(true)
    try {
      const response = await api.resetPassword({ email, token, password, password_confirmation: confirmation })
      // El enlace ya se usó y no sirve para otro cambio: se continúa en el inicio de sesión.
      toast.success(response.message, { description: 'Inicia sesión con tu nueva contraseña.' })
      navigate('/login', { replace: true, state: { email } })
    } catch (caught: unknown) {
      setError(caught instanceof ApiError ? (caught.firstValidationMessage ?? caught.message) : 'No fue posible conectar con el servidor.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell title="Define una nueva contraseña" description={`Restablecimiento para ${email || 'tu cuenta'}.`}>
      <AuthFeedback error={error || (!email || !token ? 'El enlace está incompleto.' : null)} />
      <form onSubmit={submit} noValidate>
        <FieldGroup>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="password">Nueva contraseña</FieldLabel>
            <PasswordInput id="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(error)} aria-describedby="password-strength" required />
            <PasswordStrength id="password-strength" password={password} />
          </Field>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="confirmation">Confirma la contraseña</FieldLabel>
            <PasswordInput id="confirmation" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} aria-invalid={Boolean(error)} required />
            <FieldError>{error}</FieldError>
          </Field>
          <Button type="submit" disabled={pending || !email || !token || !isPasswordValid(password) || confirmation === ''} className="w-full">
            {pending && <Spinner data-icon="inline-start" />}
            Restablecer contraseña
          </Button>
          <Button variant="link" asChild><Link to="/login">Volver al inicio de sesión</Link></Button>
        </FieldGroup>
      </form>
    </AuthShell>
  )
}
