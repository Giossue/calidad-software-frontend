import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export function ErrorNotice({ message, retry }: Readonly<{ message?: string | null; retry?: () => unknown }>) {
  if (!message) return null
  return <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>{message}</span>{retry && <Button type="button" variant="secondary" size="sm" onClick={() => void retry()}>Reintentar</Button>}</AlertDescription></Alert>
}
