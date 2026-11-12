import { formatSubjectName } from '@/lib/sanitize'
import type { Subject } from '@/lib/tutoring-api'
import type { CanvasRequirement } from './layout'

/** Ciclo (número) donde se dibuja la asignatura; `null` si no tiene. */
export type CycleOf = (subject: Subject) => number | null

/** Previas de la carrera a partir de la secuencia de cada asignatura (`next_subjects`). */
export function requirementsOf(subjects: readonly Subject[]): CanvasRequirement[] {
  const seen = new Map<string, CanvasRequirement>()
  const add = (source: number, target: number) => {
    const id = `${source}-${target}`
    if (!seen.has(id)) seen.set(id, { id, source: String(source), target: String(target) })
  }
  subjects.forEach((subject) => {
    subject.next_subjects?.forEach((next) => add(subject.id, next.id))
    subject.previous_subjects?.forEach((previous) => add(previous.id, subject.id))
  })
  return [...seen.values()]
}

/**
 * Mismas reglas que el formulario de la secuencia: la previa es de un ciclo anterior y la
 * secuencia no puede volver sobre sí misma. Devuelve el motivo del rechazo o `null`.
 */
export function prerequisiteError(source: Subject, target: Subject, subjects: readonly Subject[], cycleOf: CycleOf): string | null {
  if (source.id === target.id) return 'Una asignatura no puede ser previa de sí misma.'
  const sourceCycle = cycleOf(source)
  const targetCycle = cycleOf(target)
  if (sourceCycle === null || targetCycle === null || sourceCycle >= targetCycle) {
    return 'Una asignatura solo puede tener como previa otra de un ciclo anterior.'
  }
  if ((source.next_subjects ?? []).some((next) => next.id === target.id)) {
    return `«${formatSubjectName(source.name)}» ya es previa de «${formatSubjectName(target.name)}».`
  }
  // ¿La siguiente ya lleva de vuelta a la previa?
  const byId = new Map(subjects.map((subject) => [subject.id, subject]))
  const pending = [target.id]
  const visited = new Set<number>()
  while (pending.length > 0) {
    const current = pending.pop() as number
    if (current === source.id) return `«${formatSubjectName(target.name)}» ya lleva a «${formatSubjectName(source.name)}» en la secuencia; no puede ser su previa.`
    if (visited.has(current)) continue
    visited.add(current)
    pending.push(...(byId.get(current)?.next_subjects ?? []).map((next) => next.id))
  }
  return null
}
