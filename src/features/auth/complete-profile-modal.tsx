import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, CheckCircle2Icon, CheckIcon, SaveIcon, XCircleIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { FieldGroup } from '@/components/ui/field'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { PasswordStrength } from '@/components/ui/password-strength'
import { SelectField } from '@/components/ui/select-field'
import { Spinner } from '@/components/ui/spinner'
import { isDegreeCycleNumber, maxCycleNumber } from '@/lib/academic-stage'
import { api, ApiError, type AcademicFacultyOption } from '@/lib/api'
import { isPasswordValid } from '@/lib/password-rules'
import { identificationMaxLength, isValidIdentification, sanitizeIdentification, shouldShowIdentificationStatus } from '@/lib/cedula'
import { sanitizeDigits, sanitizeLetters } from '@/lib/sanitize'
import { cn } from '@/lib/utils'
import { useAuth } from './auth-context'
import { AuthFeedback } from './auth-feedback'

type StepKey = 'datos' | 'academico' | 'password'

/**
 * Modal bloqueante que exige completar los datos faltantes de la cuenta (como la cédula) y,
 * si tiene contraseña provisional, reemplazarla, antes de permitir usar el resto del sistema.
 * No puede cerrarse (sin botón de cerrar, clic fuera ni Escape) hasta guardar los datos.
 * Los estudiantes además registran obligatoriamente facultad, carrera y ciclo; lo que envíen
 * reemplaza lo que ya tuvieran registrado.
 *
 * El formulario se completa por pasos (datos · datos académicos · contraseña) en vez de un
 * único formulario largo, y permite volver a un paso anterior para corregirlo.
 */
