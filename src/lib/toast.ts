import { toast as sonner, type ExternalToast } from 'sonner'

// Toasts del sistema: frases cortas sin punto final, como en sílabos. Se usa en lugar de
// importar `toast` de sonner directamente, para que la regla no dependa de cada pantalla.

type Message = Parameters<typeof sonner>[0]

function clean<T>(text: T): T {
  return (typeof text === 'string' ? text.trim().replace(/\.$/, '') : text) as T
}

function cleanData(data?: ExternalToast): ExternalToast | undefined {
  return data && { ...data, description: clean(data.description) }
}

export const toast = Object.assign((message: Message, data?: ExternalToast) => sonner(clean(message), cleanData(data)), {
  success: (message: Message, data?: ExternalToast) => sonner.success(clean(message), cleanData(data)),
  error: (message: Message, data?: ExternalToast) => sonner.error(clean(message), cleanData(data)),
  info: (message: Message, data?: ExternalToast) => sonner.info(clean(message), cleanData(data)),
  warning: (message: Message, data?: ExternalToast) => sonner.warning(clean(message), cleanData(data)),
  message: (message: Message, data?: ExternalToast) => sonner.message(clean(message), cleanData(data)),
  loading: (message: Message, data?: ExternalToast) => sonner.loading(clean(message), cleanData(data)),
  dismiss: (id?: string | number) => sonner.dismiss(id),
})
