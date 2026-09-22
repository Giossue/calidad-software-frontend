import { useState } from 'react'
import { CheckCircle2Icon, AlertCircleIcon, InfoIcon, XIcon } from 'lucide-react'

export type ToastMessage = {
  id: string
  type: 'success' | 'error' | 'info'
  title: string
  description?: string
}

let toastListener: ((message: ToastMessage) => void) | null = null

export function showToast(type: 'success' | 'error' | 'info', title: string, description?: string) {
  if (toastListener) {
    toastListener({
      id: Math.random().toString(36).substring(2, 9),
      type,
      title,
      description,
    })
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<readonly ToastMessage[]>([])

  useState(() => {
    toastListener = (message) => {
      setToasts((prev) => [...prev, message])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== message.id))
      }, 4000)
    }
  })

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-in slide-in-from-bottom-5 duration-200"
        >
          {toast.type === 'success' && <CheckCircle2Icon className="size-5 shrink-0 text-emerald-500 mt-0.5" />}
          {toast.type === 'error' && <AlertCircleIcon className="size-5 shrink-0 text-rose-500 mt-0.5" />}
          {toast.type === 'info' && <InfoIcon className="size-5 shrink-0 text-blue-500 mt-0.5" />}
          
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">{toast.title}</span>
            {toast.description && (
              <span className="text-xs text-slate-500 dark:text-slate-400">{toast.description}</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
