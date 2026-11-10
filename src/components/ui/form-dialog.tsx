import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { type FriendlyErrorInfo } from '@/components/ui/error-modal'
import { ErrorNotice } from '@/components/ui/error-notice'
import { FieldDescription, FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { StepProgress } from '@/components/ui/step-progress'

/** Un paso de un formulario largo: su título, una línea de ayuda, qué falta para seguir y sus campos. */
export interface FormStep {
  readonly title: string
  readonly description?: string
  /** Si hay algo pendiente en este paso, "Siguiente" queda bloqueado y se muestra el motivo. */
  readonly blockReason?: string | null
  readonly content: ReactNode
}

/**
 * Formulario estándar en un modal centrado, con pie fijo (Cancelar + acción).
 * Pide confirmar al cerrar solo si hay cambios (`dirty`) y deja "Guardar" bloqueado cuando:
 *  - no hay cambios (`requireChanges`, activo por defecto), o
 *  - el formulario no es válido (`blockReason`: se muestra junto al botón, no escondido).
 * Un error del servidor se muestra una sola vez, en línea, dentro del modal.
 * `headerActions` son acciones de solo icono junto a la X (p. ej. habilitar/desactivar).
 * Con `steps`, el formulario se divide en pasos (como en sílabos): "Cancelar / Siguiente"
 * en el primero, "Atrás / Siguiente" en los intermedios y "Atrás / acción" en el último.
 */
export function FormDialog({
  open,
  title,
  description,
  pending,
  error,
  errorModal,
  dirty,
  requireChanges = true,
  blockReason = null,
  noChangesReason = 'No hay cambios por guardar.',
  headerActions,
  onClose,
  onSubmit,
  children,
  submitLabel = 'Guardar cambios',
  submitDisabled = false,
  submitIcon: SubmitIcon = CheckIcon,
  maxWidth = 'max-w-xl',
  steps,
}: Readonly<{
  open: boolean
  title: string
  description?: string
  pending: boolean
  error: string | null
  /** Título amigable del error (de `useOperation`); se muestra sobre el detalle. */
  errorModal?: FriendlyErrorInfo | null
  /** Ya no se usa: el error vive en línea y se limpia al volver a enviar. */
  onCloseErrorModal?: () => void
  dirty: boolean
  /** Si es false, "Guardar" no exige cambios (acciones que se confirman sin editar nada). */
  requireChanges?: boolean
  /** Motivo por el que el formulario no es válido; bloquea "Guardar" y se muestra junto al botón. */
  blockReason?: string | null
  noChangesReason?: string
  headerActions?: ReactNode
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  children?: ReactNode
  submitLabel?: string
  submitDisabled?: boolean
  submitIcon?: LucideIcon
  maxWidth?: string
  /** Pasos del formulario; si se indican, `children` va antes de los pasos (p. ej. avisos). */
  steps?: readonly FormStep[]
}>) {
  const [stepIndex, setStepIndex] = useState(0)
  // Cada vez que se abre, el formulario empieza en el primer paso.
  useEffect(() => {
    if (open) setStepIndex(0)
  }, [open])
  const step = steps?.[Math.min(stepIndex, steps.length - 1)]
  const isLastStep = !steps || stepIndex >= steps.length - 1
  const stepReason = step && !isLastStep ? (step.blockReason ?? null) : null

  function goNext() {
    if (steps && !isLastStep && !stepReason) setStepIndex((index) => index + 1)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!isLastStep) {
      // Enter en un paso intermedio avanza en vez de enviar.
      event.preventDefault()
      goNext()
      return
    }
    onSubmit(event)
  }

  const reason = blockReason ?? (requireChanges && !dirty ? noChangesReason : null)
  const blocked = pending || submitDisabled || reason !== null

  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      confirmClose={dirty}
      headerActions={headerActions}
      onClose={() => {
        if (!pending) onClose()
      }}
      maxWidth={maxWidth}
    >
      <form onSubmit={handleSubmit} aria-label={title} className="flex flex-1 flex-col">
        <fieldset disabled={pending} className="flex flex-1 flex-col">
          <FieldGroup className="flex-1 pb-4">
            {steps && steps.length > 1 && (
              <StepProgress label={`Pasos de ${title}`} steps={steps.map((item) => item.title)} current={stepIndex} />
            )}
            {children}
            {step && (
              <FieldSet key={step.title}>
                {/* Con varios pasos el título ya se lee en la barra de pasos: aquí solo para lectores de pantalla. */}
                <FieldLegend className={steps && steps.length > 1 ? 'sr-only' : undefined}>{step.title}</FieldLegend>
                {step.description && <FieldDescription>{step.description}</FieldDescription>}
                <FieldGroup>{step.content}</FieldGroup>
              </FieldSet>
            )}
            <ErrorNotice title={errorModal?.title} message={error} />
          </FieldGroup>
          <div className="sticky -bottom-6 z-10 -mx-6 -mb-6 flex flex-col-reverse gap-2 border-t bg-card p-4 sm:flex-row sm:items-center sm:justify-end">
            {(isLastStep ? blockReason : stepReason) && !pending && (
              <p className="text-sm text-muted-foreground sm:mr-auto">{isLastStep ? blockReason : stepReason}</p>
            )}
            {stepIndex > 0 && steps ? (
              <Button type="button" variant="secondary" disabled={pending} onClick={() => setStepIndex((index) => index - 1)}>
                <ArrowLeftIcon data-icon="inline-start" />
                Atrás
              </Button>
            ) : (
              <DialogCancelButton disabled={pending}>Cancelar</DialogCancelButton>
            )}
            {isLastStep ? (
              <Button type="submit" disabled={blocked}>
                {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <SubmitIcon data-icon="inline-start" />}
                {pending ? 'Guardando…' : submitLabel}
              </Button>
            ) : (
              <Button type="button" disabled={Boolean(stepReason)} onClick={goNext}>
                Siguiente
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            )}
          </div>
        </fieldset>
      </form>
    </Dialog>
  )
}
