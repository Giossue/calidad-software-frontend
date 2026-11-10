import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCwIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Si una pantalla falla al dibujarse, muestra un aviso con "Recargar" en lugar de dejar
 * toda la aplicación en blanco.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">No se pudo mostrar esta pantalla</h1>
          <p className="text-sm text-muted-foreground">Recarga la página para continuar. Tus datos guardados no se perdieron.</p>
        </div>
        <Button type="button" onClick={() => window.location.reload()}>
          <RefreshCwIcon data-icon="inline-start" />
          Recargar
        </Button>
      </div>
    )
  }
}
