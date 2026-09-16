import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ApiError } from '@/lib/api'
import { AuthFeedback } from './auth-feedback'
import { AuthShell } from './auth-shell'
import { useAuth } from './auth-context'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [values, setValues] = useState({ identification: '', name: '', email: '', password: '', password_confirmation: '' })
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function update(key: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      await register(values)
      navigate('/', { replace: true })
    } catch (caught: unknown) {
      setError(caught instanceof ApiError ? (caught.firstValidationMessage ?? caught.message) : 'No fue posible conectar con el servidor.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell title="Crea tu cuenta" description="Registra tus datos para ingresar al sistema.">
      <AuthFeedback error={error} />
      <form onSubmit={submit} noValidate>
        <FieldGroup>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="identification">Cédula</FieldLabel>
            <Input id="identification" inputMode="numeric" autoComplete="off" maxLength={20} value={values.identification} onChange={(event) => update('identification', event.target.value)} aria-invalid={Boolean(error)} required />
          </Field>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="name">Nombre completo</FieldLabel>
            <Input id="name" autoComplete="name" value={values.name} onChange={(event) => update('name', event.target.value)} aria-invalid={Boolean(error)} required />
          </Field>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
            <Input id="email" type="email" autoComplete="email" value={values.email} onChange={(event) => update('email', event.target.value)} aria-invalid={Boolean(error)} required />
          </Field>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="password">Contraseña</FieldLabel>
            <Input id="password" type="password" autoComplete="new-password" value={values.password} onChange={(event) => update('password', event.target.value)} aria-invalid={Boolean(error)} required />
          </Field>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="password-confirmation">Confirma la contraseña</FieldLabel>
            <Input id="password-confirmation" type="password" autoComplete="new-password" value={values.password_confirmation} onChange={(event) => update('password_confirmation', event.target.value)} aria-invalid={Boolean(error)} required />
            <FieldError>{error}</FieldError>
          </Field>
          <Button type="submit" disabled={pending} className="w-full">
            {pending && <Spinner data-icon="inline-start" />}
            Crear cuenta
          </Button>
          <Button variant="link" asChild><Link to="/login">Ya tengo una cuenta</Link></Button>
        </FieldGroup>
      </form>
    </AuthShell>
  )
}
