import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { api, ApiError } from '@/lib/api'
import { AuthFeedback } from './auth-feedback'
import { AuthShell } from './auth-shell'

export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const id = params.get('id')
  const hash = params.get('hash')
  const expires = params.get('expires')
  const signature = params.get('signature')
  const linkError = !id || !hash || !expires || !signature
    ? 'El enlace de verificación está incompleto.'
    : null

  useEffect(() => {
    if (!id || !hash || !expires || !signature) return

    const query = new URLSearchParams({ expires, signature }).toString()
    api.verifyEmail(id, hash, query)
      .then((response) => setMessage(response.message))
      .catch((caught: unknown) => setError(caught instanceof ApiError ? caught.message : 'No fue posible verificar el correo.'))
  }, [expires, hash, id, signature])

  return (
    <AuthShell title="Verificación de correo" description="Validamos el enlace de tu cuenta.">
      {!message && !error && !linkError && <div className="flex justify-center"><Spinner /></div>}
      <AuthFeedback error={error ?? linkError} success={message} />
      {(message || error || linkError) && <Button asChild><Link to="/">Ir al panel</Link></Button>}
    </AuthShell>
  )
}
