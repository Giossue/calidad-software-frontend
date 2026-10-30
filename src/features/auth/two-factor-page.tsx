import { useState, type FormEvent } from 'react'
import { ShieldCheckIcon } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ApiError, challengeStore } from '@/lib/api'
import { AuthFeedback } from './auth-feedback'
import { AuthShell } from './auth-shell'
import { useAuth } from './auth-context'

export function TwoFactorPage() {
  const { completeTwoFactor } = useAuth()
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!challengeStore.get()) return <Navigate to="/login" replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      await completeTwoFactor(useRecovery ? { recovery_code: value } : { code: value })
      navigate('/', { replace: true })
    } catch (caught: unknown) {
      setError(caught instanceof ApiError ? (caught.firstValidationMessage ?? caught.message) : 'No fue posible validar el código.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell title="Verificación en dos pasos" description="Confirma que eres tú para finalizar el acceso.">
      <AuthFeedback error={error} />
      <form onSubmit={submit} noValidate>
        <FieldGroup>
          <FormField
            id="two-factor-code"
            label={useRecovery ? 'Código de recuperación' : 'Código de autenticación'}
            tip={useRecovery ? 'Usa uno de tus códigos de recuperación.' : 'Ingresa el código de seis dígitos de tu aplicación.'}
            error={error}
          >
            <Input id="two-factor-code" inputMode={useRecovery ? 'text' : 'numeric'} autoComplete="one-time-code" value={value} onChange={(event) => setValue(event.target.value)} aria-invalid={Boolean(error)} required />
          </FormField>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? <Spinner data-icon="inline-start" /> : <ShieldCheckIcon data-icon="inline-start" />}
            Verificar
          </Button>
          <Button type="button" variant="tertiary" onClick={() => { setUseRecovery((current) => !current); setValue(''); setError(null) }}>
            {useRecovery ? 'Usar código de autenticación' : 'Usar código de recuperación'}
          </Button>
        </FieldGroup>
      </form>
    </AuthShell>
  )
}
