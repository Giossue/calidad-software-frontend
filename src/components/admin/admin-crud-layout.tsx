import type { ReactNode } from 'react'

export function AdminCrudLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="grid items-start gap-6 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.35fr)]">{children}</div>
}
