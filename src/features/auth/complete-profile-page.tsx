import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2Icon, XCircleIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Field, FieldCounter, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { PasswordInput } from '@/components/ui/password-input'
import { PasswordStrength } from '@/components/ui/password-strength'
import { Spinner } from '@/components/ui/spinner'
import { isDegreeCycleNumber } from '@/lib/academic-stage'
import { api, ApiError, type AcademicFacultyOption } from '@/lib/api'
import { isPasswordValid } from '@/lib/password-rules'
import { identificationMaxLength, isValidIdentification, sanitizeIdentification, shouldShowIdentificationStatus } from '@/lib/cedula'
import { sanitizeDigits, sanitizeLetters } from '@/lib/sanitize'
import { cn } from '@/lib/utils'
import { useAuth } from './auth-context'
import { AuthFeedback } from './auth-feedback'
import { AuthShell } from './auth-shell'

/**
 * Datos faltantes de la cuenta (como la cédula) y, si tiene contraseña provisional, su reemplazo.
 * Los estudiantes además registran obligatoriamente facultad, carrera y ciclo; lo que envíen
 * reemplaza lo que ya tuvieran registrado.
 */
export function CompleteProfilePage() {
  const { user, replaceUser, logout } = useAuth()
  const [identification, setIdentification] = useState(user?.identification ?? '')
  // Si la cuenta ya trae cédula o pasaporte registrado, no puede cambiarse.
  const identificationLocked = Boolean(user?.identification)
  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  // Las cuentas sin contraseña provisional solo registran sus datos faltantes.
  const mustChangePassword = user?.must_change_password ?? true
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const isStudent = user?.role === 'estudiante'
  const [options, setOptions] = useState<readonly AcademicFacultyOption[] | null>(null)
  const [facultyId, setFacultyId] = useState(user?.faculty_id ? String(user.faculty_id) : '')
  const [careerId, setCareerId] = useState(user?.career_id ? String(user.career_id) : '')
  const [cycleId, setCycleId] = useState(user?.cycle_id ? String(user.cycle_id) : '')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!isStudent) return
    let isCurrent = true
    api.academicOptions()
      .then((loaded) => { if (isCurrent) setOptions(loaded) })
      .catch(() => { if (isCurrent) setError('No fue posible cargar las facultades, carreras y ciclos.') })
    return () => { isCurrent = false }
  }, [isStudent])

  const faculty = options?.find((option) => String(option.id) === facultyId)
  const career = faculty?.careers.find((option) => String(option.id) === careerId)
  const cycle = career?.cycles.find((option) => String(option.id) === cycleId)
  const academicComplete = !isStudent || cycle !== undefined

  const identificationValid = isValidIdentification(identification)
  const canSubmit = identificationValid && name.trim() !== '' && /^\d{10}$/.test(phone) && academicComplete && (!mustChangePassword || (isPasswordValid(password) && confirmation !== ''))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mustChangePassword && password !== confirmation) {
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
        ...(isStudent && faculty && career && cycle ? { faculty_id: faculty.id, career_id: career.id, cycle_id: cycle.id } : {}),
        ...(mustChangePassword ? { password, password_confirmation: confirmation } : {}),
      })
      toast.success('Datos guardados', { description: mustChangePassword ? 'Tu cuenta está lista. Usa tu nueva contraseña en los próximos ingresos.' : 'Tu cuenta está lista.' })
      replaceUser(updated)
    } catch (caught: unknown) {
      setError(caught instanceof ApiError ? (caught.firstValidationMessage ?? caught.message) : 'No fue posible conectar con el servidor.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell title="Completa tu cuenta" description={mustChangePassword ? `Antes de continuar, confirma tus datos y reemplaza la contraseña provisional enviada a ${user?.email ?? 'tu correo'}.` : (isStudent ? 'Antes de continuar, confirma tus datos y registra tu facultad, carrera y ciclo.' : 'Antes de continuar, registra tu cédula o pasaporte y confirma tus datos.')}>
      <AuthFeedback error={error} />
      <form onSubmit={submit} aria-label="Completar cuenta" noValidate>
        <FieldGroup>
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="profile-identification">Cédula o pasaporte</FieldLabel>
              <FieldCounter current={identification.length} max={identificationMaxLength(identification)} />
            </div>
            <div className="relative flex items-center">
              <Input id="profile-identification" value={identification} onChange={(event) => setIdentification(sanitizeIdentification(event.target.value))} required disabled={identificationLocked} maxLength={10} autoComplete="off" placeholder="0201234567 o AB1234567" className={cn(shouldShowIdentificationStatus(identification) && 'pr-9')} />
              {shouldShowIdentificationStatus(identification) && (
                identificationValid
                  ? <CheckCircle2Icon className="absolute right-3 size-4 text-emerald-500" aria-label="Identificación válida" />
                  : <XCircleIcon className="absolute right-3 size-4 text-destructive" aria-label="Identificación inválida" />
              )}
            </div>
            {identificationLocked && <FieldDescription>La cédula o pasaporte ya registrado no se puede modificar.</FieldDescription>}
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
          {isStudent && (
            <>
              <Field>
                <FieldLabel htmlFor="profile-faculty">Facultad</FieldLabel>
                <NativeSelect id="profile-faculty" value={faculty ? facultyId : ''} onChange={(event) => { setFacultyId(event.target.value); setCareerId(''); setCycleId('') }} disabled={options === null} required>
                  <option value="">{options === null ? 'Cargando…' : 'Selecciona tu facultad'}</option>
                  {options?.map((option) => <option key={option.id} value={String(option.id)}>{option.name}</option>)}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="profile-career">Carrera</FieldLabel>
                <NativeSelect id="profile-career" value={career ? careerId : ''} onChange={(event) => { setCareerId(event.target.value); setCycleId('') }} disabled={!faculty} required>
                  <option value="">{faculty ? 'Selecciona tu carrera' : 'Primero selecciona la facultad'}</option>
                  {faculty?.careers.map((option) => <option key={option.id} value={String(option.id)}>{option.name}</option>)}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="profile-cycle">Ciclo</FieldLabel>
                <NativeSelect id="profile-cycle" value={cycle ? cycleId : ''} onChange={(event) => setCycleId(event.target.value)} disabled={!career || career.cycles.length === 0} required>
                  <option value="">{!career ? 'Primero selecciona la carrera' : career.cycles.length === 0 ? 'La carrera no tiene ciclos registrados' : 'Selecciona el ciclo que cursas'}</option>
                  {career?.cycles.map((option) => (
                    <option key={option.id} value={String(option.id)}>
                      {`${option.number}.º ciclo · ${option.name}`}{option.section_name ? ` · Paralelo ${option.section_name}` : ''}{isDegreeCycleNumber(option.number) ? ' · Titulación' : ''}
                    </option>
                  ))}
                </NativeSelect>
                <FieldDescription>Hasta 5.º ciclo recibes tutorías; desde 6.º, titulación.</FieldDescription>
              </Field>
            </>
          )}
          {mustChangePassword && (
            <>
              <Field>
                <FieldLabel htmlFor="profile-password">Nueva contraseña</FieldLabel>
                <PasswordInput id="profile-password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby="profile-password-strength" required />
                <FieldDescription>Debe ser distinta de la contraseña provisional.</FieldDescription>
                <PasswordStrength id="profile-password-strength" password={password} />
              </Field>
              <Field>
                <FieldLabel htmlFor="profile-password-confirmation">Confirma la contraseña</FieldLabel>
                <PasswordInput id="profile-password-confirmation" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
              </Field>
            </>
          )}
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
