// Etapas académicas: desde el 6.º ciclo es "titulación" en todas las carreras; los ciclos
// anteriores son de "tutorías". Es la misma regla del servidor (`teaching.degree_from_cycle`
// en `config/teaching.php` del backend): si cambia allí, debe cambiar aquí.

export const DEGREE_FROM_CYCLE = 6

export function maxCycleNumber(cycles: ReadonlyArray<{ number: number }>): number | null {
  return cycles.length === 0 ? null : Math.max(...cycles.map((cycle) => cycle.number))
}

export function isDegreeCycleNumber(number: number | null | undefined): boolean {
  return typeof number === 'number' && number >= DEGREE_FROM_CYCLE
}
