import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { IconAction } from '@/components/ui/icon-action'
import { addMonths, isoDate, parseIsoDate } from '@/lib/date'
import { cn } from '@/lib/utils'

// Calendario mensual accesible: semana de lunes a domingo, nombres en español,
// cada día es un botón (alcanzable con el teclado) con su fecha completa como nombre.

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
/** Columnas de lunes a domingo: nombre completo (para lectores de pantalla) y abreviado. */
const COLUMNS = [1, 2, 3, 4, 5, 6, 0].map((day) => ({ name: WEEKDAYS[day], short: WEEKDAYS[day].slice(0, 2) }))

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

/** «lunes 28 de septiembre de 2026» */
function dayName(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()]} de ${date.getFullYear()}`
}

/** Semanas del mes "YYYY-MM": cada una con 7 fechas "YYYY-MM-DD" o null fuera del mes. */
function weeks(month: string): (string | null)[][] {
  const first = parseIsoDate(`${month}-01`)
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const offset = (first.getDay() + 6) % 7
  const cells: (string | null)[] = Array.from({ length: offset }, () => null)
  for (let day = 1; day <= days; day++) cells.push(isoDate(new Date(first.getFullYear(), first.getMonth(), day, 12)))
  while (cells.length % 7 !== 0) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7))
}

export function Calendar({
  label,
  defaultMonth,
  minMonth,
  maxMonth,
  today,
  selected,
  isDisabled,
  marked,
  markLabel,
  onSelect,
  onMonthChange,
  className,
}: Readonly<{
  /** Nombre accesible del calendario. */
  label: string
  /** Mes que se muestra al inicio ("YYYY-MM"). */
  defaultMonth: string
  minMonth?: string
  maxMonth?: string
  /** Fecha de hoy ("YYYY-MM-DD"): se señala con `aria-current`. */
  today?: string
  selected?: string | null
  /** Días que no se pueden elegir. */
  isDisabled?: (date: string) => boolean
  /** Días señalados (por ejemplo, con una sesión registrada). */
  marked?: ReadonlySet<string>
  /** Qué significa la marca; se agrega al nombre accesible del día. */
  markLabel?: string
  onSelect: (date: string) => void
  onMonthChange?: (month: string) => void
  className?: string
}>) {
  const [month, setMonth] = useState(defaultMonth)
  const [year, index] = month.split('-').map(Number)
  const title = `${capitalize(MONTHS[index - 1])} de ${year}`

  function go(amount: number) {
    const next = addMonths(month, amount)
    setMonth(next)
    onMonthChange?.(next)
  }

  return (
    <div role="group" aria-label={label} className={cn('flex w-full max-w-xs flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <IconAction label="Mes anterior" icon={ChevronLeftIcon} disabled={minMonth !== undefined && month <= minMonth} onClick={() => go(-1)} />
        <h4 className="text-sm font-semibold" aria-live="polite">{title}</h4>
        <IconAction label="Mes siguiente" icon={ChevronRightIcon} disabled={maxMonth !== undefined && month >= maxMonth} onClick={() => go(1)} />
      </div>
      <table className="w-full border-collapse text-center text-sm">
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.name} scope="col" abbr={column.name} className="pb-1 text-xs font-medium text-muted-foreground">
                {capitalize(column.short)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks(month).map((week, row) => (
            <tr key={row}>
              {week.map((date, column) => {
                if (!date) return <td key={column} />
                const disabled = isDisabled?.(date) ?? false
                const isMarked = marked?.has(date) ?? false
                const isSelected = selected === date
                const name = dayName(parseIsoDate(date)) + (isMarked && markLabel ? `, ${markLabel}` : '')
                return (
                  <td key={column} className="p-0.5">
                    <button
                      type="button"
                      aria-label={name}
                      aria-pressed={isSelected}
                      aria-current={date === today ? 'date' : undefined}
                      disabled={disabled}
                      onClick={() => onSelect(date)}
                      className={cn(
                        'relative inline-flex size-9 items-center justify-center rounded-md tabular-nums transition-colors outline-hidden',
                        'focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:text-muted-foreground/50',
                        !disabled && 'hover:bg-accent hover:text-accent-foreground',
                        date === today && 'font-semibold underline underline-offset-4',
                        isMarked && !isSelected && 'bg-primary/10 text-primary',
                        isSelected && 'bg-button-primary text-button-primary-foreground hover:bg-button-primary/90 hover:text-button-primary-foreground',
                      )}
                    >
                      {Number(date.slice(8))}
                      {isMarked && <span aria-hidden="true" className="absolute bottom-1 size-1 rounded-full bg-current" />}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