export function CompleteProfileModal() {
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

  const steps: ReadonlyArray<{ key: StepKey; label: string; heading: string; description: string }> = [
    { key: 'datos', label: 'Tus datos', heading: 'Confirma tus datos', description: 'Verifica tu identificación y datos de contacto.' },
    ...(isStudent ? [{ key: 'academico' as const, label: 'Datos académicos', heading: 'Datos académicos', description: 'Indica la facultad, carrera y ciclo que cursas actualmente.' }] : []),
    ...(mustChangePassword ? [{ key: 'password' as const, label: 'Contraseña', heading: 'Crea tu nueva contraseña', description: `Reemplaza la contraseña provisional enviada a ${user?.email ?? 'tu correo'} por una que solo tú conozcas.` }] : []),
  ]
  const [stepIndex, setStepIndex] = useState(0)
  // Recuerda el paso más lejano alcanzado para permitir saltar de vuelta a cualquier paso ya
  // visitado (y corregirlo) aunque el usuario haya retrocedido antes.
  const [maxReachedStep, setMaxReachedStep] = useState(0)
  const currentStep = steps[stepIndex]
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === steps.length - 1

  function goToStep(index: number) {
    setError(null)
    setStepIndex(index)
    setMaxReachedStep((max) => Math.max(max, index))
  }

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
  // Titulación es el último ciclo (número más alto) de la carrera elegida.
  const careerMaxCycle = career ? maxCycleNumber(career.cycles) : null

  const identificationValid = isValidIdentification(identification)
  const datosValid = identificationValid && name.trim() !== '' && /^\d{10}$/.test(phone)
  const passwordValid = isPasswordValid(password) && confirmation !== ''
  const canSubmit = datosValid && academicComplete && (!mustChangePassword || passwordValid)
  const stepValid = currentStep.key === 'datos' ? datosValid : currentStep.key === 'academico' ? academicComplete : passwordValid

  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isLastStep) {
      if (stepValid) goToStep(stepIndex + 1)
      return
    }
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
    <Dialog
      open
      onClose={() => {}}
      dismissible={false}
      title="Completa tu cuenta"
      description="Para continuar necesitamos que completes estos datos."
    >
      {steps.length > 1 && (
        <nav aria-label="Progreso del formulario" className="mb-5 flex items-center gap-2">
          {steps.map((step, index) => {
            const reached = index <= maxReachedStep
            const active = index === stepIndex
            return (
              <Button
                key={step.key}
                type="button"
                variant={active ? 'secondary' : 'tertiary'}
                size="sm"
                disabled={!reached}
                aria-current={active ? 'step' : undefined}
                onClick={() => reached && goToStep(index)}
                className="flex-1 justify-start"
              >
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full text-[11px]',
                    active && 'bg-primary text-primary-foreground',
                    !active && reached && 'bg-accent text-accent-foreground',
                    !reached && 'bg-muted text-muted-foreground',
                  )}
                >
                  {reached && !active ? <CheckIcon className="size-3" /> : index + 1}
                </span>
                <span className="hidden truncate sm:inline">{step.label}</span>
              </Button>
            )
          })}
        </nav>
      )}

      <AuthFeedback error={error} />
      <form onSubmit={handleFormSubmit} aria-label="Completar cuenta" noValidate>
        <FieldGroup>
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold text-foreground">{currentStep.heading}</h3>
            <p className="text-sm text-muted-foreground">{currentStep.description}</p>
          </div>

          {currentStep.key === 'datos' && (
            <>
              <FormField
                id="profile-identification"
                label="Cédula o pasaporte"
                tip={identificationLocked ? 'La cédula o pasaporte ya registrado no se puede modificar.' : undefined}
                counter={{ current: identification.length, max: identificationMaxLength(identification) }}
              >
                <div className="relative flex items-center">
                  <Input id="profile-identification" value={identification} onChange={(event) => setIdentification(sanitizeIdentification(event.target.value))} required disabled={identificationLocked} maxLength={10} autoComplete="off" placeholder="0201234567 o AB1234567" className={cn(shouldShowIdentificationStatus(identification) && 'pr-9')} />
                  {shouldShowIdentificationStatus(identification) && (
                    identificationValid
                      ? <CheckCircle2Icon className="absolute right-3 size-4 text-emerald-500" aria-label="Identificación válida" />
                      : <XCircleIcon className="absolute right-3 size-4 text-destructive" aria-label="Identificación inválida" />
                  )}
                </div>
              </FormField>
              <FormField id="profile-name" label="Nombre completo" counter={{ current: name.length, max: 150 }}>
                <Input id="profile-name" value={name} onChange={(event) => setName(sanitizeLetters(event.target.value, 150))} required maxLength={150} autoComplete="name" placeholder="Apellidos y nombres" />
              </FormField>
              <FormField id="profile-phone" label="Teléfono celular">
                <Input id="profile-phone" type="tel" inputMode="numeric" value={phone} onChange={(event) => setPhone(sanitizeDigits(event.target.value, 10))} required maxLength={10} autoComplete="tel" placeholder="0991234567" />
              </FormField>
            </>
          )}

          {currentStep.key === 'academico' && (
            <>
              <SelectField
                id="profile-faculty"
                label="Facultad"
                value={faculty ? facultyId : ''}
                onValueChange={(value) => { setFacultyId(value); setCareerId(''); setCycleId('') }}
                disabled={options === null}
                placeholder={options === null ? 'Cargando…' : 'Selecciona tu facultad'}
                options={(options ?? []).map((option) => ({ value: String(option.id), label: option.name }))}
              />
              <SelectField
                id="profile-career"
                label="Carrera"
                value={career ? careerId : ''}
                onValueChange={(value) => { setCareerId(value); setCycleId('') }}
                disabled={!faculty}
                placeholder={faculty ? 'Selecciona tu carrera' : 'Primero selecciona la facultad'}
                options={(faculty?.careers ?? []).map((option) => ({ value: String(option.id), label: option.name }))}
              />
              <SelectField
                id="profile-cycle"
                label="Ciclo"
                tip="El último ciclo de tu carrera es de titulación; los anteriores, de tutorías."
                value={cycle ? cycleId : ''}
                onValueChange={setCycleId}
                disabled={!career || career.cycles.length === 0}
                placeholder={!career ? 'Primero selecciona la carrera' : career.cycles.length === 0 ? 'La carrera no tiene ciclos registrados' : 'Selecciona el ciclo que cursas'}
                options={(career?.cycles ?? []).map((option) => ({
                  value: String(option.id),
                  label: `${option.number}.º ciclo · ${option.name}${option.section_name ? ` · Paralelo ${option.section_name}` : ''}${isDegreeCycleNumber(option.number, careerMaxCycle) ? ' · Titulación' : ''}`,
                }))}
              />
            </>
          )}

          {currentStep.key === 'password' && (
            <>
              <FormField id="profile-password" label="Nueva contraseña" tip="Debe ser distinta de la contraseña provisional.">
                <PasswordInput id="profile-password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby="profile-password-strength" required />
                <PasswordStrength id="profile-password-strength" password={password} />
              </FormField>
              <FormField id="profile-password-confirmation" label="Confirma la contraseña">
                <PasswordInput id="profile-password-confirmation" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
              </FormField>
            </>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            {!isFirstStep
              ? <Button type="button" variant="secondary" onClick={() => goToStep(stepIndex - 1)}><ArrowLeftIcon data-icon="inline-start" />Atrás</Button>
              : <span />}
            <Button type="submit" disabled={pending || (isLastStep ? !canSubmit : !stepValid)} className={cn(isFirstStep && 'flex-1')}>
              {pending ? <Spinner data-icon="inline-start" /> : isLastStep ? <SaveIcon data-icon="inline-start" /> : <ArrowRightIcon data-icon="inline-start" />}
              {isLastStep ? 'Guardar y continuar' : 'Siguiente'}
            </Button>
          </div>
          <Button type="button" variant="tertiary" onClick={() => void logout()}>Cerrar sesión</Button>
        </FieldGroup>
      </form>
    </Dialog>
  )
}
