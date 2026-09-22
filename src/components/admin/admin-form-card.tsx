import type { FormEvent, ReactNode } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function AdminFormCard({ title, description, onSubmit, labelledBy, children }: Readonly<{ title: string; description: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; labelledBy: string; children: ReactNode }>) {
  return <Card>
    <form onSubmit={onSubmit} noValidate aria-labelledby={labelledBy}>
      <CardHeader>
        <CardTitle id={labelledBy}>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </form>
  </Card>
}
