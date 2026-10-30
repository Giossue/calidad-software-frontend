import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PrinterIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Piezas comunes de los formatos oficiales de Tutorías Académicas. Las hojas se ven
// como papel también en modo oscuro y se imprimen con los estilos `.print-root`.

export function Sheet({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <section className={cn('report-sheet flex flex-col gap-5 bg-white p-5 text-[13px] leading-snug text-slate-900 sm:p-8', className)}>
      {children}
    </section>
  )
}

export function Letterhead({ title, faculty, career }: Readonly<{ title: string; faculty?: string | null; career?: string | null }>) {
  const showUnit = faculty !== undefined || career !== undefined

  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center gap-3 border-b border-slate-300 pb-3">
        <img src="/ueb-logo.png" alt="Universidad Estatal de Bolívar" className="size-12 object-contain" />
        {showUnit && (
          <div className="flex flex-col gap-0.5">
            <p><span className="font-semibold">FACULTAD:</span> {faculty ?? '—'}</p>
            <p><span className="font-semibold">CARRERA:</span> {career ?? '—'}</p>
          </div>
        )}
      </div>
      <h3 className="text-center text-base font-bold tracking-wide">{title}</h3>
    </header>
  )
}

export function SectionTitle({ children }: Readonly<{ children: ReactNode }>) {
  return <h4 className="font-bold uppercase">{children}</h4>
}

export function Signature({ name, role }: Readonly<{ name: string | null; role: string }>) {
  return (
    <div className="flex min-w-48 flex-1 flex-col items-center gap-1 pt-10 text-center">
      <span className="w-full border-t border-slate-800" />
      <span className="font-medium">{name ?? ' '}</span>
      <span className="text-xs font-semibold uppercase">{role}</span>
    </div>
  )
}

/** Marco gris que rodea la hoja dentro de los diálogos. */
export function SheetFrame({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="rounded-lg border border-border bg-slate-100 p-2 sm:p-4 dark:bg-muted">{children}</div>
}

/**
 * Botón para imprimir o guardar en PDF. El documento se copia fuera de los diálogos
 * (directamente en <body>) para que la hoja de estilos de impresión lo muestre solo a él.
 */
export function PrintReport({ children, disabled = false }: Readonly<{ children: ReactNode; disabled?: boolean }>) {
  return (
    <>
      <Button type="button" variant="secondary" disabled={disabled} onClick={() => window.print()}>
        <PrinterIcon data-icon="inline-start" />
        Imprimir o guardar PDF
      </Button>
      {createPortal(<div className="print-root" aria-hidden="true">{children}</div>, document.body)}
    </>
  )
}
