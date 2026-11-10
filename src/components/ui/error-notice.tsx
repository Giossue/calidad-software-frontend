import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

/** Error en línea: qué pasó (`title`, opcional), el detalle y, si aplica, "Reintentar". */
export function ErrorNotice({ title, message, retry }: Readonly<{ title?: string | null; message?: string | null; retry?: () => unknown }>) {
  if (!message) return null
  return (
    <Alert variant="destructive">
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>{message}</span>
        {retry && <Button type="button" variant="secondary" size="sm" onClick={() => void retry()}>Reintentar</Button>}
      </AlertDescription>
    </Alert>
  )
}
