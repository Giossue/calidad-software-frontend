export type DegreeSection = 'degree-topics' | 'degree-sections' | 'degree-teachers'

export function canCoordinateDegrees(role?: string): boolean {
  return role === 'administrador' || role === 'coordinador_titulacion'
}

export function isDegreeSection(section?: string): section is DegreeSection {
  return section === 'degree-topics' || section === 'degree-sections' || section === 'degree-teachers'
}
