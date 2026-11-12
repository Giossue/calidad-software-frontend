import type { Career } from '@/lib/api'

type LabeledCareer = Pick<Career, 'id' | 'name' | 'code'>

const normalize = (value: string) => value.trim().toLocaleLowerCase('es')

/**
 * Nombre visible de una carrera en un listado. Cada malla es una carrera con su propio
 * código, así que dos carreras pueden llamarse igual: cuando otra del mismo listado
 * comparte el nombre, se muestra «Nombre · código» para distinguirlas.
 */
export function careerLabel(career: LabeledCareer, careers: readonly LabeledCareer[]): string {
  if (!career.code) return career.name
  const name = normalize(career.name)
  const repeated = careers.some((other) => other.id !== career.id && normalize(other.name) === name)
  return repeated ? `${career.name} · ${career.code}` : career.name
}
