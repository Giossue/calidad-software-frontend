// Etapas académicas: "titulación" es el último ciclo (el de número más alto) de cada carrera;
// los ciclos anteriores son de "tutorías". Se calcula en el cliente a partir de la lista de
// ciclos de la carrera que cada pantalla ya recibe, comparando contra el ciclo máximo de esa
// lista. El backend aún no expone este cálculo explícitamente: si la lista disponible en una
// pantalla no incluye todos los ciclos de la carrera (p. ej. excluye ciclos inactivos), el
// resultado puede no coincidir con la regla que valida el servidor.

export function maxCycleNumber(cycles: ReadonlyArray<{ number: number }>): number | null {
  return cycles.length === 0 ? null : Math.max(...cycles.map((cycle) => cycle.number))
}

export function isDegreeCycleNumber(number: number | null | undefined, maxNumber: number | null): boolean {
  return typeof number === 'number' && typeof maxNumber === 'number' && number === maxNumber
}
