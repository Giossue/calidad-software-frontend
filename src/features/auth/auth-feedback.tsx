import { AlertCircleIcon, CheckCircle2Icon } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'

export function AuthFeedback({ error, success }: Readonly<{ error?: string | null; success?: string | null }>) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon aria-hidden="true" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (success) {
    return (
      <Alert>
        <CheckCircle2Icon aria-hidden="true" />
        <AlertDescription>{success}</AlertDescription>
      </Alert>
    )
  }

  return null
}
