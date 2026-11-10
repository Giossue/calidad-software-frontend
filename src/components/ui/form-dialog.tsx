import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { type FriendlyErrorInfo } from '@/components/ui/error-modal'
import { ErrorNotice } from '@/components/ui/error-notice'
import { FieldDescription, FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// Formularios abiertos: mientras haya uno, los errores se muestran dentro de él y no en un
// toast (que desaparece y deja al usuario sin saber qué corregir).
let openFormDialogs = 0

export function isFormDialogOpen() {
  return openFormDialogs > 0
}

/** Un paso de un formulario largo: su título, una línea de ayuda, qué falta para seguir y sus campos. */
export interface FormStep {
  readonly title: string
  /** Solo si dice algo que los campos no dicen (p. ej. "Déjala en blanco para conservar la actual"). */
  readonly description?: string
  /** Si hay algo pendiente en este paso, "Siguiente" queda bloqueado (motivo en su tooltip). */
  readonly blockReason?: string | null
  /** Nombres de los campos del paso (como los devuelve la API): si el servidor rechaza uno, se vuelve a este paso. */
  readonly fields?: readonly string[]
  readonly content: ReactNode
}

/**
 * Formulario estándar en un modal centrado, con pie fijo (Cancelar + acción).
 * Pide confirmar al cerrar solo si hay cambios (`dirty`) y deja "Guardar" bloqueado cuando:
 *  - no hay cambios (`requireChanges`, activo por defecto), o
 *  - el formulario no es válido (`blockReason`). Los obligatorios ya llevan asterisco, así
 *    que el motivo no se repite en el modal: aparece en el tooltip del botón bloqueado.
 * Un error del servidor se muestra una sola vez, en línea, dentro del modal.
 * `headerActions` son acciones de solo icono junto a la X (p. ej. habilitar/desactivar).
 * Con `steps`, el formulario se divide en pasos (como en sílabos, sin barra de pasos): "Cancelar / Siguiente"
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
  /** Motivo por el que el formulario no es válido; bloquea "Guardar" (motivo en su tooltip). */
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
  useEffect(() => {
    if (!open) return
    openFormDialogs += 1
    return () => {
      openFormDialogs -= 1
    }
  }, [open])
  // Si el servidor rechaza un campo de otro paso, se vuelve a ese paso para corregirlo ahí.
  const errorField = errorModal?.field
  useEffect(() => {
    if (!steps || !errorField || !error) return
    const target = steps.findIndex((item) => item.fields?.includes(errorField))
    if (target >= 0) setStepIndex(target)
  }, [error, errorField, steps])
  const step = steps?.[Math.min(stepIndex, steps.length - 1)]
  const isLastStep = !steps || stepIndex >= steps.length - 1
  const stepReason = step && !isLastStep ? (step.blockReason ?? null) : null

  // El error del servidor se muestra una sola vez: si ya aparece bajo su campo, no se repite
  // en el recuadro; y en cuanto el usuario corrige algo, el recuadro desaparece.
  const formRef = useRef<HTMLFormElement>(null)
  const [shownInline, setShownInline] = useState(false)
  const [editedSinceError, setEditedSinceError] = useState(false)
  useEffect(() => {
    setEditedSinceError(false)
  }, [error])
  useLayoutEffect(() => {
    if (!error) {
      setShownInline(false)
      return
    }
    const inline = [...(formRef.current?.querySelectorAll('[data-slot="field-error"]') ?? [])].some((node) => node.textContent?.includes(error))
    setShownInline(inline)
  })

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
      <form ref={formRef} onSubmit={handleSubmit} onInput={() => { if (error) setEditedSinceError(true) }} onChange={() => { if (error) setEditedSinceError(true) }} aria-label={title} className="flex flex-1 flex-col">
        <fieldset disabled={pending} className="flex flex-1 flex-col">
          <FieldGroup className="flex-1 pb-4">
            {children}
            {step && (
              <FieldSet key={step.title}>
                {/* Los campos ya dicen qué se pide: el título del paso solo para lectores de pantalla. */}
                <FieldLegend className="sr-only">{step.title}</FieldLegend>
                {step.description && <FieldDescription>{step.description}</FieldDescription>}
                <FieldGroup>{step.content}</FieldGroup>
              </FieldSet>
            )}
            <ErrorNotice title={errorModal?.title} message={shownInline || editedSinceError ? null : error} />
          </FieldGroup>
          <div className="sticky -bottom-6 z-10 -mx-6 -mb-6 flex flex-col-reverse gap-2 border-t bg-card p-4 sm:flex-row sm:items-center sm:justify-end">
            {stepIndex > 0 && steps ? (
              <Button type="button" variant="secondary" disabled={pending} onClick={() => setStepIndex((index) => index - 1)}>
                <ArrowLeftIcon data-icon="inline-start" />
                Atrás
              </Button>
            ) : (
              <DialogCancelButton disabled={pending}>Cancelar</DialogCancelButton>
            )}
            {isLastStep ? (
              <BlockedReason key="submit" reason={pending ? null : reason}>
                <Button type="submit" disabled={blocked}>
                  {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <SubmitIcon data-icon="inline-start" />}
                  {pending ? 'Guardando…' : submitLabel}
                </Button>
              </BlockedReason>
            ) : (
              // Clave distinta a la del botón de enviar: si React reutilizara el mismo nodo, el
              // botón pasaría a ser de envío durante el mismo clic y el formulario se enviaría
              // sin mostrar el paso siguiente.
              <BlockedReason key="next" reason={stepReason}>
                <Button type="button" disabled={Boolean(stepReason)} onClick={(event) => { event.preventDefault(); goNext() }}>
                  Siguiente
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </BlockedReason>
            )}
          </div>
        </fieldset>
      </form>
    </Dialog>
  )
}

/**
 * Explica en un tooltip por qué el botón está bloqueado (los obligatorios ya llevan
 * asterisco, así que no se repite en el modal). El contenedor es siempre el mismo para
 * que el botón no se vuelva a montar al bloquearse o desbloquearse.
 */
function BlockedReason({ reason, children }: Readonly<{ reason: string | null; children: ReactNode }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={reason ? 0 : undefined} className="inline-flex rounded-md outline-hidden focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:[&>button]:w-full">
          {children}
        </span>
      </TooltipTrigger>
      {reason && <TooltipContent>{reason}</TooltipContent>}
    </Tooltip>
  )
}
