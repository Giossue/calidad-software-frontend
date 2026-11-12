import { useState, type ReactNode } from 'react'
import { CircleHelpIcon, InfoIcon } from 'lucide-react'
import { Popover } from 'radix-ui'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ZOOM_LEVELS, type ZoomChoice } from './layout'

/**
 * Los botones de zoom de React Flow (mismo aspecto e íconos), con nombres en español. Acercar y
 * alejar pasan al nivel fijo siguiente o anterior; Ajustar vuelve al ancho disponible.
 */
export function CurriculumNavigationControls({ choice, zoom, onChoose, children }: Readonly<{ choice: ZoomChoice; zoom: number; onChoose: (choice: ZoomChoice) => void; children?: ReactNode }>) {
  const larger = ZOOM_LEVELS.find((level) => level > zoom + 0.001) ?? null
  const smaller = [...ZOOM_LEVELS].reverse().find((level) => level < zoom - 0.001) ?? null
  return (
    <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2">
      <div className="react-flow__controls flex [&>button]:border-r [&>button]:border-b-0 [&>button]:border-border [&>button:disabled]:opacity-40" role="group" aria-label="Zoom de la malla">
        <ControlButton label="Acercar la malla" disabled={larger === null} onClick={() => larger !== null && onChoose(larger)}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M32 18.133H18.133V32h-4.266V18.133H0v-4.266h13.867V0h4.266v13.867H32z" /></svg>
        </ControlButton>
        <ControlButton label="Alejar la malla" disabled={smaller === null} onClick={() => smaller !== null && onChoose(smaller)}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 5" aria-hidden="true"><path d="M0 0h32v4.2H0z" /></svg>
        </ControlButton>
        <ControlButton label="Ajustar la malla al ancho disponible" pressed={choice === 'fit'} onClick={() => onChoose('fit')}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 30" aria-hidden="true"><path d="M3.692 4.63c0-.53.4-.938.939-.938h5.215V0H4.708C2.13 0 0 2.054 0 4.63v5.216h3.692V4.631zM27.354 0h-5.2v3.692h5.17c.53 0 .984.4.984.939v5.215H32V4.631A4.624 4.624 0 0 0 27.354 0zm.954 24.83c0 .532-.4.94-.939.94h-5.215v3.768h5.215c2.577 0 4.631-2.13 4.631-4.707v-5.139h-3.692v5.139zm-23.677.94a.919.919 0 0 1-.939-.94v-5.138H0v5.139c0 2.577 2.13 4.707 4.708 4.707h5.138V25.77H4.631z" /></svg>
        </ControlButton>
      </div>
      <Button type="button" variant="tertiary" size="icon-sm" className="bg-card/90" aria-label="Cómo moverse por la malla" tooltip="Usa la rueda o las barras para moverte · Mayús + rueda para ir a los lados">
        <CircleHelpIcon aria-hidden="true" />
      </Button>
      {children}
    </div>
  )
}

function ControlButton({ label, disabled, pressed, onClick, children }: Readonly<{ label: string; disabled?: boolean; pressed?: boolean; onClick: () => void; children: ReactNode }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="react-flow__controls-button" aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** Leyenda y totales: se abren junto a la ayuda para no ocupar espacio al lado de la malla. */
export function CurriculumLegendButton({ rows }: Readonly<{ rows: readonly { id: string; label: string; value: string }[] }>) {
  const [open, setOpen] = useState(false)
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {/* El popover se ancla fuera del tooltip del botón: si el botón fuera a la vez disparador de
          los dos, el popover perdería su referencia. */}
      <Popover.Anchor asChild>
        <span className="inline-flex">
          <Button type="button" variant="tertiary" size="icon-sm" className="bg-card/90" aria-label="Ver leyenda de la malla" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
            <InfoIcon aria-hidden="true" />
          </Button>
        </span>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          aria-label="Leyenda de la malla"
          className="z-50 w-64 rounded-md bg-popover p-3 text-popover-foreground shadow-menu ring-1 ring-surface-ring"
          onInteractOutside={(event) => { if ((event.target as Element | null)?.closest('[aria-label="Ver leyenda de la malla"]')) event.preventDefault() }}
        >
          <CurriculumLegend rows={rows} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function CurriculumLegend({ rows }: Readonly<{ rows: readonly { id: string; label: string; value: string }[] }>) {
  return (
    <div className="flex flex-col gap-2 text-xs">
      <dl className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <dt className="h-0.5 w-5 shrink-0 rounded bg-(--curriculum-prerequisite)" aria-hidden="true" />
          <dd>Previa</dd>
        </div>
      </dl>
      <dl className="flex flex-col gap-1 border-t pt-2">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3">
            <dt className="truncate text-muted-foreground">{row.label}</dt>
            <dd className="font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
