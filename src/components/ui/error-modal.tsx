import { useEffect, type ReactNode } from 'react'
import { AlertCircleIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'

export interface FriendlyErrorInfo {
  title: string
  description: string
  field?: string
}

function isReadableSpanishMessage(msg: string | undefined): boolean {
  if (!msg) return false
  const lower = msg.toLowerCase().trim()
  if (lower.startsWith('validation.') || lower.includes('validation.')) return false
  if (lower.startsWith('the ') || lower.includes('has already been taken') || lower.includes('field must be')) return false
  if (lower === 'no se pudo registrar' || lower === 'no se pudo completar la solicitud.' || lower === 'error de validación') return false
  return true
}

export function getFriendlyError(error: unknown): FriendlyErrorInfo {
  // Manejo si el error ya viene como string
  if (typeof error === 'string') {
    return parseFriendlyString(error)
  }

  if (error instanceof ApiError) {
    const errorsDict = error.payload?.errors ?? {}
    const errorKeys = Object.keys(errorsDict)
    const allMessages = Object.values(errorsDict).flat()
    const rawMessage = error.firstValidationMessage ?? error.message ?? ''
    const fullText = [rawMessage, ...allMessages].join(' ').toLowerCase()

    // 1. Teléfono
    const hasPhoneKey = errorKeys.some((k) => k.includes('phone') || k.includes('telefono'))
    if (hasPhoneKey || fullText.includes('phone') || fullText.includes('teléfono') || fullText.includes('telefono')) {
      if (
        fullText.includes('taken') ||
        fullText.includes('ya') ||
        fullText.includes('registrad') ||
        fullText.includes('duplicad') ||
        fullText.includes('unique')
      ) {
        return {
          title: 'Teléfono ya registrado',
          description: isReadableSpanishMessage(rawMessage) ? rawMessage : 'El número de teléfono ingresado ya se encuentra registrado en otra cuenta.',
          field: 'phone',
        }
      }
      return {
        title: 'Teléfono inválido',
        description: isReadableSpanishMessage(rawMessage)
          ? rawMessage
          : 'El número de teléfono debe tener exactamente 10 dígitos numéricos (ejemplo: 0991234567).',
        field: 'phone',
      }
    }

    // 2. Cédula de identidad
    const hasIdKey = errorKeys.some((k) => k.includes('identification') || k.includes('cedula'))
    if (hasIdKey || fullText.includes('cédula') || fullText.includes('cedula') || fullText.includes('identification')) {
      if (
        fullText.includes('taken') ||
        fullText.includes('ya') ||
        fullText.includes('registrad') ||
        fullText.includes('duplicad') ||
        fullText.includes('unique')
      ) {
        return {
          title: 'Cédula ya registrada',
          description: isReadableSpanishMessage(rawMessage)
            ? rawMessage
            : 'La cédula ingresada ya se encuentra registrada en el sistema. No es posible registrar dos usuarios con la misma cédula.',
          field: 'identification',
        }
      }
      return {
        title: 'Cédula inválida',
        description: isReadableSpanishMessage(rawMessage)
          ? rawMessage
          : 'La cédula ingresada no es válida. Debe tener exactamente 10 dígitos y cumplir con la validación del Registro Civil del Ecuador.',
        field: 'identification',
      }
    }

    // 3. Correo institucional
    const hasEmailKey = errorKeys.some((k) => k.includes('email') || k.includes('correo'))
    if (hasEmailKey || fullText.includes('email') || fullText.includes('correo')) {
      if (
        fullText.includes('taken') ||
        fullText.includes('ya') ||
        fullText.includes('registrad') ||
        fullText.includes('duplicad') ||
        fullText.includes('unique')
      ) {
        return {
          title: 'Correo ya registrado',
          description: isReadableSpanishMessage(rawMessage)
            ? rawMessage
            : 'El correo electrónico institucional ya se encuentra registrado para otra cuenta. Por favor, ingresa una dirección de correo diferente.',
          field: 'email',
        }
      }
      if (
        fullText.includes('ends_with') ||
        fullText.includes('@ueb.edu.ec') ||
        fullText.includes('institucional') ||
        fullText.includes('dominio')
      ) {
        return {
          title: 'Correo institucional requerido',
          description: isReadableSpanishMessage(rawMessage)
            ? rawMessage
            : 'El correo electrónico debe pertenecer al dominio institucional de la Universidad (@ueb.edu.ec).',
          field: 'email',
        }
      }
      return {
        title: 'Correo inválido',
        description: isReadableSpanishMessage(rawMessage) ? rawMessage : 'Por favor, ingresa una dirección de correo electrónico válida.',
        field: 'email',
      }
    }

    // 4. Nombre
    const hasNameKey = errorKeys.some((k) => k === 'name' || k === 'nombre')
    if (hasNameKey || fullText.includes('nombre') || fullText.includes('name')) {
      if (
        fullText.includes('taken') ||
        fullText.includes('ya') ||
        fullText.includes('registrad') ||
        fullText.includes('duplicad') ||
        fullText.includes('unique')
      ) {
        return {
          title: 'Nombre ya registrado',
          description: isReadableSpanishMessage(rawMessage) ? rawMessage : 'Ya existe un registro con este mismo nombre en el sistema.',
          field: 'name',
        }
      }
      if (fullText.includes('regex') || fullText.includes('letras') || fullText.includes('caracteres')) {
        return {
          title: 'Nombre inválido',
          description: isReadableSpanishMessage(rawMessage) ? rawMessage : 'El nombre solo puede contener letras y espacios.',
          field: 'name',
        }
      }
    }

    // 5. Código
    const hasCodeKey = errorKeys.some((k) => k.includes('code') || k.includes('codigo') || k.includes('código'))
    if (hasCodeKey || fullText.includes('code') || fullText.includes('código') || fullText.includes('codigo')) {
      if (
        fullText.includes('taken') ||
        fullText.includes('ya') ||
        fullText.includes('registrad') ||
        fullText.includes('duplicad') ||
        fullText.includes('unique')
      ) {
        return {
          title: 'Código ya registrado',
          description: isReadableSpanishMessage(rawMessage) ? rawMessage : 'Ya existe un registro con este código en el sistema.',
          field: 'code',
        }
      }
    }

    // 6. Carrera
    if (fullText.includes('carrera')) {
      if (fullText.includes('prohibited') || fullText.includes('no se puede cambiar')) {
        return {
          title: 'Carrera no modificable',
          description: 'No es posible cambiar la carrera a la que pertenece este registro.',
          field: 'career_id',
        }
      }
      if (
        fullText.includes('taken') ||
        fullText.includes('ya existe') ||
        fullText.includes('ya ha sido') ||
        fullText.includes('registrad') ||
        fullText.includes('duplicad') ||
        fullText.includes('unique')
      ) {
        return {
          title: 'Carrera ya registrada',
          description: isReadableSpanishMessage(rawMessage)
            ? rawMessage
            : 'Ya existe una carrera con este nombre en el sistema. El nombre de la carrera es único institucionalmente y no puede repetirse en ninguna facultad.',
          field: 'name',
        }
      }
      if (isReadableSpanishMessage(rawMessage)) {
        return {
          title: 'Error en la carrera',
          description: rawMessage,
          field: 'career_id',
        }
      }
    }

    // 7. Contraseña
    const hasPasswordKey = errorKeys.some((k) => k.includes('password') || k.includes('contraseña'))
    if (hasPasswordKey || fullText.includes('password') || fullText.includes('contraseña')) {
      if (fullText.includes('confirmed') || fullText.includes('coincide')) {
        return {
          title: 'Contraseñas no coinciden',
          description: 'La confirmación de la contraseña no coincide con la nueva contraseña.',
          field: 'password',
        }
      }
      if (fullText.includes('min') || fullText.includes('corta') || fullText.includes('caracteres')) {
        return {
          title: 'Contraseña muy corta',
          description: 'La contraseña debe contener al menos 8 caracteres.',
          field: 'password',
        }
      }
    }

    // 8. Regla general para cualquier dato duplicado o restricción de unicidad
    if (
      fullText.includes('taken') ||
      fullText.includes('unique') ||
      fullText.includes('duplicad') ||
      fullText.includes('ya existe') ||
      fullText.includes('ya ha sido')
    ) {
      return {
        title: 'Dato ya registrado',
        description: 'Uno o más datos ingresados ya se encuentran registrados en el sistema y no se pueden repetir.',
      }
    }

    // 9. Traducción de llaves de Laravel que no se hayan traducido
    if (fullText.includes('validation.digits')) {
      return {
        title: 'Cantidad de dígitos incorrecta',
        description: 'Uno de los campos debe tener exactamente 10 dígitos numéricos (como teléfono o cédula).',
      }
    }
    if (fullText.includes('validation.required')) {
      return {
        title: 'Campos requeridos incompletos',
        description: 'Por favor, llena todos los campos obligatorios antes de continuar.',
      }
    }

    // Error de validación 422
    if (error.status === 422) {
      const sanitized = cleanValidationMessage(rawMessage)
      return {
        title: 'Error de validación',
        description: sanitized || 'Por favor, revisa que todos los datos ingresados cumplan los requisitos.',
      }
    }

    // Conflicto 409
    if (error.status === 409) {
      return {
        title: 'Conflicto de información',
        description: rawMessage || 'La información enviada entra en conflicto con un registro existente en el sistema.',
      }
    }

    // Permisos 403
    if (error.status === 403) {
      return {
        title: 'Acceso denegado',
        description: 'No tienes los permisos necesarios para realizar esta acción.',
      }
    }

    return {
      title: 'No se pudo guardar la información',
      description: rawMessage || 'Ocurrió un error inesperado al procesar la solicitud.',
    }
  }

  if (error instanceof Error && error.message) {
    return parseFriendlyString(error.message)
  }

  return {
    title: 'Error de conexión',
    description: 'No fue posible conectar con el servidor. Verifica tu conexión a internet o el estado del backend.',
  }
}

function cleanValidationMessage(msg: string): string {
  if (!msg) return ''
  if (msg.includes('validation.digits')) {
    return 'Debe tener exactamente 10 dígitos numéricos.'
  }
  if (msg.includes('validation.required')) {
    return 'Este campo es obligatorio.'
  }
  if (msg.includes('validation.unique')) {
    return 'Este valor ya se encuentra registrado en el sistema.'
  }
  if (msg.startsWith('validation.')) {
    return 'El formato del campo no es válido.'
  }
  return msg
}

function parseFriendlyString(raw: string): FriendlyErrorInfo {
  const lower = raw.toLowerCase()
  if (lower.includes('phone') || lower.includes('teléfono') || lower.includes('telefono')) {
    if (lower.includes('ya') || lower.includes('taken') || lower.includes('registrad') || lower.includes('duplicad')) {
      return {
        title: 'Teléfono ya registrado',
        description: 'El número de teléfono ingresado ya se encuentra registrado en otra cuenta.',
        field: 'phone',
      }
    }
    return {
      title: 'Teléfono inválido',
      description: 'El número de teléfono debe tener exactamente 10 dígitos numéricos (ejemplo: 0991234567).',
      field: 'phone',
    }
  }
  if (lower.includes('cédula') || lower.includes('cedula') || lower.includes('identification')) {
    if (lower.includes('ya') || lower.includes('taken') || lower.includes('registrad')) {
      return {
        title: 'Cédula ya registrada',
        description: 'La cédula ingresada ya se encuentra registrada en el sistema.',
        field: 'identification',
      }
    }
    return {
      title: 'Cédula inválida',
      description: 'La cédula ingresada no es válida. Debe tener 10 dígitos numéricos y ser una cédula ecuatoriana válida.',
      field: 'identification',
    }
  }
  if (lower.includes('validation.digits')) {
    return {
      title: 'Dígitos incorrectos',
      description: 'El número debe contener exactamente 10 dígitos numéricos.',
    }
  }
  return {
    title: 'Error de validación',
    description: cleanValidationMessage(raw),
  }
}

export interface ErrorModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: ReactNode
  buttonLabel?: string
}

export function ErrorModal({
  open,
  onClose,
  title = 'Dato ya registrado',
  description,
  buttonLabel = 'Entendido',
}: Readonly<ErrorModalProps>) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    if (open) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150">
      {/* Backdrop oscuro con desenfoque suave */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Contenedor Modal de Error */}
      <div
        className="relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col gap-5 overflow-y-auto rounded-2xl border border-rose-200/80 bg-white p-6 shadow-2xl dark:border-rose-950/80 dark:bg-slate-900 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="error-modal-title"
      >
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-200/70 dark:bg-rose-950/50 dark:text-rose-400 dark:ring-rose-900/60">
            <AlertCircleIcon className="size-6" />
          </div>
          <div className="flex flex-1 flex-col gap-1.5 pr-2">
            <h3 id="error-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
              {title}
            </h3>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Cerrar modal de error"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        <div className="flex items-center justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button
            type="button"
            onClick={onClose}
            className="bg-brand-red hover:bg-brand-red/90 text-white font-semibold px-6 shadow-sm"
          >
            {buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
