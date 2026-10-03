import { useEffect, type ReactNode } from 'react'
import { AlertCircleIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'

export interface FriendlyErrorInfo {
  title: string
  description: string
  field?: string
}

export function getFriendlyError(error: unknown): FriendlyErrorInfo {
  if (error instanceof ApiError) {
    const rawMessage = error.firstValidationMessage ?? error.message ?? ''
    const lower = rawMessage.toLowerCase()

    // Cédula duplicada
    if (lower.includes('cédula') || lower.includes('cedula') || lower.includes('identification')) {
      if (
        lower.includes('taken') ||
        lower.includes('ya') ||
        lower.includes('registrad') ||
        lower.includes('duplicad') ||
        lower.includes('unique')
      ) {
        return {
          title: 'Cédula ya registrada',
          description:
            'La cédula ingresada ya se encuentra registrada en el sistema. No es posible registrar dos usuarios con la misma cédula.',
          field: 'identification',
        }
      }
    }

    // Correo electrónico duplicado
    if (lower.includes('email') || lower.includes('correo')) {
      if (
        lower.includes('taken') ||
        lower.includes('ya') ||
        lower.includes('registrad') ||
        lower.includes('duplicad') ||
        lower.includes('unique')
      ) {
        return {
          title: 'Correo ya registrado',
          description:
            'El correo electrónico institucional ya se encuentra registrado para otra cuenta. Por favor, ingresa una dirección de correo diferente.',
          field: 'email',
        }
      }
    }

    // Teléfono duplicado
    if (lower.includes('phone') || lower.includes('teléfono') || lower.includes('telefono')) {
      if (
        lower.includes('taken') ||
        lower.includes('ya') ||
        lower.includes('registrad') ||
        lower.includes('duplicad') ||
        lower.includes('unique')
      ) {
        return {
          title: 'Teléfono ya registrado',
          description: 'El número de teléfono ingresado ya se encuentra registrado en otra cuenta.',
          field: 'phone',
        }
      }
    }

    // Carrera duplicada
    if (lower.includes('carrera') && (lower.includes('nombre') || lower.includes('name') || lower.includes('registrad') || lower.includes('ya') || lower.includes('existe'))) {
      if (
        lower.includes('taken') ||
        lower.includes('ya') ||
        lower.includes('registrad') ||
        lower.includes('duplicad') ||
        lower.includes('unique') ||
        lower.includes('existe')
      ) {
        return {
          title: 'Carrera ya registrada',
          description:
            'Ya existe una carrera con este nombre en el sistema. El nombre de la carrera es único institucionalmente y no puede repetirse en ninguna facultad.',
          field: 'name',
        }
      }
    }

    // Nombre duplicado
    if (lower.includes('name') || lower.includes('nombre')) {
      if (
        lower.includes('taken') ||
        lower.includes('ya') ||
        lower.includes('registrad') ||
        lower.includes('duplicad') ||
        lower.includes('unique')
      ) {
        return {
          title: 'Nombre ya registrado',
          description: 'Ya existe un registro con este mismo nombre en el sistema.',
          field: 'name',
        }
      }
    }

    // Código duplicado
    if (lower.includes('code') || lower.includes('código') || lower.includes('codigo')) {
      if (
        lower.includes('taken') ||
        lower.includes('ya') ||
        lower.includes('registrad') ||
        lower.includes('duplicad') ||
        lower.includes('unique')
      ) {
        return {
          title: 'Código ya registrado',
          description: 'Ya existe un registro con este código en el sistema.',
          field: 'code',
        }
      }
    }

    // Regla general para cualquier dato duplicado o restricción de unicidad
    if (
      lower.includes('taken') ||
      lower.includes('unique') ||
      lower.includes('duplicad') ||
      lower.includes('ya existe') ||
      lower.includes('ya ha sido')
    ) {
      return {
        title: 'Dato duplicado',
        description: 'Uno o más datos ingresados ya se encuentran registrados en el sistema y no se pueden repetir.',
      }
    }

    // Error de validación 422
    if (error.status === 422) {
      return {
        title: 'Error de validación',
        description: rawMessage || 'Por favor, revisa que todos los datos ingresados cumplan los requisitos.',
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
    return {
      title: 'Error en la operación',
      description: error.message,
    }
  }

  return {
    title: 'Error de conexión',
    description: 'No fue posible conectar con el servidor. Verifica tu conexión a internet o el estado del backend.',
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
        className="relative z-10 flex w-full max-w-md flex-col gap-5 rounded-2xl border border-rose-200/80 bg-white p-6 shadow-2xl dark:border-rose-950/80 dark:bg-slate-900 animate-in zoom-in-95 duration-150"
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
