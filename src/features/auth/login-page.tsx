import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

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
      setError(caught instanceof ApiError
        ? (caught.firstValidationMessage ?? caught.message)
        : 'No fue posible conectar con el servidor.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell title="Bienvenido" description="Ingresa con tu correo institucional para continuar.">
        <AuthFeedback error={error} />
        <form onSubmit={submit} noValidate className="space-y-6">
          <FieldGroup className="gap-5">
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
              <Input id="email" name="email" type="email" autoComplete="email" placeholder="nombre@universidad.edu.ec"
                value={email} onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(error)} required />
            </Field>

            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="password">Contraseña</FieldLabel>
              <Input id="password" name="password" type="password" autoComplete="current-password"
                value={password} onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(error)} required />
              <FieldError>{error}</FieldError>
            </Field>
            <FieldDescription className="-mt-1">Usa las credenciales asignadas para tu cuenta.</FieldDescription>

            <Button type="submit" disabled={pending} size="lg" className="h-12 w-full">
              {pending && <Spinner data-icon="inline-start" />}
              Ingresar
            </Button>
          </FieldGroup>
        </form>
        <div className="mt-6 flex items-center justify-between gap-4 border-t border-border/70 pt-5">
          <span className="text-xs text-muted-foreground">¿No recuerdas tu contraseña?</span>
          <Button variant="link" size="sm" asChild><Link to="/forgot-password">Recupérala aquí</Link></Button>
        </div>
    </AuthShell>
  )
}
