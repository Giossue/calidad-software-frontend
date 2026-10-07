import { useState, type FormEvent } from 'react'
import { CheckCircle2Icon, XCircleIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Field, FieldCounter, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Spinner } from '@/components/ui/spinner'
import { api, ApiError } from '@/lib/api'
import { identificationMaxLength, isValidIdentification, sanitizeIdentification, shouldShowIdentificationStatus } from '@/lib/cedula'
import { sanitizeDigits, sanitizeLetters } from '@/lib/sanitize'
import { cn } from '@/lib/utils'
import { useAuth } from './auth-context'
import { AuthFeedback } from './auth-feedback'
import { AuthShell } from './auth-shell'

/** Primer ingreso de una cuenta creada por carga masiva: datos faltantes y nueva contraseña. */
export function CompleteProfilePage() {
  const { user, replaceUser, logout } = useAuth()
  const [identification, setIdentification] = useState(user?.identification ?? '')
  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const identificationValid = isValidIdentification(identification)
  const canSubmit = identificationValid && name.trim() !== '' && /^\d{10}$/.test(phone) && password !== '' && confirmation !== ''

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setError(null)
    setPending(true)
    try {
      const updated = await api.completeProfile({
        identification,
        name: name.trim(),
        phone,
        password,
        password_confirmation: confirmation,
      })
      toast.success('Datos guardados', { description: 'Tu cuenta está lista. Usa tu nueva contraseña en los próximos ingresos.' })
      replaceUser(updated)
    } catch (caught: unknown) {
      setError(caught instanceof ApiError ? (caught.firstValidationMessage ?? caught.message) : 'No fue posible conectar con el servidor.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell title="Completa tu cuenta" description={`Antes de continuar, confirma tus datos y reemplaza la contraseña provisional enviada a ${user?.email ?? 'tu correo'}.`}>
      <AuthFeedback error={error} />
      <form onSubmit={submit} aria-label="Completar cuenta" noValidate>
        <FieldGroup>
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="profile-identification">Cédula o pasaporte</FieldLabel>
              <FieldCounter current={identification.length} max={identificationMaxLength(identification)} />
            </div>
            <div className="relative flex items-center">
              <Input id="profile-identification" value={identification} onChange={(event) => setIdentification(sanitizeIdentification(event.target.value))} required maxLength={10} autoComplete="off" placeholder="0201234567 o AB1234567" className={cn(shouldShowIdentificationStatus(identification) && 'pr-9')} />
              {shouldShowIdentificationStatus(identification) && (
                identificationValid
                  ? <CheckCircle2Icon className="absolute right-3 size-4 text-emerald-500" aria-label="Identificación válida" />
                  : <XCircleIcon className="absolute right-3 size-4 text-destructive" aria-label="Identificación inválida" />
              )}
            </div>
          </Field>
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="profile-name">Nombre completo</FieldLabel>
              <FieldCounter current={name.length} max={150} />
            </div>
            <Input id="profile-name" value={name} onChange={(event) => setName(sanitizeLetters(event.target.value, 150))} required maxLength={150} autoComplete="name" placeholder="Apellidos y nombres" />
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-phone">Teléfono celular</FieldLabel>
            <Input id="profile-phone" type="tel" inputMode="numeric" value={phone} onChange={(event) => setPhone(sanitizeDigits(event.target.value, 10))} required maxLength={10} autoComplete="tel" placeholder="0991234567" />
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-password">Nueva contraseña</FieldLabel>
            <PasswordInput id="profile-password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            <FieldDescription>Debe ser distinta de la contraseña provisional.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-password-confirmation">Confirma la contraseña</FieldLabel>
            <PasswordInput id="profile-password-confirmation" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
          </Field>
          <Button type="submit" disabled={pending || !canSubmit} className="w-full">
            {pending && <Spinner data-icon="inline-start" />}
            Guardar y continuar
          </Button>
          <Button type="button" variant="link" onClick={() => void logout()}>Cerrar sesión</Button>
        </FieldGroup>
      </form>
    </AuthShell>
  )
}
