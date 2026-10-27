// Etapas académicas (refleja teaching.degree_from_cycle del backend, que es quien las valida):
// los ciclos anteriores reciben tutorías; desde este ciclo, titulación.
export const DEGREE_FROM_CYCLE = 6

export function isDegreeCycleNumber(number: number | null | undefined): boolean {
  return typeof number === 'number' && number >= DEGREE_FROM_CYCLE
}
